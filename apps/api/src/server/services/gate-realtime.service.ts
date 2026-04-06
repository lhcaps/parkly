import { Prisma, gate_barrier_commands_status } from '@prisma/client'

import { prisma } from '../../lib/prisma'
import { incrementBarrierAckTimeout, setDeviceOfflineCount, setOutboxBacklogSize } from '../metrics'

type DeviceDerivedHealth = 'ONLINE' | 'DEGRADED' | 'OFFLINE'
type LaneAggregateHealth = 'HEALTHY' | 'DEGRADED_CAMERA' | 'DEGRADED_RFID' | 'DEGRADED_SENSOR' | 'BARRIER_FAULT' | 'OFFLINE'

type HeartbeatRawStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'MAINTENANCE' | null

type DeviceHealthSnapshotItem = {
  siteCode: string
  gateCode: string | null
  laneCode: string | null
  laneLabel: string | null
  laneDirection: 'ENTRY' | 'EXIT' | null
  laneOperationalStatus: string | null
  deviceCode: string
  deviceType: string
  deviceRole: string | null
  isPrimary: boolean
  isRequired: boolean
  heartbeatStatus: HeartbeatRawStatus
  derivedHealth: DeviceDerivedHealth
  healthReason: string
  heartbeatReportedAt: string | null
  heartbeatReceivedAt: string | null
  heartbeatAgeSeconds: number | null
  latencyMs: number | null
  firmwareVersion: string | null
  ipAddress: string | null
  locationHint: string | null
}

type LaneStatusSnapshotItem = {
  siteCode: string
  gateCode: string
  laneCode: string
  laneLabel: string
  direction: 'ENTRY' | 'EXIT'
  laneOperationalStatus: string
  aggregateHealth: LaneAggregateHealth
  aggregateReason: string
  lastBarrierStatus: string | null
  lastBarrierIssuedAt: string | null
  lastSessionStatus: string | null
  activePresenceCount: number
  requiredDeviceCount: number
  onlineDeviceCount: number
  degradedDeviceCount: number
  offlineDeviceCount: number
  zoneCode: string | null
  zoneName: string | null
  floorKey: string | null
  spotCount: number | null
  devices: Array<{
    deviceCode: string
    deviceRole: string | null
    deviceType: string
    derivedHealth: DeviceDerivedHealth
    heartbeatStatus: HeartbeatRawStatus
    heartbeatAgeSeconds: number | null
    isRequired: boolean
  }>
}

type OutboxSnapshotItem = {
  outboxId: string
  eventId: string
  siteCode: string | null
  laneCode: string | null
  deviceCode: string | null
  eventTime: string
  status: string
  attempts: number
  createdAt: string
  updatedAt: string
  nextRetryAt: string | null
  lastError: string | null
  mongoDocId: string | null
  payloadSummary: {
    direction: 'ENTRY' | 'EXIT' | null
    readType: string | null
    plateCompact: string | null
    plateDisplay: string | null
    reviewRequired: boolean
  }
}

function envNumber(name: string, fallback: number) {
  const n = Number(process.env[name] ?? '')
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function getRealtimeThresholds() {
  return {
    degradedHeartbeatAgeSeconds: envNumber(
      'GATE_REALTIME_DEVICE_DEGRADED_THRESHOLD_SECONDS',
      envNumber('GATE_DECISION_DEVICE_DEGRADED_THRESHOLD_SECONDS', 90),
    ),
    offlineHeartbeatAgeSeconds: envNumber(
      'GATE_REALTIME_DEVICE_OFFLINE_THRESHOLD_SECONDS',
      envNumber('GATE_DECISION_DEVICE_OFFLINE_THRESHOLD_SECONDS', 300),
    ),
    barrierAckTimeoutSeconds: envNumber('GATE_BARRIER_ACK_TIMEOUT_SECONDS', 15),
    ssePollMs: envNumber('GATE_STREAM_POLL_MS', 2000),
  }
}

function parseDate(value: unknown): Date | null {
  if (value == null) return null
  const dt = new Date(String(value))
  return Number.isNaN(dt.getTime()) ? null : dt
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value == null) return fallback
  const num = Number(value)
  if (Number.isFinite(num)) return num !== 0
  return fallback
}

