import { cn } from '@/lib/utils'

export type ParkingZoneSummaryItem = {
  zoneCode: string
  total: number
  occupied: number
  stale: number
  blocked: number
  reserved: number
  violation: number
}

type Props = {
  items: ParkingZoneSummaryItem[]
  activeZone: string
  onSelect: (zoneCode: string) => void
}

export function ParkingZoneSummaryStrip({ items, activeZone, onSelect }: Props) {
  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Zone focus</p>
          <p className="mt-1 text-sm text-muted-foreground">Pick a zone to tighten the board without losing floor context.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const attention = item.stale + item.violation + item.blocked
          const active = item.zoneCode === activeZone
          const occupiedPct = item.total > 0 ? Math.round((item.occupied / item.total) * 100) : 0

          return (
            <button
              key={item.zoneCode}
              type="button"
              onClick={() => onSelect(item.zoneCode === activeZone ? '' : item.zoneCode)}
              className={cn(
                'rounded-2xl border px-4 py-3 text-left transition-all',
                active
                  ? 'border-primary/45 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.18)]'
                  : 'border-border/60 bg-card/70 hover:border-border hover:bg-card',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono-data text-sm font-semibold text-foreground">Zone {item.zoneCode}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {item.occupied}/{item.total} occupied · {occupiedPct}%
                  </p>
                </div>
                {attention > 0 ? (
                  <span className="rounded-full border border-destructive/25 bg-destructive/10 px-2 py-0.5 font-mono-data text-[10px] font-semibold text-destructive">
                    {attention} attention
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <div>
                  <p className="font-mono-data text-sm text-foreground">{item.violation}</p>
                  <p>viol</p>
                </div>
                <div>
                  <p className="font-mono-data text-sm text-foreground">{item.stale}</p>
                  <p>stale</p>
                </div>
                <div>
                  <p className="font-mono-data text-sm text-foreground">{item.blocked}</p>
                  <p>block</p>
                </div>
                <div>
                  <p className="font-mono-data text-sm text-foreground">{item.reserved}</p>
                  <p>reserve</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
