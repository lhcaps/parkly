import { useMemo } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Cpu,
  DatabaseZap,
  GitBranch,
  RadioTower,
  RefreshCcw,
  Search,
  ShieldAlert,
  TimerReset,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConnectionBadge, PageHeader, SurfaceState } from '@/components/ops/console'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { KpiCard } from '@/features/overview/components/KpiCard'
import { OperationalStatusCard, type OperationalStatus } from '@/features/overview/components/OperationalStatusCard'
import { QuickActionsCard, type QuickActionItem } from '@/features/overview/components/QuickActionsCard'
import { SiteAttentionTable } from '@/features/overview/components/SiteAttentionTable'
import { useOverviewData } from '@/features/overview/hooks/useOverviewData'
import type { SessionSummary } from '@/lib/contracts/sessions'
import { cn } from '@/lib/utils'

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    to: '/run-lane',
    label: 'route.runLane.label',
    helper: 'route.runLane.description',
    badge: 'Lane',
    icon: ArrowRightLeft,
  },
  {
    to: '/review-queue',
    label: 'route.reviewQueue.label',
    helper: 'route.reviewQueue.description',
    badge: 'Review',
    icon: ClipboardCheck,
  },
  {
    to: '/lane-monitor',
    label: 'route.laneMonitor.label',
    helper: 'route.laneMonitor.description',
    badge: 'Live',
    icon: Activity,
  },
  {
    to: '/device-health',
    label: 'route.deviceHealth.label',
    helper: 'route.deviceHealth.description',
    badge: 'Health',
    icon: Cpu,
  },
  {
    to: '/sync-outbox',
    label: 'route.syncOutbox.label',
    helper: 'route.syncOutbox.description',
    badge: 'Queue',
    icon: RadioTower,
  },
  {
    to: '/capture-debug',
    label: 'route.captureDebug.label',
    helper: 'route.captureDebug.description',
    badge: 'Capture',
    icon: Camera,
  },
]

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
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

function dependencyStatus(error: string, loading: boolean): OperationalStatus {
  if (error) return 'unavailable'
  if (loading) return 'degraded'
  return 'ready'
}