function deriveDeviceHealth(args: {
  heartbeatStatus: HeartbeatRawStatus
  heartbeatReportedAt: Date | null
  now?: Date
}): { derivedHealth: DeviceDerivedHealth; heartbeatAgeSeconds: number | null; healthReason: string } {
  const now = args.now ?? new Date()
  const thresholds = getRealtimeThresholds()
  const reportedAt = args.heartbeatReportedAt

  if (reportedAt == null) {
    return { derivedHealth: 'OFFLINE', heartbeatAgeSeconds: null, healthReason: 'Chưa có heartbeat nào từ thiết bị.' }
  }

  const ageMs = now.getTime() - reportedAt.getTime()

  // Reject impossible ages: future (device clock ahead) or absurdly old (>30 days → treat as missing)
  const CLOCK_SKEW_FUTURE_MS = 60_000       // 60 s future tolerance
  const MAX_REASONABLE_AGE_MS = 30 * 86_400_000  // 30 days

  if (ageMs < -CLOCK_SKEW_FUTURE_MS) {
    return {
      derivedHealth: 'DEGRADED',
      heartbeatAgeSeconds: null,
      healthReason: 'Heartbeat reported_at ở tương lai (clock skew). Thiết bị bị coi là degraded.',
    }
  }

  if (ageMs > MAX_REASONABLE_AGE_MS) {
    return {
      derivedHealth: 'OFFLINE',
      heartbeatAgeSeconds: null,
      healthReason: 'Heartbeat age vượt ngưỡng tối đa hợp lý (30 ngày). Thiết bị được coi là offline.',
    }
  }

  const ageSeconds = Math.max(0, Math.trunc(ageMs / 1000))
  const raw = args.heartbeatStatus

  if (raw === 'OFFLINE') {
    return { derivedHealth: 'OFFLINE', heartbeatAgeSeconds: ageSeconds, healthReason: 'Heartbeat gần nhất báo OFFLINE.' }
  }
  if (ageSeconds > thresholds.offlineHeartbeatAgeSeconds) {
    return {
      derivedHealth: 'OFFLINE',
      heartbeatAgeSeconds: ageSeconds,
      healthReason: `Heartbeat quá hạn offline threshold (${thresholds.offlineHeartbeatAgeSeconds}s).`,
    }
  }
  if (raw === 'DEGRADED') {
    return { derivedHealth: 'DEGRADED', heartbeatAgeSeconds: ageSeconds, healthReason: 'Heartbeat gần nhất báo DEGRADED.' }
  }
  if (raw === 'MAINTENANCE') {
    return { derivedHealth: 'DEGRADED', heartbeatAgeSeconds: ageSeconds, healthReason: 'Thiết bị đang ở MAINTENANCE.' }
  }
  if (ageSeconds > thresholds.degradedHeartbeatAgeSeconds) {
    return {
      derivedHealth: 'DEGRADED',
      heartbeatAgeSeconds: ageSeconds,
      healthReason: `Heartbeat quá hạn degraded threshold (${thresholds.degradedHeartbeatAgeSeconds}s).`,
    }
  }

  return { derivedHealth: 'ONLINE', heartbeatAgeSeconds: ageSeconds, healthReason: 'Heartbeat còn tươi, thiết bị được xem là ONLINE.' }
}

