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

export const ParkingFloorBoard = memo(function ParkingFloorBoard({
  floor,
  selectedSpotId,
  searchQuery,
  statusFilter,
  onSlotClick,
}: Props) {
  const q = searchQuery.trim().toLowerCase()

  // Highlighted set — slots matching the current search query
  const highlightedIds = useMemo(() => {
    if (!q) return new Set<string>()
    const set = new Set<string>()
    for (const slot of floor.slots) {
      if (
        slot.spotCode.toLowerCase().includes(q) ||
        (slot.observedPlate?.toLowerCase().includes(q)) ||
        (slot.zoneCode.toLowerCase().includes(q))
      ) {
        set.add(slot.spotId)
      }
    }
    return set
  }, [floor.slots, q])

  // Filtered view — for status filter, dim non-matching slots rather than hide
  const visibleSlots = useMemo(() => {
    if (!statusFilter) return floor.slots
    return floor.slots.filter((s) => s.occupancyStatus === statusFilter)
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

  // Group by zone for visual organisation within the floor
  const byZone = useMemo(() => {
    const map = new Map<string, SlotViewModel[]>()
    for (const slot of visibleSlots) {
      const zone = slot.zoneCode || 'Unknown'
      if (!map.has(zone)) map.set(zone, [])
      map.get(zone)!.push(slot)
    }
    return Array.from(map.entries()).sort(([a]: [string, SlotViewModel[]], [b]: [string, SlotViewModel[]]) =>
      a.localeCompare(b, undefined, { numeric: true }),
    )
  }, [visibleSlots])

  return (
    <div className="space-y-5">
      {byZone.map(([zoneCode, slots]: [string, SlotViewModel[]]) => (
        <div key={zoneCode}>
          <p className="mb-2 font-mono-data text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
            Zone {zoneCode}
          </p>
          {/* Variable-count grid — adapts to any number of slots */}
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
