import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, AlertTriangle, Camera, KeyRound, Radio, RefreshCw, ShieldAlert, Thermometer, Wifi, WifiOff } from 'lucide-react'
import { SurfaceState } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatTimeValue } from '@/i18n/format'
import { useRunLaneLiveState } from '@/features/run-lane/hooks/useRunLaneLiveState'

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
    case 'CAMERA':
      return <Camera className="h-3 w-3" />
    case 'RFID':
      return <Radio className="h-3 w-3" />
    case 'BARRIER':
      return <KeyRound className="h-3 w-3" />
    case 'LOOP_SENSOR':
      return <Thermometer className="h-3 w-3" />
    default:
      return <Activity className="h-3 w-3" />
  }
}

function formatAge(seconds: number | null | undefined) {
  if (seconds == null || seconds < 0) return '—'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h`
}

export function LiveLaneStateCard({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation()
  const {
    siteCode,
    laneCode,
    selectedLaneLive,
    snapshotLoading,
    refreshing,
    snapshotError,
    streamConnected,
    reconnectCount,
    lastEventAt,
    lastSnapshotAt,
    stale,
    unauthorized,
    lostContext,
    refreshSnapshot,
  } = useRunLaneLiveState()

  const attentionText = useMemo(() => {
    if (!selectedLaneLive) return t('runLaneLive.noSnapshotTitle')
    if (selectedLaneLive.aggregateHealth === 'HEALTHY') return t('runLaneLive.healthyAttention')
    return selectedLaneLive.aggregateReason
  }, [selectedLaneLive, t])

  const pressurePct = useMemo(() => {
    if (!selectedLaneLive || selectedLaneLive.requiredDeviceCount === 0) return null
    return Math.round((selectedLaneLive.onlineDeviceCount / selectedLaneLive.requiredDeviceCount) * 100)
  }, [selectedLaneLive])

  const roleHealthSummary = useMemo(() => {
    if (!selectedLaneLive?.devices) return []
    const map = new Map<string, { total: number; online: number; degraded: number; offline: number }>()
    for (const device of selectedLaneLive.devices) {
      const role = device.deviceRole ?? 'UNKNOWN'
      const entry = map.get(role) ?? { total: 0, online: 0, degraded: 0, offline: 0 }
      entry.total += 1
      if (device.derivedHealth === 'ONLINE') entry.online += 1
      else if (device.derivedHealth === 'DEGRADED') entry.degraded += 1
      else entry.offline += 1
      map.set(role, entry)
    }
    return Array.from(map.entries()).map(([role, counts]) => ({ role, ...counts }))
  }, [selectedLaneLive])

  return (
    <Card className="border-border/60 bg-card/96">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={streamConnected ? 'entry' : 'outline'} className="gap-1 text-[10px]">
              {streamConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {streamConnected ? t('runLaneLive.streamConnected') : t('runLaneLive.streamOffline')}
            </Badge>
            {stale ? <Badge variant="amber" className="text-[10px]">{t('runLaneLive.stale')}</Badge> : null}
            {unauthorized ? <Badge variant="destructive" className="text-[10px]">{t('runLaneLive.unauthorized')}</Badge> : null}
            {lostContext ? <Badge variant="destructive" className="text-[10px]">{t('runLaneLive.laneMissing')}</Badge> : null}
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
              <RefreshCw className={`h-3 w-3${snapshotLoading || refreshing ? ' animate-spin' : ''}`} />
              {t('common.refresh')}
            </Button>
            {onClose ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-7 text-[11px]">
                {t('runLaneLive.close')}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{t('runLaneLive.lastSnapshot', { value: formatTimeValue(lastSnapshotAt) })}</Badge>
          <Badge variant="outline">{t('runLaneLive.lastEvent', { value: formatTimeValue(lastEventAt) })}</Badge>
          <Badge variant="outline">{t('runLaneLive.reconnects', { count: reconnectCount })}</Badge>
        </div>

        {!siteCode || !laneCode ? (
          <SurfaceState
            title={t('runLaneLive.noLaneTitle')}
            description={t('runLaneLive.noLaneDescription')}
            tone="empty"
            className="min-h-[120px]"
          />
        ) : snapshotLoading && !selectedLaneLive && !snapshotError ? (
          <SurfaceState title={t('runLaneLive.loadingTitle')} description={t('runLaneLive.loadingDescription')} tone="loading" className="min-h-[120px]" />
        ) : snapshotError && !selectedLaneLive ? (
          <SurfaceState
            title={t('runLaneLive.snapshotErrorTitle')}
            description={snapshotError}
            icon={ShieldAlert}
            tone="error"
            className="min-h-[120px]"
            action={{ label: t('runLaneLive.retry'), onClick: () => void refreshSnapshot() }}
          />
        ) : lostContext ? (
          <SurfaceState
            title={t('runLaneLive.lostContextTitle')}
            description={t('runLaneLive.lostContextDescription')}
            icon={AlertTriangle}
            tone="warning"
            className="min-h-[120px]"
            action={{ label: t('runLaneLive.resync'), onClick: () => void refreshSnapshot() }}
          />
        ) : selectedLaneLive ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{t('runLaneLive.laneHealth')}</p>
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
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{t('runLaneLive.barrierSession')}</p>
                <p className="text-xs font-medium">
                  {selectedLaneLive.lastBarrierStatus || '—'} / {selectedLaneLive.lastSessionStatus || '—'}
                </p>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{t('runLaneLive.devicePressure')}</p>
                {pressurePct !== null ? (
                  <>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{selectedLaneLive.onlineDeviceCount}/{selectedLaneLive.requiredDeviceCount}</span>
                      <span className="text-[10px] text-muted-foreground">{pressurePct}%</span>
                    </div>
                    <Progress
                      value={pressurePct}
                      className="h-1.5"
                      barClassName={pressurePct === 100 ? 'bg-green-500' : pressurePct >= 60 ? 'bg-amber-500' : 'bg-red-500'}
                    />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('runLaneLive.noRequiredDevices')}</p>
                )}
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{t('runLaneLive.presence')}</p>
                <p className="text-xs font-medium">
                  {t('runLaneLive.presenceValue', { count: selectedLaneLive.activePresenceCount, direction: selectedLaneLive.direction })}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{selectedLaneLive.gateCode}/{selectedLaneLive.laneCode}</p>
              </div>
            </div>

            {roleHealthSummary.length > 0 ? (
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">{t('runLaneLive.perRoleHealth')}</p>
                <div className="flex flex-wrap gap-2">
                  {roleHealthSummary.map(({ role, online, degraded, offline }) => (
                    <div key={role} className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5">
                      {roleIcon(role)}
                      <span className="text-[11px] font-medium">{role}</span>
                      <div className="flex items-center gap-1">
                        {online > 0 ? <Badge variant="secondary" className="text-[10px]">{online}</Badge> : null}
                        {degraded > 0 ? <Badge variant="amber" className="text-[10px]">{degraded}</Badge> : null}
                        {offline > 0 ? <Badge variant="destructive" className="text-[10px]">{offline}</Badge> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{t('runLaneLive.attention')}</p>
              <p className="text-xs text-muted-foreground">{attentionText}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedLaneLive.devices.map((device) => (
                <div key={device.deviceCode} className="flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/20 px-2.5 py-1">
                  {roleIcon(device.deviceRole)}
                  <span className="font-mono-data text-[10px] font-medium">
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
            title={t('runLaneLive.noLiveRowTitle')}
            description={t('runLaneLive.noLiveRowDescription')}
            tone="warning"
            className="min-h-[120px]"
            action={{ label: t('runLaneLive.resync'), onClick: () => void refreshSnapshot() }}
          />
        )}
      </CardContent>
    </Card>
  )
}