export async function pumpBarrierCommandLifecycle(): Promise<{ promotedToSent: number; timedOut: number }> {
  const thresholds = getRealtimeThresholds()
  const now = new Date()
  const timeoutBefore = new Date(now.getTime() - thresholds.barrierAckTimeoutSeconds * 1000)

  const promoted = await prisma.gate_barrier_commands.updateMany({
    where: {
      status: gate_barrier_commands_status.PENDING,
      issued_at: { not: null },
    },
    data: { status: gate_barrier_commands_status.SENT },
  })

  const timeoutRows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      gbc.command_id AS commandId,
      ps.site_code AS siteCode,
      gl.lane_code AS laneCode
    FROM gate_barrier_commands gbc
    JOIN gate_lanes gl
      ON gl.lane_id = gbc.lane_id
    JOIN parking_sites ps
      ON ps.site_id = gl.site_id
    WHERE gbc.status = 'SENT'
      AND gbc.ack_at IS NULL
      AND gbc.issued_at < ${timeoutBefore}
  `)

  let timedOutCount = 0
  if (timeoutRows.length > 0) {
    const ids = timeoutRows.map((row) => BigInt(String(row.commandId)))
    const timedOut = await prisma.gate_barrier_commands.updateMany({
      where: { command_id: { in: ids } },
      data: { status: gate_barrier_commands_status.TIMEOUT },
    })
    timedOutCount = timedOut.count
    const grouped = new Map<string, { siteCode: string | null; laneCode: string | null; count: number }>()
    for (const row of timeoutRows) {
      const siteCode = row.siteCode == null ? null : String(row.siteCode)
      const laneCode = row.laneCode == null ? null : String(row.laneCode)
      const key = `${siteCode ?? 'UNKNOWN'}:${laneCode ?? 'UNKNOWN'}`
      const entry = grouped.get(key) ?? { siteCode, laneCode, count: 0 }
      entry.count += 1
      grouped.set(key, entry)
    }
    for (const item of grouped.values()) incrementBarrierAckTimeout(item)
  }

  return {
    promotedToSent: promoted.count,
    timedOut: timedOutCount,
  }
}

export async function getDeviceHealthSnapshot(siteCode?: string): Promise<DeviceHealthSnapshotItem[]> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        ps.site_code AS siteCode,
        gl.gate_code AS gateCode,
        gl.lane_code AS laneCode,
        COALESCE(gl.name, gl.lane_code) AS laneLabel,
        gl.direction AS laneDirection,
        gl.status AS laneOperationalStatus,
        gd.device_code AS deviceCode,
        gd.device_type AS deviceType,
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
        COALESCE(gl.lane_code, '') ASC,
        COALESCE(gld.sort_order, 999999) ASC,
        gd.device_code ASC
    `,
    siteCode ?? null,
    siteCode ?? null,
  )

  const now = new Date()
  const mapped = rows.map((row) => {
    const heartbeatStatus = row.heartbeatStatus == null ? null : String(row.heartbeatStatus).toUpperCase() as HeartbeatRawStatus
    const heartbeatReportedAt = parseDate(row.heartbeatReportedAt)
    const heartbeatReceivedAt = parseDate(row.heartbeatReceivedAt)
    const derived = deriveDeviceHealth({ heartbeatStatus, heartbeatReportedAt, now })
    return {
      siteCode: String(row.siteCode ?? ''),
      gateCode: row.gateCode == null ? null : String(row.gateCode),
      laneCode: row.laneCode == null ? null : String(row.laneCode),
      laneLabel: row.laneLabel == null ? null : String(row.laneLabel),
      laneDirection: row.laneDirection == null ? null : String(row.laneDirection).toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY',
      laneOperationalStatus: row.laneOperationalStatus == null ? null : String(row.laneOperationalStatus),
      deviceCode: String(row.deviceCode ?? ''),
      deviceType: String(row.deviceType ?? ''),
      deviceRole: row.deviceRole == null ? null : String(row.deviceRole),
      isPrimary: asBoolean(row.isPrimary),
      isRequired: asBoolean(row.isRequired, true),
      heartbeatStatus,
      derivedHealth: derived.derivedHealth,
      healthReason: derived.healthReason,
      heartbeatReportedAt: heartbeatReportedAt?.toISOString() ?? null,
      heartbeatReceivedAt: heartbeatReceivedAt?.toISOString() ?? null,
      heartbeatAgeSeconds: derived.heartbeatAgeSeconds,
      latencyMs: row.latencyMs == null ? null : Number(row.latencyMs),
      firmwareVersion: row.firmwareVersion == null ? null : String(row.firmwareVersion),
      ipAddress: row.ipAddress == null ? null : String(row.ipAddress),
      locationHint: row.locationHint == null ? null : String(row.locationHint),
    } satisfies DeviceHealthSnapshotItem
  })

  const offlineBySite = new Map<string, number>()
  for (const row of mapped) {
    if (row.derivedHealth !== 'OFFLINE') continue
    offlineBySite.set(row.siteCode, (offlineBySite.get(row.siteCode) ?? 0) + 1)
  }
  if (siteCode) setDeviceOfflineCount({ siteCode, count: offlineBySite.get(siteCode) ?? 0 })
  for (const [site, count] of offlineBySite.entries()) setDeviceOfflineCount({ siteCode: site, count })

  return mapped
}

