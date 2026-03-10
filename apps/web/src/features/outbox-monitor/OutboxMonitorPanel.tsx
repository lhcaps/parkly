import { useMemo } from 'react'
import { RadioTower } from 'lucide-react'
import { ConnectionBadge, SurfaceState } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { makeSseUrl, type OutboxSnapshot } from '@/lib/api'
import { useSseSnapshot } from '@/features/_shared/use-sse-snapshot'

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

  const metrics = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((row) => row.status === 'PENDING' || row.status === 'RETRYING').length,
    failed: rows.filter((row) => row.status === 'FAILED' || row.status === 'TIMEOUT' || row.status === 'NACKED').length,
    sent: rows.filter((row) => row.status === 'SENT' || row.status === 'ACKED').length,
  }), [rows])

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{compact ? 'Outbox' : 'Outbox Monitor'}</CardTitle>
          <CardDescription>Quan sát backlog đồng bộ, retry và kết quả đẩy xuống downstream theo thời gian thực.</CardDescription>
        </div>
        <ConnectionBadge connected={state.connected} label="Outbox stream" />
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
          <SurfaceState title="Không thể nhận outbox stream" description={state.error} tone="error" className="min-h-[140px]" />
        ) : rows.length === 0 ? (
          <SurfaceState
            title={state.connected ? 'Chưa có outbox snapshot' : 'Đang chờ kết nối outbox stream'}
            description="Khi session, gate read hoặc barrier ghi ra outbox, danh sách này sẽ cập nhật ngay."
            icon={RadioTower}
            tone={state.connected ? 'empty' : 'loading'}
            className="min-h-[220px]"
          />
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
