import { isRecord } from '@/lib/http/errors'
import type {
  FloorGroup,
  OccupancyStatus,
  OccupancySummary,
  ParkingLiveBoard,
  ParkingLiveBoardSlot,
  ParkingLiveFloor,
  ParkingLiveSpotDetail,
  ParkingLiveSummary,
  SlotViewModel,
} from './types'

function str(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function strOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function bool(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function intOrNull(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeOccupancyStatus(value: unknown): OccupancyStatus {
  const normalized = str(value).trim().toUpperCase()
  if (
    normalized === 'EMPTY' ||
    normalized === 'OCCUPIED_MATCHED' ||
    normalized === 'OCCUPIED_UNKNOWN' ||
    normalized === 'OCCUPIED_VIOLATION' ||
    normalized === 'SENSOR_STALE' ||
    normalized === 'BLOCKED' ||
    normalized === 'RESERVED'
  ) {
    return normalized as OccupancyStatus
  }
  return 'SENSOR_STALE'
}

function normalizeSummary(raw: unknown): OccupancySummary {
  const row = isRecord(raw) ? raw : {}
  const total = intOrNull(row.total) ?? 0
  const empty = intOrNull(row.empty) ?? 0
  const occupiedMatched = intOrNull(row.occupiedMatched) ?? 0
  const occupiedUnknown = intOrNull(row.occupiedUnknown) ?? 0
  const occupiedViolation = intOrNull(row.occupiedViolation) ?? 0
  const sensorStale = intOrNull(row.sensorStale) ?? 0
  const blocked = intOrNull(row.blocked) ?? 0
  const reserved = intOrNull(row.reserved) ?? 0
  const occupiedTotal = intOrNull(row.occupiedTotal) ?? (occupiedMatched + occupiedUnknown + occupiedViolation)

  return {
    total,
    empty,
    occupiedMatched,
    occupiedUnknown,
    occupiedViolation,
    sensorStale,
    blocked,
    reserved,
    occupiedTotal,
  }
}

function normalizeBoardSlot(raw: unknown): ParkingLiveBoardSlot | null {
  if (!isRecord(raw)) return null
  const spotCode = strOrNull(raw.spotCode)
  const spotId = strOrNull(raw.spotId)
  const floorKey = strOrNull(raw.floorKey)
  const siteCode = strOrNull(raw.siteCode)
  if (!spotCode || !spotId || !floorKey || !siteCode) return null

  return {
    spotId,
    spotCode,
    siteCode,
    zoneCode: strOrNull(raw.zoneCode),
    floorKey,
    layoutRow: intOrNull(raw.layoutRow),
    layoutCol: intOrNull(raw.layoutCol),
    layoutOrder: intOrNull(raw.layoutOrder),
    slotKind: strOrNull(raw.slotKind),
    occupancyStatus: normalizeOccupancyStatus(raw.occupancyStatus),
    plateNumber: strOrNull(raw.plateNumber),
    subscriptionId: strOrNull(raw.subscriptionId),
    subscriptionCode: strOrNull(raw.subscriptionCode),
    sessionId: strOrNull(raw.sessionId),
    incidentCode: strOrNull(raw.incidentCode),
    updatedAt: strOrNull(raw.updatedAt),
    stale: bool(raw.stale),
  }
}

function sortSlots(a: ParkingLiveBoardSlot, b: ParkingLiveBoardSlot) {
  const orderA = a.layoutOrder ?? Number.MAX_SAFE_INTEGER
  const orderB = b.layoutOrder ?? Number.MAX_SAFE_INTEGER
  if (orderA !== orderB) return orderA - orderB

  const rowA = a.layoutRow ?? Number.MAX_SAFE_INTEGER
  const rowB = b.layoutRow ?? Number.MAX_SAFE_INTEGER
  if (rowA !== rowB) return rowA - rowB

  const colA = a.layoutCol ?? Number.MAX_SAFE_INTEGER
  const colB = b.layoutCol ?? Number.MAX_SAFE_INTEGER
  if (colA !== colB) return colA - colB

  return a.spotCode.localeCompare(b.spotCode, undefined, { numeric: true })
}

function normalizeFloor(raw: unknown): ParkingLiveFloor | null {
  if (!isRecord(raw)) return null
  const floorKey = strOrNull(raw.floorKey)
  if (!floorKey) return null
  const slotsRaw = Array.isArray(raw.slots) ? raw.slots : []
  const slots = slotsRaw.map(normalizeBoardSlot).filter((item): item is ParkingLiveBoardSlot => item !== null).sort(sortSlots)

  return {
    floorKey,
    label: strOrNull(raw.label) ?? floorKey,
    summary: normalizeSummary(raw.summary),
    slots,
  }
}

export function normalizeParkingLiveBoard(raw: unknown): ParkingLiveBoard {
  const row = isRecord(raw) ? raw : {}
  const site = isRecord(row.site) ? row.site : {}
  const filters = isRecord(row.filters) ? row.filters : {}
  const connection = isRecord(row.connection) ? row.connection : {}
  const floors = Array.isArray(row.floors) ? row.floors.map(normalizeFloor).filter((item): item is ParkingLiveFloor => item !== null) : []

  return {
    site: {
      siteCode: strOrNull(site.siteCode) ?? '',
      name: strOrNull(site.name) ?? strOrNull(site.siteCode) ?? '',
    },
    filters: {
      floorKey: strOrNull(filters.floorKey),
      zoneCode: strOrNull(filters.zoneCode),
      status: strOrNull(filters.status) ? normalizeOccupancyStatus(filters.status) : null,
      q: strOrNull(filters.q),
      refresh: bool(filters.refresh),
    },
    floors,
    connection: {
      source: 'projection',
      reconciledAt: strOrNull(connection.reconciledAt),
      streamSupported: bool(connection.streamSupported),
    },
  }
}

export function normalizeParkingLiveSummary(raw: unknown): ParkingLiveSummary {
  const row = isRecord(raw) ? raw : {}
  const site = isRecord(row.site) ? row.site : {}
  const floorsRaw = Array.isArray(row.floors) ? row.floors : []

  return {
    site: {
      siteCode: strOrNull(site.siteCode) ?? '',
      name: strOrNull(site.name) ?? strOrNull(site.siteCode) ?? '',
    },
    summary: normalizeSummary(row.summary),
    floors: floorsRaw
      .map((floor) => {
        const item = isRecord(floor) ? floor : {}
        const floorKey = strOrNull(item.floorKey)
        if (!floorKey) return null
        return {
          floorKey,
          label: strOrNull(item.label) ?? floorKey,
          total: intOrNull(item.total) ?? 0,
          empty: intOrNull(item.empty) ?? 0,
          occupiedTotal: intOrNull(item.occupiedTotal) ?? 0,
          sensorStale: intOrNull(item.sensorStale) ?? 0,
          blocked: intOrNull(item.blocked) ?? 0,
          reserved: intOrNull(item.reserved) ?? 0,
        }
      })
      .filter((item): item is ParkingLiveSummary['floors'][number] => item !== null),
    updatedAt: strOrNull(row.updatedAt),
  }
}

export function normalizeParkingLiveSpotDetail(raw: unknown): ParkingLiveSpotDetail | null {
  const row = isRecord(raw) ? raw : {}
  const spot = isRecord(row.spot) ? row.spot : {}
  const occupancy = isRecord(row.occupancy) ? row.occupancy : {}
  const spotId = strOrNull(spot.spotId)
  const spotCode = strOrNull(spot.spotCode)
  const siteCode = strOrNull(spot.siteCode)
  const floorKey = strOrNull(spot.floorKey)
  if (!spotId || !spotCode || !siteCode || !floorKey) return null

  const subscriptionRaw = isRecord(row.subscription) ? row.subscription : null
  const presenceRaw = isRecord(row.presence) ? row.presence : null
  const sessionRaw = isRecord(row.session) ? row.session : null
  const incidentRaw = isRecord(row.incident) ? row.incident : null
  const historyRaw = isRecord(row.history) ? row.history : {}

  return {
    spot: {
      spotId,
      spotCode,
      siteCode,
      zoneCode: strOrNull(spot.zoneCode),
      floorKey,
      layoutRow: intOrNull(spot.layoutRow),
      layoutCol: intOrNull(spot.layoutCol),
      layoutOrder: intOrNull(spot.layoutOrder),
      slotKind: strOrNull(spot.slotKind),
      status: strOrNull(spot.status),
    },
    occupancy: {
      occupancyStatus: normalizeOccupancyStatus(occupancy.occupancyStatus),
      plateNumber: strOrNull(occupancy.plateNumber),
      updatedAt: strOrNull(occupancy.updatedAt),
      stale: bool(occupancy.stale),
      reasonCode: strOrNull(occupancy.reasonCode),
      reasonDetail: strOrNull(occupancy.reasonDetail),
    },
    subscription: subscriptionRaw ? {
      subscriptionId: strOrNull(subscriptionRaw.subscriptionId),
      subscriptionCode: strOrNull(subscriptionRaw.subscriptionCode),
      status: strOrNull(subscriptionRaw.status),
    } : null,
    presence: presenceRaw ? {
      presenceId: strOrNull(presenceRaw.presenceId),
      capturedAt: strOrNull(presenceRaw.capturedAt),
      cameraCode: strOrNull(presenceRaw.cameraCode),
      traceId: strOrNull(presenceRaw.traceId),
    } : null,
    session: sessionRaw ? {
      gatePresenceId: strOrNull(sessionRaw.gatePresenceId),
      sessionId: strOrNull(sessionRaw.sessionId),
      ticketId: strOrNull(sessionRaw.ticketId),
      status: strOrNull(sessionRaw.status),
      enteredAt: strOrNull(sessionRaw.enteredAt),
      lastSeenAt: strOrNull(sessionRaw.lastSeenAt),
    } : null,
    incident: incidentRaw ? {
      incidentId: strOrNull(incidentRaw.incidentId) ?? '',
      incidentType: strOrNull(incidentRaw.incidentType) ?? '',
      status: strOrNull(incidentRaw.status) ?? '',
      severity: strOrNull(incidentRaw.severity) ?? '',
      title: strOrNull(incidentRaw.title) ?? '',
      updatedAt: strOrNull(incidentRaw.updatedAt) ?? '',
    } : null,
    history: {
      lastTransitionAt: strOrNull(historyRaw.lastTransitionAt),
      lastTransitionCode: strOrNull(historyRaw.lastTransitionCode),
    },
  }
}

export function boardSlotToViewModel(slot: ParkingLiveBoardSlot): SlotViewModel {
  return {
    spotId: slot.spotId,
    spotCode: slot.spotCode,
    zoneCode: slot.zoneCode ?? '',
    floorKey: slot.floorKey,
    layoutRow: slot.layoutRow,
    layoutCol: slot.layoutCol,
    layoutOrder: slot.layoutOrder,
    slotKind: slot.slotKind,
    occupancyStatus: slot.occupancyStatus,
    observedPlate: slot.plateNumber,
    hasSubscription: Boolean(slot.subscriptionId || slot.subscriptionCode),
    subscriptionId: slot.subscriptionId,
    subscriptionCode: slot.subscriptionCode,
    incidentCode: slot.incidentCode,
    updatedAt: slot.updatedAt,
    isStale: slot.stale || slot.occupancyStatus === 'SENSOR_STALE',
  }
}

export function groupBoardIntoFloors(board: ParkingLiveBoard): FloorGroup[] {
  return board.floors.map((floor) => ({
    floorKey: floor.floorKey,
    label: floor.label,
    zones: Array.from(new Set(floor.slots.map((slot) => slot.zoneCode || 'Unknown'))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    slots: floor.slots.map(boardSlotToViewModel),
    summary: floor.summary,
  }))
}

const RECENT_CHANGE_MS = 30_000

function slotFingerprint(slot: SlotViewModel) {
  return [slot.occupancyStatus, slot.observedPlate ?? '', slot.subscriptionCode ?? '', slot.incidentCode ?? '', slot.isStale ? '1' : '0'].join('::')
}

export function markRecentlyChanged(current: SlotViewModel[], previous: SlotViewModel[]) {
  const prevMap = new Map(previous.map((slot) => [slot.spotId, slotFingerprint(slot)]))
  return current.map((slot) => {
    const previousFingerprint = prevMap.get(slot.spotId)
    const changed = previousFingerprint !== undefined && previousFingerprint !== slotFingerprint(slot)
    return {
      ...slot,
      recentlyChanged: changed ? true : Boolean(slot.recentlyChanged),
    }
  })
}

export function applyRecentChangeWindow(slots: SlotViewModel[]) {
  const now = Date.now()
  return slots.map((slot) => {
    if (!slot.recentlyChanged) return slot
    const updatedMs = slot.updatedAt ? Date.parse(slot.updatedAt) : Number.NaN
    if (!Number.isFinite(updatedMs)) return { ...slot, recentlyChanged: false }
    return {
      ...slot,
      recentlyChanged: now - updatedMs <= RECENT_CHANGE_MS,
    }
  })
}

export function applyRecentChangesToFloors(floors: FloorGroup[], previous: SlotViewModel[]) {
  const current = floors.flatMap((floor) => floor.slots)
  const marked = applyRecentChangeWindow(markRecentlyChanged(current, previous))
  const nextMap = new Map(marked.map((slot) => [slot.spotId, slot]))

  return floors.map((floor) => ({
    ...floor,
    slots: floor.slots
      .map((slot) => nextMap.get(slot.spotId) ?? slot)
      .sort((a, b) => {
        const orderA = a.layoutOrder ?? Number.MAX_SAFE_INTEGER
        const orderB = b.layoutOrder ?? Number.MAX_SAFE_INTEGER
        if (orderA !== orderB) return orderA - orderB
        const rowA = a.layoutRow ?? Number.MAX_SAFE_INTEGER
        const rowB = b.layoutRow ?? Number.MAX_SAFE_INTEGER
        if (rowA !== rowB) return rowA - rowB
        const colA = a.layoutCol ?? Number.MAX_SAFE_INTEGER
        const colB = b.layoutCol ?? Number.MAX_SAFE_INTEGER
        if (colA !== colB) return colA - colB
        return a.spotCode.localeCompare(b.spotCode, undefined, { numeric: true })
      }),
  }))
}
