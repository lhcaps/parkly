/**
 * register-edge-routes.ts — Cloud API routes for Edge Node integration
 *
 * Endpoints:
 *  POST /api/edge/sessions/bulk-sync  — Edge Node pushes offline sessions
 *  POST /api/edge/outbox/*           — Edge Node pushes outbox events
 */

import type { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { ApiError, ok } from '../../../../server/http';
import { config } from '../../../../server/config';

const BulkSyncSessionSchema = z.object({
  localSessionId: z.string().min(1),
  siteCode: z.string().min(1),
  laneCode: z.string().min(1),
  direction: z.enum(['ENTRY', 'EXIT']),
  vehiclePlate: z.string().nullable(),
  plateCompact: z.string().nullable(),
  rfidUid: z.string().nullable(),
  deviceCode: z.string().min(1),
  readType: z.enum(['ALPR', 'RFID', 'SENSOR']),
  status: z.enum(['ACTIVE', 'COMPLETED', 'TIMEOUT']),
  openedAt: z.string().datetime(),
  lastReadAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  barrierDecision: z.string().nullable(),
  decisionReason: z.string().nullable(),
  ticketNumber: z.string().nullable(),
  tariffApplied: z.string().nullable(),
  amountCharged: z.number().nullable(),
});

const BulkSyncPayloadSchema = z.object({
  edgeNodeId: z.string().min(1),
  siteCode: z.string().min(1),
  sessions: z.array(BulkSyncSessionSchema).min(0).max(500),
});

function verifyEdgeApiKey(req: { headers: Record<string, any> }): void {
  const provided = req.headers['x-api-key'];
  const expected = config.apiEdgeSyncKey ?? config.tokens.OPS;

  if (!provided || provided !== expected) {
    throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Invalid Edge API key' });
  }
}

export function registerEdgeRoutes(api: Router) {
  // ── Bulk sync sessions from Edge Node ─────────────────────────
  api.post('/edge/sessions/bulk-sync', async (req, res, next) => {
    try {
      verifyEdgeApiKey(req);

      const parsed = BulkSyncPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });
      }

      const { edgeNodeId, siteCode, sessions } = parsed.data;

      // Resolve site
      const site = await prisma.parkingSites.findUnique({
        where: { site_code: siteCode },
        select: { site_id: true },
      });

      if (!site) {
        throw new ApiError({ code: 'NOT_FOUND', message: `Site not found: ${siteCode}` });
      }

      const results: { localSessionId: string; cloudSessionId: bigint | null; status: string }[] = [];

      for (const session of sessions) {
        try {
          // Try to find existing session by local ID correlation
          const existing = await prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT session_id FROM gate_passage_sessions
            WHERE site_id = ${site.site_id}
              AND lane_id = (
                SELECT lane_id FROM gate_lanes WHERE site_id = ${site.site_id} AND lane_code = ${session.laneCode} LIMIT 1
              )
              AND opened_at = ${new Date(session.openedAt)}
            LIMIT 1
          `);

          if (existing?.length > 0) {
            // Session already exists (network was back during the event) — skip
            results.push({
              localSessionId: session.localSessionId,
              cloudSessionId: BigInt(existing[0].session_id),
              status: 'ALREADY_EXISTS',
            });
            continue;
          }

          // Create session from edge data
          const direction = session.direction === 'ENTRY' ? 'ENTRY' : 'EXIT';
          const status = session.status === 'COMPLETED' ? 'COMPLETED' : session.status === 'TIMEOUT' ? 'TIMEOUT' : 'OPEN';

          await prisma.$executeRaw(Prisma.sql`
            INSERT INTO gate_passage_sessions(
              site_id,
              lane_id,
              direction,
              status,
              opened_at,
              last_read_at,
              closed_at,
              plate_compact,
              rfid_uid,
              presence_active,
              barrier_decision,
              ticket_number,
              tariff_applied,
              amount_charged,
              correlation_id,
              edge_node_id
            ) VALUES (
              ${site.site_id},
              (SELECT lane_id FROM gate_lanes WHERE site_id = ${site.site_id} AND lane_code = ${session.laneCode} LIMIT 1),
              ${direction},
              ${status},
              ${new Date(session.openedAt)},
              ${new Date(session.lastReadAt)},
              ${session.closedAt ? new Date(session.closedAt) : null},
              ${session.plateCompact ?? null},
              ${session.rfidUid ?? null},
              1,
              ${session.barrierDecision ?? null},
              ${session.ticketNumber ?? null},
              ${session.tariffApplied ?? null},
              ${session.amountCharged ?? null},
              ${session.localSessionId},
              ${edgeNodeId}
            )
          `);

          const idRows = await prisma.$queryRaw<any[]>(Prisma.sql`SELECT LAST_INSERT_ID() AS id`);
          const cloudSessionId = idRows[0]?.id ? BigInt(idRows[0].id) : null;

          // Record gate read event
          await prisma.$executeRaw(Prisma.sql`
            INSERT INTO gate_read_events(
              session_id, site_id, lane_id, device_id,
              read_type, direction, occurred_at,
              plate_compact, rfid_uid, source_device_code
            ) VALUES (
              ${cloudSessionId},
              ${site.site_id},
              (SELECT lane_id FROM gate_lanes WHERE site_id = ${site.site_id} AND lane_code = ${session.laneCode} LIMIT 1),
              (SELECT device_id FROM gate_devices WHERE device_code = ${session.deviceCode} AND site_id = ${site.site_id} LIMIT 1),
              ${session.readType},
              ${direction},
              ${new Date(session.openedAt)},
              ${session.plateCompact ?? null},
              ${session.rfidUid ?? null},
              ${session.deviceCode}
            )
          `);

          results.push({
            localSessionId: session.localSessionId,
            cloudSessionId,
            status: 'CREATED',
          });
        } catch (err) {
          const e = err as any;
          if (e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062) {
            results.push({ localSessionId: session.localSessionId, cloudSessionId: null, status: 'DUPLICATE' });
          } else {
            results.push({ localSessionId: session.localSessionId, cloudSessionId: null, status: 'ERROR' });
            console.error(`[edge-sync] Failed to sync session ${session.localSessionId}:`, err);
          }
        }
      }

      res.json(ok(req.id as string, {
        edgeNodeId,
        syncedCount: results.filter((r) => r.status === 'CREATED').length,
        alreadyExists: results.filter((r) => r.status === 'ALREADY_EXISTS').length,
        duplicates: results.filter((r) => r.status === 'DUPLICATE').length,
        errors: results.filter((r) => r.status === 'ERROR').length,
        results,
      }));
    } catch (error) {
      next(error);
    }
  });

  // ── Edge outbox event handler ─────────────────────────────────
  api.post('/edge/outbox/:eventType', async (req, res, next) => {
    try {
      verifyEdgeApiKey(req);

      const eventType = String(req.params.eventType);
      const payload = req.body ?? {};

      // Record in audit trail
      await prisma.auditLog.create({
        data: {
          site_id: null as any,
          actor_type: 'EDGE_NODE',
          actor_id: String(req.headers['x-edge-node-id'] ?? 'unknown'),
          action: `EDGE_OUTBOX_${eventType.toUpperCase()}`,
          resource_type: 'edge_outbox',
          resource_id: null,
          details_json: payload,
          ip_address: String(req.ip ?? 'edge'),
        },
      });

      res.json(ok(req.id as string, { eventType, received: true }));
    } catch (error) {
      next(error);
    }
  });

  // ── Edge health probe ──────────────────────────────────────────
  // Only respond to requests from internal/private network ranges.
  // Prevents edge device health probes from leaking internal service info to public internet.
  api.get('/edge/health', (req, res) => {
    const remoteIp = String(req.ip ?? req.header('x-forwarded-for') ?? '').split(',')[0].trim()
    const isPrivate = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|fc00:|fd00:|fe80:)/.test(remoteIp)
    if (!isPrivate && process.env.NODE_ENV === 'production') {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Edge health probe is only available from internal networks',
        details: {},
      })
      return
    }
    res.json(ok('edge', {
      service: 'parkly-cloud',
      acceptEdgeSync: true,
      timestamp: new Date().toISOString(),
    }))
  })
}
