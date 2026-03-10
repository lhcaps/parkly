import { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma';
import { ApiError } from '../../../server/http';

export type GateDirection = 'ENTRY' | 'EXIT';
export type GateReadType = 'ALPR' | 'RFID' | 'SENSOR';
export type SensorState = 'PRESENT' | 'CLEARED' | 'TRIGGERED';

export type LaneContext = {
  siteId: bigint;
  siteCode: string;
  laneId: bigint;
  laneCode: string;
  gateCode: string;
  direction: GateDirection;
  laneStatus: string;
  deviceId: bigint;
  deviceCode: string;
  deviceType: string;
  deviceRole: string | null;
};

export type SessionLink = {
  sessionId: bigint;
  sessionStatus: string;
  created: boolean;
};

export type GateReadMediaInput = {
  storageKind?: 'UPLOAD' | 'URL' | 'INLINE' | 'MOCK' | 'UNKNOWN';
  mediaUrl?: string | null;
  filePath?: string | null;
  mimeType?: string | null;
  sha256?: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  metadataJson?: unknown;
  capturedAt?: Date | null;
};

export type PersistGateReadInput = {
  sessionId: bigint;
  siteId: bigint;
  laneId: bigint;
  deviceId: bigint;
  readType: GateReadType;
  direction: GateDirection;
  occurredAt: Date;
  plateRaw?: string | null;
  plateCompact?: string | null;
  ocrConfidence?: number | null;
  rfidUid?: string | null;
  sensorState?: SensorState | null;
  payloadJson?: unknown;
  rawOcrText?: string | null;
  cameraFrameRef?: string | null;
  cropRef?: string | null;
  sourceDeviceCode?: string | null;
  sourceCaptureTs?: Date | null;
  media?: GateReadMediaInput | null;
  requestId: string;
  idempotencyKey: string;
};

export type PersistGateReadResult = {
  changed: boolean;
  readEventId: bigint;
  sourceMediaId: bigint | null;
};

export type LaneDeviceTopologyRow = {
  siteCode: string;
  laneId: string;
  laneCode: string;
  gateCode: string;
  laneName: string;
  direction: GateDirection;
  laneStatus: string;
  sortOrder: number;
  primaryDeviceCode: string | null;
  deviceId: string | null;
  deviceCode: string | null;
  deviceType: string | null;
  deviceRole: string | null;
  isPrimary: boolean;
  isRequired: boolean;
  deviceLocationHint: string | null;
};

function deriveSessionStatusFromCapturedRead(args: {
  currentStatus: string;
  readType?: GateReadType;
  sensorState?: SensorState;
  plateCompact?: string | null;
  rfidUid?: string | null;
  presenceActive?: boolean;
}): string {
  if (args.currentStatus === 'APPROVED' || args.currentStatus === 'WAITING_PAYMENT') return args.currentStatus;

  if (
    args.readType === 'SENSOR' &&
    (args.sensorState === 'PRESENT' || args.sensorState === 'TRIGGERED' || args.presenceActive)
  ) {
    return args.currentStatus === 'OPEN' || args.currentStatus === 'WAITING_READ'
      ? 'WAITING_READ'
      : args.currentStatus;
  }

  if (
    args.readType === 'ALPR' ||
    args.readType === 'RFID' ||
    args.plateCompact ||
    args.rfidUid
  ) {
    if (args.currentStatus === 'OPEN' || args.currentStatus === 'WAITING_READ' || args.currentStatus === 'WAITING_DECISION') {
      return 'WAITING_DECISION';
    }
  }

  return args.currentStatus;
}

function jsonSafe(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined) return null;
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  ) as Prisma.InputJsonValue;
}

function asNullableString(value: unknown, maxLen: number): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function asNullableDate(value: unknown): Date | null {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(dt.getTime())) return null;
  dt.setMilliseconds(0);
  return dt;
}

function isDuplicateKeyError(err: unknown): boolean {
  const e: any = err as any;
  const errno = e?.meta?.driverAdapterError?.cause?.errno ?? e?.errno;
  if (errno === 1062 || errno === 'ER_DUP_ENTRY') return true;
  const msg = String(e?.message ?? '');
  return msg.includes('Duplicate entry') || msg.includes('1062') || msg.includes('ER_DUP_ENTRY');
}

