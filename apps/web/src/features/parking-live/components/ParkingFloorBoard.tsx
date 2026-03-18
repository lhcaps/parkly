import { memo, useMemo } from 'react'
import { PageStateBlock } from '@/components/state/page-state'
import { ParkingSlotTile } from './ParkingSlotTile'
import type { FloorGroup, SlotViewModel } from '../types'

type Props = {
  floor: FloorGroup
  selectedSpotId: string
  searchQuery: string
  statusFilter: string
  zoneFilter: string
  densityMode: 'comfortable' | 'compact'
  onSlotClick: (slot: SlotViewModel) => void
}

function sortSlots(a: SlotViewModel, b: SlotViewModel) {
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

export const ParkingFloorBoard = memo(function ParkingFloorBoard({
  floor,
  selectedSpotId,
  searchQuery,
  statusFilter,
  zoneFilter,
  densityMode,
  onSlotClick,
}: Props) {
  const q = searchQuery.trim().toLowerCase()

  const highlightedIds = useMemo(() => {
    if (!q) return new Set<string>()
    const set = new Set<string>()
    for (const slot of floor.slots) {
      if (
        slot.spotCode.toLowerCase().includes(q) ||
        slot.zoneCode.toLowerCase().includes(q) ||
        (slot.observedPlate?.toLowerCase().includes(q)) ||
        (slot.subscriptionCode?.toLowerCase().includes(q))
      ) {
        set.add(slot.spotId)
      }
    }
    return set
  }, [floor.slots, q])

  const visibleSlots = useMemo(() => {
    const filteredByStatus = !statusFilter ? floor.slots : floor.slots.filter((s) => s.occupancyStatus === statusFilter)
    const filteredByZone = !zoneFilter ? filteredByStatus : filteredByStatus.filter((s) => s.zoneCode === zoneFilter)
    return [...filteredByZone].sort(sortSlots)
  }, [floor.slots, statusFilter, zoneFilter])

  const byZone = useMemo(() => {
    const map = new Map<string, SlotViewModel[]>()
    for (const slot of visibleSlots) {
      const zone = slot.zoneCode || 'Unknown'
      if (!map.has(zone)) map.set(zone, [])
      map.get(zone)?.push(slot)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([zone, slots]) => [zone, [...slots].sort(sortSlots)] as const)
  }, [visibleSlots])

  if (visibleSlots.length === 0) {
    const detail = [zoneFilter ? `zone ${zoneFilter}` : null, statusFilter ? `status ${statusFilter}` : null].filter(Boolean).join(' · ')

    return (
      <PageStateBlock
        variant="empty"
        title="No slots match this board view"
        description={detail ? `No slot matched ${detail} on ${floor.label}. Clear one of the active filters to widen the board.` : `No slot matched the current filters on ${floor.label}.`}
        minHeightClassName="min-h-[180px]"
      />
    )
  }

  const columnWidth = densityMode === 'compact' ? 'minmax(72px, 1fr)' : 'minmax(96px, 1fr)'

  return (
    <div className="space-y-5">
      {byZone.map(([zoneCode, slots]) => (
        <section key={zoneCode} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono-data text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                Zone {zoneCode}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {slots.length} visible slot{slots.length === 1 ? '' : 's'}
                {q ? ` · ${slots.filter((slot) => highlightedIds.has(slot.spotId)).length} search match${slots.filter((slot) => highlightedIds.has(slot.spotId)).length === 1 ? '' : 'es'}` : ''}
              </p>
            </div>
          </div>

          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, ${columnWidth})` }}>
            {slots.map((slot) => (
              <ParkingSlotTile
                key={slot.spotId}
                slot={slot}
                densityMode={densityMode}
                isSelected={slot.spotId === selectedSpotId}
                isHighlighted={highlightedIds.has(slot.spotId)}
                onClick={onSlotClick}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
})
