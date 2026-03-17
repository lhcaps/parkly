import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { SlotViewModel } from '../types'

type SlotTileProps = {
  slot: SlotViewModel
  isSelected: boolean
  isHighlighted: boolean
  onClick: (slot: SlotViewModel) => void
}

const STATUS_CLASSES: Record<string, string> = {
  EMPTY: 'border-success/25 bg-success/8 text-success hover:border-success/50 hover:bg-success/14',
  OCCUPIED_MATCHED: 'border-primary/30 bg-primary/10 text-primary hover:border-primary/50 hover:bg-primary/16',
  OCCUPIED_UNKNOWN: 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:border-amber-500/50',
  OCCUPIED_VIOLATION: 'border-destructive/35 bg-destructive/12 text-destructive hover:border-destructive/55',
  SENSOR_STALE: 'border-border/50 bg-muted/30 text-muted-foreground hover:border-border',
  BLOCKED: 'border-border/70 bg-background/20 text-muted-foreground hover:border-border',
  RESERVED: 'border-cyan-400/35 bg-cyan-400/10 text-cyan-300 hover:border-cyan-400/55',
}

const STATUS_DOT: Record<string, string> = {
  EMPTY: 'bg-success',
  OCCUPIED_MATCHED: 'bg-primary',
  OCCUPIED_UNKNOWN: 'bg-amber-400',
  OCCUPIED_VIOLATION: 'bg-destructive',
  SENSOR_STALE: 'bg-muted-foreground/40',
  BLOCKED: 'bg-border',
  RESERVED: 'bg-cyan-300',
}

export const ParkingSlotTile = memo(function ParkingSlotTile({ slot, isSelected, isHighlighted, onClick }: SlotTileProps) {
  const statusClass = STATUS_CLASSES[slot.occupancyStatus] ?? STATUS_CLASSES.SENSOR_STALE
  const dotClass = STATUS_DOT[slot.occupancyStatus] ?? 'bg-muted-foreground/40'

  return (
    <button
      type="button"
      onClick={() => onClick(slot)}
      title={`${slot.spotCode} · ${slot.occupancyStatus}${slot.observedPlate ? ` · ${slot.observedPlate}` : ''}`}
      className={cn(
        'relative flex min-h-[64px] w-full flex-col justify-between rounded-xl border p-2 text-left transition-all duration-150',
        statusClass,
        isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        isHighlighted && !isSelected && 'ring-2 ring-amber-400/60 ring-offset-1 ring-offset-background',
        slot.recentlyChanged && 'animate-pulse-once',
        slot.isStale && 'opacity-70',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono-data text-[11px] font-medium leading-none truncate">{slot.spotCode}</span>
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            dotClass,
            slot.occupancyStatus === 'OCCUPIED_MATCHED' && 'shadow-[0_0_4px_currentColor]',
            slot.occupancyStatus === 'RESERVED' && 'shadow-[0_0_4px_currentColor]',
          )}
        />
      </div>

      <div className="mt-1">
        {slot.observedPlate ? (
          <span className="font-mono-data text-[10px] leading-none opacity-80">{slot.observedPlate}</span>
        ) : slot.occupancyStatus === 'EMPTY' ? (
          <span className="text-[10px] leading-none opacity-50">free</span>
        ) : slot.occupancyStatus === 'SENSOR_STALE' ? (
          <span className="text-[10px] leading-none opacity-50">stale</span>
        ) : slot.occupancyStatus === 'BLOCKED' ? (
          <span className="text-[10px] leading-none opacity-50">blocked</span>
        ) : slot.occupancyStatus === 'RESERVED' ? (
          <span className="text-[10px] leading-none opacity-50">reserved</span>
        ) : (
          <span className="text-[10px] leading-none opacity-50">—</span>
        )}
      </div>

      {slot.hasSubscription ? (
        <span className="absolute right-1.5 top-1 text-[8px] font-mono-data uppercase tracking-wide opacity-60">sub</span>
      ) : null}
    </button>
  )
})
