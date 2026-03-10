import { Wifi, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSseFeed } from '@/features/_shared/use-sse-feed'
import { getGateEventStreamUrl } from '@/lib/api/mobile'
import type { GateEventStreamItem } from '@/lib/contracts/mobile'

export function CaptureFeedTable({
  selectedEventId,
  onSelect,
}: {
  selectedEventId: string
  onSelect: (row: GateEventStreamItem) => void
}) {
  const { items, state } = useSseFeed<GateEventStreamItem>({
    url: getGateEventStreamUrl(),
    eventName: 'gate_event',
    maxItems: 80,
  })

  return (
    <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Capture feed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Feed này theo dõi event ingest thực tế. Nó không chạm vào Run Lane state.
          </p>
        </div>

        <Badge variant={state.connected ? 'entry' : 'outline'}>
          {state.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {state.connected ? 'connected' : 'disconnected'}
        </Badge>
      </div>

      {state.error ? (
        <div className="mb-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-12 text-center text-sm text-muted-foreground">
          Chưa có event nào từ gate event stream.
        </div>
      ) : (
        <ScrollArea className="h-[560px] pr-3">
          <div className="space-y-3">
            {items.map((row) => (
              <button
                key={`${row.eventId}:${row.outboxId}:${row.ts}`}
                onClick={() => onSelect(row)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  selectedEventId === row.eventId ? 'border-primary/35 bg-primary/8' : 'border-border bg-background/40 hover:bg-muted/40'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={row.direction === 'EXIT' ? 'exit' : 'entry'}>{row.direction || '—'}</Badge>
                      {row.reviewRequired ? <Badge variant="amber">review</Badge> : null}
                    </div>

                    <p className="mt-2 break-all font-mono-data text-sm font-semibold">
                      event={row.eventId} · outbox={row.outboxId}
                    </p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {row.siteCode || '—'} / {row.laneCode || '—'} / {row.deviceCode || '—'}
                    </p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      plate={row.plateDisplay || row.plateCompact || row.licensePlateRaw || '—'}
                    </p>
                  </div>

                  <div className="text-right text-[11px] font-mono-data text-muted-foreground">
                    <p>{new Date(row.eventTime).toLocaleString('vi-VN')}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
