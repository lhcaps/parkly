import { useMemo } from 'react'
import { Loader2, RefreshCw, ServerCog } from 'lucide-react'
import { ConnectionBadge, SurfaceState } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RealtimeStatusBanner } from '@/features/_shared/realtime/RealtimeStatusBanner'
import { useSseSnapshot } from '@/features/_shared/use-sse-snapshot'
import { makeSseUrl, type DeviceHealthSnapshot } from '@/lib/api'

export function DeviceHealthPanel({ compact = false }: { compact?: boolean }) {
  const { data, state, resync } = useSseSnapshot<DeviceHealthSnapshot>({
    url: makeSseUrl('/api/stream/device-health'),
    eventName: 'device_health_snapshot',
  })

  const rows = useMemo(() => {
    const sourceRows = data?.rows ?? []
    const deduped = new Map<string, typeof sourceRows[number]>()

    for (const row of sourceRows) {
      const key = [row.siteCode, row.gateCode ?? 'NA', row.laneCode ?? 'UNASSIGNED', row.deviceCode, row.deviceRole ?? row.deviceType ?? 'NA'].join(':')
      if (!deduped.has(key)) deduped.set(key, row)
    }

    return Array.from(deduped.values())
  }, [data?.rows])

  const metrics = useMemo(() => ({
    total: rows.length,
    online: rows.filter((row) => row.derivedHealth === 'ONLINE').length,
    degraded: rows.filter((row) => row.derivedHealth === 'DEGRADED').length,
    offline: rows.filter((row) => row.derivedHealth === 'OFFLINE').length,
  }), [rows])

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{compact ? 'Device health' : 'Device Health'}</CardTitle>
          <CardDescription>Derived health reflects heartbeat age, capture status, and actual lane assignment.</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ConnectionBadge connected={state.connected} status={state.status} label="Device stream" />
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
        <RealtimeStatusBanner title="Device stream" state={state} onResync={() => void resync()} disabled={state.refreshing} />

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{metrics.total} total</Badge>
          <Badge variant="secondary">{metrics.online} online</Badge>
          <Badge variant={metrics.degraded > 0 ? 'amber' : 'outline'}>{metrics.degraded} degraded</Badge>
          <Badge variant={metrics.offline > 0 ? 'destructive' : 'outline'}>{metrics.offline} offline</Badge>
        </div>

        {state.error && rows.length === 0 ? (
          <SurfaceState title="Device stream unavailable" description={state.error} tone="error" className="min-h-[140px]" action={{ label: 'Resync', onClick: () => void resync() }} />
        ) : rows.length === 0 ? (
          <SurfaceState
            title={state.connected ? 'No device health snapshot yet' : 'Waiting for device stream'}
            description="Device health will appear here once the backend pushes a snapshot. Resync to reopen the stream if data is missing."
            icon={ServerCog}
            tone={state.connected ? 'empty' : 'loading'}
            className="min-h-[220px]"
            action={{ label: 'Manual resync', onClick: () => void resync() }}
            busy={state.refreshing}
          />
        ) : (
          <ScrollArea className={compact ? 'h-[360px]' : 'h-[640px]'}>
            <div className="space-y-3 pr-3">
              {rows.map((row) => (
                <div
                  key={`${row.siteCode}:${row.gateCode ?? 'NA'}:${row.laneCode ?? 'UNASSIGNED'}:${row.deviceCode}:${row.deviceRole ?? row.deviceType ?? 'NA'}`}
                  className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono-data text-sm font-semibold">{row.deviceCode}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.siteCode}
                        {row.gateCode ? ` / ${row.gateCode}` : ''}
                        {row.laneCode ? ` / ${row.laneCode}` : ''} &middot; {row.deviceType}
                        {row.deviceRole ? ` &middot; ${row.deviceRole}` : ''}
                      </p>
                    </div>
                    <Badge
                      variant={
                        row.derivedHealth === 'ONLINE'
                          ? 'secondary'
                          : row.derivedHealth === 'OFFLINE'
                            ? 'destructive'
                            : 'amber'
                      }
                    >
                      {row.derivedHealth}
                    </Badge>
                  </div>

                  {row.healthReason ? <p className="mt-2 text-xs text-muted-foreground">{row.healthReason}</p> : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.heartbeatStatus ? <Badge variant="outline">{row.heartbeatStatus}</Badge> : <Badge variant="outline">No heartbeat</Badge>}
                    {row.isRequired ? <Badge variant="outline">Required</Badge> : null}
                    {row.isPrimary ? <Badge variant="outline">Primary</Badge> : null}
                    {typeof row.heartbeatAgeSeconds === 'number' ? (
                      <Badge variant={row.heartbeatAgeSeconds > 60 ? 'amber' : 'outline'}>{row.heartbeatAgeSeconds}s ago</Badge>
                    ) : null}
                    {typeof row.latencyMs === 'number' ? (
                      <Badge variant="outline">{row.latencyMs}ms</Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
