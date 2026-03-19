import { useMemo } from 'react'
import { Activity, AlertTriangle, Camera, KeyRound, Radio, RefreshCw, ShieldAlert, Thermometer, Wifi, WifiOff } from 'lucide-react'
import { SurfaceState } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { RealtimeStatusBanner } from '@/features/_shared/realtime/RealtimeStatusBanner'
import { useRunLaneLiveState } from '@/features/run-lane/hooks/useRunLaneLiveState'
import { cn } from '@/lib/utils'

function laneHealthVariant(value: string | null | undefined) {
  if (!value) return 'outline' as const
  if (value === 'HEALTHY') return 'secondary' as const
  if (value === 'OFFLINE' || value === 'BARRIER_FAULT') return 'destructive' as const
  return 'amber' as const
}

function operationalVariant(value: string | null | undefined) {
  if (!value) return 'outline' as const
  if (value === 'ACTIVE') return 'entry' as const
  if (value === 'MAINTENANCE') return 'amber' as const
  return 'muted' as const
}

function deviceHealthVariant(value: string | null | undefined) {
  if (!value || value === 'ONLINE') return 'secondary' as const
  if (value === 'OFFLINE') return 'destructive' as const
  return 'amber' as const
}

function roleIcon(role: string | null | undefined) {
  if (!role) return <Activity className="h-3 w-3" />
  switch (String(role).toUpperCase()) {
    case 'CAMERA': return <Camera className="h-3 w-3" />
    case 'RFID': return <Radio className="h-3 w-3" />
    case 'BARRIER': return <KeyRound className="h-3 w-3" />
    case 'LOOP_SENSOR': return <Thermometer className="h-3 w-3" />
    default: return <Activity className="h-3 w-3" />
  }
}

