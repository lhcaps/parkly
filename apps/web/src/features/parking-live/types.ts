// Types derived from backend SpotProjectionRow
// Source: apps/api/src/modules/reconciliation/application/run-reconciliation.ts
// Route: GET /api/ops/spot-occupancy?siteCode=X  (ADMIN, OPS, GUARD)

export type OccupancyStatus =
  | 'EMPTY'
  | 'OCCUPIED_MATCHED'
  | 'OCCUPIED_UNKNOWN'
  | 'OCCUPIED_VIOLATION'
  | 'SENSOR_STALE'

// Raw projection row from backend — normalized before use in UI
export type SpotProjectionRow = {
  projectionId: string | null
  siteId: string
  zoneId: string | null
  spotId: string
  zoneCode: string | null
  spotCode: string
  occupancyStatus: OccupancyStatus
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

// Normalized view model consumed by slot tiles
export type SlotViewModel = {
  spotId: string
  spotCode: string
  zoneCode: string
  occupancyStatus: OccupancyStatus
  observedPlate: string | null
  expectedPlate: string | null
  hasSubscription: boolean
  subscriptionId: string | null
  reasonCode: string
  updatedAt: string
  isStale: boolean
  // UI-only: set when a slot has recently changed (for pulse effect)
  recentlyChanged?: boolean
}

// Floor group derived by grouping zoneCode prefixes
export type FloorGroup = {
  floorKey: string   // e.g. "FLOOR_1" or "A" — derived from zone prefix
  label: string      // display label
  zones: string[]    // all zone codes on this floor
  slots: SlotViewModel[]
  summary: OccupancySummary
}

export type OccupancySummary = {
  total: number
  empty: number
  occupied: number       // OCCUPIED_MATCHED + OCCUPIED_UNKNOWN + OCCUPIED_VIOLATION
  occupiedMatched: number
  occupiedUnknown: number
  occupiedViolation: number
  stale: number          // SENSOR_STALE
}

export type ParkingLiveDataState = {
  rows: SpotProjectionRow[]
  lastFetchedAt: string | null
  isStale: boolean       // true when last fetch was >30s ago
  loading: boolean
  error: string
}
