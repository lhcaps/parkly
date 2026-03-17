import { memo } from 'react'
import type { OccupancySummary } from '../types'

type Props = {
  summary: OccupancySummary
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2">
      <span className={`font-mono-data text-lg font-semibold tabular-nums ${accent ?? 'text-foreground'}`}>
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
    </div>
  )
}

export const ParkingLiveSummaryBar = memo(function ParkingLiveSummaryBar({ summary }: Props) {
  const occupancyPct = summary.total > 0 ? Math.round((summary.occupiedTotal / summary.total) * 100) : 0

  return (
    <div className="flex flex-wrap items-center gap-0 divide-x divide-border/60 rounded-2xl border border-border/60 bg-card/70 px-1">
      <Metric label="Total" value={summary.total} />
      <Metric label="Empty" value={summary.empty} accent="text-success" />
      <Metric label="Occupied" value={summary.occupiedTotal} accent={occupancyPct >= 85 ? 'text-destructive' : occupancyPct >= 60 ? 'text-amber-400' : 'text-primary'} />
      {summary.occupiedViolation > 0 ? <Metric label="Violation" value={summary.occupiedViolation} accent="text-destructive" /> : null}
      {summary.occupiedUnknown > 0 ? <Metric label="Unknown" value={summary.occupiedUnknown} accent="text-amber-400" /> : null}
      {summary.sensorStale > 0 ? <Metric label="Stale" value={summary.sensorStale} accent="text-muted-foreground" /> : null}
      {summary.blocked > 0 ? <Metric label="Blocked" value={summary.blocked} accent="text-muted-foreground" /> : null}
      {summary.reserved > 0 ? <Metric label="Reserved" value={summary.reserved} accent="text-cyan-300" /> : null}
      <div className="flex flex-col items-center gap-0.5 px-3 py-2">
        <span className={`font-mono-data text-lg font-semibold tabular-nums ${occupancyPct >= 85 ? 'text-destructive' : occupancyPct >= 60 ? 'text-amber-400' : 'text-success'}`}>
          {occupancyPct}%
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Rate</span>
      </div>
    </div>
  )
})
