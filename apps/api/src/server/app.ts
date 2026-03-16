import 'dotenv/config';

import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import swaggerUi from 'swagger-ui-express';
import { createRedisRateLimitStore } from './rate-limit-store';

import { config, type AppRole } from './config';
import { prisma } from '../lib/prisma';
import { closeMongo } from '../lib/mongo';
import { closeRedis, ensureRedisStartupReadiness, getRedisHealth } from '../lib/redis';
import { getObjectStorageHealth } from '../lib/object-storage';

import { ApiError, buildCursorPageInfo, defaultMessageForCode, fail, ok, statusToCode, withCursorPage } from './http';
import { getRequestActor, requireAuth } from './auth';
import { nowTrimMs, simulateVietnamPlate, stringifyBigint } from './utils';

import {
  resolveGateIds,
  resolveSiteIdByCode,
  resolveDeviceIdByCode,
  resolveDefaultSiteCode,
} from '../lib/ids';
import { logGateEvent, mapLegacyEntryEventToSessionFlow, mapLegacyExitEventToSessionFlow } from '../services/event.service';

import { z } from 'zod';
import { createHash, randomUUID as uuidv4 } from 'node:crypto';

import {
  getMetricsDebugSummary,
  getMetricsText,
  registerMetrics,
  setDeviceOfflineCount,
  setOutboxBacklogSize,
  setReviewQueueSize,
} from './metrics';
import {
  AlprPreviewRequestSchema,
  AlprPreviewResponseSchema,
  AlprRecognizeBodySchema,
  AlprRecognizeResponseSchema,
  DevicesListResponseSchema,
  GateEventWriteBodySchema,
  GateEventWriteResponseSchema,
  GatesListResponseSchema,
  LanesListResponseSchema,
  LaneFlowSubmitBodySchema,
  SitesListResponseSchema,
  type DeviceRow,
  type GateRow,
  type LaneRow,
  type SiteRow,
} from '@parkly/contracts';
import { registerGateSessionRoutes } from '../modules/gate/interfaces/http/register-gate-session-routes';
import { registerAuthRoutes } from '../modules/auth/interfaces/http/register-auth-routes';
import { registerGateOpsQueryRoutes } from '../modules/gate/interfaces/http/register-gate-ops-query-routes';
import { assertNoClientCanonicalPlateFields, deriveAuthoritativePlateResult } from './plate-authority';
import { registerGateCaptureRoutes } from '../modules/gate/interfaces/http/register-gate-capture-routes';
import { registerLaneStatusStream } from '../modules/gate/interfaces/sse/register-lane-status-stream';
import { registerDeviceHealthStream } from '../modules/gate/interfaces/sse/register-device-health-stream';
import { registerOutboxStream } from '../modules/gate/interfaces/sse/register-outbox-stream';
import { drainOutboxOnce, listOutbox, requeueOutbox } from './services/outbox.service';
import { recognizeLocalPlate } from './services/local-alpr.service';
import { createMobilePairing, getMobilePairing, invalidateMobilePairing } from './services/mobile-pairing.service';
import { recordDeviceHeartbeat } from '../modules/gate/application/record-device-heartbeat';
import { ingestAlprRead } from '../modules/gate/application/ingest-alpr-read';
import { openOrReuseSessionAndResolve } from '../modules/gate/application/resolve-session';
import { resolveLaneFlowAuthority } from './services/lane-flow-authority';
import { claimIdempotency, markIdempotencyFailed, markIdempotencySucceeded } from './services/idempotency.service';
import { resolveAlprPreviewCached } from './services/alpr-preview-cache';
import { storeUploadedMedia } from './services/media-storage.service';
import { resolveMediaViewById } from './services/media-presign.service';
import { createGateReadMediaRecord, resolveLaneContext } from '../modules/gate/infrastructure/gate-read-events.repo';
import { registerZonePresenceRoutes } from '../modules/presence/interfaces/http/register-zone-presence-routes';
import { registerSpotOccupancyRoutes } from '../modules/reconciliation/interfaces/http/register-spot-occupancy-routes';
import { registerGateIncidentRoutes } from '../modules/incidents/interfaces/http/register-gate-incident-routes';
import { registerIncidentStream } from '../modules/incidents/interfaces/sse/register-incident-stream';
import { runWithAuditContext } from './services/audit-service';
import { registerSubscriptionAdminRoutes } from '../modules/subscriptions/interfaces/http/register-subscription-admin-routes';
import { registerDashboardRoutes } from '../modules/dashboard/interfaces/http/register-dashboard-routes';
import { registerAuditRoutes } from '../modules/audit/interfaces/http/register-audit-routes';
import { parseBigIntCursor, validateOrThrow } from './validation';
import { buildHealthBreakdown } from './health';
import { buildErrorLogPayload, createAccessSummaryMiddleware, createHttpLoggerMiddleware } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var __parklyLastEvents: any[] | undefined;
}

type FeedEvent = {
  ts: number;
  siteCode: string | null;
  deviceCode: string | null;
  laneCode: string | null;
  eventId: string;
  direction: 'ENTRY' | 'EXIT' | null;
  eventTime: string | null;
  licensePlateRaw: string | null;
  plateCompact: string | null;
  plateDisplay: string | null;
  plateValidity: string | null;
  reviewRequired: boolean;
  imageUrl: string | null;
  outboxId: string;
};

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function pickBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toFeedEventFromOutbox(row: { outbox_id: bigint; event_id: bigint; event_time: Date; created_at: Date; payload_json: unknown }): FeedEvent {
  const payload = asRecord(row.payload_json) ?? {};
  const mysql = asRecord(payload.mysql) ?? {};
  const rawPayload = asRecord(payload.raw_payload) ?? {};
  const plateEngine = asRecord(rawPayload.plateEngine) ?? {};

  return {
    ts: row.created_at.getTime(),
    siteCode: pickString(rawPayload.siteCode),
    deviceCode: pickString(rawPayload.deviceCode),
    laneCode: pickString(rawPayload.laneCode),
    eventId: String(row.event_id),
    direction: pickString(mysql.direction) as 'ENTRY' | 'EXIT' | null,
    eventTime: row.event_time.toISOString(),
    licensePlateRaw: pickString(plateEngine.plateRaw) ?? pickString(mysql.license_plate_raw),
    plateCompact: pickString(plateEngine.plateCompact),
    plateDisplay: pickString(plateEngine.plateDisplay),
    plateValidity: pickString(plateEngine.plateValidity),
    reviewRequired: pickBoolean(plateEngine.reviewRequired),
    imageUrl: pickString(mysql.image_url),
    outboxId: String(row.outbox_id),
  };
}
function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function collapseUnderscore(input: string): string {
  return input.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

function deriveGateCodeFromDevice(deviceCode: string): string {
  const normalized = String(deviceCode ?? '').trim().toUpperCase();
  if (!normalized) return '';

  const match = normalized.match(/^(.*?)(ENTRY|EXIT)(.*)$/);
  if (!match) return normalized;

  const prefix = collapseUnderscore(match[1]);
  const suffix = collapseUnderscore(match[3]);
  const raw = [prefix, suffix].filter(Boolean).join('_');
  return collapseUnderscore(raw) || normalized;
}

function buildGateRowsFromLanes(lanes: LaneRow[]): GateRow[] {
  const gateMap = new Map<string, GateRow>();

  for (const lane of lanes) {
    const existing = gateMap.get(lane.gateCode);
    const locationTail = lane.locationHint ? ` Ã‚Â· ${lane.locationHint}` : '';
    if (!existing) {
      gateMap.set(lane.gateCode, {
        siteCode: lane.siteCode,
        gateCode: lane.gateCode,
        label: `${lane.gateCode}${locationTail}`,
        laneCount: 1,
        directions: [lane.direction],
      });
      continue;
    }

    existing.laneCount += 1;
    if (!existing.directions.includes(lane.direction)) existing.directions.push(lane.direction);
  }

  return Array.from(gateMap.values()).sort((a, b) => a.gateCode.localeCompare(b.gateCode));
}

function requestHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex');
}

function idempotencyBusy(scope: string, key: string, status: string): never {
  throw new ApiError({
    code: 'CONFLICT',
    message: 'YÃƒÂªu cÃ¡ÂºÂ§u idempotent Ã„â€˜ang Ã„â€˜Ã†Â°Ã¡Â»Â£c xÃ¡Â»Â­ lÃƒÂ½ hoÃ¡ÂºÂ·c Ã„â€˜ÃƒÂ£ thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i trÃ†Â°Ã¡Â»â€ºc Ã„â€˜ÃƒÂ³',
    details: { scope, idempotencyKey: key, status },
  });
}

function isDbPermissionError(err: unknown): boolean {
  const anyErr = err as any;
  const message = String(anyErr?.message ?? '');
  const code = String(anyErr?.code ?? '');
  const errno = Number(anyErr?.errno ?? 0);

  return (
    errno === 1044 ||
    errno === 1142 ||
    errno === 1143 ||
    code === 'ER_DBACCESS_DENIED_ERROR' ||
    code === 'ER_TABLEACCESS_DENIED_ERROR' ||
    code === 'ER_COLUMNACCESS_DENIED_ERROR' ||
    /access denied/i.test(message) ||
    /command denied to user/i.test(message)
  );
}

function buildMasterDataFromDevices(siteCode: string, devices: Array<any>): { gates: GateRow[]; lanes: LaneRow[] } {
  const laneRows: LaneRow[] = devices.map((d) => {
    const direction = String(d.direction).toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY';
    const gateCode = deriveGateCodeFromDevice(String(d.device_code));
    const locationHint = d.location_hint ? String(d.location_hint) : null;
    return {
      siteCode,
      gateCode,
      laneCode: direction,
      label: `${direction} Ã‚Â· ${String(d.device_code)}`,
      direction,
      deviceCode: String(d.device_code),
      deviceType: String(d.device_type),
      locationHint,
      primaryDeviceCode: String(d.device_code),
    };
  });

  const gates = buildGateRowsFromLanes(laneRows);
  const lanes = laneRows.sort((a, b) => {
    const gateCmp = a.gateCode.localeCompare(b.gateCode);
    if (gateCmp !== 0) return gateCmp;
    return a.direction.localeCompare(b.direction);
  });

  return { gates, lanes };
}

async function getSiteRows(): Promise<SiteRow[]> {
  const rows = await prisma.parking_sites.findMany({
    orderBy: [{ site_code: 'asc' }],
    select: {
      site_code: true,
      name: true,
      timezone: true,
      is_active: true,
    },
  });

  return SitesListResponseSchema.shape.rows.parse(rows.map((row) => ({
    siteCode: row.site_code,
    name: row.name,
    timezone: row.timezone,
    isActive: Boolean(row.is_active),
  })));
}

async function hasGateLaneFoundation(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint | number }>>(`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name IN ('gate_lanes', 'gate_lane_devices')
  `);

  const cnt = Number((rows?.[0] as any)?.cnt ?? 0);
  return cnt >= 2;
}

