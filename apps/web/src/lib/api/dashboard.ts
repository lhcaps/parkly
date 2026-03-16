import { apiFetch, buildQuery } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import type {
  DashboardIncidentSummary,
  DashboardLaneSummary,
  DashboardOccupancySummary,
  DashboardOverview,
  DashboardScopeMeta,
  DashboardSiteOverviewRow,
  DashboardSubscriptionSummary,
  DashboardSummaryDocument,
} from '@/lib/contracts/dashboard'

function toFiniteNumber(value: unknown) {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num : 0
}

function toNullableString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function normalizeScope(value: unknown): DashboardScopeMeta {
  const row = isRecord(value) ? value : {}
  return {
    requestedSiteCode: toNullableString(row.requestedSiteCode),
    siteCodes: Array.isArray(row.siteCodes) ? row.siteCodes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
    siteCount: toFiniteNumber(row.siteCount),
    isAllSites: Boolean(row.isAllSites),
  }
}

function normalizeOverview(value: unknown): DashboardOverview {
  const row = isRecord(value) ? value : {}
  return {
    incidentsOpenCount: toFiniteNumber(row.incidentsOpenCount),
    criticalIncidentsOpenCount: toFiniteNumber(row.criticalIncidentsOpenCount),
    occupancyRate: toFiniteNumber(row.occupancyRate),
    laneAttentionCount: toFiniteNumber(row.laneAttentionCount),
    offlineLaneCount: toFiniteNumber(row.offlineLaneCount),
    activeSubscriptionCount: toFiniteNumber(row.activeSubscriptionCount),
    expiringSubscriptionCount: toFiniteNumber(row.expiringSubscriptionCount),
    activePresenceCount: toFiniteNumber(row.activePresenceCount),
    openSessionCount: toFiniteNumber(row.openSessionCount),
  }
}

function normalizeIncidentSummary(value: unknown): DashboardIncidentSummary {
  const row = isRecord(value) ? value : {}
  const bySeverity = isRecord(row.bySeverity) ? row.bySeverity : {}
  return {
    totalCount: toFiniteNumber(row.totalCount),
    openCount: toFiniteNumber(row.openCount),
    ackedCount: toFiniteNumber(row.ackedCount),
    resolvedCount: toFiniteNumber(row.resolvedCount),
    ignoredCount: toFiniteNumber(row.ignoredCount),
    criticalOpenCount: toFiniteNumber(row.criticalOpenCount),
    bySeverity: {
      INFO: toFiniteNumber(bySeverity.INFO),
      WARN: toFiniteNumber(bySeverity.WARN),
      CRITICAL: toFiniteNumber(bySeverity.CRITICAL),
    },
    resolvedWithinWindowCount: toFiniteNumber(row.resolvedWithinWindowCount),
    oldestActiveCreatedAt: toNullableString(row.oldestActiveCreatedAt),
    lastUpdatedAt: toNullableString(row.lastUpdatedAt),
  }
}

function normalizeOccupancySummary(value: unknown): DashboardOccupancySummary {
  const row = isRecord(value) ? value : {}
  return {
    totalSpots: toFiniteNumber(row.totalSpots),
    emptyCount: toFiniteNumber(row.emptyCount),
    occupiedMatchedCount: toFiniteNumber(row.occupiedMatchedCount),
    occupiedUnknownCount: toFiniteNumber(row.occupiedUnknownCount),
    occupiedViolationCount: toFiniteNumber(row.occupiedViolationCount),
    sensorStaleCount: toFiniteNumber(row.sensorStaleCount),
    unreportedCount: toFiniteNumber(row.unreportedCount),
    occupiedTotal: toFiniteNumber(row.occupiedTotal),
    occupancyRate: toFiniteNumber(row.occupancyRate),
    lastProjectedAt: toNullableString(row.lastProjectedAt),
  }
}

