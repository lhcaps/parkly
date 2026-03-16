import { useMemo } from 'react'
import { Activity, AlertTriangle, Loader2, RefreshCw, ShieldAlert, Wifi, WifiOff } from 'lucide-react'
import { SurfaceState } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RealtimeStatusBanner } from '@/features/_shared/realtime/RealtimeStatusBanner'
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

function formatTime(value: string | null) {
  if (!value) return '—'
  const ts = new Date(value)
  if (!Number.isFinite(ts.getTime())) return '—'
  return ts.toLocaleTimeString('en-GB')
}

export function LiveLaneStateCard() {
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
    if (!selectedLaneLive) return 'No lane snapshot to compare against.'
    if (selectedLaneLive.aggregateHealth === 'HEALTHY') {
      return 'Lane is healthy. You can proceed with preview, resolve, and confirm-pass on this workflow.'
    }
    return selectedLaneLive.aggregateReason
  }, [selectedLaneLive])

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Lane realtime</Badge>
            <Badge variant={streamConnected ? 'entry' : 'outline'}>
              {streamConnected ? <Wifi className="mr-1 h-3.5 w-3.5" /> : <WifiOff className="mr-1 h-3.5 w-3.5" />}
              {streamConnected ? 'Connected' : status}
            </Badge>
            <Badge variant={stale ? 'amber' : 'outline'}>{stale ? 'Stale snapshot' : 'Fresh snapshot'}</Badge>
            {unauthorized ? <Badge variant="destructive">Unauthorized</Badge> : null}
            {lostContext ? <Badge variant="destructive">Lane missing from snapshot</Badge> : null}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshSnapshot()}
            disabled={!siteCode || snapshotLoading || refreshing}
          >
            {snapshotLoading || refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh snapshot
          </Button>
        </div>

        <div>
          <CardTitle className="text-base sm:text-lg">Lane Realtime Console</CardTitle>
          <CardDescription>
            Live health snapshot for the active lane — health state, barrier status, device pressure, and stream telemetry.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <RealtimeStatusBanner
          title="Run Lane realtime"
          state={{
            status,
            stale,
            unauthorized,
            error: streamError || snapshotError,
            reconnectCount,
            receivedAt: lastEventAt,
            lastSnapshotAt,
            staleSince,
          }}
          onResync={() => void refreshSnapshot()}
          disabled={snapshotLoading || refreshing}
        />

        {!siteCode || !laneCode ? (
          <SurfaceState
            title="No lane context selected"
            description="Select a site and lane above to lock the realtime console onto the active lane."
            tone="empty"
            className="min-h-[180px]"
          />
        ) : snapshotLoading && !selectedLaneLive && !snapshotError ? (
          <SurfaceState
            title="Loading lane snapshot"
            description="Fetching the HTTP snapshot as the source of truth before trusting SSE data."
            tone="loading"
            className="min-h-[180px]"
          />
        ) : snapshotError && !selectedLaneLive ? (
          <SurfaceState
            title="Could not load lane snapshot"
            description={snapshotError}
            icon={ShieldAlert}
            tone="error"
            className="min-h-[180px]"
            action={{
              label: 'Retry',
              onClick: () => void refreshSnapshot(),
            }}
          />
        ) : lostContext ? (
          <SurfaceState
            title="Selected lane not in snapshot"
            description="The topology includes this lane but the runtime snapshot has not seen it. Check site scope, stream filter, or backend lane-status projection."
            icon={AlertTriangle}
            tone="warning"
            className="min-h-[180px]"
            action={{
              label: 'Manual resync',
              onClick: () => void refreshSnapshot(),
            }}
          />
        ) : selectedLaneLive ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Lane health</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={laneHealthVariant(selectedLaneLive.aggregateHealth)}>{selectedLaneLive.aggregateHealth}</Badge>
                  <Badge variant={operationalVariant(selectedLaneLive.laneOperationalStatus)}>{selectedLaneLive.laneOperationalStatus}</Badge>
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Barrier / session</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {selectedLaneLive.lastBarrierStatus || '—'} / {selectedLaneLive.lastSessionStatus || '—'}
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Device pressure</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {selectedLaneLive.onlineDeviceCount} online &middot; {selectedLaneLive.degradedDeviceCount} degraded &middot; {selectedLaneLive.offlineDeviceCount} offline
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Presence / required</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {selectedLaneLive.activePresenceCount} / {selectedLaneLive.requiredDeviceCount}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-foreground">
                <Activity className="h-4 w-4 text-primary" />
                <span className="font-medium">Runtime attention</span>
              </div>
              <p className="text-sm text-muted-foreground">{attentionText}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/80 bg-muted/25 p-4 text-sm text-muted-foreground">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Stream telemetry</p>
                <p className="mt-2 text-foreground">
                  Last event {formatTime(lastEventAt)} &middot; {reconnectCount} reconnect{reconnectCount !== 1 ? 's' : ''}
                </p>
                {streamError ? <p className="mt-2 text-destructive">{streamError}</p> : null}
              </div>

              <div className="rounded-2xl border border-border/80 bg-muted/25 p-4 text-sm text-muted-foreground">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Snapshot reconcile</p>
                <p className="mt-2 text-foreground">Last snapshot {formatTime(lastSnapshotAt)}</p>
                {staleSince ? <p className="mt-2 text-primary">Stale since {formatTime(staleSince)}</p> : null}
                {snapshotError ? <p className="mt-2 text-destructive">{snapshotError}</p> : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedLaneLive.devices.map((device) => (
                <Badge
                  key={device.deviceCode}
                  variant={
                    device.derivedHealth === 'ONLINE'
                      ? 'secondary'
                      : device.derivedHealth === 'OFFLINE'
                        ? 'destructive'
                        : 'amber'
                  }
                >
                  {device.deviceRole || device.deviceType}:{device.deviceCode} &middot; {device.derivedHealth}
                </Badge>
              ))}
            </div>
          </>
        ) : (
          <SurfaceState
            title="No live row for this lane"
            description="Snapshot loaded but no match for the selected lane. Try refreshing or check topology scope."
            tone="warning"
            className="min-h-[180px]"
            action={{
              label: 'Manual resync',
              onClick: () => void refreshSnapshot(),
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}
