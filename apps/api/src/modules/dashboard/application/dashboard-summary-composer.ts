export type DashboardScopeMeta = {
  requestedSiteCode: string | null
  siteCodes: string[]
  siteCount: number
  isAllSites: boolean
}

export type DashboardIncidentSiteRow = {
  siteCode: string
  totalCount: number
  openCount: number
  ackedCount: number
  resolvedCount: number
  ignoredCount: number
  criticalOpenCount: number
  infoCount: number
  warnCount: number
  criticalCount: number
  resolvedWithinWindowCount: number
  oldestActiveCreatedAt: string | null
  lastUpdatedAt: string | null
}

export type DashboardIncidentSummary = {
  totalCount: number
  openCount: number
  ackedCount: number
  resolvedCount: number
  ignoredCount: number
  criticalOpenCount: number
  bySeverity: {
    INFO: number
    WARN: number
    CRITICAL: number
  }
  resolvedWithinWindowCount: number
  oldestActiveCreatedAt: string | null
  lastUpdatedAt: string | null
}

export type DashboardOccupancySiteRow = {
  siteCode: string
  totalSpots: number
  emptyCount: number
  occupiedMatchedCount: number
  occupiedUnknownCount: number
  occupiedViolationCount: number
  sensorStaleCount: number
  unreportedCount: number
  occupiedTotal: number
  occupancyRate: number
  lastProjectedAt: string | null
}

export type DashboardOccupancySummary = {
  totalSpots: number
  emptyCount: number
  occupiedMatchedCount: number
  occupiedUnknownCount: number
  occupiedViolationCount: number
  sensorStaleCount: number
  unreportedCount: number
  occupiedTotal: number
  occupancyRate: number
  lastProjectedAt: string | null
}

export type DashboardLaneSiteRow = {
  siteCode: string
  totalLanes: number
  entryCount: number
  exitCount: number
  activeCount: number
  inactiveCount: number
  maintenanceCount: number
  healthyCount: number
  degradedCount: number
  barrierFaultCount: number
  offlineCount: number
  attentionCount: number
  activePresenceCount: number
  openSessionCount: number
}

export type DashboardLaneSummary = {
  totalLanes: number
  entryCount: number
  exitCount: number
  activeCount: number
  inactiveCount: number
  maintenanceCount: number
  healthyCount: number
  degradedCount: number
  barrierFaultCount: number
  offlineCount: number
  attentionCount: number
  activePresenceCount: number
  openSessionCount: number
}

export type DashboardSubscriptionSiteRow = {
  siteCode: string
  totalSubscriptions: number
  activeCount: number
  expiredCount: number
  cancelledCount: number
  suspendedCount: number
  monthlyActiveCount: number
  vipActiveCount: number
  expiringSoonCount: number
  activeVehicleLinkCount: number
  activeSpotLinkCount: number
}

export type DashboardSubscriptionSummary = {
  totalSubscriptions: number
  activeCount: number
  expiredCount: number
  cancelledCount: number
  suspendedCount: number
  monthlyActiveCount: number
  vipActiveCount: number
  expiringSoonCount: number
  activeVehicleLinkCount: number
  activeSpotLinkCount: number
}

export type DashboardTopologySiteRow = {
  siteCode: string
  zoneCount: number
  gateCount: number
  laneCount: number
  deviceCount: number
  zoneCodes: string[]
  zoneNames: string[]
  vehicleTypes: string[]
}

export type DashboardOverview = {
  incidentsOpenCount: number
  criticalIncidentsOpenCount: number
  occupancyRate: number
  laneAttentionCount: number
  offlineLaneCount: number
  activeSubscriptionCount: number
  expiringSubscriptionCount: number
  activePresenceCount: number
  openSessionCount: number
}

