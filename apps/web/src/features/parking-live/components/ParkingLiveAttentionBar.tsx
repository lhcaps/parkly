import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ParkingLiveAttentionItem } from './ParkingLiveToolbar'

type Props = {
  items: ParkingLiveAttentionItem[]
  activeStatus: string
  onSelect: (statusValue: string) => void
}

export function ParkingLiveAttentionBar({ items, activeStatus, onSelect }: Props) {
  if (items.length === 0) return null

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/8 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-primary">
          <AlertTriangle className="h-4 w-4" />
          <div>
            <p className="text-sm font-medium">Attention hotspots</p>
            <p className="text-xs text-primary/80">Jump straight to the classes of slots most likely to need operator action.</p>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(activeStatus === item.statusValue ? '' : item.statusValue)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                activeStatus === item.statusValue
                  ? 'border-primary/50 bg-primary text-primary-foreground'
                  : 'border-primary/20 bg-background/60 text-primary hover:border-primary/35',
              )}
            >
              {item.label} · <span className="font-mono-data">{item.count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