async function getLatestDeviceRows(siteCode?: string): Promise<DeviceRow[]> {
  if (!(await hasGateLaneFoundation())) {
    const sites = siteCode ? [{ siteCode }] : await getSiteRows();
    const rows: DeviceRow[] = [];

    for (const site of sites) {
      const { devices } = await getSiteDevices(site.siteCode);
      const synthetic = buildMasterDataFromDevices(site.siteCode, devices).lanes;
      for (const lane of synthetic) {
        rows.push({
          siteCode: lane.siteCode,
          gateCode: lane.gateCode,
          laneCode: lane.laneCode,
          laneLabel: lane.label,
          laneStatus: 'ACTIVE',
          deviceCode: lane.deviceCode,
          deviceType: lane.deviceType,
          direction: lane.direction,
          locationHint: lane.locationHint,
          deviceRole: 'PRIMARY',
          isPrimary: true,
          isRequired: true,
          heartbeatStatus: null,
          heartbeatReportedAt: null,
          heartbeatReceivedAt: null,
          heartbeatAgeSeconds: null,
          latencyMs: null,
          firmwareVersion: null,
          ipAddress: null,
        });
      }
    }

    return DevicesListResponseSchema.shape.rows.parse(rows.sort((a, b) => {
      const siteCmp = a.siteCode.localeCompare(b.siteCode);
      if (siteCmp !== 0) return siteCmp;
      const gateCmp = String(a.gateCode ?? '').localeCompare(String(b.gateCode ?? ''));
      if (gateCmp !== 0) return gateCmp;
      const laneCmp = String(a.laneCode ?? '').localeCompare(String(b.laneCode ?? ''));
      if (laneCmp !== 0) return laneCmp;
      return a.deviceCode.localeCompare(b.deviceCode);
    }));
  }

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        ps.site_code AS siteCode,
        gl.gate_code AS gateCode,
        gl.lane_code AS laneCode,
        COALESCE(gl.name, gl.lane_code) AS laneLabel,
        gl.status AS laneStatus,
        gd.device_code AS deviceCode,
        gd.device_type AS deviceType,
        gd.direction AS direction,
        gd.location_hint AS locationHint,
        gld.device_role AS deviceRole,
        COALESCE(gld.is_primary, 0) AS isPrimary,
        COALESCE(gld.is_required, 1) AS isRequired,
        dh.status AS heartbeatStatus,
        dh.reported_at AS heartbeatReportedAt,
        dh.received_at AS heartbeatReceivedAt,
        dh.latency_ms AS latencyMs,
        dh.firmware_version AS firmwareVersion,
        dh.ip_address AS ipAddress
      FROM parking_sites ps
      JOIN gate_devices gd
        ON gd.site_id = ps.site_id
      LEFT JOIN gate_lane_devices gld
        ON gld.device_id = gd.device_id
      LEFT JOIN gate_lanes gl
        ON gl.lane_id = gld.lane_id
      LEFT JOIN device_heartbeats dh
        ON dh.heartbeat_id = (
          SELECT dh2.heartbeat_id
          FROM device_heartbeats dh2
          WHERE dh2.device_id = gd.device_id
          ORDER BY dh2.reported_at DESC, dh2.heartbeat_id DESC
          LIMIT 1
        )
      WHERE (? IS NULL OR ps.site_code = ?)
      ORDER BY
        ps.site_code ASC,
        COALESCE(gl.gate_code, '') ASC,
        COALESCE(gl.sort_order, 999999) ASC,
        COALESCE(gl.lane_code, '') ASC,
        COALESCE(gld.sort_order, 999999) ASC,
        gd.device_code ASC
    `,
    siteCode ?? null,
    siteCode ?? null
  );

  const now = Date.now();
  return DevicesListResponseSchema.shape.rows.parse(rows.map((row: Record<string, unknown>) => {
    const reportedAt = row.heartbeatReportedAt == null ? null : new Date(String(row.heartbeatReportedAt));
    const receivedAt = row.heartbeatReceivedAt == null ? null : new Date(String(row.heartbeatReceivedAt));
    const heartbeatAgeSeconds = reportedAt == null ? null : Math.max(0, Math.trunc((now - reportedAt.getTime()) / 1000));

    return {
      siteCode: String(row.siteCode ?? ''),
      gateCode: row.gateCode == null ? null : String(row.gateCode),
      laneCode: row.laneCode == null ? null : String(row.laneCode),
      laneLabel: row.laneLabel == null ? null : String(row.laneLabel),
      laneStatus: row.laneStatus == null ? null : (String(row.laneStatus) as DeviceRow['laneStatus']),
      deviceCode: String(row.deviceCode ?? ''),
      deviceType: String(row.deviceType ?? ''),
      direction: String(row.direction).toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY',
      locationHint: row.locationHint == null ? null : String(row.locationHint),
      deviceRole: row.deviceRole == null ? null : (String(row.deviceRole) as DeviceRow['deviceRole']),
      isPrimary: Boolean(Number(row.isPrimary ?? 0)),
      isRequired: Boolean(Number(row.isRequired ?? 1)),
      heartbeatStatus: row.heartbeatStatus == null ? null : (String(row.heartbeatStatus) as DeviceRow['heartbeatStatus']),
      heartbeatReportedAt: reportedAt == null ? null : reportedAt.toISOString(),
      heartbeatReceivedAt: receivedAt == null ? null : receivedAt.toISOString(),
      heartbeatAgeSeconds,
      latencyMs: row.latencyMs == null ? null : Number(row.latencyMs),
      firmwareVersion: row.firmwareVersion == null ? null : String(row.firmwareVersion),
      ipAddress: row.ipAddress == null ? null : String(row.ipAddress),
    } as DeviceRow;
  }));
}

async function buildTopology(siteCode: string) {
  const siteRows = await getSiteRows();
  const site = siteRows.find((row) => row.siteCode === siteCode);
  if (!site) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: `KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y site '${siteCode}'`,
      details: { siteCode },
    });
  }

  const master = await getMasterDataFromLanes(siteCode);
  const devices = await getLatestDeviceRows(siteCode);

  if (!master) {
    const fallback = buildMasterDataFromDevices(siteCode, (await getSiteDevices(siteCode)).devices);
    return {
      site,
      gates: fallback.gates.map((gate) => ({
        ...gate,
        lanes: fallback.lanes
          .filter((lane) => lane.gateCode === gate.gateCode)
          .map((lane) => ({
            laneCode: lane.laneCode,
            label: lane.label,
            direction: lane.direction,
            status: lane.status ?? 'ACTIVE',
            sortOrder: lane.sortOrder ?? 0,
            primaryDeviceCode: lane.deviceCode,
            devices: devices.filter((device) => device.gateCode === lane.gateCode && device.laneCode === lane.laneCode),
          })),
      })),
    };
  }

  const laneMetaRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        gl.gate_code AS gateCode,
        gl.lane_code AS laneCode,
        COALESCE(gl.name, gl.lane_code) AS label,
        gl.direction AS direction,
        gl.status AS status,
        gl.sort_order AS sortOrder,
        COALESCE(gd_primary.device_code, gd_fallback.device_code) AS primaryDeviceCode
      FROM gate_lanes gl
      LEFT JOIN gate_lane_devices gld_primary
        ON gld_primary.lane_id = gl.lane_id
       AND gld_primary.is_primary = 1
      LEFT JOIN gate_devices gd_primary
        ON gd_primary.device_id = gld_primary.device_id
      LEFT JOIN gate_devices gd_fallback
        ON gd_fallback.device_id = gl.primary_device_id
      JOIN parking_sites ps
        ON ps.site_id = gl.site_id
      WHERE ps.site_code = ?
      ORDER BY gl.gate_code ASC, gl.sort_order ASC, gl.lane_code ASC
    `,
    siteCode
  );

  const laneMap = new Map<string, any>();
  for (const row of laneMetaRows) {
    laneMap.set(String(row.laneCode ?? ''), {
      laneCode: String(row.laneCode ?? ''),
      label: String(row.label ?? row.laneCode ?? ''),
      direction: String(row.direction).toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY',
      status: String(row.status ?? 'ACTIVE'),
      sortOrder: Number(row.sortOrder ?? 0),
      primaryDeviceCode: row.primaryDeviceCode == null ? null : String(row.primaryDeviceCode),
      devices: devices.filter((device) => device.laneCode === String(row.laneCode ?? '')),
    });
  }

  return {
    site,
    gates: master.gates.map((gate) => ({
      ...gate,
      lanes: master.lanes
        .filter((lane) => lane.gateCode === gate.gateCode)
        .map((lane) => laneMap.get(lane.laneCode) ?? {
          laneCode: lane.laneCode,
          label: lane.label,
          direction: lane.direction,
          status: lane.status ?? 'ACTIVE',
          sortOrder: lane.sortOrder ?? 0,
          primaryDeviceCode: lane.primaryDeviceCode ?? lane.deviceCode,
          devices: devices.filter((device) => device.laneCode === lane.laneCode),
        }),
    })),
  };
}

