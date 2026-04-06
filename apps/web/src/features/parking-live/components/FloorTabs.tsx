import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { FloorGroup } from '../types'

type Props = {
  floors: FloorGroup[]
  activeFloorKey: string
  onChange: (key: string) => void
}

export const FloorTabs = memo(function FloorTabs({ floors, activeFloorKey, onChange }: Props) {
  if (floors.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {floors.map((floor) => {
        const active = floor.floorKey === activeFloorKey
        const { summary } = floor
        const occupancyRate = summary.total > 0 ? Math.round((summary.occupiedTotal / summary.total) * 100) : 0
        const attentionCount = summary.occupiedViolation + summary.sensorStale + summary.blocked

        return (
          <button
            key={floor.floorKey}
            type="button"
            onClick={() => onChange(floor.floorKey)}
            className={cn(
              'flex min-w-[150px] flex-col items-start rounded-2xl border px-4 py-2.5 text-left transition-all',
              active
                ? 'border-primary/40 bg-primary/10 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]'
                : 'border-border/60 bg-card/70 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground',
            )}
          >
            <div className="flex w-full items-start justify-between gap-3">
              <span className={cn('text-sm font-semibold', active ? 'text-foreground' : '')}>{floor.label}</span>
              {attentionCount > 0 ? (
                <span className="rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 font-mono-data text-[10px] font-semibold text-destructive">
                  {attentionCount}
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono-data text-[11px]">{summary.occupiedTotal}/{summary.total}</span>
              <span
                className={cn(
                  'font-mono-data text-[10px]',
                  occupancyRate >= 85 ? 'text-destructive' : occupancyRate >= 60 ? 'text-amber-400' : 'text-success',
                )}
              >
                {occupancyRate}%
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {summary.sensorStale} stale · {summary.occupiedViolation} violation · {summary.blocked} blocked
            </p>
          </button>
        )
      })}
    </div>
  )
})
