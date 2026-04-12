import { Prisma } from '@prisma/client'

import { prisma } from '../../../lib/prisma'
import type {
  DashboardIncidentSiteRow,
  DashboardLaneSiteRow,
  DashboardOccupancySiteRow,
  DashboardSubscriptionSiteRow,
  DashboardTopologySiteRow,
} from '../../../modules/dashboard/application/dashboard-summary-composer'

function toNumber(value: unknown) {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num : 0
}

function toIso(value: unknown) {
  if (value == null) return null
  const dt = new Date(String(value))
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
}

function normalizeSiteCodes(siteCodes: string[]) {
  return [...new Set(siteCodes.map((siteCode) => String(siteCode ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function requireSiteCodes(siteCodes: string[]) {
  const normalized = normalizeSiteCodes(siteCodes)
  if (normalized.length === 0) throw new Error('siteCodes must not be empty')
  return normalized
}

function siteCodeSqlList(siteCodes: string[]) {
  return Prisma.join(
    requireSiteCodes(siteCodes).map((siteCode) => Prisma.sql`CAST(${siteCode} AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci`),
  )
}

export async function queryIncidentSummarySiteRows(args: {
  siteCodes: string[]
  sinceHours: number
}): Promise<DashboardIncidentSiteRow[]> {
  const cutoff = new Date(Date.now() - Math.max(1, args.sinceHours) * 3_600_000)
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      ps.site_code AS siteCode,
      COUNT(di.incidentId) AS totalCount,
      COALESCE(SUM(CASE WHEN di.status = 'OPEN' COLLATE utf8mb4_0900_ai_ci THEN 1 ELSE 0 END), 0) AS openCount,
      COALESCE(SUM(CASE WHEN di.status = 'ACKED' COLLATE utf8mb4_0900_ai_ci THEN 1 ELSE 0 END), 0) AS ackedCount,
      COALESCE(SUM(CASE WHEN di.status = 'RESOLVED' COLLATE utf8mb4_0900_ai_ci THEN 1 ELSE 0 END), 0) AS resolvedCount,
      COALESCE(SUM(CASE WHEN di.status = 'IGNORED' COLLATE utf8mb4_0900_ai_ci THEN 1 ELSE 0 END), 0) AS ignoredCount,
      COALESCE(SUM(CASE WHEN di.status = 'OPEN' COLLATE utf8mb4_0900_ai_ci AND di.severity = 'CRITICAL' COLLATE utf8mb4_0900_ai_ci THEN 1 ELSE 0 END), 0) AS criticalOpenCount,
      COALESCE(SUM(CASE WHEN di.severity = 'INFO' COLLATE utf8mb4_0900_ai_ci THEN 1 ELSE 0 END), 0) AS infoCount,
      COALESCE(SUM(CASE WHEN di.severity = 'WARN' COLLATE utf8mb4_0900_ai_ci THEN 1 ELSE 0 END), 0) AS warnCount,
      COALESCE(SUM(CASE WHEN di.severity = 'CRITICAL' COLLATE utf8mb4_0900_ai_ci THEN 1 ELSE 0 END), 0) AS criticalCount,
      COALESCE(SUM(CASE WHEN di.resolvedAt IS NOT NULL AND di.resolvedAt >= ${cutoff} THEN 1 ELSE 0 END), 0) AS resolvedWithinWindowCount,
      MIN(CASE WHEN di.status IN ('OPEN' COLLATE utf8mb4_0900_ai_ci, 'ACKED' COLLATE utf8mb4_0900_ai_ci) THEN di.createdAt END) AS oldestActiveCreatedAt,
      MAX(di.updatedAt) AS lastUpdatedAt
    FROM parking_sites ps
    LEFT JOIN pkg_dashboard_incident_summary_v di
      ON di.siteCode = ps.site_code
    WHERE ps.site_code IN (${siteCodeSqlList(args.siteCodes)})
    GROUP BY ps.site_code
    ORDER BY ps.site_code ASC
  `)

  return rows.map((row) => ({
    siteCode: String(row.siteCode ?? ''),
    totalCount: toNumber(row.totalCount),
    openCount: toNumber(row.openCount),
    ackedCount: toNumber(row.ackedCount),
    resolvedCount: toNumber(row.resolvedCount),
    ignoredCount: toNumber(row.ignoredCount),
    criticalOpenCount: toNumber(row.criticalOpenCount),
    infoCount: toNumber(row.infoCount),
    warnCount: toNumber(row.warnCount),
    criticalCount: toNumber(row.criticalCount),
    resolvedWithinWindowCount: toNumber(row.resolvedWithinWindowCount),
    oldestActiveCreatedAt: toIso(row.oldestActiveCreatedAt),
    lastUpdatedAt: toIso(row.lastUpdatedAt),
  }))
}

export async function queryOccupancySummarySiteRows(args: {
  siteCodes: string[]
}): Promise<DashboardOccupancySiteRow[]> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      o.siteCode,
      o.totalSpots,
      o.emptyCount,
      o.occupiedMatchedCount,
      o.occupiedUnknownCount,
      o.occupiedViolationCount,
      o.sensorStaleCount,
      o.unreportedCount,
      o.occupiedTotal,
      o.lastProjectedAt
    FROM pkg_dashboard_occupancy_summary_v o
    WHERE o.siteCode IN (${siteCodeSqlList(args.siteCodes)})
    ORDER BY o.siteCode ASC
  `)

  return rows.map((row) => {
    const totalSpots = toNumber(row.totalSpots)
    const occupiedTotal = toNumber(row.occupiedTotal)
    return {
      siteCode: String(row.siteCode ?? ''),
      totalSpots,
      emptyCount: toNumber(row.emptyCount),
      occupiedMatchedCount: toNumber(row.occupiedMatchedCount),
      occupiedUnknownCount: toNumber(row.occupiedUnknownCount),
      occupiedViolationCount: toNumber(row.occupiedViolationCount),
      sensorStaleCount: toNumber(row.sensorStaleCount),
      unreportedCount: toNumber(row.unreportedCount),
      occupiedTotal,
      occupancyRate: totalSpots > 0 ? Number(((occupiedTotal / totalSpots) * 100).toFixed(2)) : 0,
      lastProjectedAt: toIso(row.lastProjectedAt),
    }
  })
}

export async function querySubscriptionSummarySiteRows(args: {
  siteCodes: string[]
  expiringInDays: number
}): Promise<DashboardSubscriptionSiteRow[]> {
  const expiringInDays = Math.max(0, args.expiringInDays)
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      ps.site_code AS siteCode,
      COUNT(s.subscription_id) AS totalSubscriptions,
      COALESCE(SUM(CASE WHEN s.active_window_flag = 1 THEN 1 ELSE 0 END), 0) AS activeCount,
      COALESCE(SUM(CASE WHEN s.effective_status = 'EXPIRED' COLLATE utf8mb4_unicode_ci THEN 1 ELSE 0 END), 0) AS expiredCount,
      COALESCE(SUM(CASE WHEN s.effective_status = 'CANCELLED' COLLATE utf8mb4_unicode_ci THEN 1 ELSE 0 END), 0) AS cancelledCount,
      COALESCE(SUM(CASE WHEN s.effective_status = 'SUSPENDED' COLLATE utf8mb4_unicode_ci THEN 1 ELSE 0 END), 0) AS suspendedCount,
      COALESCE(SUM(CASE WHEN s.plan_type = 'MONTHLY' COLLATE utf8mb4_0900_ai_ci AND s.active_window_flag = 1 THEN 1 ELSE 0 END), 0) AS monthlyActiveCount,
      COALESCE(SUM(CASE WHEN s.plan_type = 'VIP' COLLATE utf8mb4_0900_ai_ci AND s.active_window_flag = 1 THEN 1 ELSE 0 END), 0) AS vipActiveCount,
      COALESCE(SUM(CASE WHEN s.active_window_flag = 1 AND s.days_to_expiry BETWEEN 0 AND ${expiringInDays} THEN 1 ELSE 0 END), 0) AS expiringSoonCount,
      COALESCE(SUM(s.active_vehicle_link_count), 0) AS activeVehicleLinkCount,
      COALESCE(SUM(s.active_spot_link_count), 0) AS activeSpotLinkCount
    FROM parking_sites ps
    LEFT JOIN pkg_subscription_effective_status_v s
      ON s.site_id = ps.site_id
    WHERE ps.site_code IN (${siteCodeSqlList(args.siteCodes)})
    GROUP BY ps.site_code, ps.site_id
    ORDER BY ps.site_code ASC
  `)

  return rows.map((row) => ({
    siteCode: String(row.siteCode ?? ''),
    totalSubscriptions: toNumber(row.totalSubscriptions),
    activeCount: toNumber(row.activeCount),
    expiredCount: toNumber(row.expiredCount),
    cancelledCount: toNumber(row.cancelledCount),
    suspendedCount: toNumber(row.suspendedCount),
    monthlyActiveCount: toNumber(row.monthlyActiveCount),
    vipActiveCount: toNumber(row.vipActiveCount),
    expiringSoonCount: toNumber(row.expiringSoonCount),
    activeVehicleLinkCount: toNumber(row.activeVehicleLinkCount),
    activeSpotLinkCount: toNumber(row.activeSpotLinkCount),
  }))
}

export async function queryLaneSummarySiteRows(args: {
  siteCodes: string[]
}): Promise<DashboardLaneSiteRow[]> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      ps.site_code AS siteCode,
      COUNT(lh.lane_id) AS totalLanes,
      COALESCE(SUM(CASE WHEN lh.direction = 'ENTRY' COLLATE utf8mb4_0900_ai_ci THEN 1 ELSE 0 END), 0) AS entryCount,
      COALESCE(SUM(CASE WHEN lh.direction = 'EXIT' COLLATE utf8mb4_0900_ai_ci THEN 1 ELSE 0 END), 0) AS exitCount,
      COALESCE(SUM(CASE WHEN lh.laneOperationalStatus = 'ACTIVE' COLLATE utf8mb4_0900_ai_ci THEN 1 ELSE 0 END), 0) AS activeCount,
      COALESCE(SUM(CASE WHEN lh.laneOperationalStatus = 'INACTIVE' COLLATE utf8mb4_0900_ai_ci THEN 1 ELSE 0 END), 0) AS inactiveCount,
      COALESCE(SUM(CASE WHEN lh.laneOperationalStatus = 'MAINTENANCE' COLLATE utf8mb4_0900_ai_ci THEN 1 ELSE 0 END), 0) AS maintenanceCount,
      COALESCE(SUM(CASE WHEN lh.aggregateHealth = 'HEALTHY' COLLATE utf8mb4_unicode_ci THEN 1 ELSE 0 END), 0) AS healthyCount,
      COALESCE(SUM(CASE WHEN lh.aggregateHealth = 'OFFLINE' COLLATE utf8mb4_unicode_ci THEN 1 ELSE 0 END), 0) AS offlineCount,
      COALESCE(SUM(CASE WHEN lh.aggregateHealth = 'BARRIER_FAULT' COLLATE utf8mb4_unicode_ci THEN 1 ELSE 0 END), 0) AS barrierFaultCount,
      COALESCE(SUM(CASE WHEN lh.aggregateHealth NOT IN ('HEALTHY' COLLATE utf8mb4_unicode_ci, 'OFFLINE' COLLATE utf8mb4_unicode_ci, 'BARRIER_FAULT' COLLATE utf8mb4_unicode_ci) THEN 1 ELSE 0 END), 0) AS degradedCount,
      COALESCE(SUM(CASE WHEN lh.aggregateHealth <> 'HEALTHY' COLLATE utf8mb4_unicode_ci THEN 1 ELSE 0 END), 0) AS attentionCount,
      COALESCE(SUM(lh.activePresenceCount), 0) AS activePresenceCount,
      COALESCE(SUM(CASE WHEN lh.lastSessionStatus IN (
        'OPEN' COLLATE utf8mb4_0900_ai_ci,
        'WAITING_READ' COLLATE utf8mb4_0900_ai_ci,
        'WAITING_DECISION' COLLATE utf8mb4_0900_ai_ci,
        'APPROVED' COLLATE utf8mb4_0900_ai_ci,
        'WAITING_PAYMENT' COLLATE utf8mb4_0900_ai_ci
      ) THEN 1 ELSE 0 END), 0) AS openSessionCount
    FROM parking_sites ps
    LEFT JOIN pkg_gate_lane_health_v lh
      ON lh.site_id = ps.site_id
    WHERE ps.site_code IN (${siteCodeSqlList(args.siteCodes)})
    GROUP BY ps.site_code, ps.site_id
    ORDER BY ps.site_code ASC
  `)

  return rows.map((row) => ({
    siteCode: String(row.siteCode ?? ''),
    totalLanes: toNumber(row.totalLanes),
    entryCount: toNumber(row.entryCount),
    exitCount: toNumber(row.exitCount),
    activeCount: toNumber(row.activeCount),
    inactiveCount: toNumber(row.inactiveCount),
    maintenanceCount: toNumber(row.maintenanceCount),
    healthyCount: toNumber(row.healthyCount),
    degradedCount: toNumber(row.degradedCount),
    barrierFaultCount: toNumber(row.barrierFaultCount),
    offlineCount: toNumber(row.offlineCount),
    attentionCount: toNumber(row.attentionCount),
    activePresenceCount: toNumber(row.activePresenceCount),
    openSessionCount: toNumber(row.openSessionCount),
  }))
}

export async function queryTopologyCountsPerSite(args: {
  siteCodes: string[]
}): Promise<DashboardTopologySiteRow[]> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      t.siteCode,
      t.zoneCount,
      t.gateCount,
      t.laneCount,
      t.deviceCount,
      t.zoneCodes,
      t.zoneNames,
      t.vehicleTypes
    FROM pkg_dashboard_topology_summary_v t
    WHERE t.siteCode IN (${siteCodeSqlList(args.siteCodes)})
    ORDER BY t.siteCode ASC
  `)

  return rows.map((row) => {
    const zoneCodesRaw = String(row.zoneCodes ?? '').trim()
    const zoneNamesRaw = String(row.zoneNames ?? '').trim()
    const vehicleTypesRaw = String(row.vehicleTypes ?? '').trim()

    return {
      siteCode: String(row.siteCode ?? ''),
      zoneCount: toNumber(row.zoneCount),
      gateCount: toNumber(row.gateCount),
      laneCount: toNumber(row.laneCount),
      deviceCount: toNumber(row.deviceCount),
      zoneCodes: zoneCodesRaw ? zoneCodesRaw.split(',').filter(Boolean) : [],
      zoneNames: zoneNamesRaw ? zoneNamesRaw.split('|||').filter(Boolean) : [],
      vehicleTypes: [...new Set(vehicleTypesRaw.split(',').filter(Boolean))],
    }
  })
}
