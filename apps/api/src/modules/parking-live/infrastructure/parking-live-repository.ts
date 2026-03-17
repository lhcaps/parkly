import { prisma } from '../../../lib/prisma'
import type { SpotOccupancyStatus } from '../../reconciliation/domain/reconciliation'
import type { ParkingLiveBaseRow, ParkingLiveSiteRef } from '../domain/parking-live-types'

function toId(value: unknown) {
  return value == null ? null : String(value)
}

function toIso(value: unknown) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export type ParkingLivePresenceSnapshot = {
  presenceId: string | null
  capturedAt: string | null
  cameraCode: string | null
  traceId: string | null
}

export type ParkingLiveSessionSnapshot = {
  gatePresenceId: string | null
  sessionId: string | null
  ticketId: string | null
  status: string | null
  enteredAt: string | null
  lastSeenAt: string | null
}

export type ParkingLiveIncidentSnapshot = {
  incidentId: string
  incidentType: string
  status: string
  severity: string
  title: string
  updatedAt: string
} | null

export type ParkingLiveSubscriptionSnapshot = {
  subscriptionId: string
  status: string | null
} | null

export type ParkingLiveRepository = {
  requireSite(siteCode: string): Promise<ParkingLiveSiteRef & { siteId: string }>
  listBaseRows(args: { siteCode: string; zoneCode?: string | null }): Promise<ParkingLiveBaseRow[]>
  getBaseRow(args: { siteCode: string; spotCode: string }): Promise<ParkingLiveBaseRow | null>
  getLatestPresence(args: { siteId: string; spotId: string }): Promise<ParkingLivePresenceSnapshot | null>
  getMatchedGatePresence(gatePresenceId: string | null): Promise<ParkingLiveSessionSnapshot | null>
  getLatestIncident(args: { siteId: string; spotId: string }): Promise<ParkingLiveIncidentSnapshot>
  getSubscriptionById(subscriptionId: string | null): Promise<ParkingLiveSubscriptionSnapshot>
}

