import {
  Activity,
  ArrowRightLeft,
  Camera,
  ClipboardCheck,
  Cpu,
  DatabaseZap,
  RadioTower,
  RefreshCcw,
  ShieldAlert,
  TimerReset,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select } from '@/components/ui/select'
import { ConnectionBadge, PageHeader, SurfaceState } from '@/components/ops/console'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { KpiCard } from '@/features/overview/components/KpiCard'
import { OperationalStatusCard, type OperationalStatus } from '@/features/overview/components/OperationalStatusCard'
import { QuickActionsCard, type QuickActionItem } from '@/features/overview/components/QuickActionsCard'
import { SiteAttentionTable } from '@/features/overview/components/SiteAttentionTable'
import { useOverviewData } from '@/features/overview/hooks/useOverviewData'
import type { SessionSummary } from '@/lib/contracts/sessions'

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    to: '/run-lane',
    label: 'Run Lane',
    helper: 'Process an incoming vehicle through the full lane flow — image to decision.',
    badge: 'Lane',
    icon: ArrowRightLeft,
  },
  {
    to: '/review-queue',
    label: 'Review Queue',
    helper: 'Claim and resolve cases waiting for manual operator confirmation.',
    badge: 'Review',
    icon: ClipboardCheck,
  },
  {
    to: '/lane-monitor',
    label: 'Lane Monitor',
    helper: 'Open live triage when you need to inspect lane and barrier state in real time.',
    badge: 'Live',
    icon: Activity,
  },
  {
    to: '/device-health',
    label: 'Device Health',
    helper: 'Check heartbeat status and degradation level for each device.',
    badge: 'Health',
    icon: Cpu,
  },
  {
    to: '/sync-outbox',
    label: 'Sync Outbox',
    helper: 'Monitor retries, failed deliveries, and the downstream sync backlog.',
    badge: 'Queue',
    icon: RadioTower,
  },
  {
    to: '/capture-debug',
    label: 'Capture Debug',
    helper: 'Inspect image ingest and ALPR results when the capture pipeline has issues.',
    badge: 'Capture',
    icon: Camera,
  },
]

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-GB')
}

function sessionVariant(status: string | null | undefined) {
  if (!status) return 'outline' as const
  if (status === 'APPROVED' || status === 'PASSED') return 'entry' as const
  if (status === 'WAITING_DECISION' || status === 'WAITING_PAYMENT' || status === 'OPEN' || status === 'WAITING_READ') return 'amber' as const
  if (status === 'DENIED' || status === 'ERROR' || status === 'CANCELLED' || status === 'TIMEOUT') return 'destructive' as const
  return 'secondary' as const
}

function laneVariant(value: string): BadgeProps['variant'] {
  if (value === 'OFFLINE' || value === 'BARRIER_FAULT') return 'destructive'
  if (value === 'DEGRADED' || value.startsWith('DEGRADED')) return 'amber'
  return 'secondary'
}

function pageStateVariant(value: OperationalStatus): BadgeProps['variant'] {
  if (value === 'ready') return 'secondary'
  if (value === 'attention') return 'amber'
  if (value === 'degraded') return 'outline'
  return 'destructive'
}

function pageStateLabel(value: OperationalStatus) {
  if (value === 'ready') return 'Ready'
  if (value === 'attention') return 'Attention'
  if (value === 'degraded') return 'Degraded'
  return 'Unavailable'
}

function dependencyStatus(error: string, loading: boolean): OperationalStatus {
  if (error) return 'unavailable'
  if (loading) return 'degraded'
  return 'ready'
}

function SessionRow({ session }: { session: SessionSummary }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono-data text-sm font-semibold">{session.sessionId || '—'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {session.siteCode || '—'} / {session.gateCode || '—'} / {session.laneCode || '—'} &middot; {session.direction}
          </p>
        </div>
        <Badge variant={sessionVariant(session.status)}>{session.status}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span className="font-mono-data">{formatDateTime(session.openedAt)}</span>
        {session.plateCompact ? <Badge variant="outline">{session.plateCompact}</Badge> : null}
        <Badge variant="outline">{session.readCount} reads</Badge>
        <Badge variant="outline">{session.decisionCount} decisions</Badge>
        {session.reviewRequired ? <Badge variant="amber">Review required</Badge> : null}
      </div>
    </div>
  )
}

