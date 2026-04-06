import { memo } from 'react'

const LEGEND = [
  { label: 'Empty', dot: 'bg-success' },
  { label: 'Matched', dot: 'bg-primary shadow-[0_0_4px_hsl(var(--primary))]' },
  { label: 'Unknown', dot: 'bg-amber-400' },
  { label: 'Violation', dot: 'bg-destructive' },
  { label: 'Stale snapshot', dot: 'bg-muted-foreground/40' },
  { label: 'Reserved', dot: 'bg-cyan-300' },
  { label: 'Blocked', dot: 'bg-border' },
] as const

export const ParkingLegend = memo(function ParkingLegend() {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Legend</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {LEGEND.map(({ label, dot }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="font-mono-data text-[9px] text-muted-foreground/60">SUB</span>
          <span className="text-[11px] text-muted-foreground">Subscription linked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono-data text-[9px] text-muted-foreground/60">INC</span>
          <span className="text-[11px] text-muted-foreground">Incident attached</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono-data text-[9px] text-muted-foreground/60">NEW</span>
          <span className="text-[11px] text-muted-foreground">Recent change cue</span>
        </div>
      </div>
    </div>
  )
})
