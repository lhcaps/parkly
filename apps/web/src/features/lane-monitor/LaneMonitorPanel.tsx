import { useMemo } from 'react'
import { Activity, Layers, Loader2, RefreshCw } from 'lucide-react'
import { ConnectionBadge, SurfaceState } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RealtimeStatusBanner } from '@/features/_shared/realtime/RealtimeStatusBanner'
import { useSseSnapshot } from '@/features/_shared/use-sse-snapshot'
import { makeSseUrl, type LaneStatusSnapshot } from '@/lib/api'
import { getLaneStatusSnapshot } from '@/lib/api/ops'

function LaneHealthBadge({ value }: { value: string }) {
  const variant =
    value === 'HEALTHY'
      ? 'secondary'
      : value === 'BARRIER_FAULT' || value === 'OFFLINE'
        ? 'destructive'
        : 'outline'

  return <Badge variant={variant}>{value}</Badge>
}


async function loadAuthoritativeLaneSnapshot() {
  const snapshot = await getLaneStatusSnapshot({ limit: 200 })
  return {
    ts: Date.now(),
    siteCode: null,
    barrierLifecycle: {
      promotedToSent: 0,
      timedOut: 0,
    },
    rows: snapshot.rows,
  } satisfies LaneStatusSnapshot
}

export function LaneMonitorPanel({ compact = false }: { compact?: boolean }) {
  const { data, state, resync } = useSseSnapshot<LaneStatusSnapshot>({
    url: makeSseUrl('/api/stream/lane-status'),
    eventName: 'lane_status_snapshot',
    loadSnapshot: loadAuthoritativeLaneSnapshot,
  })

  const rows = data?.rows ?? []

  const metrics = useMemo(() => {
    const unhealthy = rows.filter((lane) => lane.aggregateHealth !== 'HEALTHY').length
    const offlineDevices = rows.reduce((sum, lane) => sum + lane.offlineDeviceCount, 0)
    const degradedDevices = rows.reduce((sum, lane) => sum + lane.degradedDeviceCount, 0)

    return {
      lanes: rows.length,
      unhealthy,
      offlineDevices,
      degradedDevices,
    }
  }, [rows])

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{compact ? 'Lane monitor' : 'Lane Monitor'}</CardTitle>
          <CardDescription>Monitor lane health, barrier status, and the devices directly affecting vehicle flow.</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ConnectionBadge connected={state.connected} status={state.status} label="Lane stream" />
          <div className="flex gap-2">
            <Badge variant={state.stale ? 'amber' : 'outline'}>{state.stale ? 'stale' : 'live'}</Badge>
            <Button type="button" size="sm" variant="outline" onClick={() => void resync()} disabled={state.refreshing}>
              {state.refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Resync
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <RealtimeStatusBanner title="Lane stream" state={state} onResync={() => void resync()} disabled={state.refreshing} />

        <div className="flex flex-wrap gap-2 text-[11px] font-mono-data text-muted-foreground">
          <Badge variant="outline">lanes={metrics.lanes}</Badge>
          <Badge variant={metrics.unhealthy > 0 ? 'destructive' : 'outline'}>unhealthy={metrics.unhealthy}</Badge>
          <Badge variant={metrics.offlineDevices > 0 ? 'destructive' : 'outline'}>offlineDevices={metrics.offlineDevices}</Badge>
          <Badge variant={metrics.degradedDevices > 0 ? 'amber' : 'outline'}>degradedDevices={metrics.degradedDevices}</Badge>
        </div>

        {state.error && rows.length === 0 ? (
          <SurfaceState title="Lane snapshot unavailable" description={state.error} tone="error" className="min-h-[140px]" action={{ label: 'Resync', onClick: () => void resync() }} />
        ) : rows.length === 0 ? (
          <SurfaceState
            title={state.connected ? 'No lane snapshot' : 'Waiting for lane stream'}
            description="The backend pushes the full lane snapshot via SSE when available. Operators can manually resync to reopen the stream and force the REST snapshot to hydrate again."
            icon={Layers}
            tone={state.connected ? 'empty' : 'loading'}
            className="min-h-[220px]"
            action={{ label: 'Manual resync', onClick: () => void resync() }}
            busy={state.refreshing}
          />
        ) : (
          <ScrollArea className={compact ? 'h-[360px]' : 'h-[640px]'}>
            <div className="space-y-3 pr-3">
              {rows.map((lane) => (
                <div key={`${lane.siteCode}:${lane.laneCode}`} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono-data text-sm font-semibold">
                      {lane.siteCode} / {lane.gateCode} / {lane.laneCode}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {lane.laneLabel} | {lane.direction} | session={lane.lastSessionStatus || '-'} | barrier={lane.lastBarrierStatus || '-'}
                    </p>
                    {lane.zoneCode ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        zone={lane.zoneCode}{lane.zoneName ? ` (${lane.zoneName})` : ''}{lane.floorKey ? ` | ${lane.floorKey}` : ''}{lane.spotCount != null ? ` | ${lane.spotCount} spots` : ''}
                      </p>
                    ) : null}
                  </div>
                    <LaneHealthBadge value={lane.aggregateHealth} />
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">{lane.aggregateReason}</p>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono-data text-muted-foreground">
                    <Badge variant="outline">presence={lane.activePresenceCount}</Badge>
                    <Badge variant="outline">required={lane.requiredDeviceCount}</Badge>
                    <Badge variant="outline">online={lane.onlineDeviceCount}</Badge>
                    <Badge variant="outline">degraded={lane.degradedDeviceCount}</Badge>
                    <Badge variant="outline">offline={lane.offlineDeviceCount}</Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {lane.devices.map((device) => (
                      <Badge
                        key={device.deviceCode}
                        variant={
                          device.derivedHealth === 'ONLINE'
                            ? 'secondary'
                            : device.derivedHealth === 'OFFLINE'
                              ? 'destructive'
                              : 'outline'
                        }
                      >
                        {device.deviceRole || device.deviceType}:{device.deviceCode} | {device.derivedHealth}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-3 rounded-2xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-foreground">Suggested action</span>
                    </div>
                    <p className="mt-1">If a lane has warnings, check the device badges first before moving to Run Lane or Review Queue.</p>
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