function decideLaneAggregateHealth(args: {
  devices: DeviceHealthSnapshotItem[]
  lastBarrierStatus: string | null
}): { aggregateHealth: LaneAggregateHealth; aggregateReason: string } {
  const devices = args.devices
  const required = devices.filter((item) => item.isRequired)
  const online = required.filter((item) => item.derivedHealth === 'ONLINE')
  const degraded = required.filter((item) => item.derivedHealth === 'DEGRADED')
  const offline = required.filter((item) => item.derivedHealth === 'OFFLINE')

  const byRole = (roles: string[]) => required.filter((item) => roles.includes(String(item.deviceRole ?? '').toUpperCase()))
  const roleHasProblem = (roles: string[]) => byRole(roles).some((item) => item.derivedHealth !== 'ONLINE')
  const barrierHasProblem = roleHasProblem(['BARRIER'])

  // 1. Barrier command-level failure is always BARRIER_FAULT
  if (args.lastBarrierStatus === 'NACKED' || args.lastBarrierStatus === 'TIMEOUT') {
    return {
      aggregateHealth: 'BARRIER_FAULT',
      aggregateReason: `Barrier command gần nhất đang ở trạng thái ${args.lastBarrierStatus}.`,
    }
  }

  // 2. No required devices at all → OFFLINE
  if (required.length === 0) {
    return {
      aggregateHealth: 'OFFLINE',
      aggregateReason: 'Lane không có thiết bị required nào được cấu hình.',
    }
  }

  // 3. No device ONLINE → OFFLINE (even if some are degraded)
  if (online.length === 0) {
    return {
      aggregateHealth: 'OFFLINE',
      aggregateReason: 'Không còn thiết bị required nào đang ONLINE trên lane này.',
    }
  }

  // 4. At least one device is ONLINE — check for role-specific problems
  if (barrierHasProblem) {
    return {
      aggregateHealth: 'BARRIER_FAULT',
      aggregateReason: 'Thiết bị barrier của lane đang degraded/offline hoặc mất heartbeat.',
    }
  }

  if (roleHasProblem(['CAMERA'])) {
    return {
      aggregateHealth: 'DEGRADED_CAMERA',
      aggregateReason: 'Camera ALPR của lane đang degraded/offline hoặc heartbeat quá hạn.',
    }
  }

  if (roleHasProblem(['RFID'])) {
    return {
      aggregateHealth: 'DEGRADED_RFID',
      aggregateReason: 'RFID reader của lane đang degraded/offline hoặc heartbeat quá hạn.',
    }
  }

  if (roleHasProblem(['LOOP_SENSOR'])) {
    return {
      aggregateHealth: 'DEGRADED_SENSOR',
      aggregateReason: 'Loop sensor của lane đang degraded/offline hoặc heartbeat quá hạn.',
    }
  }

  // 5. Some devices are degraded but no role-specific degradation → DEGRADED overall
  if (degraded.length > 0) {
    const degradedRoles = [...new Set(degraded.map((d) => d.deviceRole ?? 'UNKNOWN'))].join(', ')
    return {
      aggregateHealth: 'OFFLINE',
      aggregateReason: `Lane có thiết bị required đang degraded (${degradedRoles}) nhưng không map được role chi tiết.`,
    }
  }

  // 6. All required devices are ONLINE
  return {
    aggregateHealth: 'HEALTHY',
    aggregateReason: 'Tất cả thiết bị required của lane đang ONLINE.',
  }
}

