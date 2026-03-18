import { memo } from 'react'
import { AlertTriangle, Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SlotViewModel } from '../types'

type SlotTileProps = {
  slot: SlotViewModel
  densityMode: 'comfortable' | 'compact'
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

function getSupportingLabel(slot: SlotViewModel) {
  if (slot.observedPlate) return slot.observedPlate
  if (slot.occupancyStatus === 'EMPTY') return 'free'
  if (slot.occupancyStatus === 'SENSOR_STALE') return 'snapshot stale'
  if (slot.occupancyStatus === 'BLOCKED') return 'blocked'
  if (slot.occupancyStatus === 'RESERVED') return 'reserved'
  if (slot.occupancyStatus === 'OCCUPIED_VIOLATION') return 'violation'
  if (slot.occupancyStatus === 'OCCUPIED_UNKNOWN') return 'unknown plate'
  return '—'
}

export const ParkingSlotTile = memo(function ParkingSlotTile({
  slot,
  densityMode,
  isSelected,
  isHighlighted,
  onClick,
}: SlotTileProps) {
  const statusClass = STATUS_CLASSES[slot.occupancyStatus] ?? STATUS_CLASSES.SENSOR_STALE
  const dotClass = STATUS_DOT[slot.occupancyStatus] ?? 'bg-muted-foreground/40'
  const compact = densityMode === 'compact'
  const supportLabel = getSupportingLabel(slot)
  const showAttention = slot.occupancyStatus === 'OCCUPIED_VIOLATION' || slot.occupancyStatus === 'OCCUPIED_UNKNOWN' || slot.isStale || Boolean(slot.incidentCode)

  return (
    <button
      type="button"
      onClick={() => onClick(slot)}
      title={`${slot.spotCode} · ${slot.occupancyStatus}${slot.observedPlate ? ` · ${slot.observedPlate}` : ''}`}
      className={cn(
        'relative w-full rounded-xl border text-left transition-all duration-150',
        compact ? 'min-h-[58px] p-2' : 'min-h-[84px] p-2.5',
        statusClass,
        isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        isHighlighted && !isSelected && 'ring-2 ring-amber-400/60 ring-offset-1 ring-offset-background',
        slot.recentlyChanged && 'animate-pulse-once',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn('font-mono-data font-semibold leading-none', compact ? 'text-[10px]' : 'text-[11px]')}>
              {slot.spotCode}
            </span>
            {slot.isStale ? (
              <span className="rounded-full border border-current/15 bg-current/10 px-1.5 py-0.5 font-mono-data text-[8px] uppercase tracking-wide opacity-80">
                stale
              </span>
            ) : null}
          </div>
          {!compact ? (
            <div className="mt-1 truncate font-mono-data text-[10px] leading-none opacity-85">{supportLabel}</div>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {showAttention ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current/15 bg-current/10">
              <AlertTriangle className="h-3 w-3" />
            </span>
          ) : null}
          <span
            className={cn(
              'mt-0.5 h-2 w-2 shrink-0 rounded-full',
              dotClass,
              slot.occupancyStatus === 'OCCUPIED_MATCHED' && 'shadow-[0_0_6px_currentColor]',
              slot.occupancyStatus === 'RESERVED' && 'shadow-[0_0_6px_currentColor]',
            )}
          />
        </div>
      </div>

      <div className={cn('mt-2 flex items-center justify-between gap-2', compact && 'mt-1')}>
        <div className="flex min-w-0 items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] opacity-70">
          <span className="truncate">{slot.zoneCode}</span>
          {slot.hasSubscription ? <span className="rounded-full border border-current/15 px-1.5 py-0.5 font-mono-data">SUB</span> : null}
          {slot.incidentCode ? <span className="rounded-full border border-current/15 px-1.5 py-0.5 font-mono-data">INC</span> : null}
        </div>

        {slot.recentlyChanged ? (
          <span className="flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] opacity-75">
            <Clock3 className="h-2.5 w-2.5" />
            new
          </span>
        ) : null}
      </div>

      {compact ? (
        <div className="mt-1 truncate font-mono-data text-[9px] leading-none opacity-75">{supportLabel}</div>
      ) : null}
    </button>
  )
})