export function OverviewPage() {
  const {
    selectedSiteCode,
    setSelectedSiteCode,
    siteOptions,
    dashboard,
    recentSessions,
    queueSummary,
    outboxSummary,
    reviewStatusSummary,
    outboxStatusSummary,
    effectiveSiteRows,
    deviceAlertSummary,
    deviceHealthState,
    liveLaneSummary,
    laneState,
    staleMinutes,
    pageState,
    refreshedAt,
    refreshing,
    refreshAll,
  } = useOverviewData()

  const dashboardData = dashboard.data
  const filtersDescription = dashboardData
    ? `${dashboardData.filters.sinceHours}h window · expiry ${dashboardData.filters.expiringInDays}d · generated ${formatDateTime(dashboardData.generatedAt)}`
    : 'Dashboard summary not available.'

  const overview = dashboardData?.overview

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Shift coordination landing page. Queue pressure, lane health, and system dependency status in one view."
        badges={[
          { label: 'Operations', variant: 'secondary' },
          { label: selectedSiteCode ? `Site ${selectedSiteCode}` : 'All accessible sites', variant: 'outline' },
          { label: pageStateLabel(pageState), variant: pageStateVariant(pageState) },
        ]}
        actions={
          <div className="flex max-w-[520px] flex-wrap items-center justify-end gap-2">
            <ConnectionBadge connected={laneState.connected} label="Lane stream" />
            <ConnectionBadge connected={deviceHealthState.connected} label="Device stream" />
            <div className="min-w-[220px] flex-1">
              <Select value={selectedSiteCode} onChange={setSelectedSiteCode} options={siteOptions} size="sm" />
            </div>
            <Button variant="outline" size="sm" onClick={() => void refreshAll()} disabled={refreshing}>
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-data text-muted-foreground">
        <Badge variant="outline">{filtersDescription}</Badge>
        <Badge variant={staleMinutes != null && staleMinutes > 5 ? 'amber' : 'outline'}>
          {staleMinutes == null ? 'Freshness unknown' : staleMinutes > 0 ? `${staleMinutes}m stale` : 'Fresh'}
        </Badge>
        <Badge variant="outline">Refreshed {refreshedAt ? formatDateTime(refreshedAt) : '—'}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          title="Open incidents"
          value={dashboard.loading ? '…' : String(overview?.incidentsOpenCount ?? 0)}
          helper={dashboard.error ? dashboard.error : 'Incidents open within the current overview scope.'}
          icon={ShieldAlert}
          tone={(overview?.criticalIncidentsOpenCount ?? 0) > 0 ? 'danger' : (overview?.incidentsOpenCount ?? 0) > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          title="Lane attention"
          value={dashboard.loading ? '…' : String(overview?.laneAttentionCount ?? 0)}
          helper={dashboard.error ? 'Lane summary unavailable.' : `${overview?.offlineLaneCount ?? 0} offline — highest priority.`}
          icon={Activity}
          tone={(overview?.laneAttentionCount ?? 0) > 0 ? 'warning' : 'success'}
        />
        <Link to="/parking-live" className="block">
          <KpiCard
            title="Occupancy rate"
            value={dashboard.loading ? '…' : `${(overview?.occupancyRate ?? 0).toFixed(2)}%`}
            helper={dashboard.error ? 'Occupancy snapshot unavailable.' : `${dashboardData?.occupancy.occupiedTotal ?? 0} of ${dashboardData?.occupancy.totalSpots ?? 0} spots. Click for live view.`}
            icon={DatabaseZap}
            tone="default"
          />
        </Link>
        <Link to="/subscriptions?status=ACTIVE" className="block">
          <KpiCard
            title="Active subscriptions"
            value={dashboard.loading ? '…' : String(overview?.activeSubscriptionCount ?? 0)}
            helper={dashboard.error ? 'Subscription summary unavailable.' : `${overview?.expiringSubscriptionCount ?? 0} expiring soon. Click to manage.`}
            icon={TimerReset}
            tone={(overview?.expiringSubscriptionCount ?? 0) > 0 ? 'warning' : 'default'}
          />
        </Link>
        <KpiCard
          title="Active presence"
          value={dashboard.loading ? '…' : String(overview?.activePresenceCount ?? 0)}
          helper={dashboard.error ? 'Presence summary unavailable.' : 'Presence active across lanes in current scope.'}
          icon={ArrowRightLeft}
          tone={(overview?.activePresenceCount ?? 0) > 0 ? 'default' : 'success'}
        />
        <KpiCard
          title="Open sessions"
          value={dashboard.loading ? '…' : String(overview?.openSessionCount ?? 0)}
          helper={dashboard.error ? 'Session summary unavailable.' : 'Sessions open with an unclosed lifecycle.'}
          icon={ClipboardCheck}
          tone={(overview?.openSessionCount ?? 0) > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OperationalStatusCard
          title="Lane pressure"
          value={laneState.connected ? `${liveLaneSummary.attention}/${liveLaneSummary.total}` : `${dashboardData?.lanes.attentionCount ?? 0}/${dashboardData?.lanes.totalLanes ?? 0}`}
          helper={laneState.connected ? 'Sourced from live lane stream. Falls back to dashboard snapshot when stream is down.' : 'Lane stream not connected — showing dashboard snapshot.'}
          icon={Activity}
          status={liveLaneSummary.offline > 0 ? 'unavailable' : liveLaneSummary.attention > 0 || (dashboardData?.lanes.attentionCount ?? 0) > 0 ? 'attention' : laneState.error ? 'degraded' : 'ready'}
          chips={[
            { label: `${liveLaneSummary.offline || dashboardData?.lanes.offlineCount || 0} offline`, variant: (liveLaneSummary.offline || dashboardData?.lanes.offlineCount || 0) > 0 ? 'destructive' : 'outline' },
            { label: `${liveLaneSummary.barrierFault || dashboardData?.lanes.barrierFaultCount || 0} barrier fault`, variant: (liveLaneSummary.barrierFault || dashboardData?.lanes.barrierFaultCount || 0) > 0 ? 'amber' : 'outline' },
            { label: `${dashboardData?.lanes.openSessionCount ?? 0} open sessions`, variant: 'outline' },
          ]}
        />

        <OperationalStatusCard
          title="Review queue"
          value={queueSummary.loading ? '…' : String(reviewStatusSummary.open)}
          helper={queueSummary.error ? queueSummary.error : reviewStatusSummary.open > 0 ? 'Open cases need an operator to claim or resolve.' : 'No open cases in the current queue.'}
          icon={ClipboardCheck}
          status={queueSummary.error ? 'unavailable' : reviewStatusSummary.open > 0 ? 'attention' : queueSummary.loading ? 'degraded' : 'ready'}
          chips={[
            { label: `${reviewStatusSummary.claimed} claimed`, variant: 'outline' },
            { label: `${reviewStatusSummary.resolved} resolved`, variant: 'secondary' },
            { label: `${reviewStatusSummary.cancelled} cancelled`, variant: 'outline' },
          ]}
        />

        <OperationalStatusCard
          title="Outbox delivery"
          value={outboxSummary.loading ? '…' : String(outboxStatusSummary.failed)}
          helper={outboxSummary.error ? outboxSummary.error : outboxStatusSummary.failed > 0 ? 'Failed or timed-out rows need downstream investigation.' : 'No delivery failures in the current overview slice.'}
          icon={RadioTower}
          status={outboxSummary.error ? 'unavailable' : outboxStatusSummary.failed > 0 ? 'attention' : outboxStatusSummary.pending > 0 ? 'degraded' : 'ready'}
          chips={[
            { label: `${outboxStatusSummary.pending} pending`, variant: outboxStatusSummary.pending > 0 ? 'amber' : 'outline' },
            { label: `${outboxStatusSummary.sent} sent`, variant: 'secondary' },
            { label: `${outboxSummary.data.length} sample rows`, variant: 'outline' },
          ]}
        />

        <OperationalStatusCard
          title="Device health"
          value={deviceHealthState.connected ? `${deviceAlertSummary.attention}/${deviceAlertSummary.total}` : String(deviceAlertSummary.attention)}
          helper={deviceHealthState.error ? deviceHealthState.error : deviceAlertSummary.attention > 0 ? 'Offline or degraded devices in the realtime snapshot.' : 'Device snapshot stable — no degraded or offline units.'}
          icon={Cpu}
          status={deviceHealthState.error ? 'unavailable' : deviceAlertSummary.offline > 0 ? 'unavailable' : deviceAlertSummary.attention > 0 ? 'attention' : 'ready'}
          chips={[
            { label: `${deviceAlertSummary.offline} offline`, variant: deviceAlertSummary.offline > 0 ? 'destructive' : 'outline' },
            { label: `${deviceAlertSummary.degraded} degraded`, variant: deviceAlertSummary.degraded > 0 ? 'amber' : 'outline' },
            { label: `${deviceAlertSummary.online} online`, variant: 'secondary' },
          ]}
        />
      </div>

      <QuickActionsCard
        actions={QUICK_ACTIONS}
        title="Go to work screen"
        description="Overview is a coordination view only. Once you know where the problem is, go directly to the right screen."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SiteAttentionTable
          rows={effectiveSiteRows}
          loading={dashboard.loading}
          error={dashboard.error}
          selectedSiteCode={selectedSiteCode}
          onSelectSite={setSelectedSiteCode}
        />

        <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
          <CardHeader>
            <CardTitle>Live lane watchlist</CardTitle>
            <CardDescription>Lanes in the worst health from the live stream — so you know which ones need immediate action in Run Lane or Lane Monitor.</CardDescription>
          </CardHeader>

          <CardContent>
            {laneState.error ? (
              <SurfaceState tone="error" title="Lane stream unavailable" description={laneState.error} className="min-h-[220px]" />
            ) : liveLaneSummary.topProblemLanes.length === 0 ? (
              <SurfaceState
                tone={laneState.connected ? 'empty' : 'loading'}
                title={laneState.connected ? 'No lanes in attention state' : 'Waiting for lane snapshot'}
                description={laneState.connected ? 'Stream is active — no lanes in attention or offline state.' : 'The list will populate once the backend pushes a lane_status_snapshot.'}
                className="min-h-[220px]"
              />
            ) : (
              <div className="space-y-3">
                {liveLaneSummary.topProblemLanes.map((lane) => (
                  <div key={`${lane.siteCode}:${lane.laneCode}`} className="rounded-2xl border border-border/80 bg-background/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono-data text-sm font-semibold">{lane.siteCode} / {lane.gateCode} / {lane.laneCode}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {lane.direction} &middot; session {lane.lastSessionStatus || '—'} &middot; barrier {lane.lastBarrierStatus || '—'}
                        </p>
                      </div>
                      <Badge variant={laneVariant(lane.aggregateHealth)}>{lane.aggregateHealth}</Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">{lane.aggregateReason}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
          <CardHeader>
            <CardTitle>Recent sessions</CardTitle>
            <CardDescription>Latest sessions — quickly spot lanes in WAITING_DECISION, ERROR, or requiring review.</CardDescription>
          </CardHeader>

          <CardContent>
            {recentSessions.loading ? (
              <SurfaceState tone="loading" title="Loading sessions" description="Fetching the most recent session slice." className="min-h-[220px]" />
            ) : recentSessions.error ? (
              <SurfaceState tone="error" title="Sessions unavailable" description={recentSessions.error} className="min-h-[220px]" />
            ) : recentSessions.data.length === 0 ? (
              <SurfaceState title="No sessions" description="No sessions returned for the current scope." className="min-h-[220px]" />
            ) : (
              <ScrollArea className="h-[360px]">
                <div className="space-y-3 pr-3">
                  {recentSessions.data.map((session) => (
                    <SessionRow key={String(session.sessionId)} session={session} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
          <CardHeader>
            <CardTitle>Dependency status</CardTitle>
            <CardDescription>Ready / degraded / unavailable per data source — helps distinguish data failures from business-logic issues.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {([
              { label: 'Dashboard summary', status: dependencyStatus(dashboard.error, dashboard.loading), detail: dashboard.error || filtersDescription },
              { label: 'Recent sessions', status: dependencyStatus(recentSessions.error, recentSessions.loading), detail: recentSessions.error || `${recentSessions.data.length} rows loaded` },
              { label: 'Review queue', status: dependencyStatus(queueSummary.error, queueSummary.loading), detail: queueSummary.error || `${reviewStatusSummary.open} open · ${reviewStatusSummary.claimed} claimed` },
              { label: 'Outbox list', status: dependencyStatus(outboxSummary.error, outboxSummary.loading), detail: outboxSummary.error || `${outboxStatusSummary.failed} failed · ${outboxStatusSummary.pending} pending` },
              { label: 'Lane stream', status: (laneState.error ? 'unavailable' : laneState.connected ? 'ready' : 'degraded') as OperationalStatus, detail: laneState.error || (laneState.connected ? 'lane_status_snapshot active' : 'Waiting for first lane snapshot') },
              { label: 'Device stream', status: (deviceHealthState.error ? 'unavailable' : deviceHealthState.connected ? 'ready' : 'degraded') as OperationalStatus, detail: deviceHealthState.error || (deviceHealthState.connected ? 'device_health_snapshot active' : 'Waiting for first device snapshot') },
            ] as Array<{ label: string; status: OperationalStatus; detail: string }>).map((item) => (
              <div key={item.label} className="rounded-2xl border border-border/80 bg-background/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <Badge variant={pageStateVariant(item.status)}>{pageStateLabel(item.status)}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
