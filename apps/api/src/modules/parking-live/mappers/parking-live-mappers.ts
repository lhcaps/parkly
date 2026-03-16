import type { SubscriptionOccupancyLookup } from '../../../server/services/subscription-occupancy.service'
import type {
  ParkingLiveBaseRow,
  ParkingLiveDerivedStatus,
  ParkingLiveFloorBoard,
  ParkingLiveSlot,
  ParkingLiveSpotDetail,
  ParkingLiveSummaryCounts,
} from '../domain/parking-live-types'

function toIntOrNull(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? Math.trunc(num) : null
}

function compact(value: unknown) {
  const raw = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return raw || null
}

function getSnapshotString(snapshot: Record<string, unknown>, path: string[]) {
  let current: unknown = snapshot
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' && current.trim() ? current.trim() : null
}

function getSnapshotNumber(snapshot: Record<string, unknown>, path: string[]) {
  let current: unknown = snapshot
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null
    current = (current as Record<string, unknown>)[key]
  }
  return toIntOrNull(current)
}

export function resolveFloorKey(row: ParkingLiveBaseRow) {
  return (
    getSnapshotString(row.snapshot, ['layout', 'floorKey'])
    ?? getSnapshotString(row.snapshot, ['floorKey'])
    ?? row.zoneCode
    ?? 'UNASSIGNED'
  )
}

export function resolveFloorLabel(row: ParkingLiveBaseRow, floorKey: string) {
  return (
    getSnapshotString(row.snapshot, ['layout', 'floorLabel'])
    ?? getSnapshotString(row.snapshot, ['floorLabel'])
    ?? row.zoneName
    ?? floorKey
  )
}

export function resolveLayoutRow(row: ParkingLiveBaseRow) {
  return getSnapshotNumber(row.snapshot, ['layout', 'row']) ?? getSnapshotNumber(row.snapshot, ['layoutRow'])
}

export function resolveLayoutCol(row: ParkingLiveBaseRow) {
  return getSnapshotNumber(row.snapshot, ['layout', 'col']) ?? getSnapshotNumber(row.snapshot, ['layoutCol'])
}

export function resolveLayoutOrder(row: ParkingLiveBaseRow) {
  return getSnapshotNumber(row.snapshot, ['layout', 'order']) ?? getSnapshotNumber(row.snapshot, ['layoutOrder'])
}

export function resolveSlotKind(row: ParkingLiveBaseRow) {
  return (
    getSnapshotString(row.snapshot, ['layout', 'slotKind'])
    ?? getSnapshotString(row.snapshot, ['slotKind'])
    ?? row.zoneVehicleType
    ?? null
  )
}

export function resolveDerivedStatus(row: ParkingLiveBaseRow, subscriptionLookup: SubscriptionOccupancyLookup): ParkingLiveDerivedStatus {
  if (String(row.spotStatus ?? '').toUpperCase() === 'OUT_OF_SERVICE') return 'BLOCKED'
  if (subscriptionLookup.bySpotId[row.spotId] && (row.occupancyStatus == null || row.occupancyStatus === 'EMPTY')) return 'RESERVED'
  if (row.occupancyStatus == null) return 'SENSOR_STALE'
  return row.occupancyStatus
}

export function resolvePlateNumber(row: ParkingLiveBaseRow, subscriptionLookup: SubscriptionOccupancyLookup) {
  return row.observedPlateCompact ?? row.expectedPlateCompact ?? subscriptionLookup.bySpotId[row.spotId]?.primaryPlateCompact ?? null
}

export function resolveSubscriptionContext(row: ParkingLiveBaseRow, subscriptionLookup: SubscriptionOccupancyLookup) {
  const explicitId = row.matchedSubscriptionId
  if (explicitId) {
    return {
      subscriptionId: explicitId,
      subscriptionCode: `SUB-${explicitId}`,
    }
  }

  const reserved = subscriptionLookup.bySpotId[row.spotId]
  if (!reserved) {
    return { subscriptionId: null, subscriptionCode: null }
  }

  return {
    subscriptionId: reserved.subscriptionId,
    subscriptionCode: `SUB-${reserved.subscriptionId}`,
  }
}

export function mapBaseRowToSlot(row: ParkingLiveBaseRow, subscriptionLookup: SubscriptionOccupancyLookup): ParkingLiveSlot {
  const floorKey = resolveFloorKey(row)
  const derivedStatus = resolveDerivedStatus(row, subscriptionLookup)
  const subscription = resolveSubscriptionContext(row, subscriptionLookup)

  return {
    spotId: row.spotId,
    spotCode: row.spotCode,
    siteCode: row.siteCode,
    zoneCode: row.zoneCode,
    floorKey,
    layoutRow: resolveLayoutRow(row),
    layoutCol: resolveLayoutCol(row),
    layoutOrder: resolveLayoutOrder(row),
    slotKind: resolveSlotKind(row),
    occupancyStatus: derivedStatus,
    plateNumber: resolvePlateNumber(row, subscriptionLookup),
    subscriptionId: subscription.subscriptionId,
    subscriptionCode: subscription.subscriptionCode,
    sessionId: null,
    incidentCode: row.reasonCode,
    updatedAt: row.updatedAt,
    stale: derivedStatus === 'SENSOR_STALE' || row.staleAt != null || row.projectionId == null,
  }
}

export function createEmptySummary(): ParkingLiveSummaryCounts {
  return {
    total: 0,
    empty: 0,
    occupiedMatched: 0,
    occupiedUnknown: 0,
    occupiedViolation: 0,
    sensorStale: 0,
    blocked: 0,
    reserved: 0,
    occupiedTotal: 0,
  }
}

