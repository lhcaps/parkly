import { useMemo } from 'react'
import { Loader2, RadioTower, Wifi, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { makeSseUrl, type OutboxSnapshot } from '@/lib/api'
import { useSseSnapshot } from '@/features/_shared/use-sse-snapshot'

function StreamBadge({ connected }: { connected: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-mono-data',
        connected ? 'border-success/25 bg-success/8 text-success' : 'border-border bg-card text-muted-foreground',
      )}
    >
      {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      OUTBOX SSE {connected ? 'CONNECTED' : 'DISCONNECTED'}
    </div>
  )
}

function outboxVariant(status: string): 'secondary' | 'outline' | 'destructive' {
  if (status === 'SENT' || status === 'ACKED') return 'secondary'
  if (status === 'FAILED' || status === 'TIMEOUT' || status === 'NACKED') return 'destructive'
  return 'outline'
}

export function OutboxMonitorPanel({ compact = false }: { compact?: boolean }) {
  const { data, state } = useSseSnapshot<OutboxSnapshot>({
    url: makeSseUrl('/api/stream/outbox?limit=40'),
    eventName: 'outbox_snapshot',
  })

  const rows = data?.rows ?? []

  const metrics = useMemo(() => {
    return {
      total: rows.length,
      pending: rows.filter((row) => row.status === 'PENDING' || row.status === 'RETRYING').length,
      failed: rows.filter((row) => row.status === 'FAILED' || row.status === 'TIMEOUT' || row.status === 'NACKED').length,
      sent: rows.filter((row) => row.status === 'SENT' || row.status === 'ACKED').length,
    }
  }, [rows])

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{compact ? 'Outbox' : 'Outbox Monitor'}</CardTitle>
          <CardDescription>
            Feed này là dữ liệu outbox thật, không phải poll giả. Dùng để thấy hàng đợi tích luỹ, retry, lỗi và bridge qua downstream.
          </CardDescription>
        </div>
        <StreamBadge connected={state.connected} />
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-[11px] font-mono-data text-muted-foreground">
          <Badge variant="outline">total={metrics.total}</Badge>
          <Badge variant={metrics.pending > 0 ? 'amber' : 'outline'}>pending={metrics.pending}</Badge>
          <Badge variant={metrics.failed > 0 ? 'destructive' : 'outline'}>failed={metrics.failed}</Badge>
          <Badge variant="secondary">sent={metrics.sent}</Badge>
          <Badge variant="outline">promotedToSent={data?.barrierLifecycle.promotedToSent ?? 0}</Badge>
          <Badge variant="outline">timedOut={data?.barrierLifecycle.timedOut ?? 0}</Badge>
        </div>

        {state.error ? (
          <div className="rounded-lg border border-destructive/25 bg-destructive/8 px-4 py-3 text-xs text-destructive">
            {state.error}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-muted-foreground/60">
            {state.connected ? <RadioTower className="h-10 w-10" /> : <Loader2 className="h-10 w-10 animate-spin" />}
            <div className="text-center">
              <p className="text-sm font-medium">{state.connected ? 'Chưa có outbox snapshot' : 'Đang chờ outbox stream...'}</p>
              <p className="mt-1 text-xs">Khi gate đọc / session / barrier ghi ra outbox, feed này sẽ đổi ngay.</p>
            </div>
          </div>
        ) : (
          <ScrollArea className={compact ? 'h-[360px]' : 'h-[640px]'}>
            <div className="space-y-3 pr-3">
              {rows.map((row) => (
                <div key={row.outboxId} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono-data text-sm font-semibold">outbox={row.outboxId}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        event={row.eventId} · {row.siteCode || '—'} / {row.laneCode || '—'} / {row.deviceCode || '—'}
                      </p>
                    </div>
                    <Badge variant={outboxVariant(row.status)}>{row.status}</Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono-data text-muted-foreground">
                    <Badge variant="outline">attempts={row.attempts}</Badge>
                    <Badge variant="outline">direction={row.payloadSummary.direction || '—'}</Badge>
                    <Badge variant="outline">readType={row.payloadSummary.readType || '—'}</Badge>
                    <Badge variant="outline">plate={row.payloadSummary.plateDisplay || row.payloadSummary.plateCompact || '—'}</Badge>
                    {row.payloadSummary.reviewRequired ? <Badge variant="outline">review</Badge> : null}
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    updated {new Date(row.updatedAt).toLocaleString('vi-VN')}
                    {row.lastError ? ` · ${row.lastError}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