function normalizeLaneSummary(value: unknown): DashboardLaneSummary {
  const row = isRecord(value) ? value : {}
  return {
    totalLanes: toFiniteNumber(row.totalLanes),
    entryCount: toFiniteNumber(row.entryCount),
    exitCount: toFiniteNumber(row.exitCount),
    activeCount: toFiniteNumber(row.activeCount),
    inactiveCount: toFiniteNumber(row.inactiveCount),
    maintenanceCount: toFiniteNumber(row.maintenanceCount),
    healthyCount: toFiniteNumber(row.healthyCount),
    degradedCount: toFiniteNumber(row.degradedCount),
    barrierFaultCount: toFiniteNumber(row.barrierFaultCount),
    offlineCount: toFiniteNumber(row.offlineCount),
    attentionCount: toFiniteNumber(row.attentionCount),
    activePresenceCount: toFiniteNumber(row.activePresenceCount),
    openSessionCount: toFiniteNumber(row.openSessionCount),
  }
}

function normalizeSubscriptionSummary(value: unknown): DashboardSubscriptionSummary {
  const row = isRecord(value) ? value : {}
  return {
    totalSubscriptions: toFiniteNumber(row.totalSubscriptions),
    activeCount: toFiniteNumber(row.activeCount),
    expiredCount: toFiniteNumber(row.expiredCount),
    cancelledCount: toFiniteNumber(row.cancelledCount),
    suspendedCount: toFiniteNumber(row.suspendedCount),
    monthlyActiveCount: toFiniteNumber(row.monthlyActiveCount),
    vipActiveCount: toFiniteNumber(row.vipActiveCount),
    expiringSoonCount: toFiniteNumber(row.expiringSoonCount),
    activeVehicleLinkCount: toFiniteNumber(row.activeVehicleLinkCount),
    activeSpotLinkCount: toFiniteNumber(row.activeSpotLinkCount),
  }
}

function normalizeSiteOverviewRow(value: unknown): DashboardSiteOverviewRow | null {
  if (!isRecord(value)) return null
  const siteCode = typeof value.siteCode === 'string' ? value.siteCode : ''
  if (!siteCode) return null

  return {
    siteCode,
    incidentsOpenCount: toFiniteNumber(value.incidentsOpenCount),
    criticalIncidentsOpenCount: toFiniteNumber(value.criticalIncidentsOpenCount),
    occupancyRate: toFiniteNumber(value.occupancyRate),
    laneAttentionCount: toFiniteNumber(value.laneAttentionCount),
    offlineLaneCount: toFiniteNumber(value.offlineLaneCount),
    activeSubscriptionCount: toFiniteNumber(value.activeSubscriptionCount),
    expiringSubscriptionCount: toFiniteNumber(value.expiringSubscriptionCount),
    activePresenceCount: toFiniteNumber(value.activePresenceCount),
    openSessionCount: toFiniteNumber(value.openSessionCount),
  }
}

function normalizeDashboardSummary(value: unknown): DashboardSummaryDocument {
  const row = isRecord(value) ? value : {}
  const filters = isRecord(row.filters) ? row.filters : {}
  return {
    generatedAt: typeof row.generatedAt === 'string' ? row.generatedAt : '',
    scope: normalizeScope(row.scope),
    filters: {
      sinceHours: toFiniteNumber(filters.sinceHours),
      expiringInDays: toFiniteNumber(filters.expiringInDays),
    },
    overview: normalizeOverview(row.overview),
    incidents: normalizeIncidentSummary(row.incidents),
    occupancy: normalizeOccupancySummary(row.occupancy),
    lanes: normalizeLaneSummary(row.lanes),
    subscriptions: normalizeSubscriptionSummary(row.subscriptions),
    sites: Array.isArray(row.sites)
      ? row.sites.map((item) => normalizeSiteOverviewRow(item)).filter((item): item is DashboardSiteOverviewRow => Boolean(item))
      : [],
  }
}

export function getDashboardSummary(params?: { siteCode?: string; sinceHours?: number; expiringInDays?: number }) {
  const qs = buildQuery(params)
  return apiFetch<DashboardSummaryDocument>(`/api/ops/dashboard/summary${qs ? `?${qs}` : ''}`, undefined, normalizeDashboardSummary)
}