async function insertReadMedia(args: {
  siteId: bigint;
  laneId: bigint;
  deviceId: bigint;
  media: GateReadMediaInput;
}): Promise<bigint | null> {
  const hasAnyValue = Boolean(
    args.media.mediaUrl ||
      args.media.filePath ||
      args.media.mimeType ||
      args.media.sha256 ||
      args.media.widthPx != null ||
      args.media.heightPx != null ||
      args.media.metadataJson != null
  );
  if (!hasAnyValue) return null;

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO gate_read_media(
      site_id,
      lane_id,
      device_id,
      storage_kind,
      media_url,
      file_path,
      mime_type,
      sha256,
      width_px,
      height_px,
      metadata_json,
      captured_at
    ) VALUES (
      ${args.siteId},
      ${args.laneId},
      ${args.deviceId},
      ${args.media.storageKind ?? 'UNKNOWN'},
      ${args.media.mediaUrl ?? null},
      ${args.media.filePath ?? null},
      ${args.media.mimeType ?? null},
      ${args.media.sha256 ?? null},
      ${args.media.widthPx ?? null},
      ${args.media.heightPx ?? null},
      ${jsonSafe(args.media.metadataJson)},
      ${asNullableDate(args.media.capturedAt) ?? null}
    )
  `);

  const idRows = await prisma.$queryRaw<{ id: any }[]>(Prisma.sql`SELECT LAST_INSERT_ID() AS id`);
  return idRows[0]?.id != null ? BigInt(idRows[0].id) : null;
}

export async function resolveLaneContext(args: {
  siteCode: string;
  laneCode?: string;
  deviceCode?: string;
  expectedDirection?: GateDirection;
}): Promise<LaneContext> {
  const siteCode = String(args.siteCode ?? '').trim();
  const laneCode = String(args.laneCode ?? '').trim() || null;
  const deviceCode = String(args.deviceCode ?? '').trim() || null;

  if (!siteCode) {
    throw new ApiError({ code: 'BAD_REQUEST', message: 'siteCode là bắt buộc' });
  }
  if (!laneCode && !deviceCode) {
    throw new ApiError({ code: 'BAD_REQUEST', message: 'Cần ít nhất laneCode hoặc deviceCode để resolve lane context' });
  }

  const rows = await prisma.$queryRaw<any[]>(Prisma.sql`
    SELECT
      ps.site_id AS site_id,
      ps.site_code AS site_code,
      gl.lane_id AS lane_id,
      gl.lane_code AS lane_code,
      gl.gate_code AS gate_code,
      gl.direction AS direction,
      gl.status AS lane_status,
      gd.device_id AS device_id,
      gd.device_code AS device_code,
      gd.device_type AS device_type,
      gld.device_role AS device_role
    FROM parking_sites ps
    JOIN gate_lanes gl
      ON gl.site_id = ps.site_id
    LEFT JOIN gate_lane_devices gld
      ON gld.lane_id = gl.lane_id
    LEFT JOIN gate_devices gd
      ON gd.device_id = gld.device_id
    WHERE ps.site_code = ${siteCode}
      AND (${laneCode} IS NULL OR gl.lane_code = ${laneCode})
      AND (${deviceCode} IS NULL OR gd.device_code = ${deviceCode})
    ORDER BY
      CASE WHEN ${deviceCode} IS NOT NULL AND gd.device_code = ${deviceCode} THEN 0 ELSE 1 END,
      COALESCE(gld.is_primary, 0) DESC,
      COALESCE(gld.sort_order, 999999) ASC,
      gd.device_code ASC
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Không resolve được lane/device từ master data',
      details: { siteCode, laneCode, deviceCode },
    });
  }

  const direction = String(row.direction).toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY';
  if (args.expectedDirection && args.expectedDirection !== direction) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'direction không khớp lane direction',
      details: {
        expectedDirection: args.expectedDirection,
        laneDirection: direction,
        laneCode: row.lane_code,
        deviceCode: row.device_code,
      },
    });
  }

  return {
    siteId: BigInt(row.site_id),
    siteCode: String(row.site_code),
    laneId: BigInt(row.lane_id),
    laneCode: String(row.lane_code),
    gateCode: String(row.gate_code),
    direction,
    laneStatus: String(row.lane_status),
    deviceId: BigInt(row.device_id),
    deviceCode: String(row.device_code),
    deviceType: String(row.device_type),
    deviceRole: row.device_role != null ? String(row.device_role) : null,
  };
}

