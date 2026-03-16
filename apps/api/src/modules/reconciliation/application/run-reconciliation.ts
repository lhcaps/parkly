import { prisma } from '../../../lib/prisma'
import { syncIncidentFromSpotProjection } from '../../incidents/application/incident-service'
import { listSubscriptionOccupancyLookup, type SubscriptionOccupancyLookup } from '../../../server/services/subscription-occupancy.service'
import {
  reconcileSpotProjection,
  type ActiveGatePresenceRecord,
  type LatestPresenceEventRecord,
  type ReconciliationSpotRecord,
  type SpotProjectionDecision,
  type SpotOccupancyStatus,
} from '../domain/reconciliation'

export type RunReconciliationInput = {
  siteCode: string
  spotCode?: string | null
  now?: Date
  sensorStaleSeconds?: number
}

export type SpotProjectionRow = {
  projectionId: string | null
  siteId: string
  zoneId: string | null
  spotId: string
  zoneCode: string | null
  spotCode: string
  occupancyStatus: SpotOccupancyStatus
  observedPlateCompact: string | null
  expectedPlateCompact: string | null
  matchedSubscriptionId: string | null
  matchedSubscriptionSpotId: string | null
  matchedGatePresenceId: string | null
  sourcePresenceEventId: string | null
  reasonCode: string
  reasonDetail: string
  staleAt: string | null
  snapshot: Record<string, unknown>
  updatedAt: string
}

type PersistProjectionInput = {
  spot: ReconciliationSpotRecord
  decision: SpotProjectionDecision
}

type ReconciliationDeps = {
  listSpots: (args: { siteCode: string; spotCode?: string | null }) => Promise<ReconciliationSpotRecord[]>
  listLatestPresenceEvents: (args: { siteCode: string; spotCode?: string | null }) => Promise<Record<string, LatestPresenceEventRecord>>
  listActiveGatePresence: (args: { siteCode: string }) => Promise<Record<string, ActiveGatePresenceRecord>>
  listSubscriptionLookup: (siteCode: string) => Promise<SubscriptionOccupancyLookup>
  persistProjection: (args: PersistProjectionInput) => Promise<SpotProjectionRow>
  listProjectionRows: (args: { siteCode: string; spotCode?: string | null; status?: string | null; zoneCode?: string | null; limit?: number }) => Promise<SpotProjectionRow[]>
  getProjectionRow: (args: { siteCode: string; spotCode: string }) => Promise<SpotProjectionRow | null>
}

function envNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name] ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toId(value: unknown) {
  if (value == null) return null
  return String(value)
}

function normalizePlate(value: string | null | undefined) {
  const raw = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return raw || null
}

