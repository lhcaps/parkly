import { useMemo } from 'react'
import { Activity, Layers } from 'lucide-react'
import { ConnectionBadge, SurfaceState } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { makeSseUrl, type LaneStatusSnapshot } from '@/lib/api'
import { useSseSnapshot } from '@/features/_shared/use-sse-snapshot'

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
          <CardDescription>Theo dõi sức khỏe lane, trạng thái barrier và thiết bị đang ảnh hưởng trực tiếp tới vận hành.</CardDescription>
        </div>
        <ConnectionBadge connected={state.connected} label="Lane stream" />
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-[11px] font-mono-data text-muted-foreground">
          <Badge variant="outline">lanes={metrics.lanes}</Badge>
          <Badge variant={metrics.unhealthy > 0 ? 'destructive' : 'outline'}>unhealthy={metrics.unhealthy}</Badge>
          <Badge variant={metrics.offlineDevices > 0 ? 'destructive' : 'outline'}>offlineDevices={metrics.offlineDevices}</Badge>
          <Badge variant={metrics.degradedDevices > 0 ? 'amber' : 'outline'}>degradedDevices={metrics.degradedDevices}</Badge>
        </div>

        {state.error ? (
          <SurfaceState title="Không thể nhận lane snapshot" description={state.error} tone="error" className="min-h-[140px]" />
        ) : rows.length === 0 ? (
          <SurfaceState
            title={state.connected ? 'Chưa có lane snapshot' : 'Đang chờ kết nối lane stream'}
            description="Backend sẽ đẩy toàn bộ snapshot lane qua SSE khi có dữ liệu."
            icon={Layers}
            tone={state.connected ? 'empty' : 'loading'}
            className="min-h-[220px]"
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
                      <span className="font-medium text-foreground">Gợi ý xử lý</span>
                    </div>
                    <p className="mt-1">Nếu lane có cảnh báo, kiểm tra badge thiết bị trước rồi mới chuyển sang Run Lane hoặc Review Queue.</p>
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