export function createParkingLiveRepository(): ParkingLiveRepository {
  return {
    async requireSite(siteCode) {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT site_id AS siteId, site_code AS siteCode, name
          FROM parking_sites
          WHERE site_code = ?
          LIMIT 1
        `,
        siteCode,
      )
      const row = rows[0]
      if (!row) return Promise.reject(new Error(`SITE_NOT_FOUND:${siteCode}`))
      return {
        siteId: String(row.siteId),
        siteCode: String(row.siteCode),
        name: String(row.name),
      }
    },

    async listBaseRows({ siteCode, zoneCode }) {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT
            ps.site_id AS siteId,
            ps.site_code AS siteCode,
            ps.name AS siteName,
            z.zone_id AS zoneId,
            z.code AS zoneCode,
            z.name AS zoneName,
            z.vehicle_type AS zoneVehicleType,
            sp.spot_id AS spotId,
            sp.code AS spotCode,
            sp.status AS spotStatus,
            COALESCE(sp.floor_key, z.code) AS floorKey,
            sp.layout_row AS layoutRow,
            sp.layout_col AS layoutCol,
            sp.layout_order AS layoutOrder,
            sp.slot_kind AS slotKind,
            COALESCE(sp.is_blocked, 0) AS isBlocked,
            COALESCE(sp.is_reserved, 0) AS isReserved,
            sp.display_label AS displayLabel,
            pop.projection_id AS projectionId,
            pop.occupancy_status AS occupancyStatus,
            pop.observed_plate_compact AS observedPlateCompact,
            pop.expected_plate_compact AS expectedPlateCompact,
            pop.matched_subscription_id AS matchedSubscriptionId,
            pop.matched_subscription_spot_id AS matchedSubscriptionSpotId,
            pop.matched_gate_presence_id AS matchedGatePresenceId,
            pop.source_presence_event_id AS sourcePresenceEventId,
            pop.reason_code AS reasonCode,
            pop.reason_detail AS reasonDetail,
            pop.stale_at AS staleAt,
            pop.snapshot_json AS snapshotJson,
            pop.updated_at AS updatedAt
          FROM parking_sites ps
          JOIN spots sp
            ON sp.site_id = ps.site_id
          JOIN zones z
            ON z.zone_id = sp.zone_id
          LEFT JOIN spot_occupancy_projection pop
            ON pop.site_id = sp.site_id
           AND pop.spot_id = sp.spot_id
          WHERE ps.site_code = ?
            AND (? IS NULL OR z.code = ?)
          ORDER BY z.code ASC, sp.code ASC
        `,
        siteCode,
        zoneCode ?? null,
        zoneCode ?? null,
      )

      return rows.map((row) => ({
        siteId: String(row.siteId),
        siteCode: String(row.siteCode),
        siteName: String(row.siteName),
        zoneId: toId(row.zoneId),
        zoneCode: row.zoneCode == null ? null : String(row.zoneCode),
        zoneName: row.zoneName == null ? null : String(row.zoneName),
        zoneVehicleType: row.zoneVehicleType == null ? null : String(row.zoneVehicleType),
        spotId: String(row.spotId),
        spotCode: String(row.spotCode),
        spotStatus: row.spotStatus == null ? null : String(row.spotStatus),
        floorKeyDirect: row.floorKey == null ? null : String(row.floorKey),
        layoutRowDirect: row.layoutRow == null ? null : Number(row.layoutRow),
        layoutColDirect: row.layoutCol == null ? null : Number(row.layoutCol),
        layoutOrderDirect: row.layoutOrder == null ? null : Number(row.layoutOrder),
        slotKindDirect: row.slotKind == null ? null : String(row.slotKind),
        isBlockedDirect: Boolean(row.isBlocked),
        isReservedDirect: Boolean(row.isReserved),
        displayLabelDirect: row.displayLabel == null ? null : String(row.displayLabel),
        projectionId: toId(row.projectionId),
        occupancyStatus: row.occupancyStatus == null ? null : String(row.occupancyStatus) as SpotOccupancyStatus,
        observedPlateCompact: row.observedPlateCompact == null ? null : String(row.observedPlateCompact),
        expectedPlateCompact: row.expectedPlateCompact == null ? null : String(row.expectedPlateCompact),
        matchedSubscriptionId: toId(row.matchedSubscriptionId),
        matchedSubscriptionSpotId: toId(row.matchedSubscriptionSpotId),
        matchedGatePresenceId: toId(row.matchedGatePresenceId),
        sourcePresenceEventId: toId(row.sourcePresenceEventId),
        reasonCode: row.reasonCode == null ? null : String(row.reasonCode),
        reasonDetail: row.reasonDetail == null ? null : String(row.reasonDetail),
        staleAt: toIso(row.staleAt),
        snapshot: parseJsonObject(row.snapshotJson),
        updatedAt: toIso(row.updatedAt),
      }))
    },

    async getBaseRow({ siteCode, spotCode }) {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT
            ps.site_id AS siteId,
            ps.site_code AS siteCode,
            ps.name AS siteName,
            z.zone_id AS zoneId,
            z.code AS zoneCode,
            z.name AS zoneName,
            z.vehicle_type AS zoneVehicleType,
            sp.spot_id AS spotId,
            sp.code AS spotCode,
            sp.status AS spotStatus,
            COALESCE(sp.floor_key, z.code) AS floorKey,
            sp.layout_row AS layoutRow,
            sp.layout_col AS layoutCol,
            sp.layout_order AS layoutOrder,
            sp.slot_kind AS slotKind,
            COALESCE(sp.is_blocked, 0) AS isBlocked,
            COALESCE(sp.is_reserved, 0) AS isReserved,
            sp.display_label AS displayLabel,
            pop.projection_id AS projectionId,
            pop.occupancy_status AS occupancyStatus,
            pop.observed_plate_compact AS observedPlateCompact,
            pop.expected_plate_compact AS expectedPlateCompact,
            pop.matched_subscription_id AS matchedSubscriptionId,
            pop.matched_subscription_spot_id AS matchedSubscriptionSpotId,
            pop.matched_gate_presence_id AS matchedGatePresenceId,
            pop.source_presence_event_id AS sourcePresenceEventId,
            pop.reason_code AS reasonCode,
            pop.reason_detail AS reasonDetail,
            pop.stale_at AS staleAt,
            pop.snapshot_json AS snapshotJson,
            pop.updated_at AS updatedAt
          FROM parking_sites ps
          JOIN spots sp
            ON sp.site_id = ps.site_id
          JOIN zones z
            ON z.zone_id = sp.zone_id
          LEFT JOIN spot_occupancy_projection pop
            ON pop.site_id = sp.site_id
           AND pop.spot_id = sp.spot_id
          WHERE ps.site_code = ?
            AND sp.code = ?
          LIMIT 1
        `,
        siteCode,
        spotCode,
      )

      const row = rows[0]
      if (!row) return null
      return {
        siteId: String(row.siteId),
        siteCode: String(row.siteCode),
        siteName: String(row.siteName),
        zoneId: toId(row.zoneId),
        zoneCode: row.zoneCode == null ? null : String(row.zoneCode),
        zoneName: row.zoneName == null ? null : String(row.zoneName),
        zoneVehicleType: row.zoneVehicleType == null ? null : String(row.zoneVehicleType),
        spotId: String(row.spotId),
        spotCode: String(row.spotCode),
        spotStatus: row.spotStatus == null ? null : String(row.spotStatus),
        floorKeyDirect: row.floorKey == null ? null : String(row.floorKey),
        layoutRowDirect: row.layoutRow == null ? null : Number(row.layoutRow),
        layoutColDirect: row.layoutCol == null ? null : Number(row.layoutCol),
        layoutOrderDirect: row.layoutOrder == null ? null : Number(row.layoutOrder),
        slotKindDirect: row.slotKind == null ? null : String(row.slotKind),
        isBlockedDirect: Boolean(row.isBlocked),
        isReservedDirect: Boolean(row.isReserved),
        displayLabelDirect: row.displayLabel == null ? null : String(row.displayLabel),
        projectionId: toId(row.projectionId),
        occupancyStatus: row.occupancyStatus == null ? null : String(row.occupancyStatus) as SpotOccupancyStatus,
        observedPlateCompact: row.observedPlateCompact == null ? null : String(row.observedPlateCompact),
        expectedPlateCompact: row.expectedPlateCompact == null ? null : String(row.expectedPlateCompact),
        matchedSubscriptionId: toId(row.matchedSubscriptionId),
        matchedSubscriptionSpotId: toId(row.matchedSubscriptionSpotId),
        matchedGatePresenceId: toId(row.matchedGatePresenceId),
        sourcePresenceEventId: toId(row.sourcePresenceEventId),
        reasonCode: row.reasonCode == null ? null : String(row.reasonCode),
        reasonDetail: row.reasonDetail == null ? null : String(row.reasonDetail),
        staleAt: toIso(row.staleAt),
        snapshot: parseJsonObject(row.snapshotJson),
        updatedAt: toIso(row.updatedAt),
      }
    },

    async getLatestPresence({ siteId, spotId }) {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT
            presence_event_id AS presenceId,
            captured_at AS capturedAt,
            camera_code AS cameraCode,
            trace_id AS traceId
          FROM internal_presence_events
          WHERE site_id = ?
            AND spot_id = ?
            AND intake_status = 'ACCEPTED'
          ORDER BY captured_at DESC, presence_event_id DESC
          LIMIT 1
        `,
        siteId,
        spotId,
      )
      const row = rows[0]
      if (!row) return null
      return {
        presenceId: toId(row.presenceId),
        capturedAt: toIso(row.capturedAt),
        cameraCode: row.cameraCode == null ? null : String(row.cameraCode),
        traceId: row.traceId == null ? null : String(row.traceId),
      }
    },

    async getMatchedGatePresence(gatePresenceId) {
      if (!gatePresenceId) return null
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT
            presence_id AS gatePresenceId,
            session_id AS sessionId,
            ticket_id AS ticketId,
            status,
            entered_at AS enteredAt,
            last_seen_at AS lastSeenAt
          FROM gate_active_presence
          WHERE presence_id = ?
          LIMIT 1
        `,
        gatePresenceId,
      )
      const row = rows[0]
      if (!row) return null
      return {
        gatePresenceId: toId(row.gatePresenceId),
        sessionId: toId(row.sessionId),
        ticketId: toId(row.ticketId),
        status: row.status == null ? null : String(row.status),
        enteredAt: toIso(row.enteredAt),
        lastSeenAt: toIso(row.lastSeenAt),
      }
    },

    async getLatestIncident({ siteId, spotId }) {
      const sourceKey = `reconciliation:${siteId}:${spotId}`
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT
            incident_id AS incidentId,
            incident_type AS incidentType,
            status,
            severity,
            title,
            updated_at AS updatedAt
          FROM gate_incidents
          WHERE source_key = ?
          ORDER BY incident_id DESC
          LIMIT 1
        `,
        sourceKey,
      )
      const row = rows[0]
      if (!row) return null
      return {
        incidentId: String(row.incidentId),
        incidentType: String(row.incidentType),
        status: String(row.status),
        severity: String(row.severity),
        title: String(row.title),
        updatedAt: toIso(row.updatedAt) ?? new Date(0).toISOString(),
      }
    },

    async getSubscriptionById(subscriptionId) {
      if (!subscriptionId) return null
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
          SELECT subscription_id AS subscriptionId, status
          FROM subscriptions
          WHERE subscription_id = ?
          LIMIT 1
        `,
        subscriptionId,
      )
      const row = rows[0]
      if (!row) return null
      return {
        subscriptionId: String(row.subscriptionId),
        status: row.status == null ? null : String(row.status),
      }
    },
  }
}