function formatAge(seconds: number | null | undefined) {
  if (seconds == null) return '—'
  if (seconds < 0) return '—'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h`
}

function formatTime(value: string | null) {
  if (!value) return '—'
  const ts = new Date(value)
  if (!Number.isFinite(ts.getTime())) return '—'
  return ts.toLocaleTimeString('en-GB')
}

export function LiveLaneStateCard({ onClose }: { onClose?: () => void }) {
  const {
    siteCode,
    laneCode,
    selectedLaneLive,
    snapshotLoading,
    refreshing,
    snapshotError,
    streamConnected,
    streamError,
    reconnectCount,
    lastEventAt,
    lastSnapshotAt,
    stale,
    status,
    unauthorized,
    staleSince,
    lostContext,
    refreshSnapshot,
  } = useRunLaneLiveState()

  const attentionText = useMemo(() => {
    if (!selectedLaneLive) return 'No lane snapshot.'
    if (selectedLaneLive.aggregateHealth === 'HEALTHY') {
      return 'Lane healthy — có thể tiếp tục workflow.'
    }
    return selectedLaneLive.aggregateReason
  }, [selectedLaneLive])

  const pressurePct = useMemo(() => {
    if (!selectedLaneLive || selectedLaneLive.requiredDeviceCount === 0) return null
    return Math.round((selectedLaneLive.onlineDeviceCount / selectedLaneLive.requiredDeviceCount) * 100)
  }, [selectedLaneLive])

  const roleHealthSummary = useMemo(() => {
    if (!selectedLaneLive?.devices) return []
    const map = new Map<string, { total: number; online: number; degraded: number; offline: number }>()
    for (const dev of selectedLaneLive.devices) {
      const role = dev.deviceRole ?? 'UNKNOWN'
      const entry = map.get(role) ?? { total: 0, online: 0, degraded: 0, offline: 0 }
      entry.total += 1
      if (dev.derivedHealth === 'ONLINE') entry.online += 1
      else if (dev.derivedHealth === 'DEGRADED') entry.degraded += 1
      else entry.offline += 1
      map.set(role, entry)
    }
    return Array.from(map.entries()).map(([role, counts]) => ({ role, ...counts }))
  }, [selectedLaneLive])

  return (
    <Card className="border-border/60 bg-card/95">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={streamConnected ? 'entry' : 'outline'} className="text-[10px] gap-1">
              {streamConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {streamConnected ? 'Stream connected' : 'Stream offline'}
            </Badge>
            {stale && <Badge variant="amber" className="text-[10px]">Stale</Badge>}
            {unauthorized && <Badge variant="destructive" className="text-[10px]">Unauthorized</Badge>}
            {lostContext && <Badge variant="destructive" className="text-[10px]">Lane missing</Badge>}
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refreshSnapshot()}
              disabled={!siteCode || snapshotLoading || refreshing}
              className="h-7 gap-1.5 text-[11px]"
            >
              {snapshotLoading || refreshing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Refresh
            </Button>
            {onClose && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 text-[11px]"
              >
                Đóng
              </Button>
            )}
          </div>
        </div>

        {!siteCode || !laneCode ? (
          <SurfaceState
            title="Chưa chọn lane"
            description="Chọn site và lane để xem trạng thái realtime."
            tone="empty"
            className="min-h-[120px]"
          />
        ) : snapshotLoading && !selectedLaneLive && !snapshotError ? (
          <SurfaceState title="Đang tải..." description="Fetching HTTP snapshot..." tone="loading" className="min-h-[120px]" />
        ) : snapshotError && !selectedLaneLive ? (
          <SurfaceState
            title="Lỗi tải snapshot"
            description={snapshotError}
            icon={ShieldAlert}
            tone="error"
            className="min-h-[120px]"
            action={{ label: 'Retry', onClick: () => void refreshSnapshot() }}
          />
        ) : lostContext ? (
          <SurfaceState
            title="Lane không có trong snapshot"
            description="Kiểm tra site scope hoặc backend lane-status projection."
            icon={AlertTriangle}
            tone="warning"
            className="min-h-[120px]"
            action={{ label: 'Resync', onClick: () => void refreshSnapshot() }}
          />
        ) : selectedLaneLive ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Lane Health</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={laneHealthVariant(selectedLaneLive.aggregateHealth)} className="text-[10px]">
                    {selectedLaneLive.aggregateHealth}
                  </Badge>
                  <Badge variant={operationalVariant(selectedLaneLive.laneOperationalStatus)} className="text-[10px]">
                    {selectedLaneLive.laneOperationalStatus}
                  </Badge>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Barrier / Session</p>
                <p className="text-xs font-medium">{selectedLaneLive.lastBarrierStatus || '—'} · {selectedLaneLive.lastSessionStatus || '—'}</p>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Device Pressure</p>
                {pressurePct !== null ? (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-medium">{selectedLaneLive.onlineDeviceCount}/{selectedLaneLive.requiredDeviceCount}</span>
                      <span className="text-[10px] text-muted-foreground">{pressurePct}%</span>
                    </div>
                    <Progress
                      value={pressurePct}
                      className="h-1.5"
                      barClassName={
                        pressurePct === 100 ? 'bg-green-500' : pressurePct >= 60 ? 'bg-amber-500' : 'bg-red-500'
                      }
                    />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No required devices</p>
                )}
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Presence</p>
                <p className="text-xs font-medium">{selectedLaneLive.activePresenceCount} active · {selectedLaneLive.direction}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{selectedLaneLive.gateCode}/{selectedLaneLive.laneCode}</p>
              </div>
            </div>

            {roleHealthSummary.length > 0 && (
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Per-role health</p>
                <div className="flex flex-wrap gap-2">
                  {roleHealthSummary.map(({ role, total, online, degraded, offline }) => (
                    <div key={role} className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5">
                      {roleIcon(role)}
                      <span className="text-[11px] font-medium">{role}</span>
                      <div className="flex items-center gap-1">
                        {online > 0 && <Badge variant="secondary" className="text-[10px]">{online}</Badge>}
                        {degraded > 0 && <Badge variant="amber" className="text-[10px]">{degraded}</Badge>}
                        {offline > 0 && <Badge variant="destructive" className="text-[10px]">{offline}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Attention</p>
              <p className="text-xs text-muted-foreground">{attentionText}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedLaneLive.devices.map((device) => (
                <div
                  key={device.deviceCode}
                  className="flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/20 px-2.5 py-1"
                >
                  {roleIcon(device.deviceRole)}
                  <span className="text-[10px] font-medium font-mono-data">
                    {device.deviceRole}:{device.deviceCode}
                  </span>
                  <Badge variant={deviceHealthVariant(device.derivedHealth)} className="text-[9px]">
                    {device.derivedHealth}
                  </Badge>
                  <span className="text-[9px] text-muted-foreground">{formatAge(device.heartbeatAgeSeconds)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <SurfaceState
            title="Không có live row"
            description="Snapshot loaded nhưng không tìm thấy lane. Thử refresh."
            tone="warning"
            className="min-h-[120px]"
            action={{ label: 'Resync', onClick: () => void refreshSnapshot() }}
          />
        )}
      </CardContent>
    </Card>
  )
}