export type DashboardSiteOverviewRow = {
  siteCode: string
  incidentsOpenCount: number
  criticalIncidentsOpenCount: number
  occupancyRate: number
  laneAttentionCount: number
  offlineLaneCount: number
  activeSubscriptionCount: number
  expiringSubscriptionCount: number
  activePresenceCount: number
  openSessionCount: number
  zoneCount: number
  gateCount: number
  laneCount: number
  deviceCount: number
  zoneCodes: string[]
  zoneNames: string[]
  vehicleTypes: string[]
}

export type DashboardSummaryDocument = {
  generatedAt: string
  scope: DashboardScopeMeta
  filters: {
    sinceHours: number
    expiringInDays: number
  }
  overview: DashboardOverview
  incidents: DashboardIncidentSummary
  occupancy: DashboardOccupancySummary
  lanes: DashboardLaneSummary
  subscriptions: DashboardSubscriptionSummary
  sites: DashboardSiteOverviewRow[]
}

function toFiniteNumber(value: unknown) {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num : 0
}

function maxIso(a: string | null, b: string | null) {
  if (!a) return b
  if (!b) return a
  return a >= b ? a : b
}

function minIso(a: string | null, b: string | null) {
  if (!a) return b
  if (!b) return a
  return a <= b ? a : b
}

export function summarizeIncidentRows(rows: DashboardIncidentSiteRow[]): DashboardIncidentSummary {
  return rows.reduce<DashboardIncidentSummary>((acc, row) => {
    acc.totalCount += toFiniteNumber(row.totalCount)
    acc.openCount += toFiniteNumber(row.openCount)
    acc.ackedCount += toFiniteNumber(row.ackedCount)
    acc.resolvedCount += toFiniteNumber(row.resolvedCount)
    acc.ignoredCount += toFiniteNumber(row.ignoredCount)
    acc.criticalOpenCount += toFiniteNumber(row.criticalOpenCount)
    acc.bySeverity.INFO += toFiniteNumber(row.infoCount)
    acc.bySeverity.WARN += toFiniteNumber(row.warnCount)
    acc.bySeverity.CRITICAL += toFiniteNumber(row.criticalCount)
    acc.resolvedWithinWindowCount += toFiniteNumber(row.resolvedWithinWindowCount)
    acc.oldestActiveCreatedAt = minIso(acc.oldestActiveCreatedAt, row.oldestActiveCreatedAt)
    acc.lastUpdatedAt = maxIso(acc.lastUpdatedAt, row.lastUpdatedAt)
    return acc
  }, {
    totalCount: 0,
    openCount: 0,
    ackedCount: 0,
    resolvedCount: 0,
    ignoredCount: 0,
    criticalOpenCount: 0,
    bySeverity: { INFO: 0, WARN: 0, CRITICAL: 0 },
    resolvedWithinWindowCount: 0,
    oldestActiveCreatedAt: null,
    lastUpdatedAt: null,
  })
}

export function summarizeOccupancyRows(rows: DashboardOccupancySiteRow[]): DashboardOccupancySummary {
  const summary = rows.reduce<DashboardOccupancySummary>((acc, row) => {
    acc.totalSpots += toFiniteNumber(row.totalSpots)
    acc.emptyCount += toFiniteNumber(row.emptyCount)
    acc.occupiedMatchedCount += toFiniteNumber(row.occupiedMatchedCount)
    acc.occupiedUnknownCount += toFiniteNumber(row.occupiedUnknownCount)
    acc.occupiedViolationCount += toFiniteNumber(row.occupiedViolationCount)
    acc.sensorStaleCount += toFiniteNumber(row.sensorStaleCount)
    acc.unreportedCount += toFiniteNumber(row.unreportedCount)
    acc.occupiedTotal += toFiniteNumber(row.occupiedTotal)
    acc.lastProjectedAt = maxIso(acc.lastProjectedAt, row.lastProjectedAt)
    return acc
  }, {
    totalSpots: 0,
    emptyCount: 0,
    occupiedMatchedCount: 0,
    occupiedUnknownCount: 0,
    occupiedViolationCount: 0,
    sensorStaleCount: 0,
    unreportedCount: 0,
    occupiedTotal: 0,
    occupancyRate: 0,
    lastProjectedAt: null,
  })

  summary.occupancyRate = summary.totalSpots > 0
    ? Number(((summary.occupiedTotal / summary.totalSpots) * 100).toFixed(2))
    : 0

  return summary
}

