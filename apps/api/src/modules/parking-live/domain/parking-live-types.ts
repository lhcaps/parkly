import type { SpotOccupancyStatus } from '../../reconciliation/domain/reconciliation'

export type ParkingLiveDerivedStatus = SpotOccupancyStatus | 'BLOCKED' | 'RESERVED'

export type ParkingLiveBoardQuery = {
  siteCode: string
  floorKey?: string | null
  zoneCode?: string | null
  status?: ParkingLiveDerivedStatus | null
  q?: string | null
  refresh?: boolean
}

export type ParkingLiveBaseRow = {
  siteId: string
  siteCode: string
  siteName: string
  zoneId: string | null
  zoneCode: string | null
  zoneName: string | null
  zoneVehicleType: string | null
  spotId: string
  spotCode: string
  spotStatus: string | null
  // Direct layout columns from spots table (V25 migration)
  floorKeyDirect: string | null
  layoutRowDirect: number | null
  layoutColDirect: number | null
  layoutOrderDirect: number | null
  slotKindDirect: string | null
  isBlockedDirect: boolean
  isReservedDirect: boolean
  displayLabelDirect: string | null
  projectionId: string | null
  occupancyStatus: SpotOccupancyStatus | null
  observedPlateCompact: string | null
  expectedPlateCompact: string | null
  matchedSubscriptionId: string | null
  matchedSubscriptionSpotId: string | null
  matchedGatePresenceId: string | null
  sourcePresenceEventId: string | null
  reasonCode: string | null
  reasonDetail: string | null
  staleAt: string | null
  snapshot: Record<string, unknown>
  updatedAt: string | null
}

export type ParkingLiveSiteRef = {
  siteCode: string
  name: string
}

export type ParkingLiveSummaryCounts = {
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

export type ParkingLiveSlot = {
  spotId: string
  spotCode: string
  siteCode: string
  zoneCode: string | null
  floorKey: string
  layoutRow: number | null
  layoutCol: number | null
  layoutOrder: number | null
  slotKind: string | null
  occupancyStatus: ParkingLiveDerivedStatus
  plateNumber: string | null
  subscriptionId: string | null
  subscriptionCode: string | null
  sessionId: string | null
  incidentCode: string | null
  updatedAt: string | null
  stale: boolean
}

export type ParkingLiveFloorBoard = {
  floorKey: string
  label: string
  summary: ParkingLiveSummaryCounts
  slots: ParkingLiveSlot[]
}

export type ParkingLiveBoard = {
  site: ParkingLiveSiteRef
  filters: {
    floorKey: string | null
    zoneCode: string | null
    status: ParkingLiveDerivedStatus | null
    q: string | null
    refresh: boolean
  }
  floors: ParkingLiveFloorBoard[]
  connection: {
    source: 'projection'
    reconciledAt: string | null
    streamSupported: false
  }
}

export type ParkingLiveSummaryFloor = {
  floorKey: string
  label: string
  total: number
  empty: number
  occupiedTotal: number
  sensorStale: number
  blocked: number
  reserved: number
}

export type ParkingLiveSummary = {
  site: ParkingLiveSiteRef
  summary: ParkingLiveSummaryCounts
  floors: ParkingLiveSummaryFloor[]
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
    occupancyStatus: ParkingLiveDerivedStatus
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
