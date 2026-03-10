import { useMemo } from 'react'
import { Activity, Layers, Loader2, Wifi, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { makeSseUrl, type LaneStatusSnapshot } from '@/lib/api'
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
      LANE SSE {connected ? 'CONNECTED' : 'DISCONNECTED'}
    </div>
  )
}

function LaneHealthBadge({ value }: { value: string }) {
  const variant =
    value === 'HEALTHY'
      ? 'secondary'
      : value === 'BARRIER_FAULT' || value === 'OFFLINE'
        ? 'destructive'
        : 'outline'

  return <Badge variant={variant}>{value}</Badge>
}

export function LaneMonitorPanel({ compact = false }: { compact?: boolean }) {
  const { data, state } = useSseSnapshot<LaneStatusSnapshot>({
    url: makeSseUrl('/api/stream/lane-status'),
    eventName: 'lane_status_snapshot',
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
          <CardDescription>
            Lane cards lấy trực tiếp từ SSE lane-status, gồm aggregate health, session gần nhất, barrier gần nhất và sức khoẻ thiết bị theo lane.
          </CardDescription>
        </div>
        <StreamBadge connected={state.connected} />
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-[11px] font-mono-data text-muted-foreground">
          <Badge variant="outline">lanes={metrics.lanes}</Badge>
          <Badge variant={metrics.unhealthy > 0 ? 'destructive' : 'outline'}>unhealthy={metrics.unhealthy}</Badge>
          <Badge variant={metrics.offlineDevices > 0 ? 'destructive' : 'outline'}>offlineDevices={metrics.offlineDevices}</Badge>
          <Badge variant={metrics.degradedDevices > 0 ? 'amber' : 'outline'}>degradedDevices={metrics.degradedDevices}</Badge>
        </div>

        {state.error ? (
          <div className="rounded-lg border border-destructive/25 bg-destructive/8 px-4 py-3 text-xs text-destructive">
            {state.error}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-muted-foreground/60">
            {state.connected ? <Layers className="h-10 w-10" /> : <Loader2 className="h-10 w-10 animate-spin" />}
            <div className="text-center">
              <p className="text-sm font-medium">{state.connected ? 'Chưa có lane snapshot' : 'Đang chờ lane status...'}</p>
              <p className="mt-1 text-xs">Backend sẽ đẩy full snapshot theo nhịp SSE.</p>
            </div>
          </div>
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
                        {lane.laneLabel} · {lane.direction} · session={lane.lastSessionStatus || '—'} · barrier={lane.lastBarrierStatus || '—'}
                      </p>
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
                        {device.deviceRole || device.deviceType}:{device.deviceCode} · {device.derivedHealth}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-3 rounded-2xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-foreground">Triage note</span>
                    </div>
                    <p className="mt-1">
                      Nếu lane này unhealthy, ưu tiên nhìn device badges và last session status trước khi nhảy sang Run Lane hoặc Review Queue.
                    </p>
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