export function summarizeLaneRows(rows: DashboardLaneSiteRow[]): DashboardLaneSummary {
  return rows.reduce<DashboardLaneSummary>((acc, row) => {
    acc.totalLanes += toFiniteNumber(row.totalLanes)
    acc.entryCount += toFiniteNumber(row.entryCount)
    acc.exitCount += toFiniteNumber(row.exitCount)
    acc.activeCount += toFiniteNumber(row.activeCount)
    acc.inactiveCount += toFiniteNumber(row.inactiveCount)
    acc.maintenanceCount += toFiniteNumber(row.maintenanceCount)
    acc.healthyCount += toFiniteNumber(row.healthyCount)
    acc.degradedCount += toFiniteNumber(row.degradedCount)
    acc.barrierFaultCount += toFiniteNumber(row.barrierFaultCount)
    acc.offlineCount += toFiniteNumber(row.offlineCount)
    acc.attentionCount += toFiniteNumber(row.attentionCount)
    acc.activePresenceCount += toFiniteNumber(row.activePresenceCount)
    acc.openSessionCount += toFiniteNumber(row.openSessionCount)
    return acc
  }, {
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
  })
}

export function summarizeSubscriptionRows(rows: DashboardSubscriptionSiteRow[]): DashboardSubscriptionSummary {
  return rows.reduce<DashboardSubscriptionSummary>((acc, row) => {
    acc.totalSubscriptions += toFiniteNumber(row.totalSubscriptions)
    acc.activeCount += toFiniteNumber(row.activeCount)
    acc.expiredCount += toFiniteNumber(row.expiredCount)
    acc.cancelledCount += toFiniteNumber(row.cancelledCount)
    acc.suspendedCount += toFiniteNumber(row.suspendedCount)
    acc.monthlyActiveCount += toFiniteNumber(row.monthlyActiveCount)
    acc.vipActiveCount += toFiniteNumber(row.vipActiveCount)
    acc.expiringSoonCount += toFiniteNumber(row.expiringSoonCount)
    acc.activeVehicleLinkCount += toFiniteNumber(row.activeVehicleLinkCount)
    acc.activeSpotLinkCount += toFiniteNumber(row.activeSpotLinkCount)
    return acc
  }, {
    totalSubscriptions: 0,
    activeCount: 0,
    expiredCount: 0,
    cancelledCount: 0,
    suspendedCount: 0,
    monthlyActiveCount: 0,
    vipActiveCount: 0,
    expiringSoonCount: 0,
    activeVehicleLinkCount: 0,
    activeSpotLinkCount: 0,
  })
}

