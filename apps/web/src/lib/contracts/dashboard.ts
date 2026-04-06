export type DashboardScopeMeta = {
  requestedSiteCode: string | null
  siteCodes: string[]
  siteCount: number
  isAllSites: boolean
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
