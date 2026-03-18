import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { OccupancySummary } from '../types'

type Props = {
  summary: OccupancySummary
  label?: string
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: string
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/35 px-3 py-2.5">
      <div className={cn('font-mono-data text-lg font-semibold tabular-nums', accent ?? 'text-foreground')}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
    </div>
  )
}

export const ParkingLiveSummaryBar = memo(function ParkingLiveSummaryBar({ summary, label = 'Active board snapshot' }: Props) {
  const occupancyPct = summary.total > 0 ? Math.round((summary.occupiedTotal / summary.total) * 100) : 0
  const attentionCount = summary.occupiedViolation + summary.sensorStale + summary.blocked

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Board summary</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">{label}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.occupiedTotal} occupied out of {summary.total} slots. {attentionCount > 0 ? `${attentionCount} slots need attention.` : 'No immediate hotspot detected.'}
          </p>
        </div>

        <div className="min-w-[180px] rounded-2xl border border-border/60 bg-background/35 px-4 py-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Occupancy ratio</p>
              <p className={cn(
                'mt-1 font-mono-data text-2xl font-semibold',
                occupancyPct >= 85 ? 'text-destructive' : occupancyPct >= 60 ? 'text-amber-400' : 'text-success',
              )}>
                {occupancyPct}%
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{summary.empty} empty</p>
              <p>{summary.reserved} reserved</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                occupancyPct >= 85 ? 'bg-destructive' : occupancyPct >= 60 ? 'bg-amber-400' : 'bg-success',
              )}
              style={{ width: `${occupancyPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
        <Metric label="Total" value={summary.total} />
        <Metric label="Occupied" value={summary.occupiedTotal} accent={occupancyPct >= 85 ? 'text-destructive' : occupancyPct >= 60 ? 'text-amber-400' : 'text-primary'} />
        <Metric label="Empty" value={summary.empty} accent="text-success" />
        <Metric label="Violation" value={summary.occupiedViolation} accent="text-destructive" />
        <Metric label="Unknown" value={summary.occupiedUnknown} accent="text-amber-400" />
        <Metric label="Stale" value={summary.sensorStale} accent="text-muted-foreground" />
        <Metric label="Blocked" value={summary.blocked} accent="text-muted-foreground" />
        <Metric label="Reserved" value={summary.reserved} accent="text-cyan-300" />
      </div>
    </div>
  )
})
