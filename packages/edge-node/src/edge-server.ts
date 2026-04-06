/**
 * edge-server.ts — Express server for Parkly Edge Node
 *
 * Exposes the same capture API surface as Parkly Cloud:
 *   POST /api/gate-reads/alpr
 *   POST /api/gate-reads/rfid
 *   POST /api/gate-reads/sensor
 *
 * But processes everything locally (offline-first).
 * Also exposes edge-specific management endpoints.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import type { EdgeNodeConfig } from './types.js';
import { CaptureAlprBodySchema, CaptureRfidBodySchema, CaptureSensorBodySchema } from './types.js';
import { processAlprCapture, processRfidCapture, processSensorCapture } from './decision-engine.js';
import { BarrierController } from './barrier-controller.js';
import type { SyncService } from './sync-service.js';

type EdgeServerDeps = {
  config: EdgeNodeConfig;
  syncService: SyncService;
  barrierController: BarrierController;
};

function jsonOk(res: Response, data: unknown) {
  res.json({ ok: true, data });
}

function jsonError(res: Response, code: string, message: string, status = 400) {
  res.status(status).json({ ok: false, error: { code, message } });
}

function getOccurredAt(body: { eventTime?: string; timestamp?: string }): Date {
  if (body.eventTime) return new Date(body.eventTime);
  if (body.timestamp) return new Date(body.timestamp);
  return new Date();
}

function createCaptureHandler(
  processFn: (ctx: any, body: any) => any,
  barrier: BarrierController,
) {
  return async (req: Request, res: Response) => {
    const requestId = (req.headers['x-request-id'] as string) ?? `edge-${Date.now()}`;
    const laneCode = (req.body.laneCode as string) ?? (req.body.direction as string);

    try {
      const result = processFn(
        {
          siteCode: req.body.siteCode,
          laneCode,
          direction: req.body.direction,
          deviceCode: req.body.deviceCode,
          occurredAt: getOccurredAt(req.body),
        },
        req.body,
      );

      // If barrier should open — do it
      if (result.barrierDecision === 'OPEN') {
        barrier.openBarrierFireAndForget(laneCode, result.reason);
      }

      // Record the event in outbox for later sync
      // (processFn already saved to SQLite offline_sessions)

      jsonOk(res, {
        requestId,
        sessionId: result.sessionId,
        decision: result.decision,
        reason: result.reason,
        plateCompact: result.plateCompact,
        rfidUid: result.rfidUid,
        ticketNumber: result.ticketNumber,
        barrierDecision: result.barrierDecision,
        offlineMode: true,
        synced: result.syncStatus === 'SYNCED',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[edge-server] Capture error:`, message);
      jsonError(res, 'INTERNAL_ERROR', message, 500);
    }
  };
}

export function createEdgeServer(deps: EdgeServerDeps): ReturnType<typeof express> {
  const app = express();

  app.use(express.json({ limit: '2mb' }));

  // ── Capture endpoints (offline-first) ───────────────────────
  app.post('/api/gate-reads/alpr', createCaptureHandler(processAlprCapture, deps.barrierController));
  app.post('/api/gate-reads/rfid', createCaptureHandler(processRfidCapture, deps.barrierController));
  app.post('/api/gate-reads/sensor', createCaptureHandler(processSensorCapture, deps.barrierController));

  // ── Edge management endpoints ───────────────────────────────

  // Health & status
  app.get('/api/edge/health', (_req, res) => {
    const syncHealth = deps.syncService.getHealth();
    jsonOk(res, {
      nodeId: deps.config.EDGE_NODE_ID,
      siteCode: deps.config.EDGE_SITE_CODE,
      mode: deps.syncService.isOnline() ? 'HYBRID' : 'OFFLINE',
      cloudState: syncHealth.state,
      lastSyncAt: syncHealth.lastSyncAt,
      pendingSessions: syncHealth.pendingSessionCount,
      subscriptionCount: syncHealth.subscriptionCount,
      barrierHealthy: deps.barrierController.isHealthy(),
      uptime: process.uptime(),
    });
  });

  // Trigger manual sync
  app.post('/api/edge/sync', async (_req, res) => {
    try {
      await deps.syncService.pullData();
      await deps.syncService.pushData();
      jsonOk(res, { triggeredAt: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      jsonError(res, 'SYNC_FAILED', message);
    }
  });

  // Get subscription whitelist (debug)
  app.get('/api/edge/subscriptions', async (_req, res) => {
    const { getDb } = await import('./local-db.js');
    const { getSubscriptionCount } = await import('./local-db.js');
    try {
      const db = getDb();
      const subs = db.prepare(
        `SELECT subscription_id, site_code, plate_compact, rfid_uid, vehicle_type, status, valid_until
         FROM subscriptions WHERE site_code = ? AND status = 'ACTIVE' LIMIT 100`,
      ).all(deps.config.EDGE_SITE_CODE);

      jsonOk(res, {
        totalActive: getSubscriptionCount(deps.config.EDGE_SITE_CODE),
        samples: subs,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      jsonError(res, 'DB_ERROR', message);
    }
  });

  // Manual barrier control
  app.post('/api/edge/barrier/:command', async (req: Request, res: Response) => {
    const cmd = req.params.command as 'OPEN' | 'CLOSE' | 'PULSE';
    if (!['OPEN', 'CLOSE', 'PULSE'].includes(cmd)) {
      jsonError(res as Response, 'INVALID_COMMAND', 'Must be OPEN, CLOSE, or PULSE');
      return;
    }

    const laneCode = (req.body.laneCode as string) ?? 'MANUAL';
    let result;

    if (cmd === 'OPEN') result = await deps.barrierController.openBarrier(laneCode, 'MANUAL');
    else if (cmd === 'CLOSE') result = await deps.barrierController.closeBarrier(laneCode);
    else result = await deps.barrierController.pulseBarrier(laneCode);

    jsonOk(res, result);
  });

  // Offline session stats
  app.get('/api/edge/sessions/stats', async (_req, res) => {
    const { getDb } = await import('./local-db.js');
    try {
      const db = getDb();
      const stats = db.prepare(`
        SELECT
          sync_status,
          COUNT(*) as count
        FROM offline_sessions
        WHERE site_code = ?
        GROUP BY sync_status
      `).all(deps.config.EDGE_SITE_CODE);

      jsonOk(res, { stats, siteCode: deps.config.EDGE_SITE_CODE });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      jsonError(res, 'DB_ERROR', message);
    }
  });

  // 404 fallback
  app.use((_req: Request, res: Response) => {
    jsonError(res, 'NOT_FOUND', 'Edge endpoint not found', 404);
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[edge-server] Unhandled error:', err);
    jsonError(res, 'INTERNAL_ERROR', err.message, 500);
  });

  return app;
}