export function buildDashboardSiteOverviewRows(args: {
  siteCodes: string[]
  incidents: DashboardIncidentSiteRow[]
  occupancy: DashboardOccupancySiteRow[]
  lanes: DashboardLaneSiteRow[]
  subscriptions: DashboardSubscriptionSiteRow[]
  topology: DashboardTopologySiteRow[]
}): DashboardSiteOverviewRow[] {
  const incidentMap = new Map(args.incidents.map((row) => [row.siteCode, row]))
  const occupancyMap = new Map(args.occupancy.map((row) => [row.siteCode, row]))
  const laneMap = new Map(args.lanes.map((row) => [row.siteCode, row]))
  const subscriptionMap = new Map(args.subscriptions.map((row) => [row.siteCode, row]))
  const topologyMap = new Map(args.topology.map((row) => [row.siteCode, row]))

  return [...args.siteCodes]
    .sort((a, b) => a.localeCompare(b))
    .map((siteCode) => {
      const incident = incidentMap.get(siteCode)
      const occupancy = occupancyMap.get(siteCode)
      const lane = laneMap.get(siteCode)
      const subscription = subscriptionMap.get(siteCode)
      const topo = topologyMap.get(siteCode)
      return {
        siteCode,
        incidentsOpenCount: toFiniteNumber(incident?.openCount),
        criticalIncidentsOpenCount: toFiniteNumber(incident?.criticalOpenCount),
        occupancyRate: Number((occupancy?.occupancyRate ?? 0).toFixed(2)),
        laneAttentionCount: toFiniteNumber(lane?.attentionCount),
        offlineLaneCount: toFiniteNumber(lane?.offlineCount),
        activeSubscriptionCount: toFiniteNumber(subscription?.activeCount),
        expiringSubscriptionCount: toFiniteNumber(subscription?.expiringSoonCount),
        activePresenceCount: toFiniteNumber(lane?.activePresenceCount),
        openSessionCount: toFiniteNumber(lane?.openSessionCount),
        zoneCount: topo?.zoneCount ?? 0,
        gateCount: topo?.gateCount ?? 0,
        laneCount: topo?.laneCount ?? 0,
        deviceCount: topo?.deviceCount ?? 0,
        zoneCodes: topo?.zoneCodes ?? [],
        zoneNames: topo?.zoneNames ?? [],
        vehicleTypes: topo?.vehicleTypes ?? [],
      }
    })
}

export function buildDashboardOverview(args: {
  occupancy: DashboardOccupancySummary
  incidents: DashboardIncidentSummary
  lanes: DashboardLaneSummary
  subscriptions: DashboardSubscriptionSummary
}): DashboardOverview {
  return {
    incidentsOpenCount: args.incidents.openCount,
    criticalIncidentsOpenCount: args.incidents.criticalOpenCount,
    occupancyRate: Number((args.occupancy.occupancyRate ?? 0).toFixed(2)),
    laneAttentionCount: args.lanes.attentionCount,
    offlineLaneCount: args.lanes.offlineCount,
    activeSubscriptionCount: args.subscriptions.activeCount,
    expiringSubscriptionCount: args.subscriptions.expiringSoonCount,
    activePresenceCount: args.lanes.activePresenceCount,
    openSessionCount: args.lanes.openSessionCount,
  }
}

export function composeDashboardSummaryDocument(args: {
  generatedAt?: string
  scope: DashboardScopeMeta
  sinceHours: number
  expiringInDays: number
  incidents: DashboardIncidentSiteRow[]
  occupancy: DashboardOccupancySiteRow[]
  lanes: DashboardLaneSiteRow[]
  subscriptions: DashboardSubscriptionSiteRow[]
  topology: DashboardTopologySiteRow[]
}): DashboardSummaryDocument {
  const generatedAt = args.generatedAt ?? new Date().toISOString()
  const incidentSummary = summarizeIncidentRows(args.incidents)
  const occupancySummary = summarizeOccupancyRows(args.occupancy)
  const laneSummary = summarizeLaneRows(args.lanes)
  const subscriptionSummary = summarizeSubscriptionRows(args.subscriptions)

  return {
    generatedAt,
    scope: args.scope,
    filters: {
      sinceHours: args.sinceHours,
      expiringInDays: args.expiringInDays,
    },
    overview: buildDashboardOverview({
      incidents: incidentSummary,
      occupancy: occupancySummary,
      lanes: laneSummary,
      subscriptions: subscriptionSummary,
    }),
    incidents: incidentSummary,
    occupancy: occupancySummary,
    lanes: laneSummary,
    subscriptions: subscriptionSummary,
    sites: buildDashboardSiteOverviewRows({
      siteCodes: args.scope.siteCodes,
      incidents: args.incidents,
      occupancy: args.occupancy,
      lanes: args.lanes,
      subscriptions: args.subscriptions,
      topology: args.topology,
    }),
  }
}
