import { Prisma } from '@prisma/client'

import { prisma } from '../../../lib/prisma'
import { getLaneStatusSnapshot } from '../gate-realtime.service'
import type {
  DashboardIncidentSiteRow,
  DashboardLaneSiteRow,
  DashboardOccupancySiteRow,
  DashboardSubscriptionSiteRow,
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

function siteCodeFilter(siteCodes: string[]) {
  const normalized = requireSiteCodes(siteCodes)
  return Prisma.sql`AND ps.site_code IN (${Prisma.join(normalized)})`
}

export async function queryIncidentSummarySiteRows(args: {
  siteCodes: string[]
  sinceHours: number
}): Promise<DashboardIncidentSiteRow[]> {
  const cutoff = new Date(Date.now() - Math.max(1, args.sinceHours) * 3_600_000)
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      ps.site_code AS siteCode,
      COUNT(gi.incident_id) AS totalCount,
      COALESCE(SUM(CASE WHEN gi.status = 'OPEN' THEN 1 ELSE 0 END), 0) AS openCount,
      COALESCE(SUM(CASE WHEN gi.status = 'ACKED' THEN 1 ELSE 0 END), 0) AS ackedCount,
      COALESCE(SUM(CASE WHEN gi.status = 'RESOLVED' THEN 1 ELSE 0 END), 0) AS resolvedCount,
      COALESCE(SUM(CASE WHEN gi.status = 'IGNORED' THEN 1 ELSE 0 END), 0) AS ignoredCount,
      COALESCE(SUM(CASE WHEN gi.status = 'OPEN' AND gi.severity = 'CRITICAL' THEN 1 ELSE 0 END), 0) AS criticalOpenCount,
      COALESCE(SUM(CASE WHEN gi.severity = 'INFO' THEN 1 ELSE 0 END), 0) AS infoCount,
      COALESCE(SUM(CASE WHEN gi.severity = 'WARN' THEN 1 ELSE 0 END), 0) AS warnCount,
      COALESCE(SUM(CASE WHEN gi.severity = 'CRITICAL' THEN 1 ELSE 0 END), 0) AS criticalCount,
      COALESCE(SUM(CASE WHEN gi.resolved_at IS NOT NULL AND gi.resolved_at >= ${cutoff} THEN 1 ELSE 0 END), 0) AS resolvedWithinWindowCount,
      MIN(CASE WHEN gi.status IN ('OPEN', 'ACKED') THEN gi.created_at END) AS oldestActiveCreatedAt,
      MAX(gi.updated_at) AS lastUpdatedAt
    FROM parking_sites ps
    LEFT JOIN gate_incidents gi
      ON gi.site_id = ps.site_id
    WHERE 1 = 1
      ${siteCodeFilter(args.siteCodes)}
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
      ps.site_code AS siteCode,
      COUNT(sp.spot_id) AS totalSpots,
      COALESCE(SUM(CASE WHEN pop.occupancy_status = 'EMPTY' THEN 1 ELSE 0 END), 0) AS emptyCount,
      COALESCE(SUM(CASE WHEN pop.occupancy_status = 'OCCUPIED_MATCHED' THEN 1 ELSE 0 END), 0) AS occupiedMatchedCount,
      COALESCE(SUM(CASE WHEN pop.occupancy_status = 'OCCUPIED_UNKNOWN' THEN 1 ELSE 0 END), 0) AS occupiedUnknownCount,
      COALESCE(SUM(CASE WHEN pop.occupancy_status = 'OCCUPIED_VIOLATION' THEN 1 ELSE 0 END), 0) AS occupiedViolationCount,
      COALESCE(SUM(CASE WHEN pop.occupancy_status = 'SENSOR_STALE' THEN 1 ELSE 0 END), 0) AS sensorStaleCount,
      COALESCE(SUM(CASE WHEN sp.spot_id IS NOT NULL AND pop.projection_id IS NULL THEN 1 ELSE 0 END), 0) AS unreportedCount,
      COALESCE(SUM(CASE WHEN pop.occupancy_status IN ('OCCUPIED_MATCHED', 'OCCUPIED_UNKNOWN', 'OCCUPIED_VIOLATION', 'SENSOR_STALE') THEN 1 ELSE 0 END), 0) AS occupiedTotal,
      MAX(pop.updated_at) AS lastProjectedAt
    FROM parking_sites ps
    LEFT JOIN spots sp
      ON sp.site_id = ps.site_id
    LEFT JOIN spot_occupancy_projection pop
      ON pop.site_id = sp.site_id
     AND pop.spot_id = sp.spot_id
    WHERE 1 = 1
      ${siteCodeFilter(args.siteCodes)}
    GROUP BY ps.site_code
    ORDER BY ps.site_code ASC
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
      COALESCE(SUM(CASE WHEN s.status = 'ACTIVE' AND CURDATE() BETWEEN s.start_date AND s.end_date THEN 1 ELSE 0 END), 0) AS activeCount,
      COALESCE(SUM(CASE WHEN s.status = 'EXPIRED' OR (s.status = 'ACTIVE' AND s.end_date < CURDATE()) THEN 1 ELSE 0 END), 0) AS expiredCount,
      COALESCE(SUM(CASE WHEN s.status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelledCount,
      COALESCE(SUM(CASE WHEN s.status = 'SUSPENDED' THEN 1 ELSE 0 END), 0) AS suspendedCount,
      COALESCE(SUM(CASE WHEN s.plan_type = 'MONTHLY' AND s.status = 'ACTIVE' AND CURDATE() BETWEEN s.start_date AND s.end_date THEN 1 ELSE 0 END), 0) AS monthlyActiveCount,
      COALESCE(SUM(CASE WHEN s.plan_type = 'VIP' AND s.status = 'ACTIVE' AND CURDATE() BETWEEN s.start_date AND s.end_date THEN 1 ELSE 0 END), 0) AS vipActiveCount,
      COALESCE(SUM(CASE WHEN s.status = 'ACTIVE' AND CURDATE() BETWEEN s.start_date AND s.end_date AND s.end_date <= DATE_ADD(CURDATE(), INTERVAL ${expiringInDays} DAY) THEN 1 ELSE 0 END), 0) AS expiringSoonCount,
      (
        SELECT COUNT(*)
        FROM subscription_vehicles sv
        JOIN subscriptions s2
          ON s2.subscription_id = sv.subscription_id
        WHERE sv.site_id = ps.site_id
          AND sv.status = 'ACTIVE'
          AND s2.status = 'ACTIVE'
          AND CURDATE() BETWEEN s2.start_date AND s2.end_date
          AND CURDATE() BETWEEN COALESCE(sv.valid_from, s2.start_date) AND COALESCE(sv.valid_to, s2.end_date)
      ) AS activeVehicleLinkCount,
      (
        SELECT COUNT(*)
        FROM subscription_spots ss
        JOIN subscriptions s3
          ON s3.subscription_id = ss.subscription_id
        WHERE ss.site_id = ps.site_id
          AND ss.status = 'ACTIVE'
          AND s3.status = 'ACTIVE'
          AND CURDATE() BETWEEN s3.start_date AND s3.end_date
          AND CURDATE() BETWEEN COALESCE(ss.assigned_from, s3.start_date) AND COALESCE(ss.assigned_until, s3.end_date)
      ) AS activeSpotLinkCount
    FROM parking_sites ps
    LEFT JOIN subscriptions s
      ON s.site_id = ps.site_id
    WHERE 1 = 1
      ${siteCodeFilter(args.siteCodes)}
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

type LaneStatusSnapshotRow = Awaited<ReturnType<typeof getLaneStatusSnapshot>>[number]

function isOpenLaneSession(status: string | null) {
  return ['OPEN', 'WAITING_READ', 'WAITING_DECISION', 'APPROVED', 'WAITING_PAYMENT'].includes(String(status ?? '').trim().toUpperCase())
}

export function summarizeLaneStatusBySite(rows: LaneStatusSnapshotRow[]): DashboardLaneSiteRow[] {
  const map = new Map<string, DashboardLaneSiteRow>()

  for (const row of rows) {
    const siteCode = String(row.siteCode ?? '').trim()
    if (!siteCode) continue

    const entry = map.get(siteCode) ?? {
      siteCode,
      totalLanes: 0,
      entryCount: 0,
      exitCount: 0,
      activeCount: 0,
      inactiveCount: 0,
      maintenanceCount: 0,
      healthyCount: 0,
      degradedCount: 0,
      barrierFaultCount: 0,
      offlineCount: 0,
      attentionCount: 0,
      activePresenceCount: 0,
      openSessionCount: 0,
    }

    entry.totalLanes += 1
    if (row.direction === 'ENTRY') entry.entryCount += 1
    if (row.direction === 'EXIT') entry.exitCount += 1

    const operationalStatus = String(row.laneOperationalStatus ?? '').trim().toUpperCase()
    if (operationalStatus === 'ACTIVE') entry.activeCount += 1
    else if (operationalStatus === 'MAINTENANCE') entry.maintenanceCount += 1
    else entry.inactiveCount += 1

    const aggregateHealth = String(row.aggregateHealth ?? '').trim().toUpperCase()
    if (aggregateHealth === 'HEALTHY') entry.healthyCount += 1
    else if (aggregateHealth === 'OFFLINE') entry.offlineCount += 1
    else if (aggregateHealth === 'BARRIER_FAULT') entry.barrierFaultCount += 1
    else entry.degradedCount += 1

    if (aggregateHealth !== 'HEALTHY') entry.attentionCount += 1
    entry.activePresenceCount += toNumber(row.activePresenceCount)
    if (isOpenLaneSession(row.lastSessionStatus ?? null)) entry.openSessionCount += 1

    map.set(siteCode, entry)
  }

  return [...map.values()].sort((a, b) => a.siteCode.localeCompare(b.siteCode))
}

export async function queryLaneSummarySiteRows(args: {
  siteCodes: string[]
}): Promise<DashboardLaneSiteRow[]> {
  const rows = await getLaneStatusSnapshot()
  const allowed = new Set(requireSiteCodes(args.siteCodes))
  return summarizeLaneStatusBySite(rows.filter((row) => allowed.has(String(row.siteCode ?? ''))))
}