async function getMasterDataFromLanes(siteCode: string): Promise<{ gates: GateRow[]; lanes: LaneRow[] } | null> {
  if (!(await hasGateLaneFoundation())) return null;

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        ps.site_code AS siteCode,
        gl.gate_code AS gateCode,
        gl.lane_code AS laneCode,
        COALESCE(gl.name, gl.lane_code) AS label,
        gl.direction AS direction,
        COALESCE(gd_primary.device_code, gd_fallback.device_code) AS deviceCode,
        COALESCE(gd_primary.device_type, gd_fallback.device_type) AS deviceType,
        COALESCE(gd_primary.location_hint, gd_fallback.location_hint) AS locationHint,
        gl.status AS status,
        gl.sort_order AS sortOrder,
        COALESCE(gd_primary.device_code, gd_fallback.device_code) AS primaryDeviceCode
      FROM gate_lanes gl
      JOIN parking_sites ps
        ON ps.site_id = gl.site_id
      LEFT JOIN gate_lane_devices gld_primary
        ON gld_primary.lane_id = gl.lane_id
       AND gld_primary.is_primary = 1
      LEFT JOIN gate_devices gd_primary
        ON gd_primary.device_id = gld_primary.device_id
      LEFT JOIN gate_devices gd_fallback
        ON gd_fallback.device_id = gl.primary_device_id
      WHERE ps.site_code = ?
      ORDER BY gl.gate_code ASC, gl.sort_order ASC, gl.lane_code ASC
    `,
    siteCode
  );

  const lanes = LanesListResponseSchema.shape.rows.parse(rows.map((row: Record<string, unknown>) => ({
    siteCode: String(row.siteCode ?? siteCode),
    gateCode: String(row.gateCode ?? ''),
    laneCode: String(row.laneCode ?? ''),
    label: String(row.label ?? row.laneCode ?? ''),
    direction: String(row.direction).toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY',
    deviceCode: String(row.deviceCode ?? ''),
    deviceType: String(row.deviceType ?? ''),
    locationHint: row.locationHint == null ? null : String(row.locationHint),
    status: String(row.status ?? 'ACTIVE'),
    sortOrder: Number(row.sortOrder ?? 0),
    primaryDeviceCode: row.primaryDeviceCode == null ? null : String(row.primaryDeviceCode),
  })));

  return {
    gates: GatesListResponseSchema.shape.rows.parse(buildGateRowsFromLanes(lanes)),
    lanes,
  };
}

async function getSiteDevices(siteCode: string) {
  const siteId = await resolveSiteIdByCode(siteCode);
  const devices = await prisma.gate_devices.findMany({
    where: { site_id: siteId },
    orderBy: [{ device_code: 'asc' }],
    select: {
      device_code: true,
      device_type: true,
      direction: true,
      location_hint: true,
    },
  });

  return { siteId, devices };
}

export async function buildApp() {
  await ensureRedisStartupReadiness();

  const app = express();

  app.use((req, res, next) => {
    const incoming = String(req.header('x-request-id') ?? '').trim();
    const rid = incoming || randomUUID();
    const incomingCorrelation = String(req.header('x-correlation-id') ?? '').trim();
    const correlationId = incomingCorrelation || rid;
    (req as any).id = rid;
    (req as any).correlationId = correlationId;
    res.setHeader('x-request-id', rid);
    res.setHeader('x-correlation-id', correlationId);
    runWithAuditContext({ requestId: rid, correlationId, occurredAt: new Date().toISOString() }, () => next());
  });

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.length ? config.corsOrigins : true,
      credentials: true,
    })
  );
  const sharedRateLimitStore = config.rateLimit.backend === 'REDIS'
    ? createRedisRateLimitStore({
        prefix: config.rateLimit.prefix,
        windowMs: config.rateLimit.windowMs,
      })
    : undefined;

  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      store: sharedRateLimitStore as any,
    })
  );

  app.use(createHttpLoggerMiddleware());
  app.use(createAccessSummaryMiddleware());

  app.use(express.json({ limit: '2mb' }));

  const uploadDirAbs = path.resolve(process.cwd(), config.upload.dir);
  await fs.mkdir(uploadDirAbs, { recursive: true });
  const uploadPrefix = config.upload.publicPath.replace(/\/$/, '') + '/';
  app.use(uploadPrefix, express.static(uploadDirAbs));

  const publicDirAbs = path.resolve(process.cwd(), 'public');
  app.use('/', express.static(publicDirAbs));

  if (process.env.SERVE_WEB === 'ON') {
    const dist = process.env.WEB_DIST_DIR
      ? path.resolve(process.cwd(), process.env.WEB_DIST_DIR)
      : path.resolve(process.cwd(), '..', 'web', 'dist');
    app.use('/', express.static(dist));
  }

  registerMetrics(app);
  app.get('/metrics', async (_req, res, next) => {
    try {
      await refreshBusinessMetrics(undefined);
      await getRedisHealth();
      const text = await getMetricsText();
      res.setHeader('content-type', 'text/plain; version=0.0.4');
      res.send(text);
    } catch (e) {
      next(e);
    }
  });


  const openapi: any = {
    openapi: '3.0.3',
    info: { title: 'Parkly API', version: '4.0.0' },
    servers: [{ url: config.prefix }],
    paths: {
      '/health': { get: { summary: 'health', responses: { '200': { description: 'ok' } } } },
      '/ready': { get: { summary: 'readiness', responses: { '200': { description: 'ready' }, '503': { description: 'not ready' } } } },
      '/me': { get: { summary: 'current role', responses: { '200': { description: 'ok' } } } },
      '/auth/password-policy': {},
      '/auth/login': {},
      '/auth/refresh': {},
      '/auth/logout': {},
      '/auth/revoke-all': {},
      '/auth/admin/users/{userId}/revoke-all': {},
      '/auth/admin/users/{userId}/disable': {},
      '/auth/admin/users/{userId}/enable': {},
      '/auth/me': {},
      '/sites': {},
      '/gates': {},
      '/lanes': {},
      '/gate-events': {},
      '/media/upload': {},
      '/mobile-capture/pair': {},
      '/mobile-capture/revoke': {},
      '/mobile-capture/session': {},
      '/mobile-capture/upload': {},
      '/mobile-capture/heartbeat': {},
      '/mobile-capture/alpr': {},
      '/device-control/heartbeat-pulse': {},
      '/alpr/recognize': {},
      '/stream/gate-events': {},
      '/stream/lane-status': {},
      '/stream/device-health': {},
      '/stream/outbox': {},
      '/ops/lane-status': {},
      '/ops/device-health': {},
      '/ops/dashboard/summary': {},
      '/ops/dashboard/sites/{siteCode}/summary': {},
      '/ops/dashboard/incidents/summary': {},
      '/ops/dashboard/occupancy/summary': {},
      '/ops/dashboard/lanes/summary': {},
      '/ops/dashboard/subscriptions/summary': {},
      '/reports/summary': {},
      '/gate-sessions/open': {},
      '/gate-sessions/resolve': {},
      '/gate-sessions/{sessionId}': {},
      '/gate-sessions': {},
      '/gate-sessions/{sessionId}/confirm-pass': {},
      '/gate-sessions/{sessionId}/cancel': {},
      '/gate-reads/alpr': {},
      '/gate-reads/rfid': {},
      '/gate-reads/sensor': {},
      '/devices/heartbeat': {},
      '/devices': {},
      '/outbox': {},
      '/outbox/drain': {},
      '/outbox/requeue': {},
      '/topology': {},
      '/ops/incidents': {},
      '/ops/incidents/{incidentId}': {},
      '/ops/incidents/{incidentId}/resolve': {},
      '/ops/audit': {},
      '/ops/audit/{auditId}': {},
      '/ops/metrics/summary': {},
      '/admin/subscriptions': {},
      '/admin/subscriptions/{subscriptionId}': {},
      '/admin/subscription-spots': {},
      '/admin/subscription-spots/{subscriptionSpotId}': {},
      '/admin/subscription-vehicles': {},
      '/admin/subscription-vehicles/{subscriptionVehicleId}': {},
      '/stream/incidents': {},
    },
  };
  app.get('/openapi.json', (_req, res) => res.json(openapi));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  const api = express.Router();
  app.use(config.prefix, api);

  async function probeDbHealth() {
    const startedAt = Date.now();
    try {
      await prisma.$queryRawUnsafe('SELECT 1 AS ok');
      return {
        available: true,
        latencyMs: Date.now() - startedAt,
        error: null,
      };
    } catch (error) {
      return {
        available: false,
        latencyMs: Date.now() - startedAt,
        error: String((error as { message?: unknown } | null | undefined)?.message ?? error ?? 'Unknown DB probe failure'),
      };
    }
  }

  async function buildDependencyStatus() {
    return await buildHealthBreakdown({
      probeDb: probeDbHealth,
      getRedisHealth: () => getRedisHealth({ forceRefresh: true }),
      getObjectStorageHealth: () => getObjectStorageHealth({ forceRefresh: true }),
    });
  }

  api.get('/health', async (_req, res, next) => {
    try {
      const rid = (res.req as any).id;
      const payload = await buildDependencyStatus();
      res.json(ok(rid, payload));
    } catch (e) {
      next(e);
    }
  });

  api.get('/ready', async (_req, res, next) => {
    try {
      const rid = (res.req as any).id;
      const payload = await buildDependencyStatus();
      res.status(payload.ready ? 200 : 503).json(ok(rid, payload));
    } catch (e) {
      next(e);
    }
  });

  api.get('/ops/metrics/summary', requireAuth(['ADMIN', 'OPS']), async (req, res, next) => {
    try {
      await refreshBusinessMetrics(undefined);
      const health = await buildDependencyStatus();
      const rid = (req as any).id;
      res.json(ok(rid, {
        correlationId: (req as any).correlationId ?? rid,
        summary: getMetricsDebugSummary(),
        health,
      }));
    } catch (e) {
      next(e);
    }
  });

  api.get('/me', requireAuth(['ADMIN', 'OPS', 'GUARD', 'CASHIER', 'WORKER'] as AppRole[]), (req, res) => {
    const rid = (req as any).id;
    const auth = req.auth!;
    res.json(ok(rid, auth.principalType === 'SERVICE'
      ? { principalType: auth.principalType, role: auth.role, actorLabel: auth.actorLabel, serviceCode: auth.serviceCode }
      : { principalType: auth.principalType, role: auth.role, actorLabel: auth.actorLabel, userId: auth.userId, username: auth.username, sessionId: auth.sessionId, siteScopes: auth.siteScopes }));
  });

  registerAuthRoutes(api);
  registerGateSessionRoutes(api);
  registerGateOpsQueryRoutes(api);
  registerGateCaptureRoutes(api);
  registerLaneStatusStream(api);
  registerDeviceHealthStream(api);
  registerOutboxStream(api);
  registerZonePresenceRoutes(api);
  registerSpotOccupancyRoutes(api);
  registerSubscriptionAdminRoutes(api);
  registerDashboardRoutes(api);
  registerAuditRoutes(api);
  registerGateIncidentRoutes(api);
  registerIncidentStream(api);

  const SiteQuery = z.object({
    includeInactive: z.coerce.boolean().optional(),
  });

  api.get('/sites', requireAuth(['ADMIN', 'OPS', 'GUARD', 'WORKER']), async (req, res, next) => {
    try {
      const parsed = validateOrThrow(SiteQuery, req.query ?? {});

      let rows = await getSiteRows();
      if (!parsed.includeInactive) rows = rows.filter((row) => row.isActive);

      const rid = (req as any).id;
      const data = SitesListResponseSchema.parse({ rows });
      res.json(ok(rid, data));
    } catch (e) {
      next(e);
    }
  });

  const MasterDataQuery = z.object({
    siteCode: z.string().trim().min(1),
  });

  api.get('/gates', requireAuth(['ADMIN', 'OPS', 'GUARD', 'WORKER']), async (req, res, next) => {
    try {
      const parsed = validateOrThrow(MasterDataQuery, req.query ?? {});

      const siteCode = parsed.siteCode;
      const master = await getMasterDataFromLanes(siteCode);
      const gates = master?.gates ?? buildMasterDataFromDevices(siteCode, (await getSiteDevices(siteCode)).devices).gates;

      const rid = (req as any).id;
      const data = GatesListResponseSchema.parse({ siteCode, rows: gates });
      res.json(ok(rid, data));
    } catch (e) {
      next(e);
    }
  });

  api.get('/lanes', requireAuth(['ADMIN', 'OPS', 'GUARD', 'WORKER']), async (req, res, next) => {
    try {
      const parsed = validateOrThrow(MasterDataQuery, req.query ?? {});

      const siteCode = parsed.siteCode;
      const master = await getMasterDataFromLanes(siteCode);
      const lanes = master?.lanes ?? buildMasterDataFromDevices(siteCode, (await getSiteDevices(siteCode)).devices).lanes;

      const rid = (req as any).id;
      const data = LanesListResponseSchema.parse({ siteCode, rows: lanes });
      res.json(ok(rid, data));
    } catch (e) {
      next(e);
    }
  });

  const DeviceListQuery = z.object({
    siteCode: z.string().trim().min(1).optional(),
    heartbeatStatus: z.string().trim().min(1).optional(),
    unassignedOnly: z.coerce.boolean().optional(),
  });

  const OutboxListQuery = z.object({
    siteCode: z.string().trim().min(1).optional(),
    status: z.enum(['PENDING', 'SENT', 'FAILED']).optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
    cursor: z.string().trim().optional(),
  });

  const OutboxDrainBody = z.object({
    limit: z.coerce.number().int().positive().max(200).optional(),
    dryRun: z.coerce.boolean().optional(),
  });

  const OutboxRequeueBody = z.object({
    outboxIds: z.array(z.union([z.string().trim().min(1), z.number().int().positive()])).optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
  });

  function sanitizeOutboxItem(row: any) {
    return stringifyBigint({
      outboxId: row.outbox_id,
      eventId: row.event_id,
      siteId: row.site_id,
      eventTime: row.event_time,
      status: row.status,
      attempts: row.attempts,
      sentAt: row.sent_at,
      nextRetryAt: row.next_retry_at,
      lastError: row.last_error,
      mongoDocId: row.mongo_doc_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      payload: row.payload_json,
    });
  }

  async function refreshBusinessMetrics(siteCode?: string) {
    const degradedThresholdSeconds = Number.isFinite(Number(process.env.GATE_REALTIME_DEVICE_DEGRADED_THRESHOLD_SECONDS ?? process.env.GATE_DECISION_DEVICE_DEGRADED_THRESHOLD_SECONDS ?? '90'))
      ? Number(process.env.GATE_REALTIME_DEVICE_DEGRADED_THRESHOLD_SECONDS ?? process.env.GATE_DECISION_DEVICE_DEGRADED_THRESHOLD_SECONDS ?? '90')
      : 90;
    const offlineThresholdSeconds = Number.isFinite(Number(process.env.GATE_REALTIME_DEVICE_OFFLINE_THRESHOLD_SECONDS ?? process.env.GATE_DECISION_DEVICE_OFFLINE_THRESHOLD_SECONDS ?? '300'))
      ? Number(process.env.GATE_REALTIME_DEVICE_OFFLINE_THRESHOLD_SECONDS ?? process.env.GATE_DECISION_DEVICE_OFFLINE_THRESHOLD_SECONDS ?? '300')
      : 300;

    const reviewRows = await prisma.$queryRawUnsafe<Array<{ siteCode: string | null; count: number }>>(
      `
        SELECT ps.site_code AS siteCode, COUNT(*) AS count
        FROM gate_manual_reviews gmr
        JOIN parking_sites ps
          ON ps.site_id = gmr.site_id
        WHERE gmr.status IN ('OPEN', 'CLAIMED')
          AND (? IS NULL OR ps.site_code = ?)
        GROUP BY ps.site_code
      `,
      siteCode ?? null,
      siteCode ?? null,
    );

    if (siteCode && !reviewRows.some((row) => row.siteCode === siteCode)) {
      setReviewQueueSize({ siteCode, count: 0 });
    }
    for (const row of reviewRows) {
      setReviewQueueSize({ siteCode: row.siteCode ?? siteCode ?? 'UNKNOWN', count: Number((row as any).count ?? 0) });
    }

    const offlineRows = await prisma.$queryRawUnsafe<Array<{ siteCode: string | null; count: number }>>(
      `
        SELECT x.siteCode AS siteCode, SUM(CASE WHEN x.derivedHealth = 'OFFLINE' THEN 1 ELSE 0 END) AS count
        FROM (
          SELECT
            ps.site_code AS siteCode,
            CASE
              WHEN dh.status = 'OFFLINE' THEN 'OFFLINE'
              WHEN dh.reported_at IS NULL THEN 'OFFLINE'
              WHEN TIMESTAMPDIFF(SECOND, dh.reported_at, NOW()) > ? THEN 'OFFLINE'
              WHEN dh.status = 'DEGRADED' THEN 'DEGRADED'
              WHEN TIMESTAMPDIFF(SECOND, dh.reported_at, NOW()) > ? THEN 'DEGRADED'
              ELSE 'ONLINE'
            END AS derivedHealth
          FROM parking_sites ps
          JOIN gate_devices gd
            ON gd.site_id = ps.site_id
          LEFT JOIN device_heartbeats dh
            ON dh.heartbeat_id = (
              SELECT dh2.heartbeat_id
              FROM device_heartbeats dh2
              WHERE dh2.device_id = gd.device_id
              ORDER BY dh2.reported_at DESC, dh2.heartbeat_id DESC
              LIMIT 1
            )
          WHERE (? IS NULL OR ps.site_code = ?)
        ) x
        GROUP BY x.siteCode
      `,
      offlineThresholdSeconds,
      degradedThresholdSeconds,
      siteCode ?? null,
      siteCode ?? null,
    );

    if (siteCode && !offlineRows.some((row) => row.siteCode === siteCode)) {
      setDeviceOfflineCount({ siteCode, count: 0 });
    }
    for (const row of offlineRows) {
      setDeviceOfflineCount({ siteCode: row.siteCode ?? siteCode ?? 'UNKNOWN', count: Number((row as any).count ?? 0) });
    }

    const backlogRows = await prisma.$queryRawUnsafe<Array<{ siteCode: string | null; status: string | null; count: number }>>(
      `
        SELECT ps.site_code AS siteCode, o.status AS status, COUNT(*) AS count
        FROM gate_event_outbox o
        LEFT JOIN parking_sites ps
          ON ps.site_id = o.site_id
        WHERE (? IS NULL OR ps.site_code = ?)
        GROUP BY ps.site_code, o.status
      `,
      siteCode ?? null,
      siteCode ?? null,
    );

    for (const status of ['PENDING', 'SENT', 'FAILED']) {
      if (siteCode && !backlogRows.some((row) => row.siteCode === siteCode && row.status === status)) {
        setOutboxBacklogSize({ siteCode, status, count: 0 });
      }
    }
    for (const row of backlogRows) {
      setOutboxBacklogSize({ siteCode: row.siteCode ?? siteCode ?? 'UNKNOWN', status: row.status ?? 'UNKNOWN', count: Number((row as any).count ?? 0) });
    }
  }

  api.get('/devices', requireAuth(['ADMIN', 'OPS', 'GUARD', 'WORKER']), async (req, res, next) => {
    try {
      const parsed = validateOrThrow(DeviceListQuery, req.query ?? {});

      let rows = await getLatestDeviceRows(parsed.siteCode);
      if (parsed.heartbeatStatus) rows = rows.filter((row) => row.heartbeatStatus === parsed.heartbeatStatus);
      if (parsed.unassignedOnly) rows = rows.filter((row) => !row.laneCode);

      const rid = (req as any).id;
      const data = DevicesListResponseSchema.parse({ siteCode: parsed.siteCode ?? null, rows });
      res.json(ok(rid, data));
    } catch (e) {
      next(e);
    }
  });

  api.get('/topology', requireAuth(['ADMIN', 'OPS', 'GUARD', 'WORKER']), async (req, res, next) => {
    try {
      const parsed = validateOrThrow(MasterDataQuery, req.query ?? {});

      const data = await buildTopology(parsed.siteCode);
      const rid = (req as any).id;
      res.json(ok(rid, { siteCode: parsed.siteCode, ...data }));
    } catch (e) {
      next(e);
    }
  });

  api.get('/outbox', requireAuth(['ADMIN', 'OPS', 'WORKER']), async (req, res, next) => {
    try {
      const parsed = validateOrThrow(OutboxListQuery, req.query ?? {});

      const siteId = parsed.siteCode ? await resolveSiteIdByCode(parsed.siteCode) : undefined;
      const cursor = parseBigIntCursor(parsed.cursor);
      const data = await listOutbox({
        siteId,
        status: parsed.status as any,
        limit: parsed.limit,
        cursor,
      });

      await refreshBusinessMetrics(parsed.siteCode);

      (req as any).log?.info?.({
        requestId: (req as any).id,
        correlationId: (req as any).correlationId,
        siteCode: parsed.siteCode ?? null,
        status: parsed.status ?? null,
        cursor: parsed.cursor ?? null,
        returned: data.items.length,
      }, 'outbox_list');

      const payload = stringifyBigint(withCursorPage(data.items.map(sanitizeOutboxItem), {
        limit: parsed.limit ?? 50,
        nextCursor: data.nextCursor,
        sort: 'outboxId:desc',
      }));

      res.json(ok((req as any).id, payload));
    } catch (e) {
      next(e);
    }
  });

  api.post('/outbox/drain', requireAuth(['ADMIN', 'WORKER']), async (req, res, next) => {
    try {
      const parsed = validateOrThrow(OutboxDrainBody, req.body ?? {});

      const data = await drainOutboxOnce({ limit: parsed.limit, dryRun: parsed.dryRun });
      await refreshBusinessMetrics(undefined);
      (req as any).log?.info?.({
        requestId: (req as any).id,
        correlationId: (req as any).correlationId,
        actor: getRequestActor(req).actorLabel,
        dryRun: Boolean(parsed.dryRun),
        limit: parsed.limit ?? null,
        result: stringifyBigint(data),
      }, 'outbox_drain');
      res.json(ok((req as any).id, stringifyBigint(data)));
    } catch (e) {
      next(e);
    }
  });

  api.post('/outbox/requeue', requireAuth(['ADMIN', 'OPS']), async (req, res, next) => {
    try {
      const parsed = validateOrThrow(OutboxRequeueBody, req.body ?? {});
      const ids = parsed.outboxIds?.map((value) => BigInt(value));
      const changed = await requeueOutbox({ outboxIds: ids, limit: parsed.limit });
      await refreshBusinessMetrics(undefined);
      (req as any).log?.warn?.({
        requestId: (req as any).id,
        correlationId: (req as any).correlationId,
        actor: getRequestActor(req).actorLabel,
        outboxIds: ids?.map((id) => id.toString()) ?? null,
        limit: parsed.limit ?? null,
        changed: changed.changed,
      }, 'outbox_requeue');
      res.json(ok((req as any).id, changed));
    } catch (e) {
      next(e);
    }
  });

  api.post('/gate-events', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req, res, next) => {
    try {
      const body = validateOrThrow(GateEventWriteBodySchema, req.body);
      assertNoClientCanonicalPlateFields(req.body, 'POST /api/gate-events');

      const { siteId, deviceId, siteCode, deviceCode } = await resolveGateIds({
        siteCode: body.siteCode,
        deviceCode: body.deviceCode,
      });

      const eventTime = body.eventTime ? new Date(body.eventTime) : nowTrimMs();
      const laneCode = (body.laneCode ?? body.direction).trim();

      const authoritative = deriveAuthoritativePlateResult({
        surface: 'POST /api/gate-events',
        licensePlateRaw: body.licensePlateRaw ?? (body.simulatePlate ? simulateVietnamPlate() : null),
        alprPlate: body.alprResult?.plate,
      });
      const hasPlate = Boolean(authoritative.effectivePlateRaw);
      const plateCanonical = hasPlate ? authoritative.plate : null;
      const reviewRequired = plateCanonical?.reviewRequired ?? false;
      const rawPayloadBase = asRecord(body.rawPayload) ?? {};
      const persistedRawPayload = {
        ...rawPayloadBase,
        siteCode,
        deviceCode,
        laneCode,
        capturedAt: eventTime.toISOString(),
        alprResult: body.alprResult ?? null,
        plateEngine: {
          authority: 'BACKEND',
          sourcePlateRaw: authoritative.effectivePlateRaw,
          compare: {
            licensePlateRaw: authoritative.compare.licensePlateRaw,
            alprPlate: authoritative.compare.alprPlate,
          },
          ...(plateCanonical ?? {}),
        },
      } as const;

      const result = await logGateEvent({
        siteId,
        deviceId,
        direction: body.direction,
        eventTime,
        idempotencyKey: body.idempotencyKey,
        ticketId: body.ticketId ? BigInt(body.ticketId) : undefined,
        licensePlateRaw: plateCanonical?.plateCompact ?? authoritative.effectivePlateRaw ?? undefined,
        rfidUid: body.rfidUid,
        imageUrl: body.imageUrl,
        rawPayload: persistedRawPayload,
      });

      globalThis.__parklyLastEvents = globalThis.__parklyLastEvents ?? [];
      globalThis.__parklyLastEvents.push({
        ts: Date.now(),
        siteCode,
        deviceCode,
        laneCode,
        eventId: String(result.eventId),
        direction: body.direction,
        eventTime: eventTime.toISOString(),
        licensePlateRaw: plateCanonical?.plateRaw ?? null,
        plateCompact: plateCanonical?.plateCompact ?? null,
        plateDisplay: plateCanonical?.plateDisplay ?? null,
        plateValidity: plateCanonical?.plateValidity ?? null,
        reviewRequired,
        imageUrl: body.imageUrl ?? null,
        outboxId: String(result.outboxId),
      });
      globalThis.__parklyLastEvents = globalThis.__parklyLastEvents.slice(-200);

      let legacyMappedSession: { sessionId: string; status: string; decisionCode: string | null } | null = null;
      if (body.direction === 'ENTRY' || body.direction === 'EXIT') {
        try {
          const mapped = body.direction === 'ENTRY'
            ? await mapLegacyEntryEventToSessionFlow({
                siteCode,
                laneCode,
                deviceCode,
                eventTime,
                idempotencyKey: body.idempotencyKey,
                requestId: `legacy-${body.idempotencyKey}`.slice(0, 64),
                licensePlateRaw: plateCanonical?.plateRaw ?? authoritative.effectivePlateRaw ?? null,
                rfidUid: body.rfidUid ?? null,
                ocrConfidence: body.alprResult?.confidence ?? null,
                rawPayload: persistedRawPayload,
              })
            : await mapLegacyExitEventToSessionFlow({
                siteCode,
                laneCode,
                deviceCode,
                eventTime,
                idempotencyKey: body.idempotencyKey,
                requestId: `legacy-${body.idempotencyKey}`.slice(0, 64),
                licensePlateRaw: plateCanonical?.plateRaw ?? authoritative.effectivePlateRaw ?? null,
                rfidUid: body.rfidUid ?? null,
                ocrConfidence: body.alprResult?.confidence ?? null,
                rawPayload: persistedRawPayload,
              });

          legacyMappedSession = {
            sessionId: String(mapped.session.sessionId),
            status: String(mapped.session.status),
            decisionCode: mapped.decision?.decisionCode ?? null,
          };
        } catch (legacyErr) {
          (req as any).log?.warn?.({
            siteCode,
            laneCode,
            deviceCode,
            direction: body.direction,
            error: legacyErr instanceof Error ? legacyErr.message : String(legacyErr),
          }, body.direction === 'ENTRY' ? 'legacy_entry_adapter_failed' : 'legacy_exit_adapter_failed');
        }
      }

      const responseBody = GateEventWriteResponseSchema.parse(stringifyBigint({
        siteCode,
        deviceCode,
        laneCode,
        ...result,
        changed: result.changed,
        alreadyExists: !result.changed,
        ...(plateCanonical ?? {
          plateRaw: null,
          plateCompact: null,
          plateDisplay: null,
          plateFamily: 'UNKNOWN',
          plateValidity: 'INVALID',
          ocrSubstitutions: [],
          suspiciousFlags: [],
          validationNotes: [],
          reviewRequired: false,
        }),
        reviewRequired,
        plate: plateCanonical,
        mappedSessionId: legacyMappedSession?.sessionId ?? null,
        mappedSessionStatus: legacyMappedSession?.status ?? null,
        mappedDecisionCode: legacyMappedSession?.decisionCode ?? null,
      }));

      const rid = (req as any).id;
      (req as any).log?.info?.({
        requestId: rid,
        correlationId: (req as any).correlationId,
        siteCode,
        laneCode,
        deviceCode,
        direction: body.direction,
        eventId: String(result.eventId),
        outboxId: String(result.outboxId),
        mappedSessionId: legacyMappedSession?.sessionId ?? null,
        mappedDecisionCode: legacyMappedSession?.decisionCode ?? null,
      }, 'legacy_gate_event_write');
      res.json(ok(rid, responseBody));
    } catch (e) {
      next(e);
    }
  });

  const GateEventListQuery = z.object({
    siteCode: z.string().trim().min(1).optional(),
    deviceCode: z.string().trim().min(1).optional(),
    sinceEventId: z.string().trim().optional(),
    sinceTime: z.string().datetime().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
  });

  api.get('/gate-events', requireAuth(['ADMIN', 'OPS', 'GUARD', 'WORKER']), async (req, res, next) => {
    try {
      const parsed = validateOrThrow(GateEventListQuery, req.query ?? {});

      const siteCode = parsed.siteCode ?? (await resolveDefaultSiteCode());
      const siteId = await resolveSiteIdByCode(siteCode);
      const deviceId = parsed.deviceCode
        ? await resolveDeviceIdByCode({ siteId, deviceCode: parsed.deviceCode })
        : undefined;

      const limit = Math.min(200, Math.max(1, parsed.limit ?? 50));

      const where: any = {
        site_id: siteId,
        ...(deviceId ? { device_id: deviceId } : {}),
        ...(parsed.sinceTime ? { event_time: { gte: new Date(parsed.sinceTime) } } : {}),
        ...(parsed.sinceEventId ? { event_id: { gt: BigInt(parsed.sinceEventId) } } : {}),
      };

      const orderBy = parsed.sinceEventId ? { event_id: 'asc' as const } : { event_id: 'desc' as const };

      const rows = await prisma.gate_events.findMany({ where, orderBy, take: limit });

      const deviceMap = new Map<string, string>();
      const devices = await prisma.gate_devices.findMany({ where: { site_id: siteId } });
      for (const d of devices) deviceMap.set(String(d.device_id), d.device_code);

      const items = rows.map((r) => ({
        eventId: String(r.event_id),
        eventTime: r.event_time.toISOString(),
        direction: r.direction,
        deviceId: String(r.device_id),
        deviceCode: deviceMap.get(String(r.device_id)) ?? null,
        rfidUid: r.rfid_uid,
        licensePlateRaw: r.license_plate_raw,
        imageUrl: r.image_url,
        ticketId: r.ticket_id != null ? String(r.ticket_id) : null,
      }));

      const rid = (req as any).id;
      const pageInfo = buildCursorPageInfo({
        limit,
        nextCursor: items.length === limit && items.length > 0 ? items[items.length - 1].eventId : null,
        sort: parsed.sinceEventId ? 'eventId:asc' : 'eventId:desc',
      });
      res.json(ok(rid, { siteCode, rows: items, nextCursor: pageInfo.nextCursor, pageInfo }));
    } catch (e) {
      next(e);
    }
  });

  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: { fileSize: config.upload.maxBytes, files: 1 },
  });

  const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
  function extFromMime(mime: string): string {
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'bin';
  }
  function sha256(buf: Buffer): string {
    return createHash('sha256').update(buf).digest('hex');
  }

  function requestHeader(req: Request, name: string): string | null {
    const value = req.header(name) ?? req.get?.(name) ?? null;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function buildAbsoluteUrl(req: Request, targetPath: string) {
    const proto = String(requestHeader(req, 'x-forwarded-proto') ?? requestHeader(req, 'x-forwarded-scheme') ?? 'http')
      .split(',')[0]
      .trim() || 'http';
    const host = String(requestHeader(req, 'x-forwarded-host') ?? requestHeader(req, 'host') ?? '')
      .split(',')[0]
      .trim();
    const normalizedPath = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
    return host ? `${proto}://${host}${normalizedPath}` : normalizedPath;
  }

  function buildQuickQrUrl(textValue: string) {
    return `https://quickchart.io/qr?size=280&text=${encodeURIComponent(textValue)}`;
  }

  function renderMobileCaptureHtml(pairToken: string) {
    const escapedToken = JSON.stringify(pairToken);
    return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Parkly Mobile Camera</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #070b12; color: #f3f5f7; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 16px; }
    .card { background: #0d1320; border: 1px solid #1e2a3d; border-radius: 16px; padding: 16px; margin-bottom: 16px; }
    .muted { color: #92a0b5; }
    .badge { display: inline-flex; gap: 6px; align-items: center; padding: 6px 10px; border-radius: 999px; background: #101a2a; border: 1px solid #233149; color: #d4deea; font-size: 12px; }
    .stack { display: grid; gap: 12px; }
    .btn { width: 100%; border: 0; border-radius: 12px; background: #f7b027; color: #111; font-weight: 700; padding: 14px 16px; font-size: 16px; }
    .btn.secondary { background: transparent; color: #f3f5f7; border: 1px solid #26354d; }
    .inp { width: 100%; border-radius: 12px; border: 1px solid #22314a; background: #0a101b; color: #f3f5f7; padding: 12px 14px; font-size: 16px; }
    .preview { width: 100%; max-height: 420px; object-fit: contain; border-radius: 14px; border: 1px solid #22314a; background: #05080f; }
    .log { white-space: pre-wrap; word-break: break-word; border-radius: 12px; border: 1px solid #22314a; background: #0a101b; padding: 12px 14px; font-size: 14px; }
    label.file { display: block; border: 1px dashed #354766; border-radius: 16px; padding: 24px 16px; text-align: center; background: #0a101b; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card stack">
      <div>
        <h1 style="margin:0 0 6px;font-size:24px;">Mobile camera as edge device</h1>
        <div class="muted">Ã„ÂiÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i nÃƒÂ y pair trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p vÃƒÂ o lane. KhÃƒÂ´ng cÃ¡ÂºÂ§n device secret Ã¡Â»Å¸ phÃƒÂ­a mobile.</div>
      </div>
      <div id="pairing" class="stack"></div>
    </div>

    <div class="card stack">
      <label class="file">
        <input id="file" type="file" accept="image/*" capture="environment" style="display:none" />
        <div style="font-weight:700;margin-bottom:6px;">ChÃ¡ÂºÂ¡m Ã„â€˜Ã¡Â»Æ’ chÃ¡Â»Â¥p Ã¡ÂºÂ£nh biÃ¡Â»Æ’n sÃ¡Â»â€˜</div>
        <div class="muted">JPG / PNG / WEBP</div>
      </label>
      <img id="preview" class="preview" style="display:none" alt="preview" />
      <input id="plateHint" class="inp" placeholder="Plate hint nÃ¡ÂºÂ¿u OCR local chÃ†Â°a chÃ¡ÂºÂ¯c" />
      <div class="stack" style="grid-template-columns:1fr 1fr;">
        <button id="submitBtn" class="btn">GÃ¡Â»Â­i ALPR capture</button>
        <button id="pulseBtn" class="btn secondary">Pulse heartbeat</button>
      </div>
      <div id="status" class="log">Ã„Âang khÃ¡Â»Å¸i tÃ¡ÂºÂ¡o...</div>
    </div>
  </div>

  <script>
    const pairToken = ${escapedToken};
    const fileInput = document.getElementById('file');
    const preview = document.getElementById('preview');
    const pairingBox = document.getElementById('pairing');
    const statusBox = document.getElementById('status');
    const plateHintInput = document.getElementById('plateHint');
    const submitBtn = document.getElementById('submitBtn');
    const pulseBtn = document.getElementById('pulseBtn');

    function setStatus(message) {
      statusBox.textContent = String(message ?? '');
    }

    async function api(path, init) {
      const response = await fetch(path, init);
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(text || ('HTTP ' + response.status)); }
      if (!response.ok || data.error) {
        const err = data.error || { code: 'HTTP_ERROR', message: 'Request failed' };
        throw new Error((err.code || 'ERROR') + ': ' + (err.message || 'Request failed'));
      }
      return data.data;
    }

    async function loadPairing() {
      const session = await api('/api/mobile-capture/session?pairToken=' + encodeURIComponent(pairToken));
      pairingBox.innerHTML = [
        '<div style="display:flex;flex-wrap:wrap;gap:8px;">',
        '<span class="badge">' + session.siteCode + '</span>',
        '<span class="badge">' + session.laneCode + '</span>',
        '<span class="badge">' + session.deviceCode + '</span>',
        '<span class="badge">' + session.direction + '</span>',
        '</div>',
        '<div class="muted">HÃ¡ÂºÂ¿t hÃ¡ÂºÂ¡n: ' + new Date(session.expiresAt).toLocaleString('vi-VN') + '</div>'
      ].join('');
      await pulseHeartbeat();
      setStatus('Ã„ÂiÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i Ã„â€˜ÃƒÂ£ pair vÃƒÂ o lane. CÃƒÂ³ thÃ¡Â»Æ’ chÃ¡Â»Â¥p Ã¡ÂºÂ£nh vÃƒÂ  gÃ¡Â»Â­i capture.');
    }

    async function pulseHeartbeat() {
      await api('/api/mobile-capture/heartbeat?pairToken=' + encodeURIComponent(pairToken), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ONLINE', latencyMs: 25 })
      });
    }

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        preview.style.display = 'none';
        preview.removeAttribute('src');
        return;
      }
      preview.src = URL.createObjectURL(file);
      preview.style.display = 'block';
    });

    document.querySelector('label.file').addEventListener('click', () => fileInput.click());

    submitBtn.addEventListener('click', async () => {
      const file = fileInput.files && fileInput.files[0];
      const plateHint = plateHintInput.value.trim();
      if (!file && !plateHint) {
        setStatus('CÃ¡ÂºÂ§n Ã¡ÂºÂ£nh hoÃ¡ÂºÂ·c plate hint trÃ†Â°Ã¡Â»â€ºc khi gÃ¡Â»Â­i.');
        return;
      }
      submitBtn.disabled = true;
      try {
        setStatus('Ã„Âang upload Ã¡ÂºÂ£nh vÃƒÂ  gÃ¡Â»Â­i ALPR capture...');
        let imageUrl = undefined;
        let mediaId = undefined;
        if (file) {
          const fd = new FormData();
          fd.append('file', file);
          const uploadRes = await fetch('/api/mobile-capture/upload?pairToken=' + encodeURIComponent(pairToken), { method: 'POST', body: fd });
          const uploadText = await uploadRes.text();
          let uploadJson;
          try { uploadJson = JSON.parse(uploadText); } catch { throw new Error(uploadText || ('HTTP ' + uploadRes.status)); }
          if (!uploadRes.ok || uploadJson.error) {
            const err = uploadJson.error || { code: 'UPLOAD_ERROR', message: 'Upload failed' };
            throw new Error((err.code || 'ERROR') + ': ' + (err.message || 'Upload failed'));
          }
          imageUrl = uploadJson.data.imageUrl;
          mediaId = uploadJson.data.mediaId;
        }
        const result = await api('/api/mobile-capture/alpr?pairToken=' + encodeURIComponent(pairToken), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl, mediaId, plateHint: plateHint || undefined })
        });
        await pulseHeartbeat();
        const plate = result.capture?.plate?.plateDisplay || result.recognition?.plate?.plateDisplay || result.recognition?.recognizedPlate || 'OK';
        setStatus('Ã„ÂÃƒÂ£ gÃ¡Â»Â­i capture thÃƒÂ nh cÃƒÂ´ng. BiÃ¡Â»Æ’n sÃ¡Â»â€˜: ' + plate + '\nSession: ' + (result.capture?.sessionId || 'n/a'));
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      } finally {
        submitBtn.disabled = false;
      }
    });

    pulseBtn.addEventListener('click', async () => {
      pulseBtn.disabled = true;
      try {
        await pulseHeartbeat();
        setStatus('Ã„ÂÃƒÂ£ pulse heartbeat ONLINE cho mobile camera.');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      } finally {
        pulseBtn.disabled = false;
      }
    });

    loadPairing().catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
    window.setInterval(() => { pulseHeartbeat().catch(() => void 0); }, 15000);
  </script>
</body>
</html>`;
  }

  api.post('/media/upload', requireAuth(['ADMIN', 'OPS', 'GUARD']), upload.single('file'), async (req, res, next) => {
    try {
      const f = (req as any).file as Express.Multer.File | undefined;
      if (!f) throw new ApiError({ code: 'BAD_REQUEST', message: 'Missing multipart file (field name: file)' });

      const mime = String(f.mimetype ?? '').trim();
      if (!ALLOWED_MIME.has(mime)) {
        throw new ApiError({
          code: 'BAD_REQUEST',
          message: 'Unsupported mime type',
          details: { allowed: Array.from(ALLOWED_MIME), got: mime },
        });
      }

      const stored = await storeUploadedMedia({
        buffer: f.buffer,
        mimeType: mime,
        originalName: f.originalname ?? null,
        metadata: {
          surface: 'POST /api/media/upload',
        },
      });

      const rid = (req as any).id;
      res.json(
        ok(rid, {
          imageUrl: stored.viewUrl ?? stored.mediaUrl,
          viewUrl: stored.viewUrl ?? stored.mediaUrl,
          filePath: stored.filePath,
          filename: stored.filename,
          originalName: stored.originalName,
          size: stored.sizeBytes,
          mime: stored.mimeType,
          sha256: stored.sha256,
          storageKind: stored.storageKind,
          storageProvider: stored.storageProvider,
          bucketName: stored.bucketName,
          objectKey: stored.objectKey,
          objectEtag: stored.objectEtag,
          widthPx: stored.widthPx,
          heightPx: stored.heightPx,
        })
      );
    } catch (e) {
      next(e);
    }
  });


  app.get('/mobile-capture', async (req, res, next) => {
    try {
      const pairToken = String((req.query as any)?.pairToken ?? '').trim();
      if (!pairToken) {
        throw new ApiError({ code: 'BAD_REQUEST', message: 'ThiÃ¡ÂºÂ¿u pairToken Ã„â€˜Ã¡Â»Æ’ mÃ¡Â»Å¸ mobile capture surface' });
      }
      const pairing = await getMobilePairing(pairToken);
      if (!pairing) {
        throw new ApiError({ code: 'NOT_FOUND', message: 'Pair token mobile camera khÃƒÂ´ng cÃƒÂ²n hiÃ¡Â»â€¡u lÃ¡Â»Â±c hoÃ¡ÂºÂ·c khÃƒÂ´ng tÃ¡Â»â€œn tÃ¡ÂºÂ¡i' });
      }
      res.type('html').send(renderMobileCaptureHtml(pairToken));
    } catch (e) {
      next(e);
    }
  });

  api.get('/mobile-capture/session', async (req, res, next) => {
    try {
      const pairToken = String((req.query as any)?.pairToken ?? '').trim();
      const pairing = await getMobilePairing(pairToken);
      if (!pairing) {
        throw new ApiError({ code: 'NOT_FOUND', message: 'Pair token mobile camera khÃƒÂ´ng cÃƒÂ²n hiÃ¡Â»â€¡u lÃ¡Â»Â±c hoÃ¡ÂºÂ·c khÃƒÂ´ng tÃ¡Â»â€œn tÃ¡ÂºÂ¡i' });
      }
      const rid = (req as any).id;
      res.json(ok(rid, pairing));
    } catch (e) {
      next(e);
    }
  });

  api.post('/mobile-capture/pair', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req, res, next) => {
    try {
      const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body as Record<string, unknown> : {};
      const siteCode = String(body.siteCode ?? '').trim();
      const laneCode = String(body.laneCode ?? '').trim();
      const deviceCode = String(body.deviceCode ?? '').trim();
      const direction = String(body.direction ?? 'ENTRY').trim().toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY';

      if (!siteCode || !laneCode || !deviceCode) {
        throw new ApiError({ code: 'BAD_REQUEST', message: 'siteCode, laneCode vÃƒÂ  deviceCode lÃƒÂ  bÃ¡ÂºÂ¯t buÃ¡Â»â„¢c Ã„â€˜Ã¡Â»Æ’ pair mobile camera' });
      }

      const pairing = await createMobilePairing({ siteCode, laneCode, direction, deviceCode });
      const mobileUrl = buildAbsoluteUrl(req, `/mobile-capture?pairToken=${encodeURIComponent(pairing.pairToken)}`);
      const qrUrl = buildQuickQrUrl(mobileUrl);
      const rid = (req as any).id;
      res.json(ok(rid, { ...pairing, mobileUrl, qrUrl }));
    } catch (e) {
      next(e);
    }
  });


  api.post('/mobile-capture/revoke', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req, res, next) => {
    try {
      const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body as Record<string, unknown> : {};
      const pairToken = String(body.pairToken ?? '').trim();

      if (!pairToken) {
        throw new ApiError({ code: 'BAD_REQUEST', message: 'Missing pairToken to revoke mobile capture session' });
      }

      const revoked = await invalidateMobilePairing(pairToken, { reason: 'manual-admin-revoke' });
      if (!revoked.revoked) {
        throw new ApiError({ code: 'NOT_FOUND', message: 'Mobile capture pair token is not active or does not exist' });
      }

      const rid = (req as any).id;
      res.json(ok(rid, revoked));
    } catch (e) {
      next(e);
    }
  });

  api.post('/mobile-capture/upload', upload.single('file'), async (req, res, next) => {
    try {
      const pairToken = String((req.query as any)?.pairToken ?? '').trim();
      const pairing = await getMobilePairing(pairToken);
      if (!pairing) {
        throw new ApiError({ code: 'NOT_FOUND', message: 'Pair token mobile camera khÃƒÂ´ng hÃ¡Â»Â£p lÃ¡Â»â€¡' });
      }

      const f = (req as any).file as Express.Multer.File | undefined;
      if (!f) throw new ApiError({ code: 'BAD_REQUEST', message: 'Missing multipart file (field name: file)' });

      const mime = String(f.mimetype ?? '').trim();
      if (!ALLOWED_MIME.has(mime)) {
        throw new ApiError({ code: 'BAD_REQUEST', message: 'Unsupported mime type', details: { allowed: Array.from(ALLOWED_MIME), got: mime } });
      }

      const laneContext = await resolveLaneContext({
        siteCode: pairing.siteCode,
        laneCode: pairing.laneCode,
        deviceCode: pairing.deviceCode,
        expectedDirection: pairing.direction,
      });

      const stored = await storeUploadedMedia({
        buffer: f.buffer,
        mimeType: mime,
        originalName: f.originalname ?? null,
        siteCode: pairing.siteCode,
        laneCode: pairing.laneCode,
        deviceCode: pairing.deviceCode,
        capturedAt: new Date(),
        metadata: {
          source: 'MOBILE_CAPTURE_PAIR',
          pairToken: pairing.pairToken,
        },
      });

      const mediaId = await createGateReadMediaRecord({
        siteId: laneContext.siteId,
        laneId: laneContext.laneId,
        deviceId: laneContext.deviceId,
        media: {
          storageKind: stored.storageKind,
          storageProvider: stored.storageProvider,
          mediaUrl: stored.mediaUrl,
          filePath: stored.filePath,
          bucketName: stored.bucketName,
          objectKey: stored.objectKey,
          objectEtag: stored.objectEtag,
          mimeType: stored.mimeType,
          sha256: stored.sha256,
          widthPx: stored.widthPx,
          heightPx: stored.heightPx,
          metadataJson: stored.metadataJson,
          capturedAt: new Date(),
        },
      });

      const view = await resolveMediaViewById(String(mediaId));

      const rid = (req as any).id;
      res.json(ok(rid, {
        pairing,
        mediaId: String(mediaId),
        imageUrl: view?.viewUrl ?? stored.viewUrl ?? stored.mediaUrl,
        viewUrl: view?.viewUrl ?? stored.viewUrl ?? stored.mediaUrl,
        expiresAt: view?.expiresAt ?? null,
        filePath: stored.filePath,
        filename: stored.filename,
        originalName: stored.originalName,
        size: stored.sizeBytes,
        mime: stored.mimeType,
        sha256: stored.sha256,
        storageKind: stored.storageKind,
        storageProvider: stored.storageProvider,
        bucketName: stored.bucketName,
        objectKey: stored.objectKey,
        objectEtag: stored.objectEtag,
        widthPx: stored.widthPx,
        heightPx: stored.heightPx,
      }));
    } catch (e) {
      next(e);
    }
  });

  api.post('/mobile-capture/heartbeat', async (req, res, next) => {
    try {
      const pairToken = String((req.query as any)?.pairToken ?? '').trim();
      const pairing = await getMobilePairing(pairToken);
      if (!pairing) {
        throw new ApiError({ code: 'NOT_FOUND', message: 'Pair token mobile camera khÃƒÂ´ng hÃ¡Â»Â£p lÃ¡Â»â€¡' });
      }
      const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body as Record<string, unknown> : {};
      const status = String(body.status ?? 'ONLINE').trim().toUpperCase();
      const result = await recordDeviceHeartbeat({
        requestId: `mobile-hb:${randomUUID()}`,
        idempotencyKey: `mobile-hb:${Date.now()}:${pairing.deviceCode}`,
        siteCode: pairing.siteCode,
        deviceCode: pairing.deviceCode,
        reportedAt: new Date(),
        status: status === 'DEGRADED' ? 'DEGRADED' : status === 'OFFLINE' ? 'OFFLINE' : 'ONLINE',
        latencyMs: Number(body.latencyMs ?? 25) || 25,
        firmwareVersion: 'mobile-web-camera',
        ipAddress: req.ip,
        rawPayload: {
          source: 'MOBILE_CAPTURE_PAIR',
          laneCode: pairing.laneCode,
          pairToken: pairing.pairToken,
        },
      });
      const rid = (req as any).id;
      res.json(ok(rid, { pairing, heartbeat: result }));
    } catch (e) {
      next(e);
    }
  });

  api.post('/mobile-capture/alpr', async (req, res, next) => {
    try {
      const pairToken = String((req.query as any)?.pairToken ?? '').trim();
      const pairing = await getMobilePairing(pairToken);
      if (!pairing) {
        throw new ApiError({ code: 'NOT_FOUND', message: 'Pair token mobile camera khÃƒÂ´ng hÃ¡Â»Â£p lÃ¡Â»â€¡' });
      }
      const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body as Record<string, unknown> : {};
      const mediaId = body.mediaId == null ? null : String(body.mediaId).trim();
      const mediaView = mediaId ? await resolveMediaViewById(mediaId).catch(() => null) : null;
      const imageUrl = typeof body.imageUrl === 'string' && body.imageUrl.trim()
        ? body.imageUrl
        : mediaView?.viewUrl ?? null;

      const recognition = await recognizeLocalPlate({
        imageUrl,
        plateHint: typeof body.plateHint === 'string' ? body.plateHint : null,
      });

      const capture = await ingestAlprRead({
        requestId: `mobile-alpr:${randomUUID()}`,
        idempotencyKey: `mobile-alpr:${Date.now()}:${pairing.deviceCode}`,
        siteCode: pairing.siteCode,
        laneCode: pairing.laneCode,
        deviceCode: pairing.deviceCode,
        direction: pairing.direction,
        occurredAt: new Date(),
        plateRaw: recognition.recognizedPlate,
        imageUrl: imageUrl ?? undefined,
        sourceMediaId: mediaId ?? undefined,
        ocrConfidence: recognition.confidence,
        rawPayload: {
          source: 'MOBILE_CAPTURE_PAIR',
          pairToken: pairing.pairToken,
          mediaId,
          imagePath: recognition.imagePath,
          rawOcrText: recognition.rawText,
          originalFilename: recognition.originalFilename,
        },
      });
      const rid = (req as any).id;
      res.json(ok(rid, { pairing, mediaId, viewUrl: mediaView?.viewUrl ?? imageUrl, recognition, capture }));
    } catch (e) {
      next(e);
    }
  });

  api.post('/device-control/heartbeat-pulse', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req, res, next) => {
    try {
      const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body as Record<string, unknown> : {};
      const siteCode = String(body.siteCode ?? '').trim();
      const deviceCode = String(body.deviceCode ?? '').trim();
      const status = String(body.status ?? 'ONLINE').trim().toUpperCase();
      if (!siteCode || !deviceCode) {
        throw new ApiError({ code: 'BAD_REQUEST', message: 'siteCode vÃƒÂ  deviceCode lÃƒÂ  bÃ¡ÂºÂ¯t buÃ¡Â»â„¢c Ã„â€˜Ã¡Â»Æ’ pulse heartbeat' });
      }
      const result = await recordDeviceHeartbeat({
        requestId: `manual-pulse:${randomUUID()}`,
        idempotencyKey: `manual-pulse:${Date.now()}:${deviceCode}`,
        siteCode,
        deviceCode,
        reportedAt: new Date(),
        status: status === 'DEGRADED' ? 'DEGRADED' : status === 'OFFLINE' ? 'OFFLINE' : 'ONLINE',
        latencyMs: Number(body.latencyMs ?? 25) || 25,
        firmwareVersion: 'manual-pulse',
        ipAddress: req.ip,
        rawPayload: {
          source: 'MANUAL_DEVICE_CONTROL',
          laneCode: body.laneCode ?? null,
        },
      });
      const rid = (req as any).id;
      res.json(ok(rid, result));
    } catch (e) {
      next(e);
    }
  });

  const handleAlprPreview = async (
    surface: 'POST /api/alpr/preview' | 'POST /api/alpr/recognize',
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requestSchema = surface === 'POST /api/alpr/preview' ? AlprPreviewRequestSchema : AlprRecognizeBodySchema;
      const responseSchema = surface === 'POST /api/alpr/preview' ? AlprPreviewResponseSchema : AlprRecognizeResponseSchema;
      const parsed = validateOrThrow(requestSchema as any, req.body);

      if (!parsed.plateHint?.trim() && !parsed.imageUrl?.trim()) {
        throw new ApiError({
          code: 'BAD_REQUEST',
          message: 'Cáº§n imageUrl hoáº·c plateHint Ä‘á»ƒ nháº­n diá»‡n biá»ƒn sá»‘. Backend khÃ´ng cÃ²n tá»± sinh biá»ƒn sá»‘ fallback khi Ä‘á»ƒ trá»‘ng.',
        });
      }

      const rawBody = (req.body && typeof req.body === 'object' && !Array.isArray(req.body))
        ? req.body as Record<string, unknown>
        : {};

      const cached = await resolveAlprPreviewCached(
        {
          surface,
          siteCode: String(rawBody.siteCode ?? req.header('x-site-code') ?? '').trim() || null,
          laneCode: String(rawBody.laneCode ?? req.header('x-lane-code') ?? '').trim() || null,
          imageUrl: parsed.imageUrl ?? null,
          plateHint: parsed.plateHint ?? null,
        },
        async () => {
          const recognition = await recognizeLocalPlate({
            imageUrl: parsed.imageUrl ?? null,
            plateHint: parsed.plateHint ?? null,
          });

          const diagnostics = {
            mode: recognition.source,
            imageUrl: parsed.imageUrl ?? null,
            imagePath: recognition.imagePath,
            rawText: recognition.rawText,
            originalFilename: recognition.originalFilename,
            attempts: recognition.attempts,
            failureReason: recognition.failureReason,
            cacheHit: recognition.cacheHit,
            latencyMs: recognition.latencyMs,
            authoritative: 'BACKEND',
            providerTrace: recognition.providerTrace,
          };

          const isPreviewSurface = surface === 'POST /api/alpr/preview';
          const hasUsableRecognition =
            Boolean(recognition.recognizedPlate)
            && recognition.previewStatus !== 'INVALID'
            && recognition.candidates.length > 0;

          if (!hasUsableRecognition && !isPreviewSurface) {
            throw new ApiError({
              code: 'BAD_REQUEST',
              statusCode: 422,
              message: 'Không thể nhận diện biển số đủ tin cậy từ ảnh hiện tại.',
              details: diagnostics,
            });
          }

          const recognizedPlate = hasUsableRecognition ? recognition.recognizedPlate : '';
          const confidence = hasUsableRecognition ? recognition.confidence : 0;
          const plateCanonical = recognizedPlate
            ? deriveAuthoritativePlateResult({
                surface,
                licensePlateRaw: recognizedPlate,
                rejectInvalid: false,
              }).plate
            : {
                plateRaw: null,
                plateCompact: null,
                plateDisplay: null,
                plateFamily: 'UNKNOWN',
                plateValidity: 'INVALID',
                ocrSubstitutions: [],
                suspiciousFlags: [],
                validationNotes: ['Backend preview không tìm được candidate đủ tin cậy từ ảnh hiện tại.'],
                reviewRequired: true,
              };

          return responseSchema.parse({
            recognizedPlate,
            confidence,
            previewStatus: hasUsableRecognition ? recognition.previewStatus : 'INVALID',
            needsConfirm: hasUsableRecognition ? recognition.needsConfirm : true,
            candidates: recognition.candidates.map((candidate) => ({
              plate: candidate.plate,
              score: candidate.score,
              votes: candidate.votes,
              cropVariants: candidate.cropVariants,
              psmModes: candidate.psmModes,
              suspiciousFlags: candidate.suspiciousFlags,
            })),
            winner: recognition.winner
              ? {
                  cropVariant: recognition.winner.cropVariant,
                  psm: recognition.winner.psm,
                  rawText: recognition.winner.rawText,
                  score: recognition.winner.score,
                }
              : null,
            raw: diagnostics,
            ...plateCanonical,
            plate: plateCanonical,
          });
        },
      );

      const rid = (req as any).id;
      if (config.previewCache.debugHeaders) {
        res.setHeader('x-alpr-preview-cache', cached.meta.status);
        res.setHeader('x-alpr-preview-cache-key', cached.meta.debugKey);
      }
      res.json(ok(rid, cached.value));
    } catch (e) {
      next(e);
    }
  };
  api.post('/lane-flow/submit', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req, res, next) => {
    const rid = (req as any).id;
    try {
      const body = validateOrThrow(LaneFlowSubmitBodySchema, req.body);
      assertNoClientCanonicalPlateFields(req.body, 'POST /api/lane-flow/submit');

      const scope = `lane-flow-submit:${body.siteCode}:${body.laneCode}:${body.direction}`;
      const claim = await claimIdempotency({ scope, key: body.idempotencyKey, requestHash: requestHash(body) });
      if (!claim.claimed) {
        if (claim.row.status === 'SUCCEEDED') return res.json(ok(rid, claim.row.response_json as any));
        return idempotencyBusy(scope, body.idempotencyKey, claim.row.status);
      }

      try {
        const authority = resolveLaneFlowAuthority({
          surface: 'POST /api/lane-flow/submit',
          plateConfirmed: body.plateConfirmed ?? null,
          previewSnapshot: body.previewSnapshot ?? null,
        });

        const occurredAt = new Date();
        const rawPayloadBase = asRecord(body.rawPayload) ?? {};
        const auditRawPayload = {
          ...rawPayloadBase,
          imageUrl: body.imageUrl ?? rawPayloadBase.imageUrl ?? null,
          plateConfirmed: body.plateConfirmed ?? null,
          previewSnapshot: body.previewSnapshot ?? null,
          laneFlow: {
            source: 'LANE_FLOW_SUBMIT',
            authoritativeSource: authority.authoritativeSource,
            decisionPolicy: authority.decisionPolicy,
            auditSnapshot: authority.auditSnapshot,
          },
        } as const;

        const resolved = await openOrReuseSessionAndResolve({
          siteCode: body.siteCode,
          laneCode: body.laneCode,
          direction: body.direction,
          occurredAt,
          requestId: body.requestId,
          idempotencyKey: body.idempotencyKey,
          deviceCode: body.deviceCode,
          readType: authority.authoritativeSource === 'NO_PLATE' ? 'SENSOR' : 'ALPR',
          sensorState: authority.authoritativeSource === 'NO_PLATE' ? 'PRESENT' : undefined,
          presenceActive: true,
          plateRaw: authority.decisionPlateRaw ?? undefined,
          ocrConfidence: authority.ocrConfidence ?? undefined,
          previewStatus: authority.decisionPreviewStatus ?? undefined,
          plateDecisionMode: authority.decisionPolicy === 'MANUAL_CONFIRMED' || authority.decisionPolicy === 'PREVIEW_STRICT'
            ? 'AUTHORITATIVE'
            : authority.decisionPolicy === 'PREVIEW_AMBIGUOUS'
              ? 'SOFT_REVIEW'
              : 'NO_PLATE',
          authoritativeSource: authority.authoritativeSource,
          payload: auditRawPayload,
        });

        const responseBody = stringifyBigint({
          requestId: body.requestId,
          submittedAt: occurredAt.toISOString(),
          authority: {
            source: authority.authoritativeSource,
            decisionPolicy: authority.decisionPolicy,
            authoritativePlateRaw: authority.authoritativePlateRaw,
            authoritativePlate: authority.authoritativePlate,
            decisionPlateRaw: authority.decisionPlateRaw,
            previewStatus: authority.decisionPreviewStatus,
            originalPreviewStatus: authority.originalPreviewStatus,
            needsManualReview: authority.needsManualReview,
            ocrConfidence: authority.ocrConfidence,
            auditSnapshot: authority.auditSnapshot,
          },
          session: resolved.session,
          event: resolved.event ?? null,
          decision: resolved.decision ?? {
            decisionCode: authority.decisionPolicy === 'NO_PLATE' ? 'WAITING_READ' : 'REVIEW_REQUIRED',
            recommendedAction: 'REVIEW',
            finalAction: 'REVIEW',
            reasonCode: authority.decisionPolicy === 'NO_PLATE' ? 'NO_PLATE_RULE_APPLIED' : 'OCR_AMBIGUOUS_SOFT_REVIEW',
            reasonDetail: authority.decisionPolicy === 'NO_PLATE'
              ? 'Lane-flow submit chÃ†Â°a cÃƒÂ³ plate authoritative nÃƒÂªn session Ã„â€˜Ã†Â°Ã¡Â»Â£c giÃ¡Â»Â¯ Ã¡Â»Å¸ WAITING_READ Ã„â€˜Ã¡Â»Æ’ chÃ¡Â»Â thÃƒÂªm evidence.'
              : 'OCR ambiguous Ã„â€˜Ã†Â°Ã¡Â»Â£c hÃ¡ÂºÂ¡ xuÃ¡Â»â€˜ng review mÃ¡Â»Âm; backend khÃƒÂ´ng hard-deny chÃ¡Â»â€° vÃƒÂ¬ preview chÃ†Â°a chÃ¡ÂºÂ¯c chÃ¡ÂºÂ¯n.',
            reviewRequired: true,
            explanation: authority.decisionPolicy === 'NO_PLATE'
              ? 'No-plate rule applied.'
              : 'Soft-review policy applied for ambiguous OCR.',
            inputSnapshot: {
              authoritativeSource: authority.authoritativeSource,
              decisionPolicy: authority.decisionPolicy,
              auditSnapshot: authority.auditSnapshot,
            },
            thresholdSnapshot: null,
          },
        });

        await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: responseBody });
        res.json(ok(rid, responseBody));
      } catch (err) {
        await markIdempotencyFailed({ scope, key: body.idempotencyKey }).catch(() => void 0);
        throw err;
      }
    } catch (e) {
      next(e);
    }
  });

  api.post('/alpr/preview', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req, res, next) => {
    await handleAlprPreview('POST /api/alpr/preview', req, res, next);
  });

  api.post('/alpr/recognize', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req, res, next) => {
    await handleAlprPreview('POST /api/alpr/recognize', req, res, next);
  });

  api.get('/reports/summary', requireAuth(['ADMIN', 'OPS', 'WORKER']), async (req, res, next) => {
    try {
      const days = Math.min(31, Math.max(1, Number(req.query.days ?? 7) || 7));
      const siteCode = String(req.query.siteCode ?? (await resolveDefaultSiteCode())).trim();
      const siteId = await resolveSiteIdByCode(siteCode);

      const since = new Date(Date.now() - days * 86400_000);

      const rows = await prisma.gate_events.groupBy({
        by: ['direction'],
        where: { site_id: siteId, event_time: { gte: since } },
        _count: { _all: true },
      });

      let entry = 0;
      let exit = 0;
      for (const r of rows as any[]) {
        if (r.direction === 'ENTRY') entry = r._count._all;
        if (r.direction === 'EXIT') exit = r._count._all;
      }

      const rid = (req as any).id;
      res.json(ok(rid, { siteCode, days, entry, exit, total: entry + exit }));
    } catch (e) {
      next(e);
    }
  });

  api.get('/stream/gate-events', requireAuth(['ADMIN', 'OPS', 'GUARD', 'WORKER']), async (req, res, next) => {
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const send = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const recentRows = await prisma.gate_event_outbox.findMany({
        orderBy: [{ created_at: 'desc' }, { outbox_id: 'desc' }],
        take: 25,
        select: { outbox_id: true, event_id: true, event_time: true, created_at: true, payload_json: true },
      });
      const recentEvents = recentRows.reverse().map(toFeedEventFromOutbox);
      const latestRow = recentRows[0] ?? null;
      let lastCreatedAt = latestRow?.created_at ?? new Date(0);
      let lastOutboxId = latestRow?.outbox_id ?? 0n;

      send('hello', { ts: Date.now(), bootstrapCount: recentEvents.length });
      for (const item of recentEvents) send('gate_event', item);

      const timer = setInterval(async () => {
        try {
          const rows = await prisma.gate_event_outbox.findMany({
            where: {
              OR: [
                { created_at: { gt: lastCreatedAt } },
                { created_at: lastCreatedAt, outbox_id: { gt: lastOutboxId } },
              ],
            },
            orderBy: [{ created_at: 'asc' }, { outbox_id: 'asc' }],
            take: 50,
            select: { outbox_id: true, event_id: true, event_time: true, created_at: true, payload_json: true },
          });

          for (const row of rows) {
            send('gate_event', toFeedEventFromOutbox(row));
            lastCreatedAt = row.created_at;
            lastOutboxId = row.outbox_id;
          }

          res.write(`: ping ${Date.now()}\n\n`);
        } catch (error) {
          send('stream_error', { message: error instanceof Error ? error.message : String(error) });
        }
      }, 1000);

      req.on('close', () => {
        clearInterval(timer);
      });
    } catch (e) {
      next(e);
    }
  });

  api.use((_req, _res, next) => {
    next(new ApiError({ code: 'NOT_FOUND', message: 'Route not found' }));
  });

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    if ((res as any).headersSent) {
      return _next(err);
    }

    const rid = (req as any).id ?? randomUUID();

    if (err instanceof ApiError) {
      const payload = buildErrorLogPayload(err, req);
      const level = payload.status >= 500 ? 'error' : payload.status === 409 || payload.status === 412 || payload.status === 422 || payload.status === 401 || payload.status === 403 ? 'warn' : 'info';
      (req as any).log?.[level]?.(payload, 'api_error');
      res.status(err.statusCode).json(fail(rid, { code: err.code, message: err.message, details: err.details }));
      return;
    }

    if (isDbPermissionError(err)) {
      (req as any).log?.error?.({
        ...buildErrorLogPayload(err, req),
        type: 'db.permission.error',
        errorKind: 'db_permission_error',
        errorCode: String(err?.code ?? 'DB_PERMISSION_ERROR'),
        errorReason: Number.isFinite(err?.errno) ? `MYSQL_${Number(err.errno)}` : null,
      }, 'db_permission_error');
      res.status(500).json(fail(rid, {
        code: 'INTERNAL_ERROR',
        message: 'Database runtime user chưa đủ quyền hoặc đang match sai host account (localhost / 127.0.0.1 / ::1). Chạy pnpm db:whoami:app, rồi pnpm db:grant:app và restart API.',
        details: {
          hint: 'Ví dụ: pnpm db:whoami:app && pnpm db:grant:app && pnpm dev',
          dbCode: err?.code ?? null,
          dbErrno: err?.errno ?? null,
        },
      }));
      return;
    }

    if ((res as any).headersSent) {
      return _next(err);
    }

    const rawStatus = err?.statusCode ?? err?.status;
    const status = Number.isFinite(rawStatus) ? Number(rawStatus) : 500;
    const code = statusToCode(status);

    const message = status >= 500 ? defaultMessageForCode('INTERNAL_ERROR') : String(err?.message ?? defaultMessageForCode(code));
    const details = err?.validation ?? err?.details;

    const payload = buildErrorLogPayload(err, req);
    (req as any).log?.[payload.status >= 500 ? 'error' : 'warn']?.({
      ...payload,
      status,
      errorCode: code,
    }, 'api_error');
    res.status(status).json(fail(rid, { code, message, details }));
  });

  (app as any).close = async () => {
    await prisma.$disconnect();
    await closeMongo().catch(() => void 0);
    await closeRedis().catch(() => void 0);
  };

  return app;
}


