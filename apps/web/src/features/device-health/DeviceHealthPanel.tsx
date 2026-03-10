import { useMemo } from 'react'
import { Loader2, ServerCog, Wifi, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { makeSseUrl, type DeviceHealthSnapshot } from '@/lib/api'
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
      DEVICE SSE {connected ? 'CONNECTED' : 'DISCONNECTED'}
    </div>
  )
}

export function DeviceHealthPanel({ compact = false }: { compact?: boolean }) {
  const { data, state } = useSseSnapshot<DeviceHealthSnapshot>({
    url: makeSseUrl('/api/stream/device-health'),
    eventName: 'device_health_snapshot',
  })

  const rows = useMemo(() => {
    const sourceRows = data?.rows ?? []
    const deduped = new Map<string, typeof sourceRows[number]>()

    for (const row of sourceRows) {
      const key = [
        row.siteCode,
        row.gateCode ?? 'NA',
        row.laneCode ?? 'UNASSIGNED',
        row.deviceCode,
        row.deviceRole ?? row.deviceType ?? 'NA',
      ].join(':')

      if (!deduped.has(key)) deduped.set(key, row)
    }

    return Array.from(deduped.values())
  }, [data?.rows])

  const metrics = useMemo(() => {
    return {
      total: rows.length,
      online: rows.filter((row) => row.derivedHealth === 'ONLINE').length,
      degraded: rows.filter((row) => row.derivedHealth === 'DEGRADED').length,
      offline: rows.filter((row) => row.derivedHealth === 'OFFLINE').length,
    }
  }, [rows])

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{compact ? 'Device health' : 'Device Health'}</CardTitle>
          <CardDescription>
            Derived health được tính từ heartbeat aging, capture status và lane mapping thật.
          </CardDescription>
        </div>
        <StreamBadge connected={state.connected} />
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-[11px] font-mono-data text-muted-foreground">
          <Badge variant="outline">total={metrics.total}</Badge>
          <Badge variant="secondary">online={metrics.online}</Badge>
          <Badge variant={metrics.degraded > 0 ? 'amber' : 'outline'}>degraded={metrics.degraded}</Badge>
          <Badge variant={metrics.offline > 0 ? 'destructive' : 'outline'}>offline={metrics.offline}</Badge>
        </div>

        {state.error ? (
          <div className="rounded-lg border border-destructive/25 bg-destructive/8 px-4 py-3 text-xs text-destructive">
            {state.error}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-muted-foreground/60">
            {state.connected ? <ServerCog className="h-10 w-10" /> : <Loader2 className="h-10 w-10 animate-spin" />}
            <div className="text-center">
              <p className="text-sm font-medium">{state.connected ? 'Chưa có device health snapshot' : 'Đang chờ device health...'}</p>
              <p className="mt-1 text-xs">SSE này phản ánh health thật từ backend.</p>
            </div>
          </div>
        ) : (
          <ScrollArea className={compact ? 'h-[360px]' : 'h-[640px]'}>
            <div className="space-y-3 pr-3">
              {rows.map((row) => (
                <div
                  key={`${row.siteCode}:${row.gateCode ?? 'NA'}:${row.laneCode ?? 'UNASSIGNED'}:${row.deviceCode}:${row.deviceRole ?? row.deviceType ?? 'NA'}`}
                  className="rounded-xl border border-border bg-muted/20 px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono-data text-sm font-semibold">{row.deviceCode}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.siteCode}
                        {row.gateCode ? ` / ${row.gateCode}` : ''}
                        {row.laneCode ? ` / ${row.laneCode}` : ''} · {row.deviceType}
                        {row.deviceRole ? ` · ${row.deviceRole}` : ''}
                      </p>
                    </div>
                    <Badge
                      variant={
                        row.derivedHealth === 'ONLINE'
                          ? 'secondary'
                          : row.derivedHealth === 'OFFLINE'
                            ? 'destructive'
                            : 'outline'
                      }
                    >
                      {row.derivedHealth}
                    </Badge>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">{row.healthReason}</p>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono-data text-muted-foreground">
                    <Badge variant="outline">capture={row.heartbeatStatus || 'NO_HEARTBEAT'}</Badge>
                    <Badge variant="outline">required={row.isRequired ? 'yes' : 'no'}</Badge>
                    <Badge variant="outline">primary={row.isPrimary ? 'yes' : 'no'}</Badge>
                    {typeof row.heartbeatAgeSeconds === 'number' ? <Badge variant="outline">age={row.heartbeatAgeSeconds}s</Badge> : null}
                    {typeof row.latencyMs === 'number' ? <Badge variant="outline">latency={row.latencyMs}ms</Badge> : null}
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
