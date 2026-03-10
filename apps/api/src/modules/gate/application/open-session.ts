import { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma';
import { ApiError } from '../../../server/http';
import { buildPlateCanonical } from '@parkly/gate-core';
import { resolveDeviceIdByCode, resolveSiteIdByCode } from '../../../lib/ids';
import {
  ACTIVE_SESSION_STATUSES,
  computeWindowCutoff,
  deriveStatusFromRead,
  ensureSessionTransition,
  getAllowedActions,
  shouldReuseSession,
  type SessionAllowedAction,
  type SessionStatus,
} from '../domain/session';

export type SessionDirection = 'ENTRY' | 'EXIT';
export type ReadType = 'ALPR' | 'RFID' | 'SENSOR';
export type SensorState = 'PRESENT' | 'CLEARED' | 'TRIGGERED';

export type LaneRef = {
  siteId: bigint;
  siteCode: string;
  laneId: bigint;
  laneCode: string;
  gateCode: string;
  direction: SessionDirection;
  primaryDeviceId: bigint | null;
};

export type SessionReadEventSummary = {
  readEventId: string;
  readType: ReadType;
  direction: SessionDirection;
  occurredAt: string;
  plateRaw: string | null;
  plateCompact: string | null;
  ocrConfidence: number | null;
  rfidUid: string | null;
  sensorState: SensorState | null;
  requestId: string | null;
};

export type SessionSummary = {
  sessionId: string;
  siteCode: string;
  gateCode: string;
  laneCode: string;
  direction: SessionDirection;
  status: SessionStatus;
  allowedActions: SessionAllowedAction[];
  ticketId: string | null;
  correlationId: string | null;
  openedAt: string;
  lastReadAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  plateCompact: string | null;
  rfidUid: string | null;
  presenceActive: boolean;
  reviewRequired: boolean;
  readCount: number;
  decisionCount: number;
  barrierCommandCount: number;
};

export type OpenGateSessionInput = {
  siteCode: string;
  laneCode: string;
  direction: SessionDirection;
  occurredAt?: Date;
  presenceActive?: boolean;
  correlationId?: string;
  plateRaw?: string;
  rfidUid?: string;
  deviceCode?: string;
  readType?: ReadType;
  sensorState?: SensorState;
  ocrConfidence?: number;
  requestId?: string;
  idempotencyKey?: string;
  payload?: unknown;
};

function jsonSafe(value: unknown): any {
  return JSON.parse(JSON.stringify(value ?? null, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

function asDirection(value: string): SessionDirection {
  return String(value).toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY';
}

function asGateDirection(value: SessionDirection): SessionDirection {
  return value === 'EXIT' ? 'EXIT' : 'ENTRY';
}

function asReadDirection(value: SessionDirection): SessionDirection {
  return value === 'EXIT' ? 'EXIT' : 'ENTRY';
}

function asReadType(value: ReadType): ReadType {
  if (value === 'RFID') return 'RFID';
  if (value === 'SENSOR') return 'SENSOR';
  return 'ALPR';
}

function asSensorState(value?: SensorState | null): SensorState | null {
  if (!value) return null;
  if (value === 'CLEARED') return 'CLEARED';
  if (value === 'TRIGGERED') return 'TRIGGERED';
  return 'PRESENT';
}

export function getSessionReuseWindowMs(): number {
  const raw = Number(process.env.GATE_SESSION_REUSE_WINDOW_MS ?? process.env.GATE_SESSION_OPEN_WINDOW_MS ?? 20_000);
  if (!Number.isFinite(raw) || raw <= 0) return 20_000;
  return Math.trunc(raw);
}

export async function resolveLaneRef(args: {
  siteCode: string;
  laneCode: string;
  direction?: SessionDirection;
}): Promise<LaneRef> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        ps.site_id AS siteId,
        ps.site_code AS siteCode,
        gl.lane_id AS laneId,
        gl.lane_code AS laneCode,
        gl.gate_code AS gateCode,
        gl.direction AS direction,
        gl.primary_device_id AS primaryDeviceId
      FROM parking_sites ps
      JOIN gate_lanes gl
        ON gl.site_id = ps.site_id
      WHERE ps.site_code = ?
        AND gl.lane_code = ?
      LIMIT 1
    `,
    args.siteCode,
    args.laneCode
  );

  const row = rows[0];
  if (!row) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: `Không tìm thấy lane '${args.laneCode}' cho site '${args.siteCode}'`,
      details: args,
    });
  }

  const direction = asDirection(String(row.direction ?? 'ENTRY'));
  if (args.direction && args.direction !== direction) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'direction không khớp với lane master data',
      details: { expected: direction, got: args.direction, laneCode: args.laneCode },
    });
  }

  return {
    siteId: BigInt(row.siteId as any),
    siteCode: String(row.siteCode ?? args.siteCode),
    laneId: BigInt(row.laneId as any),
    laneCode: String(row.laneCode ?? args.laneCode),
    gateCode: String(row.gateCode ?? ''),
    direction,
    primaryDeviceId: row.primaryDeviceId == null ? null : BigInt(row.primaryDeviceId as any),
  };
}

export async function resolveDeviceForLane(args: {
  siteId: bigint;
  laneId: bigint;
  deviceCode?: string;
  primaryDeviceId?: bigint | null;
}): Promise<bigint | null> {
  if (args.deviceCode?.trim()) {
    return resolveDeviceIdByCode({ siteId: args.siteId, deviceCode: args.deviceCode.trim() });
  }

  if (args.primaryDeviceId != null) return args.primaryDeviceId;

  const rows = await prisma.$queryRawUnsafe<Array<{ deviceId: any }>>(
    `
      SELECT gld.device_id AS deviceId
      FROM gate_lane_devices gld
      WHERE gld.lane_id = ?
      ORDER BY gld.is_primary DESC, gld.sort_order ASC, gld.lane_device_id ASC
      LIMIT 1
    `,
    String(args.laneId)
  );

  const deviceId = rows[0]?.deviceId;
  return deviceId == null ? null : BigInt(deviceId);
}

export async function expireStaleSessions(args: {
  siteId: bigint;
  laneId: bigint;
  direction: SessionDirection;
  now: Date;
  reuseWindowMs: number;
}) {
  const cutoff = computeWindowCutoff(args.now, args.reuseWindowMs);

  const staleRows = await prisma.gate_passage_sessions.findMany({
    where: {
      site_id: args.siteId,
      lane_id: args.laneId,
      direction: asGateDirection(args.direction),
      status: { in: ACTIVE_SESSION_STATUSES as any },
      OR: [
        { last_read_at: { lt: cutoff } },
        { last_read_at: null, opened_at: { lt: cutoff } },
      ],
    },
    select: { session_id: true },
  });

  if (!staleRows.length) return 0;

  const ids = staleRows.map((row: any) => row.session_id);
  const updated = await prisma.gate_passage_sessions.updateMany({
    where: { session_id: { in: ids } },
    data: {
      status: 'TIMEOUT',
      resolved_at: args.now,
      closed_at: args.now,
      updated_at: args.now,
    },
  });

  return updated.count;
}

export async function findReusableSession(args: {
  siteId: bigint;
  laneId: bigint;
  direction: SessionDirection;
  now: Date;
  reuseWindowMs: number;
}) {
  const candidate = await prisma.gate_passage_sessions.findFirst({
    where: {
      site_id: args.siteId,
      lane_id: args.laneId,
      direction: asGateDirection(args.direction),
      status: { in: ACTIVE_SESSION_STATUSES as any },
    },
    orderBy: [{ last_read_at: 'desc' }, { opened_at: 'desc' }, { session_id: 'desc' }],
  });

  if (!candidate) return null;
  if (!shouldReuseSession({ openedAt: candidate.opened_at, lastReadAt: candidate.last_read_at, now: args.now, windowMs: args.reuseWindowMs })) {
    return null;
  }
  return candidate;
}

function buildReadEventSummary(args: {
  sessionId: bigint;
  direction: SessionDirection;
  occurredAt: Date;
  readType?: ReadType;
  plateRaw?: string;
  ocrConfidence?: number;
  rfidUid?: string;
  sensorState?: SensorState;
  requestId?: string;
}, readEventId: bigint, plateCanonical: ReturnType<typeof buildPlateCanonical> | null): SessionReadEventSummary {
  return {
    readEventId: String(readEventId),
    readType: asReadType(args.readType ?? 'ALPR'),
    direction: asReadDirection(args.direction),
    occurredAt: args.occurredAt.toISOString(),
    plateRaw: plateCanonical?.plateRaw ?? args.plateRaw ?? null,
    plateCompact: plateCanonical?.plateCompact ?? null,
    ocrConfidence: args.ocrConfidence != null ? Number(args.ocrConfidence.toFixed(4)) : null,
    rfidUid: args.rfidUid ?? null,
    sensorState: asSensorState(args.sensorState),
    requestId: args.requestId ?? null,
  };
}

export async function recordSessionReadEvent(args: {
  tx?: Prisma.TransactionClient;
  sessionId: bigint;
  siteId: bigint;
  laneId: bigint;
  deviceId: bigint | null;
  direction: SessionDirection;
  occurredAt: Date;
  readType?: ReadType;
  plateRaw?: string;
  ocrConfidence?: number;
  rfidUid?: string;
  sensorState?: SensorState;
  requestId?: string;
  idempotencyKey?: string;
  payload?: unknown;
}) {
  if (!args.readType || args.deviceId == null) return null;

  const plateCanonical = args.plateRaw ? buildPlateCanonical(args.plateRaw) : null;
  const readIdemKey = args.idempotencyKey ? `session-read:${args.readType}:${args.idempotencyKey}` : null;

  const db = args.tx ?? prisma;

  try {
    const created = await db.gate_read_events.create({
      data: {
        session_id: args.sessionId,
        site_id: args.siteId,
        lane_id: args.laneId,
        device_id: args.deviceId,
        read_type: asReadType(args.readType),
        direction: asReadDirection(args.direction),
        occurred_at: args.occurredAt,
        plate_raw: plateCanonical?.plateRaw ?? args.plateRaw ?? null,
        plate_compact: plateCanonical?.plateCompact ?? null,
        ocr_confidence: args.ocrConfidence != null ? Number(args.ocrConfidence.toFixed(4)) : null,
        rfid_uid: args.rfidUid ?? null,
        sensor_state: asSensorState(args.sensorState),
        payload_json: jsonSafe(args.payload),
        request_id: args.requestId ?? null,
        idempotency_key: readIdemKey,
      },
      select: { read_event_id: true },
    });

    return {
      readEventId: created.read_event_id,
      event: buildReadEventSummary(args, created.read_event_id, plateCanonical),
    };
  } catch (err: any) {
    const errno = err?.meta?.driverAdapterError?.cause?.errno ?? err?.errno;
    const msg = String(err?.message ?? '');
    if (errno === 1062 || msg.includes('Duplicate entry')) {
      const existing = await db.gate_read_events.findFirst({
        where: {
          site_id: args.siteId,
          idempotency_key: readIdemKey ?? undefined,
        },
        select: { read_event_id: true },
      });
      if (existing) return {
        readEventId: existing.read_event_id,
        event: buildReadEventSummary(args, existing.read_event_id, plateCanonical),
      };
    }
    throw err;
  }
}

export async function getSessionSummary(sessionId: bigint): Promise<SessionSummary> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        gps.session_id AS sessionId,
        ps.site_code AS siteCode,
        gl.gate_code AS gateCode,
        gl.lane_code AS laneCode,
        gps.direction AS direction,
        gps.status AS status,
        gps.ticket_id AS ticketId,
        gps.correlation_id AS correlationId,
        gps.opened_at AS openedAt,
        gps.last_read_at AS lastReadAt,
        gps.resolved_at AS resolvedAt,
        gps.closed_at AS closedAt,
        gps.plate_compact AS plateCompact,
        gps.rfid_uid AS rfidUid,
        gps.presence_active AS presenceActive,
        gps.review_required AS reviewRequired,
        (SELECT COUNT(*) FROM gate_read_events gre WHERE gre.session_id = gps.session_id) AS readCount,
        (SELECT COUNT(*) FROM gate_decisions gd WHERE gd.session_id = gps.session_id) AS decisionCount,
        (SELECT COUNT(*) FROM gate_barrier_commands gbc WHERE gbc.session_id = gps.session_id) AS barrierCommandCount
      FROM gate_passage_sessions gps
      JOIN parking_sites ps
        ON ps.site_id = gps.site_id
      JOIN gate_lanes gl
        ON gl.lane_id = gps.lane_id
      WHERE gps.session_id = ?
      LIMIT 1
    `,
    String(sessionId)
  );

  const row = rows[0];
  if (!row) {
    throw new ApiError({ code: 'NOT_FOUND', message: `Không tìm thấy session ${String(sessionId)}` });
  }

  const asIso = (value: unknown) => (value instanceof Date ? value.toISOString() : value ? new Date(String(value)).toISOString() : null);

  const status = String(row.status ?? 'OPEN') as SessionStatus;

  return {
    sessionId: String(row.sessionId),
    siteCode: String(row.siteCode ?? ''),
    gateCode: String(row.gateCode ?? ''),
    laneCode: String(row.laneCode ?? ''),
    direction: asDirection(String(row.direction ?? 'ENTRY')),
    status,
    allowedActions: getAllowedActions(status),
    ticketId: row.ticketId == null ? null : String(row.ticketId),
    correlationId: row.correlationId == null ? null : String(row.correlationId),
    openedAt: asIso(row.openedAt) ?? new Date(0).toISOString(),
    lastReadAt: asIso(row.lastReadAt),
    resolvedAt: asIso(row.resolvedAt),
    closedAt: asIso(row.closedAt),
    plateCompact: row.plateCompact == null ? null : String(row.plateCompact),
    rfidUid: row.rfidUid == null ? null : String(row.rfidUid),
    presenceActive: Boolean(Number(row.presenceActive ?? 0)),
    reviewRequired: Boolean(Number(row.reviewRequired ?? 0)),
    readCount: Number(row.readCount ?? 0),
    decisionCount: Number(row.decisionCount ?? 0),
    barrierCommandCount: Number(row.barrierCommandCount ?? 0),
  };
}

export async function openGateSession(input: OpenGateSessionInput) {
  const occurredAt = input.occurredAt ?? new Date();
  const reuseWindowMs = getSessionReuseWindowMs();
  const lane = await resolveLaneRef({
    siteCode: input.siteCode,
    laneCode: input.laneCode,
    direction: input.direction,
  });

  await expireStaleSessions({
    siteId: lane.siteId,
    laneId: lane.laneId,
    direction: lane.direction,
    now: occurredAt,
    reuseWindowMs,
  });

  const reusable = await findReusableSession({
    siteId: lane.siteId,
    laneId: lane.laneId,
    direction: lane.direction,
    now: occurredAt,
    reuseWindowMs,
  });

  const deviceId = await resolveDeviceForLane({
    siteId: lane.siteId,
    laneId: lane.laneId,
    deviceCode: input.deviceCode,
    primaryDeviceId: lane.primaryDeviceId,
  });

  const plateCanonical = input.plateRaw ? buildPlateCanonical(input.plateRaw) : null;
  if (input.plateRaw && plateCanonical?.plateValidity === 'INVALID') {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Plate không vượt qua strict validation ở backend',
      details: plateCanonical,
    });
  }
  const presenceActive = input.presenceActive ?? (input.sensorState === 'PRESENT' || input.sensorState === 'TRIGGERED');
  const hasEvidence = Boolean(input.readType === 'ALPR' || input.readType === 'RFID' || plateCanonical?.plateCompact || input.rfidUid);

  let sessionId: bigint;
  let reused = false;

  if (reusable) {
    reused = true;
    const nextStatus = input.readType === 'SENSOR'
      ? deriveStatusFromRead({
          currentStatus: String(reusable.status ?? 'OPEN') as SessionStatus,
          readType: input.readType,
          sensorState: input.sensorState,
          presenceActive,
          hasEvidence,
        })
      : (String(reusable.status ?? 'OPEN') as SessionStatus);

    ensureSessionTransition(String(reusable.status ?? 'OPEN') as SessionStatus, nextStatus);

    const updated = await prisma.gate_passage_sessions.update({
      where: { session_id: reusable.session_id },
      data: {
        status: nextStatus,
        last_read_at: occurredAt,
        resolved_at: nextStatus === 'OPEN' || nextStatus === 'WAITING_READ' ? reusable.resolved_at ?? null : occurredAt,
        plate_compact: plateCanonical?.plateCompact ?? reusable.plate_compact ?? undefined,
        rfid_uid: input.rfidUid ?? reusable.rfid_uid ?? undefined,
        presence_active: presenceActive,
        correlation_id: input.correlationId ?? reusable.correlation_id ?? undefined,
        review_required: nextStatus === 'WAITING_DECISION',
        updated_at: occurredAt,
      },
      select: { session_id: true },
    });
    sessionId = updated.session_id;
  } else {
    const nextStatus = input.readType === 'SENSOR'
      ? deriveStatusFromRead({
          currentStatus: 'OPEN',
          readType: input.readType,
          sensorState: input.sensorState,
          presenceActive,
          hasEvidence,
        })
      : 'OPEN';

    const created = await prisma.gate_passage_sessions.create({
      data: {
        site_id: lane.siteId,
        lane_id: lane.laneId,
        direction: asGateDirection(lane.direction),
        status: nextStatus,
        correlation_id: input.correlationId ?? null,
        opened_at: occurredAt,
        last_read_at: occurredAt,
        resolved_at: nextStatus === 'OPEN' || nextStatus === 'WAITING_READ' ? null : occurredAt,
        plate_compact: plateCanonical?.plateCompact ?? null,
        rfid_uid: input.rfidUid ?? null,
        presence_active: presenceActive,
        review_required: nextStatus === 'WAITING_DECISION',
      },
      select: { session_id: true },
    });
    sessionId = created.session_id;
  }

  const readRecord = await recordSessionReadEvent({
    sessionId,
    siteId: lane.siteId,
    laneId: lane.laneId,
    deviceId,
    direction: lane.direction,
    occurredAt,
    readType: input.readType,
    plateRaw: input.plateRaw,
    ocrConfidence: input.ocrConfidence,
    rfidUid: input.rfidUid,
    sensorState: input.sensorState,
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
    payload: input.payload,
  });

  const session = await getSessionSummary(sessionId);
  return {
    reused,
    reuseWindowMs,
    session,
    event: readRecord?.event ?? null,
    plate: plateCanonical,
  };
}


export async function resolveSiteCodeOrThrow(siteCode?: string) {
  if (siteCode?.trim()) return siteCode.trim();
  const defaultSiteId = await resolveSiteIdByCode('SITE_HCM_01').catch(() => null);
  if (defaultSiteId != null) return 'SITE_HCM_01';
  throw new ApiError({ code: 'BAD_REQUEST', message: 'siteCode là bắt buộc' });
}