export function getDefaultReconciliationDeps(): ReconciliationDeps {
  return {
    listSpots: async ({ siteCode, spotCode }) => {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT
            ps.site_id AS siteId,
            z.zone_id AS zoneId,
            sp.spot_id AS spotId,
            z.code AS zoneCode,
            sp.code AS spotCode
          FROM parking_sites ps
          JOIN zones z
            ON z.site_id = ps.site_id
          JOIN spots sp
            ON sp.site_id = ps.site_id
           AND sp.zone_id = z.zone_id
          WHERE ps.site_code = ?
            AND (? IS NULL OR sp.code = ?)
          ORDER BY z.code ASC, sp.code ASC
        `,
        siteCode,
        spotCode ?? null,
        spotCode ?? null,
      )

      return rows.map((row) => ({
        siteId: BigInt(row.siteId),
        zoneId: row.zoneId == null ? null : BigInt(row.zoneId),
        spotId: BigInt(row.spotId),
        zoneCode: row.zoneCode == null ? null : String(row.zoneCode),
        spotCode: String(row.spotCode),
      }))
    },
    listLatestPresenceEvents: async ({ siteCode, spotCode }) => {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT
            e.presence_event_id AS presenceEventId,
            e.spot_id AS spotId,
            e.plate_compact AS plateCompact,
            CAST(e.confidence AS DOUBLE) AS confidence,
            e.captured_at AS capturedAt,
            e.camera_code AS cameraCode,
            e.trace_id AS traceId,
            e.snapshot_object_key AS snapshotObjectKey,
            e.model_version AS modelVersion
          FROM internal_presence_events e
          JOIN parking_sites ps
            ON ps.site_id = e.site_id
          JOIN spots sp
            ON sp.spot_id = e.spot_id
          WHERE ps.site_code = ?
            AND e.intake_status = 'ACCEPTED'
            AND (? IS NULL OR sp.code = ?)
            AND e.presence_event_id IN (
              SELECT MAX(e2.presence_event_id)
              FROM internal_presence_events e2
              WHERE e2.site_id = e.site_id
                AND e2.spot_id = e.spot_id
                AND e2.intake_status = 'ACCEPTED'
            )
        `,
        siteCode,
        spotCode ?? null,
        spotCode ?? null,
      )

      const result: Record<string, LatestPresenceEventRecord> = {}
      for (const row of rows) {
        const key = String(row.spotId)
        result[key] = {
          presenceEventId: BigInt(row.presenceEventId),
          plateCompact: normalizePlate(row.plateCompact),
          confidence: row.confidence == null ? null : Number(row.confidence),
          capturedAt: row.capturedAt,
          cameraCode: row.cameraCode == null ? null : String(row.cameraCode),
          traceId: row.traceId == null ? null : String(row.traceId),
          snapshotObjectKey: row.snapshotObjectKey == null ? null : String(row.snapshotObjectKey),
          modelVersion: row.modelVersion == null ? null : String(row.modelVersion),
        }
      }
      return result
    },
    listActiveGatePresence: async ({ siteCode }) => {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT
            gp.presence_id AS presenceId,
            gp.plate_compact AS plateCompact,
            gp.ticket_id AS ticketId,
            gp.session_id AS sessionId,
            gp.entered_at AS enteredAt,
            gp.last_seen_at AS lastSeenAt
          FROM gate_active_presence gp
          JOIN parking_sites ps
            ON ps.site_id = gp.site_id
          WHERE ps.site_code = ?
            AND gp.status = 'ACTIVE'
        `,
        siteCode,
      )

      const result: Record<string, ActiveGatePresenceRecord> = {}
      for (const row of rows) {
        const plateCompact = normalizePlate(row.plateCompact)
        if (!plateCompact) continue
        result[plateCompact] = {
          presenceId: BigInt(row.presenceId),
          plateCompact,
          ticketId: row.ticketId == null ? null : BigInt(row.ticketId),
          sessionId: row.sessionId == null ? null : BigInt(row.sessionId),
          enteredAt: row.enteredAt,
          lastSeenAt: row.lastSeenAt,
        }
      }
      return result
    },
    listSubscriptionLookup: async (siteCode) => listSubscriptionOccupancyLookup(siteCode),
    persistProjection: async ({ spot, decision }) => {
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO spot_occupancy_projection (
            site_id,
            zone_id,
            spot_id,
            zone_code,
            spot_code,
            occupancy_status,
            source_presence_event_id,
            matched_gate_presence_id,
            matched_subscription_id,
            matched_subscription_spot_id,
            observed_plate_compact,
            expected_plate_compact,
            reason_code,
            reason_detail,
            stale_at,
            snapshot_json,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            zone_id = VALUES(zone_id),
            zone_code = VALUES(zone_code),
            spot_code = VALUES(spot_code),
            occupancy_status = VALUES(occupancy_status),
            source_presence_event_id = VALUES(source_presence_event_id),
            matched_gate_presence_id = VALUES(matched_gate_presence_id),
            matched_subscription_id = VALUES(matched_subscription_id),
            matched_subscription_spot_id = VALUES(matched_subscription_spot_id),
            observed_plate_compact = VALUES(observed_plate_compact),
            expected_plate_compact = VALUES(expected_plate_compact),
            reason_code = VALUES(reason_code),
            reason_detail = VALUES(reason_detail),
            stale_at = VALUES(stale_at),
            snapshot_json = VALUES(snapshot_json),
            updated_at = NOW()
        `,
        toId(spot.siteId),
        toId(spot.zoneId),
        toId(spot.spotId),
        spot.zoneCode,
        spot.spotCode,
        decision.occupancyStatus,
        decision.sourcePresenceEventId,
        decision.matchedGatePresenceId,
        decision.matchedSubscriptionId,
        decision.matchedSubscriptionSpotId,
        decision.observedPlateCompact,
        decision.expectedPlateCompact,
        decision.reasonCode,
        decision.reasonDetail,
        decision.staleAt,
        JSON.stringify(decision.snapshot ?? {}),
      )

      const row = await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT
            projection_id AS projectionId,
            site_id AS siteId,
            zone_id AS zoneId,
            spot_id AS spotId,
            zone_code AS zoneCode,
            spot_code AS spotCode,
            occupancy_status AS occupancyStatus,
            observed_plate_compact AS observedPlateCompact,
            expected_plate_compact AS expectedPlateCompact,
            matched_subscription_id AS matchedSubscriptionId,
            matched_subscription_spot_id AS matchedSubscriptionSpotId,
            matched_gate_presence_id AS matchedGatePresenceId,
            source_presence_event_id AS sourcePresenceEventId,
            reason_code AS reasonCode,
            reason_detail AS reasonDetail,
            stale_at AS staleAt,
            snapshot_json AS snapshotJson,
            updated_at AS updatedAt
          FROM spot_occupancy_projection
          WHERE site_id = ?
            AND spot_id = ?
          LIMIT 1
        `,
        toId(spot.siteId),
        toId(spot.spotId),
      )

      return mapProjectionRow(row[0])
    },
    listProjectionRows: async ({ siteCode, spotCode, status, zoneCode, limit }) => {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT
            p.projection_id AS projectionId,
            p.site_id AS siteId,
            p.zone_id AS zoneId,
            p.spot_id AS spotId,
            p.zone_code AS zoneCode,
            p.spot_code AS spotCode,
            p.occupancy_status AS occupancyStatus,
            p.observed_plate_compact AS observedPlateCompact,
            p.expected_plate_compact AS expectedPlateCompact,
            p.matched_subscription_id AS matchedSubscriptionId,
            p.matched_subscription_spot_id AS matchedSubscriptionSpotId,
            p.matched_gate_presence_id AS matchedGatePresenceId,
            p.source_presence_event_id AS sourcePresenceEventId,
            p.reason_code AS reasonCode,
            p.reason_detail AS reasonDetail,
            p.stale_at AS staleAt,
            p.snapshot_json AS snapshotJson,
            p.updated_at AS updatedAt
          FROM spot_occupancy_projection p
          JOIN parking_sites ps
            ON ps.site_id = p.site_id
          WHERE ps.site_code = ?
            AND (? IS NULL OR p.spot_code = ?)
            AND (? IS NULL OR p.occupancy_status = ?)
            AND (? IS NULL OR p.zone_code = ?)
          ORDER BY p.zone_code ASC, p.spot_code ASC
          LIMIT ?
        `,
        siteCode,
        spotCode ?? null,
        spotCode ?? null,
        status ?? null,
        status ?? null,
        zoneCode ?? null,
        zoneCode ?? null,
        limit ?? 500,
      )
      return rows.map(mapProjectionRow)
    },
    getProjectionRow: async ({ siteCode, spotCode }) => {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT
            p.projection_id AS projectionId,
            p.site_id AS siteId,
            p.zone_id AS zoneId,
            p.spot_id AS spotId,
            p.zone_code AS zoneCode,
            p.spot_code AS spotCode,
            p.occupancy_status AS occupancyStatus,
            p.observed_plate_compact AS observedPlateCompact,
            p.expected_plate_compact AS expectedPlateCompact,
            p.matched_subscription_id AS matchedSubscriptionId,
            p.matched_subscription_spot_id AS matchedSubscriptionSpotId,
            p.matched_gate_presence_id AS matchedGatePresenceId,
            p.source_presence_event_id AS sourcePresenceEventId,
            p.reason_code AS reasonCode,
            p.reason_detail AS reasonDetail,
            p.stale_at AS staleAt,
            p.snapshot_json AS snapshotJson,
            p.updated_at AS updatedAt
          FROM spot_occupancy_projection p
          JOIN parking_sites ps
            ON ps.site_id = p.site_id
          WHERE ps.site_code = ?
            AND p.spot_code = ?
          LIMIT 1
        `,
        siteCode,
        spotCode,
      )
      return rows[0] ? mapProjectionRow(rows[0]) : null
    },
  }
}

function mapProjectionRow(row: any): SpotProjectionRow {
  return {
    projectionId: toId(row.projectionId),
    siteId: String(row.siteId),
    zoneId: toId(row.zoneId),
    spotId: String(row.spotId),
    zoneCode: row.zoneCode == null ? null : String(row.zoneCode),
    spotCode: String(row.spotCode),
    occupancyStatus: String(row.occupancyStatus) as SpotOccupancyStatus,
    observedPlateCompact: row.observedPlateCompact == null ? null : String(row.observedPlateCompact),
    expectedPlateCompact: row.expectedPlateCompact == null ? null : String(row.expectedPlateCompact),
    matchedSubscriptionId: toId(row.matchedSubscriptionId),
    matchedSubscriptionSpotId: toId(row.matchedSubscriptionSpotId),
    matchedGatePresenceId: toId(row.matchedGatePresenceId),
    sourcePresenceEventId: toId(row.sourcePresenceEventId),
    reasonCode: String(row.reasonCode),
    reasonDetail: String(row.reasonDetail),
    staleAt: row.staleAt ? new Date(row.staleAt).toISOString() : null,
    snapshot:
      row.snapshotJson == null
        ? {}
        : typeof row.snapshotJson === 'string'
          ? (() => { try { return JSON.parse(row.snapshotJson) } catch { return {} } })()
          : typeof row.snapshotJson === 'object'
            ? row.snapshotJson
            : {},
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

export async function runReconciliation(
  input: RunReconciliationInput,
  deps: ReconciliationDeps = getDefaultReconciliationDeps(),
) {
  const now = input.now ?? new Date()
  const sensorStaleSeconds = input.sensorStaleSeconds ?? envNumber('RECONCILIATION_SENSOR_STALE_SECONDS', 180)

  const [spots, latestEventsBySpotId, activeGatePresenceByPlate, subscriptionLookup] = await Promise.all([
    deps.listSpots({ siteCode: input.siteCode, spotCode: input.spotCode ?? null }),
    deps.listLatestPresenceEvents({ siteCode: input.siteCode, spotCode: input.spotCode ?? null }),
    deps.listActiveGatePresence({ siteCode: input.siteCode }),
    deps.listSubscriptionLookup(input.siteCode),
  ])

  const rows: SpotProjectionRow[] = []
  const summary = {
    EMPTY: 0,
    OCCUPIED_MATCHED: 0,
    OCCUPIED_UNKNOWN: 0,
    OCCUPIED_VIOLATION: 0,
    SENSOR_STALE: 0,
  } as Record<SpotOccupancyStatus, number>

  for (const spot of spots) {
    const latestPresenceEvent = latestEventsBySpotId[String(spot.spotId)] ?? null
    const observedPlateCompact = normalizePlate(latestPresenceEvent?.plateCompact)
    const activeGatePresence = observedPlateCompact ? activeGatePresenceByPlate[observedPlateCompact] ?? null : null
    const observedVehicleSubscription = observedPlateCompact ? subscriptionLookup.byPlate[observedPlateCompact] ?? null : null
    const reservedSpotSubscription = subscriptionLookup.bySpotId[String(spot.spotId)] ?? null

    const decision = reconcileSpotProjection({
      now,
      sensorStaleSeconds,
      spot,
      latestPresenceEvent,
      activeGatePresence,
      observedVehicleSubscription,
      reservedSpotSubscription,
    })

    const persisted = await deps.persistProjection({ spot, decision })
    await syncIncidentFromSpotProjection(persisted)
    rows.push(persisted)
    summary[persisted.occupancyStatus] += 1
  }

  return {
    siteCode: input.siteCode,
    spotCode: input.spotCode ?? null,
    sensorStaleSeconds,
    processedCount: rows.length,
    summary,
    rows,
  }
}

export async function listSpotOccupancyProjection(args: {
  siteCode: string
  spotCode?: string | null
  status?: string | null
  zoneCode?: string | null
  limit?: number
}, deps: ReconciliationDeps = getDefaultReconciliationDeps()) {
  return deps.listProjectionRows(args)
}

export async function getSpotOccupancyProjectionDetail(args: {
  siteCode: string
  spotCode: string
}, deps: ReconciliationDeps = getDefaultReconciliationDeps()) {
  return deps.getProjectionRow(args)
}