function SessionRow({ session, t }: { session: SessionSummary; t: ReturnType<typeof useTranslation>['t'] }) {
  return (
    <div className="group rounded-2xl border border-border/60 bg-card/60 p-4 transition-all duration-200 hover:border-primary/25 hover:bg-card/80 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono-data text-sm font-semibold tracking-tight">{session.sessionId || '—'}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="font-medium">{session.siteCode || '—'}</span>
            <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
            <span>{session.gateCode || '—'}</span>
            <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
            <span>{session.laneCode || '—'}</span>
            <span className="ml-1 text-primary/70">{session.direction}</span>
          </p>
        </div>
        <Badge variant={sessionVariant(session.status)} className="shrink-0 text-[10px]">
          {session.status}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-mono-data text-muted-foreground">{formatDateTime(session.openedAt)}</span>
        {session.plateCompact ? (
          <Badge variant="outline" className="font-mono-data font-semibold">
            {session.plateCompact}
          </Badge>
        ) : null}
        <Badge variant="outline" className="font-mono-data">
          {session.readCount} reads
        </Badge>
        <Badge variant="outline" className="font-mono-data">
          {session.decisionCount} decisions
        </Badge>
        {session.reviewRequired ? (
          <Badge variant="amber" className="flex items-center gap-1 font-semibold">
            <AlertTriangle className="h-3 w-3" />
            {t('overview.recentSessions.reviewRequired')}
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

export function OverviewPage() {
  const { t } = useTranslation()
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
  const overview = dashboardData?.overview

  const lanePressureData = useMemo(() => {
    const useLive = laneState.connected && liveLaneSummary.total > 0
    return {
      useLive,
      attention: useLive ? liveLaneSummary.attention : (dashboardData?.lanes.attentionCount ?? 0),
      total: useLive ? liveLaneSummary.total : (dashboardData?.lanes.totalLanes ?? 0),
      offline: useLive ? liveLaneSummary.offline : (dashboardData?.lanes.offlineCount ?? 0),
      barrierFault: useLive ? liveLaneSummary.barrierFault : (dashboardData?.lanes.barrierFaultCount ?? 0),
      openSessions: dashboardData?.lanes.openSessionCount ?? 0,
    }
  }, [laneState.connected, liveLaneSummary, dashboardData])

  const lanePressureValue = useMemo(() => {
    if (lanePressureData.total === 0 && lanePressureData.attention === 0) return 'N/A'
    return `${lanePressureData.attention}/${lanePressureData.total}`
  }, [lanePressureData])

  const lanePressureHelper = useMemo(() => {
    if (lanePressureData.useLive) return t('overview.status.lanePressure.helperLive')
    if (laneState.connected) return t('overview.status.lanePressure.helperFallback')
    return t('overview.status.lanePressure.helperFallback')
  }, [lanePressureData.useLive, laneState.connected, t])

  const lanePressureStatus = useMemo<OperationalStatus>(() => {
    if (lanePressureData.offline > 0) return 'unavailable'
    if (lanePressureData.attention > 0) return 'attention'
    if (laneState.error || (!laneState.connected && !dashboardData)) return 'degraded'
    return 'ready'
  }, [lanePressureData, laneState, dashboardData])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('overview.eyebrow')}
        title={t('overview.title')}
        description={t('overview.description')}
        badges={[
          { label: t('route.overview.label'), variant: 'secondary' },
          { label: selectedSiteCode ? `${selectedSiteCode}` : t('overview.allAccessibleSites'), variant: 'outline' },
          { label: t(`overview.pageStatus.${pageState}`), variant: pageStateVariant(pageState) },
        ]}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ConnectionBadge connected={laneState.connected} label={t('overview.streamLane')} />
            <ConnectionBadge connected={deviceHealthState.connected} label={t('overview.streamDevice')} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshAll()}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCcw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              {refreshing ? t('overview.refreshing') : t('overview.refresh')}
            </Button>
          </div>
        }
      />

      {/* ── KPI row ──────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          title={t('overview.kpi.incidents.title')}
          value={dashboard.loading ? '…' : String(overview?.incidentsOpenCount ?? 0)}
          helper={
            dashboard.error
              ? dashboard.error
              : `${overview?.criticalIncidentsOpenCount ?? 0} ${t('overview.kpi.incidents.critical', { count: overview?.criticalIncidentsOpenCount ?? 0 })}. ${t('overview.kpi.incidents.helper')}`
          }
          icon={ShieldAlert}
          tone={(overview?.criticalIncidentsOpenCount ?? 0) > 0 ? 'danger' : (overview?.incidentsOpenCount ?? 0) > 0 ? 'warning' : 'default'}
          loading={dashboard.loading}
        />
        <KpiCard
          title={t('overview.kpi.laneAttention.title')}
          value={dashboard.loading ? '…' : String(overview?.laneAttentionCount ?? 0)}
          helper={dashboard.error ? t('overview.kpi.laneAttention.helper', { offline: 0 }) : t('overview.kpi.laneAttention.helper', { offline: overview?.offlineLaneCount ?? 0 })}
          icon={Activity}
          tone={(overview?.laneAttentionCount ?? 0) > 0 ? 'warning' : 'success'}
          loading={dashboard.loading}
        />
        <Link to="/parking-live" className="block">
          <KpiCard
            title={t('overview.kpi.occupancy.title')}
            value={dashboard.loading ? '…' : `${(overview?.occupancyRate ?? 0).toFixed(1)}%`}
            helper={dashboard.error ? '—' : t('overview.kpi.occupancy.helper', { occupied: dashboardData?.occupancy.occupiedTotal ?? 0, total: dashboardData?.occupancy.totalSpots ?? 0 })}
            icon={DatabaseZap}
            tone="default"
            loading={dashboard.loading}
          />
        </Link>
        <Link to="/subscriptions?status=ACTIVE" className="block">
          <KpiCard
            title={t('overview.kpi.subscriptions.title')}
            value={dashboard.loading ? '…' : String(overview?.activeSubscriptionCount ?? 0)}
            helper={dashboard.error ? '—' : t('overview.kpi.subscriptions.helper', { expiring: overview?.expiringSubscriptionCount ?? 0 })}
            icon={TimerReset}
            tone={(overview?.expiringSubscriptionCount ?? 0) > 0 ? 'warning' : 'default'}
            loading={dashboard.loading}
          />
        </Link>
        <KpiCard
          title={t('overview.kpi.activePresence.title')}
          value={dashboard.loading ? '…' : String(overview?.activePresenceCount ?? 0)}
          helper={dashboard.error ? '—' : t('overview.kpi.activePresence.helper')}
          icon={ArrowRightLeft}
          tone={(overview?.activePresenceCount ?? 0) > 0 ? 'default' : 'success'}
          loading={dashboard.loading}
        />
        <KpiCard
          title={t('overview.kpi.openSessions.title')}
          value={dashboard.loading ? '…' : String(overview?.openSessionCount ?? 0)}
          helper={dashboard.error ? '—' : t('overview.kpi.openSessions.helper')}
          icon={GitBranch}
          tone={(overview?.openSessionCount ?? 0) > 0 ? 'warning' : 'default'}
          loading={dashboard.loading}
        />
      </div>

      {/* ── Operational status row ─────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <OperationalStatusCard
          title={t('overview.status.lanePressure.title')}
          value={lanePressureValue}
          helper={lanePressureHelper}
          icon={Activity}
          status={lanePressureStatus}
          chips={[
            {
              label: t('overview.status.lanePressure.offline', { count: lanePressureData.offline }),
              variant: lanePressureData.offline > 0 ? 'destructive' : 'outline',
            },
            {
              label: t('overview.status.lanePressure.barrierFault', { count: lanePressureData.barrierFault }),
              variant: lanePressureData.barrierFault > 0 ? 'amber' : 'outline',
            },
            {
              label: t('overview.status.lanePressure.openSessions', { count: lanePressureData.openSessions }),
              variant: 'outline',
            },
          ]}
          loading={dashboard.loading && lanePressureData.total === 0}
        />

        <OperationalStatusCard
          title={t('overview.status.reviewQueue.title')}
          value={queueSummary.loading ? '…' : String(reviewStatusSummary.open)}
          helper={queueSummary.error ? queueSummary.error : reviewStatusSummary.open > 0 ? t('overview.status.reviewQueue.helperHasItems') : t('overview.status.reviewQueue.helperEmpty')}
          icon={ClipboardCheck}
          status={queueSummary.error ? 'unavailable' : reviewStatusSummary.open > 0 ? 'attention' : queueSummary.loading ? 'degraded' : 'ready'}
          chips={[
            { label: `${reviewStatusSummary.claimed} ${t('overview.status.reviewQueue.claimed')}`, variant: 'outline' },
            { label: `${reviewStatusSummary.resolved} ${t('overview.status.reviewQueue.resolved')}`, variant: 'secondary' },
            { label: `${reviewStatusSummary.cancelled} ${t('overview.status.reviewQueue.cancelled')}`, variant: 'outline' },
          ]}
          loading={queueSummary.loading}
        />

        <OperationalStatusCard
          title={t('overview.status.outboxDelivery.title')}
          value={outboxSummary.loading ? '…' : String(outboxStatusSummary.failed)}
          helper={outboxSummary.error ? outboxSummary.error : outboxStatusSummary.failed > 0 ? t('overview.status.outboxDelivery.helperHasItems') : t('overview.status.outboxDelivery.helperEmpty')}
          icon={RadioTower}
          status={outboxSummary.error ? 'unavailable' : outboxStatusSummary.failed > 0 ? 'attention' : outboxStatusSummary.pending > 0 ? 'degraded' : 'ready'}
          chips={[
            { label: `${outboxStatusSummary.pending} ${t('overview.status.outboxDelivery.pending')}`, variant: outboxStatusSummary.pending > 0 ? 'amber' : 'outline' },
            { label: `${outboxStatusSummary.sent} ${t('overview.status.outboxDelivery.sent')}`, variant: 'secondary' },
            { label: t('overview.status.outboxDelivery.sampleRows', { count: outboxSummary.data.length }), variant: 'outline' },
          ]}
          loading={outboxSummary.loading}
        />

        <OperationalStatusCard
          title={t('overview.status.deviceHealth.title')}
          value={deviceHealthState.connected ? `${deviceAlertSummary.attention}/${deviceAlertSummary.total}` : String(deviceAlertSummary.attention)}
          helper={deviceHealthState.error ? deviceHealthState.error : deviceAlertSummary.attention > 0 ? t('overview.status.deviceHealth.helperAttention') : t('overview.status.deviceHealth.helperStable')}
          icon={Cpu}
          status={deviceHealthState.error ? 'unavailable' : deviceAlertSummary.offline > 0 ? 'unavailable' : deviceAlertSummary.attention > 0 ? 'attention' : 'ready'}
          chips={[
            { label: t('overview.status.deviceHealth.offline', { count: deviceAlertSummary.offline }), variant: deviceAlertSummary.offline > 0 ? 'destructive' : 'outline' },
            { label: t('overview.status.deviceHealth.degraded', { count: deviceAlertSummary.degraded }), variant: deviceAlertSummary.degraded > 0 ? 'amber' : 'outline' },
            { label: t('overview.status.deviceHealth.online', { count: deviceAlertSummary.online }), variant: 'secondary' },
          ]}
          loading={deviceHealthState.connected === false && deviceAlertSummary.total === 0}
        />
      </div>

      {/* ── Quick actions ─────────────────────────────────────── */}
      <QuickActionsCard
        actions={QUICK_ACTIONS}
        title={t('overview.quickActions.title')}
        description={t('overview.quickActions.description')}
      />

      {/* ── Site overview + Live watchlist ─────────────────────── */}
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                    <Activity className="h-4 w-4 text-primary" />
                  </span>
                  {t('overview.liveWatchlist.title')}
                </CardTitle>
                <CardDescription className="mt-1">{t('overview.liveWatchlist.description')}</CardDescription>
              </div>
              {laneState.connected ? (
                <Badge variant="secondary" className="flex items-center gap-1 shrink-0">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                  Live
                </Badge>
              ) : (
                <Badge variant="outline" className="flex items-center gap-1 shrink-0">
                  <WifiOff className="h-3 w-3" />
                  Offline
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {laneState.error ? (
              <SurfaceState
                tone="error"
                title={t('overview.liveWatchlist.streamUnavailable')}
                description={laneState.error}
                className="min-h-[220px]"
              />
            ) : liveLaneSummary.topProblemLanes.length === 0 ? (
              <SurfaceState
                tone={laneState.connected ? 'empty' : 'loading'}
                title={laneState.connected ? t('overview.liveWatchlist.noLanes') : t('overview.liveWatchlist.waiting')}
                description={laneState.connected ? t('overview.liveWatchlist.noLanesDesc') : t('overview.liveWatchlist.waitingDesc')}
                className="min-h-[220px]"
              />
            ) : (
              <div className="space-y-3">
                {liveLaneSummary.topProblemLanes.map((lane) => (
                  <div
                    key={`${lane.siteCode}:${lane.laneCode}`}
                    className="group rounded-2xl border border-border/60 bg-card/60 p-4 transition-all duration-200 hover:border-destructive/30 hover:bg-destructive/5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono-data text-sm font-semibold tracking-tight">
                          {lane.siteCode} / {lane.gateCode} / {lane.laneCode}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">
                            {lane.direction}
                          </Badge>
                          <span>
                            {t('overview.liveWatchlist.session')}:{' '}
                            <span className="font-medium text-foreground">{lane.lastSessionStatus || '—'}</span>
                          </span>
                          <span>
                            {t('overview.liveWatchlist.barrier')}:{' '}
                            <span className="font-medium text-foreground">{lane.lastBarrierStatus || '—'}</span>
                          </span>
                        </p>
                      </div>
                      <Badge variant={laneVariant(lane.aggregateHealth)} className="shrink-0 text-[10px]">
                        {lane.aggregateHealth}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{lane.aggregateReason}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent sessions + Dependency status ───────────────── */}
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                    <GitBranch className="h-4 w-4 text-primary" />
                  </span>
                  {t('overview.recentSessions.title')}
                </CardTitle>
                <CardDescription className="mt-1">{t('overview.recentSessions.description')}</CardDescription>
              </div>
              <Link to="/sessions">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                  Xem tất cả
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent>
            {recentSessions.loading ? (
              <SurfaceState tone="loading" title={t('overview.recentSessions.loading')} className="min-h-[220px]" />
            ) : recentSessions.error ? (
              <SurfaceState tone="error" title={t('overview.recentSessions.error')} description={recentSessions.error} className="min-h-[220px]" />
            ) : recentSessions.data.length === 0 ? (
              <SurfaceState title={t('overview.recentSessions.empty')} className="min-h-[220px]" />
            ) : (
              <ScrollArea className="h-[360px]">
                <div className="space-y-3 pr-3">
                  {recentSessions.data.map((session) => (
                    <SessionRow key={String(session.sessionId)} session={session} t={t} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                <Wifi className="h-4 w-4 text-primary" />
              </span>
              {t('overview.dependencyStatus.title')}
            </CardTitle>
            <CardDescription>{t('overview.dependencyStatus.description')}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {([
              {
                label: t('overview.dependencyStatus.dashboardSummary'),
                status: dependencyStatus(dashboard.error, dashboard.loading),
                detail: dashboard.error || t('overview.filterBadge', { hours: dashboardData?.filters.sinceHours ?? '?', days: dashboardData?.filters.expiringInDays ?? '?' }),
              },
              {
                label: t('overview.dependencyStatus.recentSessions'),
                status: dependencyStatus(recentSessions.error, recentSessions.loading),
                detail: recentSessions.error || t('overview.dependencyStatus.rowsLoaded', { count: recentSessions.data.length }),
              },
              {
                label: t('overview.dependencyStatus.reviewQueue'),
                status: dependencyStatus(queueSummary.error, queueSummary.loading),
                detail: queueSummary.error || t('overview.dependencyStatus.openClaimed', { open: reviewStatusSummary.open, claimed: reviewStatusSummary.claimed }),
              },
              {
                label: t('overview.dependencyStatus.outboxList'),
                status: dependencyStatus(outboxSummary.error, outboxSummary.loading),
                detail: outboxSummary.error || t('overview.dependencyStatus.failedPending', { failed: outboxStatusSummary.failed, pending: outboxStatusSummary.pending }),
              },
              {
                label: t('overview.dependencyStatus.laneStream'),
                status: (laneState.error ? 'unavailable' : laneState.connected ? 'ready' : 'degraded') as OperationalStatus,
                detail: laneState.error || (laneState.connected ? t('overview.dependencyStatus.streamActive') : t('overview.liveWatchlist.waiting')),
              },
              {
                label: t('overview.dependencyStatus.deviceStream'),
                status: (deviceHealthState.error ? 'unavailable' : deviceHealthState.connected ? 'ready' : 'degraded') as OperationalStatus,
                detail: deviceHealthState.error || (deviceHealthState.connected ? t('overview.dependencyStatus.streamActive') : t('overview.liveWatchlist.waiting')),
              },
            ] as Array<{ label: string; status: OperationalStatus; detail: string }>).map((item) => (
              <div
                key={item.label}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 transition-all duration-200 hover:bg-card/80"
              >
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <Badge variant={pageStateVariant(item.status)} className="shrink-0 text-[10px]">
                  {t(`overview.pageStatus.${item.status}`)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