export function accumulateSummary(summary: ParkingLiveSummaryCounts, slot: ParkingLiveSlot) {
  summary.total += 1
  switch (slot.occupancyStatus) {
    case 'EMPTY':
      summary.empty += 1
      break
    case 'OCCUPIED_MATCHED':
      summary.occupiedMatched += 1
      summary.occupiedTotal += 1
      break
    case 'OCCUPIED_UNKNOWN':
      summary.occupiedUnknown += 1
      summary.occupiedTotal += 1
      break
    case 'OCCUPIED_VIOLATION':
      summary.occupiedViolation += 1
      summary.occupiedTotal += 1
      break
    case 'SENSOR_STALE':
      summary.sensorStale += 1
      break
    case 'BLOCKED':
      summary.blocked += 1
      break
    case 'RESERVED':
      summary.reserved += 1
      break
  }
  return summary
}

function slotSortWeight(slot: ParkingLiveSlot) {
  const order = slot.layoutOrder ?? Number.MAX_SAFE_INTEGER
  const row = slot.layoutRow ?? Number.MAX_SAFE_INTEGER
  const col = slot.layoutCol ?? Number.MAX_SAFE_INTEGER
  return { order, row, col }
}

export function compareSlots(a: ParkingLiveSlot, b: ParkingLiveSlot) {
  const wa = slotSortWeight(a)
  const wb = slotSortWeight(b)
  if (wa.order !== wb.order) return wa.order - wb.order
  if (wa.row !== wb.row) return wa.row - wb.row
  if (wa.col !== wb.col) return wa.col - wb.col
  return a.spotCode.localeCompare(b.spotCode)
}

export function groupSlotsByFloor(args: {
  rows: ParkingLiveBaseRow[]
  subscriptionLookup: SubscriptionOccupancyLookup
}): ParkingLiveFloorBoard[] {
  const floors = new Map<string, ParkingLiveFloorBoard>()

  for (const row of args.rows) {
    const floorKey = resolveFloorKey(row)
    const existing = floors.get(floorKey)
    const slot = mapBaseRowToSlot(row, args.subscriptionLookup)
    if (!existing) {
      floors.set(floorKey, {
        floorKey,
        label: resolveFloorLabel(row, floorKey),
        summary: accumulateSummary(createEmptySummary(), slot),
        slots: [slot],
      })
      continue
    }
    existing.slots.push(slot)
    accumulateSummary(existing.summary, slot)
  }

  return [...floors.values()]
    .map((floor) => ({
      ...floor,
      slots: [...floor.slots].sort(compareSlots),
    }))
    .sort((a, b) => a.floorKey.localeCompare(b.floorKey))
}


export function summarizeSlots(slots: ParkingLiveSlot[]) {
  const summary = createEmptySummary()
  for (const slot of slots) accumulateSummary(summary, slot)
  return summary
}

export function buildOverallSummary(floors: ParkingLiveFloorBoard[]) {
  const summary = createEmptySummary()
  for (const floor of floors) {
    summary.total += floor.summary.total
    summary.empty += floor.summary.empty
    summary.occupiedMatched += floor.summary.occupiedMatched
    summary.occupiedUnknown += floor.summary.occupiedUnknown
    summary.occupiedViolation += floor.summary.occupiedViolation
    summary.sensorStale += floor.summary.sensorStale
    summary.blocked += floor.summary.blocked
    summary.reserved += floor.summary.reserved
    summary.occupiedTotal += floor.summary.occupiedTotal
  }
  return summary
}

export function mapBaseRowToSpotDetail(args: {
  row: ParkingLiveBaseRow
  subscriptionLookup: SubscriptionOccupancyLookup
  subscriptionStatus: string | null
  presence: ParkingLiveSpotDetail['presence']
  session: ParkingLiveSpotDetail['session']
  incident: ParkingLiveSpotDetail['incident']
}): ParkingLiveSpotDetail {
  const slot = mapBaseRowToSlot(args.row, args.subscriptionLookup)
  return {
    spot: {
      spotId: args.row.spotId,
      spotCode: args.row.spotCode,
      siteCode: args.row.siteCode,
      zoneCode: args.row.zoneCode,
      floorKey: slot.floorKey,
      layoutRow: slot.layoutRow,
      layoutCol: slot.layoutCol,
      layoutOrder: slot.layoutOrder,
      slotKind: slot.slotKind,
      status: args.row.spotStatus,
    },
    occupancy: {
      occupancyStatus: slot.occupancyStatus,
      plateNumber: slot.plateNumber,
      updatedAt: slot.updatedAt,
      stale: slot.stale,
      reasonCode: args.row.reasonCode,
      reasonDetail: args.row.reasonDetail,
    },
    subscription: slot.subscriptionId
      ? {
          subscriptionId: slot.subscriptionId,
          subscriptionCode: slot.subscriptionCode,
          status: args.subscriptionStatus,
        }
      : null,
    presence: args.presence,
    session: args.session,
    incident: args.incident,
    history: {
      lastTransitionAt: args.row.updatedAt,
      lastTransitionCode: args.row.reasonCode,
    },
  }
}

export function matchesSearch(slot: ParkingLiveSlot, q: string | null | undefined) {
  const normalized = compact(q)
  if (!normalized) return true
  const haystacks = [slot.spotCode, slot.plateNumber, slot.subscriptionCode, slot.zoneCode]
  return haystacks.some((value) => compact(value)?.includes(normalized))
}
