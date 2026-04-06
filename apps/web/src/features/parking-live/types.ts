export type OccupancyStatus =
  | 'EMPTY'
  | 'OCCUPIED_MATCHED'
  | 'OCCUPIED_UNKNOWN'
  | 'OCCUPIED_VIOLATION'
  | 'SENSOR_STALE'
  | 'BLOCKED'
  | 'RESERVED'

export type ParkingLiveConnectionStatus = 'idle' | 'loading' | 'connected' | 'stale' | 'retrying' | 'error'

export type OccupancySummary = {
  total: number
  empty: number
  occupiedMatched: number
  occupiedUnknown: number
  occupiedViolation: number
  sensorStale: number
  blocked: number
  reserved: number
  occupiedTotal: number
}

export type ParkingLiveBoardSlot = {
  spotId: string
  spotCode: string
  siteCode: string
  zoneCode: string | null
  floorKey: string
  layoutRow: number | null
  layoutCol: number | null
  layoutOrder: number | null
  slotKind: string | null
  occupancyStatus: OccupancyStatus
  plateNumber: string | null
  subscriptionId: string | null
  subscriptionCode: string | null
  sessionId: string | null
  incidentCode: string | null
  updatedAt: string | null
  stale: boolean
}

export type ParkingLiveFloor = {
  floorKey: string
  label: string
  summary: OccupancySummary
  slots: ParkingLiveBoardSlot[]
}

export type ParkingLiveBoard = {
  site: {
    siteCode: string
    name: string
  }
  filters: {
    floorKey: string | null
    zoneCode: string | null
    status: OccupancyStatus | null
    q: string | null
    refresh: boolean
  }
  floors: ParkingLiveFloor[]
  connection: {
    source: 'projection'
    reconciledAt: string | null
    streamSupported: boolean
  }
}

export type ParkingLiveSummary = {
  site: {
    siteCode: string
    name: string
  }
  summary: OccupancySummary
  floors: Array<{
    floorKey: string
    label: string
    total: number
    empty: number
    occupiedTotal: number
    sensorStale: number
    blocked: number
    reserved: number
  }>
  updatedAt: string | null
}

export type ParkingLiveSpotDetail = {
  spot: {
    spotId: string
    spotCode: string
    siteCode: string
    zoneCode: string | null
    floorKey: string
    layoutRow: number | null
    layoutCol: number | null
    layoutOrder: number | null
    slotKind: string | null
    status: string | null
  }
  occupancy: {
    occupancyStatus: OccupancyStatus
    plateNumber: string | null
    updatedAt: string | null
    stale: boolean
    reasonCode: string | null
    reasonDetail: string | null
  }
  subscription: {
    subscriptionId: string | null
    subscriptionCode: string | null
    status: string | null
  } | null
  presence: {
    presenceId: string | null
    capturedAt: string | null
    cameraCode: string | null
    traceId: string | null
  } | null
  session: {
    gatePresenceId: string | null
    sessionId: string | null
    ticketId: string | null
    status: string | null
    enteredAt: string | null
    lastSeenAt: string | null
  } | null
  incident: {
    incidentId: string
    incidentType: string
    status: string
    severity: string
    title: string
    updatedAt: string
  } | null
  history: {
    lastTransitionAt: string | null
    lastTransitionCode: string | null
  }
}

export type SlotViewModel = {
  spotId: string
  spotCode: string
  zoneCode: string
  floorKey: string
  layoutRow: number | null
  layoutCol: number | null
  layoutOrder: number | null
  slotKind: string | null
  occupancyStatus: OccupancyStatus
  observedPlate: string | null
  hasSubscription: boolean
  subscriptionId: string | null
  subscriptionCode: string | null
  incidentCode: string | null
  updatedAt: string | null
  isStale: boolean
  recentlyChanged?: boolean
}

export type FloorGroup = {
  floorKey: string
  label: string
  zones: string[]
  slots: SlotViewModel[]
  summary: OccupancySummary
}

export type ParkingLiveDataState = {
  lastFetchedAt: string | null
  isStale: boolean
  loading: boolean
  error: string
}

export type ParkingLiveFreshnessView = {
  status: ParkingLiveConnectionStatus
  lastFetchedAt: string | null
  lastSummaryAt: string | null
  lastReconciledAt: string | null
  lastDeltaAt: string | null
  staleSince: string | null
  nextRetryAt: string | null
  fallbackPolling: boolean
  reconnectCount: number
  error: string
  hasSnapshot: boolean
  requestIdHint: string | null
}

export type ParkingLiveFeedState = {
  status: ParkingLiveConnectionStatus
  reconnectCount: number
  error: string
  staleSince: string | null
  lastDeltaAt: string | null
  nextRetryAt: string | null
}
