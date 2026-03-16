import { isRecord } from '@/lib/http/errors'
import type {
  FloorGroup,
  OccupancySummary,
  OccupancyStatus,
  SlotViewModel,
  SpotProjectionRow,
} from './types'

// ─── Raw normalization ────────────────────────────────────────

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function normalizeOccupancyStatus(v: unknown): OccupancyStatus {
  const s = str(v).toUpperCase()
  if (
    s === 'EMPTY' ||
    s === 'OCCUPIED_MATCHED' ||
    s === 'OCCUPIED_UNKNOWN' ||
    s === 'OCCUPIED_VIOLATION' ||
    s === 'SENSOR_STALE'
  ) return s as OccupancyStatus
  return 'SENSOR_STALE'
}

export function normalizeSpotProjectionRow(raw: unknown): SpotProjectionRow | null {
  if (!isRecord(raw)) return null
  const spotCode = str(raw.spotCode)
  if (!spotCode) return null
  return {
    projectionId: strOrNull(raw.projectionId),
    siteId: str(raw.siteId),
    zoneId: strOrNull(raw.zoneId),
    spotId: str(raw.spotId),
    zoneCode: strOrNull(raw.zoneCode),
    spotCode,
    occupancyStatus: normalizeOccupancyStatus(raw.occupancyStatus),
    observedPlateCompact: strOrNull(raw.observedPlateCompact),
    expectedPlateCompact: strOrNull(raw.expectedPlateCompact),
    matchedSubscriptionId: strOrNull(raw.matchedSubscriptionId),
    matchedSubscriptionSpotId: strOrNull(raw.matchedSubscriptionSpotId),
    matchedGatePresenceId: strOrNull(raw.matchedGatePresenceId),
    sourcePresenceEventId: strOrNull(raw.sourcePresenceEventId),
    reasonCode: str(raw.reasonCode),
    reasonDetail: str(raw.reasonDetail),
    staleAt: strOrNull(raw.staleAt),
    snapshot: isRecord(raw.snapshot) ? (raw.snapshot as Record<string, unknown>) : {},
    updatedAt: str(raw.updatedAt),
  }
}

export function normalizeSpotProjectionList(raw: unknown): SpotProjectionRow[] {
  const r = isRecord(raw) ? raw : {}
  // Backend wraps in { data: { rows: [...] } }
  const data = isRecord(r.data) ? r.data : r
  const rows = Array.isArray(data.rows) ? data.rows : Array.isArray(data) ? data : []
  return rows.map(normalizeSpotProjectionRow).filter((x): x is SpotProjectionRow => x !== null)
}

// ─── View model derivation ────────────────────────────────────

const STALE_THRESHOLD_MS = 120_000 // 2 minutes — slot is visually stale

export function rowToSlotViewModel(row: SpotProjectionRow): SlotViewModel {
  const isStale =
    row.occupancyStatus === 'SENSOR_STALE' ||
    (row.staleAt != null && Date.now() > Date.parse(row.staleAt))

  return {
    spotId: row.spotId,
    spotCode: row.spotCode,
    zoneCode: row.zoneCode ?? '',
    occupancyStatus: row.occupancyStatus,
    observedPlate: row.observedPlateCompact,
    expectedPlate: row.expectedPlateCompact,
    hasSubscription: row.matchedSubscriptionId != null,
    subscriptionId: row.matchedSubscriptionId,
    reasonCode: row.reasonCode,
    updatedAt: row.updatedAt,
    isStale,
  }
}

// ─── Floor grouping ───────────────────────────────────────────
//
// Backend doesn't expose a floor concept — we derive it from zoneCode prefix.
// Convention: if zoneCode is like "A1", "A2" → floor "A"
//             if zoneCode is like "F1_A", "F1_B" → floor "F1"
//             if no clear prefix, group into "Zone [code]"
// This is purely a frontend grouping heuristic.
// If backend ever adds a floor field, update this mapper.

function deriveFloorKey(zoneCode: string): string {
  if (!zoneCode) return 'UNKNOWN'
  // Try F1_, F2_ style
  const floorMatch = zoneCode.match(/^(F\d+)[_-]/i)
  if (floorMatch) return floorMatch[1].toUpperCase()
  // Try single-letter prefix: A1, B3 etc
  const letterMatch = zoneCode.match(/^([A-Z])\d+$/i)
  if (letterMatch) return letterMatch[1].toUpperCase()
  // Fall back: use full zone code as its own floor
  return zoneCode
}

export function buildFloorLabel(key: string): string {
  if (key === 'UNKNOWN') return 'Unknown floor'
  if (/^F\d+$/i.test(key)) return `Floor ${key.slice(1)}`
  if (/^[A-Z]$/.test(key)) return `Block ${key}`
  return key
}

function buildSummary(slots: SlotViewModel[]): OccupancySummary {
  const summary: OccupancySummary = {
    total: slots.length,
    empty: 0,
    occupied: 0,
    occupiedMatched: 0,
    occupiedUnknown: 0,
    occupiedViolation: 0,
    stale: 0,
  }
  for (const s of slots) {
    if (s.occupancyStatus === 'EMPTY') summary.empty++
    else if (s.occupancyStatus === 'OCCUPIED_MATCHED') { summary.occupied++; summary.occupiedMatched++ }
    else if (s.occupancyStatus === 'OCCUPIED_UNKNOWN') { summary.occupied++; summary.occupiedUnknown++ }
    else if (s.occupancyStatus === 'OCCUPIED_VIOLATION') { summary.occupied++; summary.occupiedViolation++ }
    else if (s.occupancyStatus === 'SENSOR_STALE') summary.stale++
  }
  return summary
}

export function groupRowsIntoFloors(rows: SpotProjectionRow[]): FloorGroup[] {
  const floorMap = new Map<string, { zones: Set<string>; slots: SlotViewModel[] }>()

  for (const row of rows) {
    const floorKey = deriveFloorKey(row.zoneCode ?? '')
    if (!floorMap.has(floorKey)) floorMap.set(floorKey, { zones: new Set(), slots: [] })
    const entry = floorMap.get(floorKey)!
    if (row.zoneCode) entry.zones.add(row.zoneCode)
    entry.slots.push(rowToSlotViewModel(row))
  }

  // Sort floor keys naturally: F1 < F2 < F3, or A < B < C
  const sortedKeys = Array.from(floorMap.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  return sortedKeys.map((key) => {
    const entry = floorMap.get(key)!
    const slots = entry.slots.sort((a, b) => a.spotCode.localeCompare(b.spotCode, undefined, { numeric: true }))
    return {
      floorKey: key,
      label: buildFloorLabel(key),
      zones: Array.from(entry.zones).sort(),
      slots,
      summary: buildSummary(slots),
    }
  })
}

// ─── Recently changed detection ───────────────────────────────

const RECENT_CHANGE_MS = 30_000 // 30 seconds

export function markRecentlyChanged(
  current: SlotViewModel[],
  previous: SlotViewModel[],
): SlotViewModel[] {
  const prevMap = new Map(previous.map((s) => [s.spotId, s.occupancyStatus]))
  const now = Date.now()
  return current.map((slot) => {
    const wasStatus = prevMap.get(slot.spotId)
    const changedRecently =
      wasStatus != null &&
      wasStatus !== slot.occupancyStatus &&
      Date.now() - Date.parse(slot.updatedAt) < RECENT_CHANGE_MS
    return changedRecently ? { ...slot, recentlyChanged: true } : slot
  })
}
