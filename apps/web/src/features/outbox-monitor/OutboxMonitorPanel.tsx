import { useMemo } from 'react'
import { Loader2, RadioTower, RefreshCw } from 'lucide-react'
import { ConnectionBadge, SurfaceState } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RealtimeStatusBanner } from '@/features/_shared/realtime/RealtimeStatusBanner'
import { useSseSnapshot } from '@/features/_shared/use-sse-snapshot'
import { makeSseUrl, type OutboxSnapshot } from '@/lib/api'

function outboxVariant(status: string): 'secondary' | 'outline' | 'destructive' {
  if (status === 'SENT' || status === 'ACKED') return 'secondary'
  if (status === 'FAILED' || status === 'TIMEOUT' || status === 'NACKED') return 'destructive'
  return 'outline'
}

export function OutboxMonitorPanel({ compact = false }: { compact?: boolean }) {
  const { data, state, resync } = useSseSnapshot<OutboxSnapshot>({
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
          <CardDescription>Live view of the sync queue — backlog, retries, and downstream delivery results.</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ConnectionBadge connected={state.connected} status={state.status} label="Outbox stream" />
          <div className="flex gap-2">
            <Badge variant={state.stale ? 'amber' : 'outline'}>{state.stale ? 'Stale' : 'Live'}</Badge>
            <Button type="button" size="sm" variant="outline" onClick={() => void resync()}>
              {state.refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Resync
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <RealtimeStatusBanner title="Outbox stream" state={state} onResync={() => void resync()} disabled={state.refreshing} />

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{metrics.total} total</Badge>
          <Badge variant={metrics.pending > 0 ? 'amber' : 'outline'}>{metrics.pending} pending</Badge>
          <Badge variant={metrics.failed > 0 ? 'destructive' : 'outline'}>{metrics.failed} failed</Badge>
          <Badge variant="secondary">{metrics.sent} sent</Badge>
          {(data?.barrierLifecycle.promotedToSent ?? 0) > 0 ? (
            <Badge variant="outline">{data?.barrierLifecycle.promotedToSent} promoted</Badge>
          ) : null}
          {(data?.barrierLifecycle.timedOut ?? 0) > 0 ? (
            <Badge variant="amber">{data?.barrierLifecycle.timedOut} timed out</Badge>
          ) : null}
        </div>

        {state.error && rows.length === 0 ? (
          <SurfaceState title="Outbox stream unavailable" description={state.error} tone="error" className="min-h-[140px]" action={{ label: 'Resync', onClick: () => void resync() }} />
        ) : rows.length === 0 ? (
          <SurfaceState
            title={state.connected ? 'No outbox rows yet' : 'Waiting for outbox stream'}
            description="Rows will appear here once sessions, gate reads, or barrier events write to the outbox."
            icon={RadioTower}
            tone={state.connected ? 'empty' : 'loading'}
            className="min-h-[220px]"
            action={{ label: 'Manual resync', onClick: () => void resync() }}
            busy={state.refreshing}
          />
        ) : (
          <ScrollArea className={compact ? 'h-[360px]' : 'h-[640px]'}>
            <div className="space-y-3 pr-3">
              {rows.map((row) => (
                <div key={row.outboxId} className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono-data text-sm font-semibold">{row.outboxId}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.siteCode || '—'} / {row.laneCode || '—'} / {row.deviceCode || '—'}
                      </p>
                    </div>
                    <Badge variant={outboxVariant(row.status)}>{row.status}</Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">{row.attempts} attempt{row.attempts !== 1 ? 's' : ''}</Badge>
                    {row.payloadSummary.direction ? <Badge variant="outline">{row.payloadSummary.direction}</Badge> : null}
                    {row.payloadSummary.readType ? <Badge variant="outline">{row.payloadSummary.readType}</Badge> : null}
                    {(row.payloadSummary.plateDisplay || row.payloadSummary.plateCompact) ? (
                      <Badge variant="outline">{row.payloadSummary.plateDisplay || row.payloadSummary.plateCompact}</Badge>
                    ) : null}
                    {row.payloadSummary.reviewRequired ? <Badge variant="amber">Review</Badge> : null}
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    Updated {new Date(row.updatedAt).toLocaleString('en-GB')}
                    {row.lastError ? <span className="ml-2 text-destructive">{row.lastError}</span> : null}
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