export async function getLaneStatusSnapshot(siteCode?: string): Promise<LaneStatusSnapshotItem[]> {
  const devices = await getDeviceHealthSnapshot(siteCode)
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        ps.site_code AS siteCode,
        gl.gate_code AS gateCode,
        gl.lane_code AS laneCode,
        COALESCE(gl.name, gl.lane_code) AS laneLabel,
        gl.direction AS direction,
        gl.status AS laneOperationalStatus,
        (
          SELECT gbc.status
          FROM gate_barrier_commands gbc
          WHERE gbc.lane_id = gl.lane_id
          ORDER BY gbc.issued_at DESC, gbc.command_id DESC
          LIMIT 1
        ) AS lastBarrierStatus,
        (
          SELECT gbc.issued_at
          FROM gate_barrier_commands gbc
          WHERE gbc.lane_id = gl.lane_id
          ORDER BY gbc.issued_at DESC, gbc.command_id DESC
          LIMIT 1
        ) AS lastBarrierIssuedAt,
        (
          SELECT gps.status
          FROM gate_passage_sessions gps
          WHERE gps.lane_id = gl.lane_id
          ORDER BY gps.opened_at DESC, gps.session_id DESC
          LIMIT 1
        ) AS lastSessionStatus,
        (
          SELECT COUNT(*)
          FROM gate_active_presence gap
          WHERE gap.site_id = gl.site_id
            AND gap.entry_lane_code = gl.lane_code
            AND COALESCE(gap.active_flag, 1) = 1
        ) AS activePresenceCount,
        matched_zone.zoneCode AS zoneCode,
        matched_zone.zoneName AS zoneName,
        matched_zone.floorKey AS floorKey,
        matched_zone.spotCount AS spotCount
      FROM gate_lanes gl
      JOIN parking_sites ps
        ON ps.site_id = gl.site_id
      LEFT JOIN LATERAL (
        SELECT
          z.code AS zoneCode,
          z.name AS zoneName,
          NULL AS floorKey,
          (
            SELECT COUNT(sp.spot_id)
            FROM spots sp
            WHERE sp.zone_id = z.zone_id
          ) AS spotCount
        FROM zones z
        WHERE z.site_id = ps.site_id
          AND (
            (gl.direction = 'ENTRY' AND z.vehicle_type = 'CAR' AND z.code LIKE '%CAR%')
            OR (gl.direction = 'ENTRY' AND z.vehicle_type = 'MOTORBIKE' AND z.code LIKE '%MOTO%')
            OR (gl.direction = 'EXIT' AND z.vehicle_type = 'CAR' AND z.code LIKE '%CAR%')
            OR (gl.direction = 'EXIT' AND z.vehicle_type = 'MOTORBIKE' AND z.code LIKE '%MOTO%')
          )
        LIMIT 1
      ) matched_zone ON TRUE
      WHERE (? IS NULL OR ps.site_code = ?)
      ORDER BY ps.site_code ASC, gl.gate_code ASC, gl.sort_order ASC, gl.lane_code ASC, gl.lane_id ASC
    `,
    siteCode ?? null,
    siteCode ?? null,
  )

  return rows.map((row) => {
    const laneDevices = devices.filter((item) => item.siteCode === String(row.siteCode ?? '') && item.laneCode === String(row.laneCode ?? ''))
    const required = laneDevices.filter((item) => item.isRequired)
    const aggregate = decideLaneAggregateHealth({
      devices: laneDevices,
      lastBarrierStatus: row.lastBarrierStatus == null ? null : String(row.lastBarrierStatus),
    })
    return {
      siteCode: String(row.siteCode ?? ''),
      gateCode: String(row.gateCode ?? ''),
      laneCode: String(row.laneCode ?? ''),
      laneLabel: String(row.laneLabel ?? row.laneCode ?? ''),
      direction: String(row.direction).toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY',
      laneOperationalStatus: String(row.laneOperationalStatus ?? 'ACTIVE'),
      aggregateHealth: aggregate.aggregateHealth,
      aggregateReason: aggregate.aggregateReason,
      lastBarrierStatus: row.lastBarrierStatus == null ? null : String(row.lastBarrierStatus),
      lastBarrierIssuedAt: parseDate(row.lastBarrierIssuedAt)?.toISOString() ?? null,
      lastSessionStatus: row.lastSessionStatus == null ? null : String(row.lastSessionStatus),
      activePresenceCount: Number(row.activePresenceCount ?? 0),
      requiredDeviceCount: required.length,
      onlineDeviceCount: required.filter((item) => item.derivedHealth === 'ONLINE').length,
      degradedDeviceCount: required.filter((item) => item.derivedHealth === 'DEGRADED').length,
      offlineDeviceCount: required.filter((item) => item.derivedHealth === 'OFFLINE').length,
      zoneCode: row.zoneCode == null ? null : String(row.zoneCode),
      zoneName: row.zoneName == null ? null : String(row.zoneName),
      floorKey: row.floorKey == null ? null : String(row.floorKey),
      spotCount: row.spotCount == null ? null : Number(row.spotCount),
      devices: laneDevices.map((item) => ({
        deviceCode: item.deviceCode,
        deviceRole: item.deviceRole,
        deviceType: item.deviceType,
        derivedHealth: item.derivedHealth,
        heartbeatStatus: item.heartbeatStatus,
        heartbeatAgeSeconds: item.heartbeatAgeSeconds,
        isRequired: item.isRequired,
      })),
    } satisfies LaneStatusSnapshotItem
  })
}

export async function getOutboxSnapshot(args?: { limit?: number; siteCode?: string }): Promise<OutboxSnapshotItem[]> {
  const limit = Math.min(100, Math.max(1, Number(args?.limit ?? 40)))
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      o.outbox_id AS outboxId,
      o.event_id AS eventId,
      ps.site_code AS siteCode,
      gd.device_code AS deviceCode,
      o.event_time AS eventTime,
      o.status AS status,
      o.attempts AS attempts,
      o.created_at AS createdAt,
      o.updated_at AS updatedAt,
      o.next_retry_at AS nextRetryAt,
      o.last_error AS lastError,
      o.mongo_doc_id AS mongoDocId,
      o.payload_json AS payloadJson
    FROM gate_event_outbox o
    LEFT JOIN parking_sites ps
      ON ps.site_id = o.site_id
    LEFT JOIN gate_events ge
      ON ge.event_id = o.event_id
    LEFT JOIN gate_devices gd
      ON gd.device_id = ge.device_id
    WHERE (${args?.siteCode ?? null} IS NULL OR ps.site_code = ${args?.siteCode ?? null})
    ORDER BY o.updated_at DESC, o.outbox_id DESC
    LIMIT ${limit}
  `)

  const mapped = rows.map((row) => {
    const payload = (row.payloadJson && typeof row.payloadJson === 'object' && !Array.isArray(row.payloadJson)
      ? row.payloadJson as Record<string, unknown>
      : {})
    const mysql = payload.mysql && typeof payload.mysql === 'object' && !Array.isArray(payload.mysql)
      ? payload.mysql as Record<string, unknown>
      : {}
    const rawPayload = payload.raw_payload && typeof payload.raw_payload === 'object' && !Array.isArray(payload.raw_payload)
      ? payload.raw_payload as Record<string, unknown>
      : {}
    const nestedRawPayload = rawPayload.rawPayload && typeof rawPayload.rawPayload === 'object' && !Array.isArray(rawPayload.rawPayload)
      ? rawPayload.rawPayload as Record<string, unknown>
      : {}
    const plateEngine = rawPayload.plateEngine && typeof rawPayload.plateEngine === 'object' && !Array.isArray(rawPayload.plateEngine)
      ? rawPayload.plateEngine as Record<string, unknown>
      : {}

    const laneCode = rawPayload.laneCode ?? rawPayload.lane_code ?? nestedRawPayload.laneCode ?? nestedRawPayload.lane_code ?? mysql.lane_code ?? null
    const deviceCode = row.deviceCode ?? rawPayload.deviceCode ?? rawPayload.device_code ?? nestedRawPayload.deviceCode ?? nestedRawPayload.device_code ?? mysql.device_code ?? null

    return {
      outboxId: String(row.outboxId ?? ''),
      eventId: String(row.eventId ?? ''),
      siteCode: row.siteCode == null ? null : String(row.siteCode),
      laneCode: laneCode == null ? null : String(laneCode),
      deviceCode: deviceCode == null ? null : String(deviceCode),
      eventTime: parseDate(row.eventTime)?.toISOString() ?? new Date().toISOString(),
      status: String(row.status ?? ''),
      attempts: Number(row.attempts ?? 0),
      createdAt: parseDate(row.createdAt)?.toISOString() ?? new Date().toISOString(),
      updatedAt: parseDate(row.updatedAt)?.toISOString() ?? new Date().toISOString(),
      nextRetryAt: parseDate(row.nextRetryAt)?.toISOString() ?? null,
      lastError: row.lastError == null ? null : String(row.lastError),
      mongoDocId: row.mongoDocId == null ? null : String(row.mongoDocId),
      payloadSummary: {
        direction: mysql.direction == null ? null : String(mysql.direction).toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY',
        readType: rawPayload.readType == null ? null : String(rawPayload.readType),
        plateCompact: plateEngine.plateCompact == null ? null : String(plateEngine.plateCompact),
        plateDisplay: plateEngine.plateDisplay == null ? null : String(plateEngine.plateDisplay),
        reviewRequired: Boolean(plateEngine.reviewRequired ?? false),
      },
    } satisfies OutboxSnapshotItem
  })

  const backlog = new Map<string, number>()
  for (const row of mapped) {
    const key = `${row.siteCode ?? 'UNKNOWN'}:${row.status}`
    backlog.set(key, (backlog.get(key) ?? 0) + 1)
  }
  for (const [key, count] of backlog.entries()) {
    const [site, status] = key.split(':')
    setOutboxBacklogSize({ siteCode: site, status, count })
  }

  return mapped
}

export type { DeviceHealthSnapshotItem, LaneStatusSnapshotItem, OutboxSnapshotItem, DeviceDerivedHealth, LaneAggregateHealth }
