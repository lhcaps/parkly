import { memo } from 'react'

const LEGEND = [
  { label: 'Empty', dot: 'bg-success', ring: '' },
  { label: 'Matched', dot: 'bg-primary shadow-[0_0_4px_hsl(var(--primary))]', ring: '' },
  { label: 'Unknown occupancy', dot: 'bg-amber-400', ring: '' },
  { label: 'Violation', dot: 'bg-destructive', ring: '' },
  { label: 'Sensor stale', dot: 'bg-muted-foreground/40', ring: '' },
] as const

export const ParkingLegend = memo(function ParkingLegend() {
  return (
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
    </div>
  )
})