export async function resolveOrCreateSession(args: {
  siteId: bigint;
  laneId: bigint;
  direction: GateDirection;
  occurredAt: Date;
  requestId: string;
  readType?: GateReadType;
  sensorState?: SensorState;
  plateCompact?: string | null;
  rfidUid?: string | null;
  reviewRequired?: boolean;
  presenceActive?: boolean;
}): Promise<SessionLink> {
  const occurredAt = new Date(args.occurredAt);
  occurredAt.setMilliseconds(0);

  const reuseWindowSeconds = Math.max(5, Number(process.env.GATE_SESSION_REUSE_WINDOW_SECONDS ?? 45));

  await prisma.$executeRaw(Prisma.sql`
    UPDATE gate_passage_sessions
    SET
      status = 'TIMEOUT',
      resolved_at = COALESCE(resolved_at, ${occurredAt}),
      closed_at = COALESCE(closed_at, ${occurredAt}),
      updated_at = CURRENT_TIMESTAMP
    WHERE site_id = ${args.siteId}
      AND lane_id = ${args.laneId}
      AND status IN ('OPEN', 'WAITING_READ', 'WAITING_DECISION', 'APPROVED', 'WAITING_PAYMENT')
      AND COALESCE(last_read_at, opened_at) < DATE_SUB(${occurredAt}, INTERVAL ${reuseWindowSeconds} SECOND)
  `);

  const rows = await prisma.$queryRaw<any[]>(Prisma.sql`
    SELECT session_id, status
    FROM gate_passage_sessions
    WHERE site_id = ${args.siteId}
      AND lane_id = ${args.laneId}
      AND status IN ('OPEN', 'WAITING_READ', 'WAITING_DECISION', 'APPROVED', 'WAITING_PAYMENT')
      AND COALESCE(last_read_at, opened_at) >= DATE_SUB(${occurredAt}, INTERVAL ${reuseWindowSeconds} SECOND)
    ORDER BY COALESCE(last_read_at, opened_at) DESC, session_id DESC
    LIMIT 1
  `);

  const existing = rows[0];
  if (existing?.session_id != null) {
    const sessionId = BigInt(existing.session_id);
    const currentStatus = String(existing.status ?? 'OPEN');
    const nextStatus = deriveSessionStatusFromCapturedRead({
      currentStatus,
      readType: args.readType,
      sensorState: args.sensorState,
      plateCompact: args.plateCompact,
      rfidUid: args.rfidUid,
      presenceActive: args.presenceActive,
    });

    await prisma.$executeRaw(Prisma.sql`
      UPDATE gate_passage_sessions
      SET
        status = ${nextStatus},
        last_read_at = ${occurredAt},
        resolved_at = CASE
          WHEN ${nextStatus} IN ('OPEN', 'WAITING_READ') THEN resolved_at
          ELSE COALESCE(resolved_at, ${occurredAt})
        END,
        plate_compact = COALESCE(${args.plateCompact ?? null}, plate_compact),
        rfid_uid = COALESCE(${args.rfidUid ?? null}, rfid_uid),
        review_required = CASE
          WHEN ${nextStatus} = 'WAITING_DECISION' THEN 1
          ELSE 0
        END,
        presence_active = CASE
          WHEN ${args.presenceActive === undefined ? null : args.presenceActive ? 1 : 0} IS NULL THEN presence_active
          ELSE ${args.presenceActive === undefined ? null : args.presenceActive ? 1 : 0}
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ${sessionId}
    `);

    if (nextStatus === 'WAITING_DECISION' && currentStatus !== 'WAITING_DECISION') {
      await prisma.gate_decisions.create({
        data: {
          session_id: sessionId,
          site_id: args.siteId,
          lane_id: args.laneId,
          decision_code: 'REVIEW_REQUIRED',
          final_action: 'REVIEW',
          reason_code: args.reviewRequired ? 'PLATE_REVIEW_REQUIRED' : 'CAPTURE_READ_READY_FOR_DECISION',
          reason_detail: args.readType ? `Capture ${args.readType} đã vào session orchestration` : 'Capture read đã vào session orchestration',
          input_snapshot_json: jsonSafe({
            readType: args.readType ?? null,
            sensorState: args.sensorState ?? null,
            plateCompact: args.plateCompact ?? null,
            rfidUid: args.rfidUid ?? null,
            presenceActive: args.presenceActive ?? null,
          }),
          threshold_snapshot_json: jsonSafe({
            orchestrator: 'PR05_CAPTURE',
            source: 'resolveOrCreateSession',
          }),
        },
      });
    }

    return {
      sessionId,
      sessionStatus: nextStatus,
      created: false,
    };
  }

  const nextStatus = deriveSessionStatusFromCapturedRead({
    currentStatus: 'OPEN',
    readType: args.readType,
    sensorState: args.sensorState,
    plateCompact: args.plateCompact,
    rfidUid: args.rfidUid,
    presenceActive: args.presenceActive,
  });

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO gate_passage_sessions(
      site_id,
      lane_id,
      direction,
      status,
      correlation_id,
      opened_at,
      last_read_at,
      resolved_at,
      plate_compact,
      rfid_uid,
      presence_active,
      review_required
    ) VALUES (
      ${args.siteId},
      ${args.laneId},
      ${args.direction},
      ${nextStatus},
      ${args.requestId},
      ${occurredAt},
      ${occurredAt},
      ${nextStatus === 'OPEN' || nextStatus === 'WAITING_READ' ? null : occurredAt},
      ${args.plateCompact ?? null},
      ${args.rfidUid ?? null},
      ${args.presenceActive ? 1 : 0},
      ${nextStatus === 'WAITING_DECISION' ? 1 : 0}
    )
  `);

  const idRows = await prisma.$queryRaw<{ id: any }[]>(Prisma.sql`SELECT LAST_INSERT_ID() AS id`);
  if (!idRows[0]?.id) {
    throw new Error('Failed to resolve session_id via LAST_INSERT_ID()');
  }

  const sessionId = BigInt(idRows[0].id);

  if (nextStatus === 'WAITING_DECISION') {
    await prisma.gate_decisions.create({
      data: {
        session_id: sessionId,
        site_id: args.siteId,
        lane_id: args.laneId,
        decision_code: 'REVIEW_REQUIRED',
        final_action: 'REVIEW',
        reason_code: args.reviewRequired ? 'PLATE_REVIEW_REQUIRED' : 'CAPTURE_READ_READY_FOR_DECISION',
        reason_detail: args.readType ? `Capture ${args.readType} mở mới session và chờ quyết định` : 'Capture read mở mới session và chờ quyết định',
        input_snapshot_json: jsonSafe({
          readType: args.readType ?? null,
          sensorState: args.sensorState ?? null,
          plateCompact: args.plateCompact ?? null,
          rfidUid: args.rfidUid ?? null,
          presenceActive: args.presenceActive ?? null,
        }),
        threshold_snapshot_json: jsonSafe({
          orchestrator: 'PR05_CAPTURE',
          source: 'resolveOrCreateSession',
        }),
      },
    });
  }

  return {
    sessionId,
    sessionStatus: nextStatus,
    created: true,
  };
}

export async function persistGateReadEvent(args: PersistGateReadInput): Promise<PersistGateReadResult> {
  const occurredAt = new Date(args.occurredAt);
  occurredAt.setMilliseconds(0);
  const sourceCaptureTs = asNullableDate(args.sourceCaptureTs ?? occurredAt) ?? occurredAt;

  try {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO gate_read_events(
        session_id,
        site_id,
        lane_id,
        device_id,
        read_type,
        direction,
        occurred_at,
        plate_raw,
        plate_compact,
        ocr_confidence,
        rfid_uid,
        sensor_state,
        payload_json,
        raw_ocr_text,
        camera_frame_ref,
        crop_ref,
        source_device_code,
        source_capture_ts,
        request_id,
        idempotency_key
      ) VALUES (
        ${args.sessionId},
        ${args.siteId},
        ${args.laneId},
        ${args.deviceId},
        ${args.readType},
        ${args.direction},
        ${occurredAt},
        ${args.plateRaw ?? null},
        ${args.plateCompact ?? null},
        ${args.ocrConfidence ?? null},
        ${args.rfidUid ?? null},
        ${args.sensorState ?? null},
        ${jsonSafe(args.payloadJson)},
        ${asNullableString(args.rawOcrText, 64)},
        ${asNullableString(args.cameraFrameRef, 255)},
        ${asNullableString(args.cropRef, 255)},
        ${asNullableString(args.sourceDeviceCode, 64)},
        ${sourceCaptureTs},
        ${args.requestId},
        ${args.idempotencyKey}
      )
    `);

    const idRows = await prisma.$queryRaw<{ id: any }[]>(Prisma.sql`SELECT LAST_INSERT_ID() AS id`);
    if (!idRows[0]?.id) {
      throw new Error('Failed to resolve read_event_id via LAST_INSERT_ID()');
    }
    const readEventId = BigInt(idRows[0].id);

    let sourceMediaId: bigint | null = null;
    if (args.media) {
      sourceMediaId = await insertReadMedia({
        siteId: args.siteId,
        laneId: args.laneId,
        deviceId: args.deviceId,
        media: {
          ...args.media,
          capturedAt: args.media.capturedAt ?? sourceCaptureTs,
        },
      });

      if (sourceMediaId != null) {
        await prisma.$executeRaw(Prisma.sql`
          UPDATE gate_read_events
          SET source_media_id = ${sourceMediaId}
          WHERE read_event_id = ${readEventId}
        `);
      }
    }

    return { changed: true, readEventId, sourceMediaId };
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;

    const rows = await prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT read_event_id, source_media_id
      FROM gate_read_events
      WHERE site_id = ${args.siteId}
        AND idempotency_key = ${args.idempotencyKey}
      LIMIT 1
    `);

    if (!rows[0]?.read_event_id) {
      throw err;
    }

    return {
      changed: false,
      readEventId: BigInt(rows[0].read_event_id),
      sourceMediaId: rows[0].source_media_id == null ? null : BigInt(rows[0].source_media_id),
    };
  }
}

export async function listLaneDeviceTopology(args: {
  siteCode: string;
  laneCode?: string;
}): Promise<LaneDeviceTopologyRow[]> {
  const siteCode = String(args.siteCode ?? '').trim();
  const laneCode = String(args.laneCode ?? '').trim() || null;
  if (!siteCode) throw new ApiError({ code: 'BAD_REQUEST', message: 'siteCode là bắt buộc' });

  const rows = await prisma.$queryRaw<any[]>(Prisma.sql`
    SELECT
      ps.site_code AS siteCode,
      gl.lane_id AS laneId,
      gl.lane_code AS laneCode,
      gl.gate_code AS gateCode,
      COALESCE(gl.name, gl.lane_code) AS laneName,
      gl.direction AS direction,
      gl.status AS laneStatus,
      gl.sort_order AS sortOrder,
      gd_primary.device_code AS primaryDeviceCode,
      gd.device_id AS deviceId,
      gd.device_code AS deviceCode,
      gd.device_type AS deviceType,
      gld.device_role AS deviceRole,
      COALESCE(gld.is_primary, 0) AS isPrimary,
      COALESCE(gld.is_required, 1) AS isRequired,
      gd.location_hint AS deviceLocationHint
    FROM parking_sites ps
    JOIN gate_lanes gl
      ON gl.site_id = ps.site_id
    LEFT JOIN gate_lane_devices gld
      ON gld.lane_id = gl.lane_id
    LEFT JOIN gate_devices gd
      ON gd.device_id = gld.device_id
    LEFT JOIN gate_lane_devices gld_primary
      ON gld_primary.lane_id = gl.lane_id
     AND gld_primary.is_primary = 1
    LEFT JOIN gate_devices gd_primary
      ON gd_primary.device_id = gld_primary.device_id
    WHERE ps.site_code = ${siteCode}
      AND (${laneCode} IS NULL OR gl.lane_code = ${laneCode})
    ORDER BY gl.gate_code ASC, gl.sort_order ASC, gl.lane_code ASC, COALESCE(gld.sort_order, 999999) ASC, gd.device_code ASC
  `);

  return rows.map((row) => ({
    siteCode: String(row.siteCode ?? ''),
    laneId: String(row.laneId ?? ''),
    laneCode: String(row.laneCode ?? ''),
    gateCode: String(row.gateCode ?? ''),
    laneName: String(row.laneName ?? row.laneCode ?? ''),
    direction: String(row.direction).toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY',
    laneStatus: String(row.laneStatus ?? 'ACTIVE'),
    sortOrder: Number(row.sortOrder ?? 0),
    primaryDeviceCode: row.primaryDeviceCode == null ? null : String(row.primaryDeviceCode),
    deviceId: row.deviceId == null ? null : String(row.deviceId),
    deviceCode: row.deviceCode == null ? null : String(row.deviceCode),
    deviceType: row.deviceType == null ? null : String(row.deviceType),
    deviceRole: row.deviceRole == null ? null : String(row.deviceRole),
    isPrimary: Boolean(Number(row.isPrimary ?? 0)),
    isRequired: Boolean(Number(row.isRequired ?? 1)),
    deviceLocationHint: row.deviceLocationHint == null ? null : String(row.deviceLocationHint),
  }));
}
