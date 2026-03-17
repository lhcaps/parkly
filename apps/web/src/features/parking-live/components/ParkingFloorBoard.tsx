import { memo, useMemo } from 'react'
import { SurfaceState } from '@/components/ops/console'
import { ParkingSlotTile } from './ParkingSlotTile'
import type { FloorGroup, SlotViewModel } from '../types'

type Props = {
  floor: FloorGroup
  selectedSpotId: string
  searchQuery: string
  statusFilter: string
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

export const ParkingFloorBoard = memo(function ParkingFloorBoard({ floor, selectedSpotId, searchQuery, statusFilter, onSlotClick }: Props) {
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
    const filtered = !statusFilter ? floor.slots : floor.slots.filter((s) => s.occupancyStatus === statusFilter)
    return [...filtered].sort(sortSlots)
  }, [floor.slots, statusFilter])

  if (visibleSlots.length === 0) {
    return (
      <SurfaceState
        title="No slots match current filter"
        description="Adjust the status filter to see more slots."
        tone="empty"
        className="min-h-[140px]"
      />
    )
  }

  const byZone = useMemo(() => {
    const map = new Map<string, SlotViewModel[]>()
    for (const slot of visibleSlots) {
      const zone = slot.zoneCode || 'Unknown'
      if (!map.has(zone)) map.set(zone, [])
      map.get(zone)!.push(slot)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([zone, slots]) => [zone, [...slots].sort(sortSlots)] as const)
  }, [visibleSlots])

  return (
    <div className="space-y-5">
      {byZone.map(([zoneCode, slots]) => (
        <div key={zoneCode}>
          <p className="mb-2 font-mono-data text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
            Zone {zoneCode}
          </p>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}>
            {slots.map((slot) => (
              <ParkingSlotTile
                key={slot.spotId}
                slot={slot}
                isSelected={slot.spotId === selectedSpotId}
                isHighlighted={highlightedIds.has(slot.spotId)}
                onClick={onSlotClick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
})
