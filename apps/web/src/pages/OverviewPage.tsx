import { memo, useMemo } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Camera,
  ChevronRight,
  ClipboardCheck,
  Cpu,
  DatabaseZap,
  GitBranch,
  Layers,
  RadioTower,
  RefreshCcw,
  ShieldAlert,
  TimerReset,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConnectionBadge, PageHeader, SurfaceState } from '@/components/ops/console'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { KpiCard } from '@/features/overview/components/KpiCard'
import { OperationalStatusCard, type OperationalStatus } from '@/features/overview/components/OperationalStatusCard'
import { QuickActionsCard, type QuickActionItem } from '@/features/overview/components/QuickActionsCard'
import { SiteAttentionTable } from '@/features/overview/components/SiteAttentionTable'
import { useOverviewData } from '@/features/overview/hooks/useOverviewData'
import { useOverviewDeviceRealtime, useOverviewLaneRealtime, type OverviewLaneProblem } from '@/features/overview/hooks/useOverviewRealtime'
import type { SessionSummary } from '@/lib/contracts/sessions'
import { cn } from '@/lib/utils'

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    to: '/run-lane',
    label: 'route.runLane.label',
    helper: 'route.runLane.description',
    badge: 'overview.quickActions.badges.lane',
    icon: ArrowRightLeft,
  },
  {
    to: '/review-queue',
    label: 'route.reviewQueue.label',
    helper: 'route.reviewQueue.description',
    badge: 'overview.quickActions.badges.review',
    icon: ClipboardCheck,
  },
  {
    to: '/lane-monitor',
    label: 'route.laneMonitor.label',
    helper: 'route.laneMonitor.description',
    badge: 'overview.quickActions.badges.live',
    icon: Activity,
  },
  {
    to: '/device-health',
    label: 'route.deviceHealth.label',
    helper: 'route.deviceHealth.description',
    badge: 'overview.quickActions.badges.health',
    icon: Cpu,
  },
  {
    to: '/sync-outbox',
    label: 'route.syncOutbox.label',
    helper: 'route.syncOutbox.description',
    badge: 'overview.quickActions.badges.queue',
    icon: RadioTower,
  },
  {
    to: '/capture-debug',
    label: 'route.captureDebug.label',
    helper: 'route.captureDebug.description',
    badge: 'overview.quickActions.badges.capture',
    icon: Camera,
  },
]

function formatDateTime(value: string | null | undefined, locale: string, emptyLabel: string) {
  if (!value) return emptyLabel
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return emptyLabel
  return date.toLocaleString(locale, {
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

const SessionRow = memo(function SessionRow({ session, t }: { session: SessionSummary; t: ReturnType<typeof useTranslation>['t'] }) {
  const locale = t('common.locale')
  const dash = t('common.dash')

  return (
    <div className="group rounded-2xl border border-border/60 bg-card/60 p-4 transition-[background-color,border-color,box-shadow,transform] duration-200 hover:border-primary/25 hover:bg-card/82 hover:shadow-[0_12px_32px_rgba(35,94,138,0.12)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono-data text-sm font-semibold tracking-tight">{session.sessionId || dash}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="font-medium">{session.siteCode || dash}</span>
            <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
            <span>{session.gateCode || dash}</span>
            <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
            <span>{session.laneCode || dash}</span>
            <span className="ml-1 text-primary/70">{session.direction}</span>
          </p>
        </div>
        <Badge variant={sessionVariant(session.status)} className="shrink-0 text-[10px]">
          {session.status}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-mono-data text-muted-foreground">{formatDateTime(session.openedAt, locale, dash)}</span>
        {session.plateCompact ? (
          <Badge variant="outline" className="font-mono-data font-semibold">
            {session.plateCompact}
          </Badge>
        ) : null}
        <Badge variant="outline" className="font-mono-data">
          {t('overview.recentSessions.readCount', { count: session.readCount })}
        </Badge>
        <Badge variant="outline" className="font-mono-data">
          {t('overview.recentSessions.decisionCount', { count: session.decisionCount })}
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
})

const OverviewHeaderActions = memo(function OverviewHeaderActions({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean
  onRefresh: () => Promise<void>
}) {
  const { t, i18n } = useTranslation()
  const { laneState } = useOverviewLaneRealtime()
  const { deviceHealthState } = useOverviewDeviceRealtime()
  const sqlButtonLabel = i18n.language.startsWith('en') ? 'SQL modules' : 'Module SQL'

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <ConnectionBadge connected={laneState.connected} label={t('overview.streamLane')} />
      <ConnectionBadge connected={deviceHealthState.connected} label={t('overview.streamDevice')} />
      <Button asChild variant="secondary" size="sm" className="gap-2">
        <Link to="/settings?tab=sql">
          <DatabaseZap className="h-4 w-4" />
          {sqlButtonLabel}
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void onRefresh()}
        disabled={refreshing}
        className="gap-2"
      >
        <RefreshCcw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        {refreshing ? t('overview.refreshing') : t('overview.refresh')}
      </Button>
    </div>
  )
})

const OverviewLanePressureCard = memo(function OverviewLanePressureCard({
  fallbackAttention,
  fallbackTotal,
  fallbackOffline,
  fallbackBarrierFault,
  fallbackOpenSessions,
  loading,
}: {
  fallbackAttention: number
  fallbackTotal: number
  fallbackOffline: number
  fallbackBarrierFault: number
  fallbackOpenSessions: number
  loading: boolean
}) {
  const { t } = useTranslation()
  const { laneState, liveLaneSummary } = useOverviewLaneRealtime()

  const lanePressureData = useMemo(() => {
    const useLive = laneState.connected && liveLaneSummary.total > 0
    return {
      useLive,
      attention: useLive ? liveLaneSummary.attention : fallbackAttention,
      total: useLive ? liveLaneSummary.total : fallbackTotal,
      offline: useLive ? liveLaneSummary.offline : fallbackOffline,
      barrierFault: useLive ? liveLaneSummary.barrierFault : fallbackBarrierFault,
      openSessions: useLive ? liveLaneSummary.openSessions : fallbackOpenSessions,
    }
  }, [fallbackAttention, fallbackBarrierFault, fallbackOffline, fallbackOpenSessions, fallbackTotal, laneState.connected, liveLaneSummary])

  const lanePressureValue = useMemo(() => {
    if (lanePressureData.total === 0 && lanePressureData.attention === 0) return 'N/A'
    return `${lanePressureData.attention}/${lanePressureData.total}`
  }, [lanePressureData.attention, lanePressureData.total])

  const lanePressureHelper = useMemo(() => {
    if (lanePressureData.useLive) return t('overview.status.lanePressure.helperLive')
    return t('overview.status.lanePressure.helperFallback')
  }, [lanePressureData.useLive, t])

  const lanePressureStatus = useMemo<OperationalStatus>(() => {
    if (lanePressureData.offline > 0) return 'unavailable'
    if (lanePressureData.attention > 0) return 'attention'
    if (laneState.error || (!laneState.connected && fallbackTotal === 0 && fallbackAttention === 0)) return 'degraded'
    return 'ready'
  }, [fallbackAttention, fallbackTotal, lanePressureData.attention, lanePressureData.offline, laneState.connected, laneState.error])

  const chips = useMemo(() => ([
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
  ] as Array<{ label: string; variant: BadgeProps['variant'] }>), [lanePressureData.barrierFault, lanePressureData.offline, lanePressureData.openSessions, t])

  return (
    <OperationalStatusCard
      title={t('overview.status.lanePressure.title')}
      value={lanePressureValue}
      helper={lanePressureHelper}
      icon={Activity}
      status={lanePressureStatus}
      chips={chips}
      loading={loading && lanePressureData.total === 0}
    />
  )
})

const OverviewDeviceHealthCard = memo(function OverviewDeviceHealthCard() {
  const { t } = useTranslation()
  const { deviceHealthState, deviceAlertSummary } = useOverviewDeviceRealtime()

  const chips = useMemo(() => ([
    { label: t('overview.status.deviceHealth.offline', { count: deviceAlertSummary.offline }), variant: deviceAlertSummary.offline > 0 ? 'destructive' : 'outline' },
    { label: t('overview.status.deviceHealth.degraded', { count: deviceAlertSummary.degraded }), variant: deviceAlertSummary.degraded > 0 ? 'amber' : 'outline' },
    { label: t('overview.status.deviceHealth.online', { count: deviceAlertSummary.online }), variant: 'secondary' },
  ] as Array<{ label: string; variant: BadgeProps['variant'] }>), [deviceAlertSummary.degraded, deviceAlertSummary.offline, deviceAlertSummary.online, t])

  return (
    <OperationalStatusCard
      title={t('overview.status.deviceHealth.title')}
      value={deviceHealthState.connected ? `${deviceAlertSummary.attention}/${deviceAlertSummary.total}` : String(deviceAlertSummary.attention)}
      helper={deviceHealthState.error ? deviceHealthState.error : deviceAlertSummary.attention > 0 ? t('overview.status.deviceHealth.helperAttention') : t('overview.status.deviceHealth.helperStable')}
      icon={Cpu}
      status={deviceHealthState.error ? 'unavailable' : deviceAlertSummary.offline > 0 ? 'unavailable' : deviceAlertSummary.attention > 0 ? 'attention' : 'ready'}
      chips={chips}
      loading={deviceHealthState.connected === false && deviceAlertSummary.total === 0}
    />
  )
})

const LiveWatchlistPanel = memo(function LiveWatchlistPanel({
  selectedSiteCode,
  dash,
}: {
  selectedSiteCode: string
  dash: string
}) {
  const { t } = useTranslation()
  const { laneState, liveLaneSummary } = useOverviewLaneRealtime()

  const lanes = useMemo<OverviewLaneProblem[]>(() => {
    const scoped = selectedSiteCode
      ? liveLaneSummary.problemLanes.filter((lane) => lane.siteCode === selectedSiteCode)
      : liveLaneSummary.problemLanes
    return scoped.slice(0, 5)
  }, [liveLaneSummary.problemLanes, selectedSiteCode])

  return (
    <CollapsibleCard
      title={t('overview.liveWatchlist.title')}
      description={t('overview.liveWatchlist.description')}
      defaultOpen={false}
      count={lanes.length}
      countVariant={laneState.error ? 'destructive' : lanes.length > 0 ? 'amber' : 'success'}
      icon={<Activity className="h-4 w-4" />}
      headerBadge={laneState.connected ? (
        <Badge variant="secondary" className="shrink-0">
          {t('overview.liveWatchlist.live')}
        </Badge>
      ) : (
        <Badge variant="outline" className="flex shrink-0 items-center gap-1">
          <WifiOff className="h-3 w-3" />
          {t('overview.liveWatchlist.offline')}
        </Badge>
      )}
      className="border-border/80 bg-card/95 shadow-[0_20px_62px_rgba(35,94,138,0.12)]"
      contentClassName="pt-0"
      renderContent={() => {
        if (laneState.error) {
          return (
            <SurfaceState
              tone="error"
              title={t('overview.liveWatchlist.streamUnavailable')}
              description={laneState.error}
              className="min-h-[220px]"
            />
          )
        }

        if (lanes.length === 0) {
          return (
            <SurfaceState
              tone={laneState.connected ? 'empty' : 'loading'}
              title={laneState.connected ? t('overview.liveWatchlist.noLanes') : t('overview.liveWatchlist.waiting')}
              description={laneState.connected ? t('overview.liveWatchlist.noLanesDesc') : t('overview.liveWatchlist.waitingDesc')}
              className="min-h-[220px]"
            />
          )
        }

        return (
          <div className="space-y-3">
            {lanes.map((lane) => (
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
                        <span className="font-medium text-foreground">{lane.lastSessionStatus || dash}</span>
                      </span>
                      <span>
                        {t('overview.liveWatchlist.barrier')}:{' '}
                        <span className="font-medium text-foreground">{lane.lastBarrierStatus || dash}</span>
                      </span>
                    </p>
                  </div>
                  <Badge variant={laneVariant(lane.aggregateHealth)} className="shrink-0 text-[10px]">
                    {lane.aggregateHealth}
                  </Badge>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{lane.aggregateReason}</p>
              </div>
            ))}
          </div>
        )
      }}
    />
  )
})

const RecentSessionsPanel = memo(function RecentSessionsPanel({
  loading,
  error,
  sessions,
}: {
  loading: boolean
  error: string
  sessions: SessionSummary[]
}) {
  const { t } = useTranslation()

  return (
    <CollapsibleCard
      title={t('overview.recentSessions.title')}
      description={t('overview.recentSessions.description')}
      defaultOpen={false}
      count={loading ? '…' : sessions.length}
      countVariant={error ? 'destructive' : sessions.length > 0 ? 'amber' : 'success'}
      icon={<GitBranch className="h-4 w-4" />}
      headerAction={(
        <Link to="/sessions">
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
            {t('overview.recentSessions.viewAll')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
      className="border-border/80 bg-card/95 shadow-[0_20px_62px_rgba(35,94,138,0.12)]"
      contentClassName="pt-0"
      renderContent={() => {
        if (loading) {
          return <SurfaceState tone="loading" title={t('overview.recentSessions.loading')} className="min-h-[220px]" />
        }

        if (error) {
          return <SurfaceState tone="error" title={t('overview.recentSessions.error')} description={error} className="min-h-[220px]" />
        }

        if (sessions.length === 0) {
          return <SurfaceState title={t('overview.recentSessions.empty')} className="min-h-[220px]" />
        }

        return (
          <ScrollArea className="h-[360px]">
            <div className="space-y-3 pr-3">
              {sessions.map((session) => (
                <SessionRow key={String(session.sessionId)} session={session} t={t} />
              ))}
            </div>
          </ScrollArea>
        )
      }}
    />
  )
})

const DependencyStatusPanel = memo(function DependencyStatusPanel({
  dashboardError,
  dashboardLoading,
  sinceHours,
  expiringInDays,
  recentSessionsError,
  recentSessionsLoading,
  recentSessionCount,
  queueError,
  queueLoading,
  reviewOpen,
  reviewClaimed,
  outboxError,
  outboxLoading,
  outboxFailed,
  outboxPending,
}: {
  dashboardError: string
  dashboardLoading: boolean
  sinceHours: number | string
  expiringInDays: number | string
  recentSessionsError: string
  recentSessionsLoading: boolean
  recentSessionCount: number
  queueError: string
  queueLoading: boolean
  reviewOpen: number
  reviewClaimed: number
  outboxError: string
  outboxLoading: boolean
  outboxFailed: number
  outboxPending: number
}) {
  const { t } = useTranslation()
  const { laneState } = useOverviewLaneRealtime()
  const { deviceHealthState } = useOverviewDeviceRealtime()

  const items = useMemo<Array<{ label: string; status: OperationalStatus; detail: string }>>(() => ([
    {
      label: t('overview.dependencyStatus.dashboardSummary'),
      status: dependencyStatus(dashboardError, dashboardLoading),
      detail: dashboardError || t('overview.filterBadge', { hours: sinceHours, days: expiringInDays }),
    },
    {
      label: t('overview.dependencyStatus.recentSessions'),
      status: dependencyStatus(recentSessionsError, recentSessionsLoading),
      detail: recentSessionsError || t('overview.dependencyStatus.rowsLoaded', { count: recentSessionCount }),
    },
    {
      label: t('overview.dependencyStatus.reviewQueue'),
      status: dependencyStatus(queueError, queueLoading),
      detail: queueError || t('overview.dependencyStatus.openClaimed', { open: reviewOpen, claimed: reviewClaimed }),
    },
    {
      label: t('overview.dependencyStatus.outboxList'),
      status: dependencyStatus(outboxError, outboxLoading),
      detail: outboxError || t('overview.dependencyStatus.failedPending', { failed: outboxFailed, pending: outboxPending }),
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
  ]), [
    dashboardError,
    dashboardLoading,
    deviceHealthState.connected,
    deviceHealthState.error,
    expiringInDays,
    laneState.connected,
    laneState.error,
    outboxError,
    outboxFailed,
    outboxLoading,
    outboxPending,
    queueError,
    queueLoading,
    recentSessionCount,
    recentSessionsError,
    recentSessionsLoading,
    reviewClaimed,
    reviewOpen,
    sinceHours,
    t,
  ])

  const issueCount = items.filter((item) => item.status !== 'ready').length
  const countVariant = items.some((item) => item.status === 'unavailable')
    ? 'destructive'
    : issueCount > 0
      ? 'amber'
      : 'success'

  return (
    <CollapsibleCard
      title={t('overview.dependencyStatus.title')}
      description={t('overview.dependencyStatus.description')}
      defaultOpen={false}
      count={`${issueCount}/${items.length}`}
      countVariant={countVariant}
      icon={<Wifi className="h-4 w-4" />}
      className="border-border/80 bg-card/95 shadow-[0_20px_62px_rgba(35,94,138,0.12)]"
      contentClassName="space-y-3 pt-0"
      renderContent={() => (
        <>
          {items.map((item) => (
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
        </>
      )}
    />
  )
})

export function OverviewPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'vi-VN'
  const dash = t('common.dash')
  const {
    selectedSiteCode,
    setSelectedSiteCode,
    dashboard,
    recentSessions,
    queueSummary,
    outboxSummary,
    reviewStatusSummary,
    outboxStatusSummary,
    effectiveSiteRows,
    staleMinutes,
    pageState,
    refreshedAt,
    refreshing,
    refreshAll,
  } = useOverviewData()

  const dashboardData = dashboard.data
  const overview = dashboardData?.overview

  const topologySummary = useMemo(() => {
    const siteRows = dashboardData?.sites ?? []
    const totalZones = siteRows.reduce((sum, row) => sum + (row.zoneCount ?? 0), 0)
    const totalGates = siteRows.reduce((sum, row) => sum + (row.gateCount ?? 0), 0)
    const totalLanes = siteRows.reduce((sum, row) => sum + (row.laneCount ?? 0), 0)
    const totalDevices = siteRows.reduce((sum, row) => sum + (row.deviceCount ?? 0), 0)
    const hasTopology = totalZones > 0 || totalGates > 0 || totalLanes > 0 || totalDevices > 0

    if (!hasTopology) return null

    return {
      siteCount: siteRows.length,
      totalZones,
      totalGates,
      totalLanes,
      totalDevices,
      allVehicleTypes: [...new Set(siteRows.flatMap((row) => row.vehicleTypes ?? []))],
      allZoneNames: [...new Set(siteRows.flatMap((row) => row.zoneNames ?? []))],
    }
  }, [dashboardData?.sites])

  const shiftPriority = useMemo(() => {
    if ((overview?.criticalIncidentsOpenCount ?? 0) > 0) {
      return {
        label: t('overview.shiftPriority.criticalIncidents.label'),
        summary: t('overview.shiftPriority.criticalIncidents.summary', { count: overview?.criticalIncidentsOpenCount ?? 0 }),
        toneClass: 'border-destructive/25 bg-destructive/6',
        badgeVariant: 'destructive' as const,
      }
    }
    if ((overview?.offlineLaneCount ?? 0) > 0) {
      return {
        label: t('overview.shiftPriority.offlineLanes.label'),
        summary: t('overview.shiftPriority.offlineLanes.summary', { count: overview?.offlineLaneCount ?? 0 }),
        toneClass: 'border-primary/25 bg-primary/6',
        badgeVariant: 'amber' as const,
      }
    }
    if (outboxStatusSummary.failed > 0) {
      return {
        label: t('overview.shiftPriority.syncBacklog.label'),
        summary: t('overview.shiftPriority.syncBacklog.summary', { count: outboxStatusSummary.failed }),
        toneClass: 'border-primary/25 bg-primary/6',
        badgeVariant: 'amber' as const,
      }
    }
    return {
      label: t('overview.shiftPriority.stableShift.label'),
      summary: t('overview.shiftPriority.stableShift.summary'),
      toneClass: 'border-success/20 bg-success/6',
      badgeVariant: 'secondary' as const,
    }
  }, [outboxStatusSummary.failed, overview?.criticalIncidentsOpenCount, overview?.offlineLaneCount, t])

  const reviewQueueChips = useMemo(() => ([
    { label: `${reviewStatusSummary.claimed} ${t('overview.status.reviewQueue.claimed')}`, variant: 'outline' },
    { label: `${reviewStatusSummary.resolved} ${t('overview.status.reviewQueue.resolved')}`, variant: 'secondary' },
    { label: `${reviewStatusSummary.cancelled} ${t('overview.status.reviewQueue.cancelled')}`, variant: 'outline' },
  ] as Array<{ label: string; variant: BadgeProps['variant'] }>), [reviewStatusSummary.cancelled, reviewStatusSummary.claimed, reviewStatusSummary.resolved, t])

  const outboxDeliveryChips = useMemo(() => ([
    { label: `${outboxStatusSummary.pending} ${t('overview.status.outboxDelivery.pending')}`, variant: outboxStatusSummary.pending > 0 ? 'amber' : 'outline' },
    { label: `${outboxStatusSummary.sent} ${t('overview.status.outboxDelivery.sent')}`, variant: 'secondary' },
    { label: t('overview.status.outboxDelivery.sampleRows', { count: outboxSummary.data.length }), variant: 'outline' },
  ] as Array<{ label: string; variant: BadgeProps['variant'] }>), [outboxStatusSummary.pending, outboxStatusSummary.sent, outboxSummary.data.length, t])

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
          <OverviewHeaderActions refreshing={refreshing} onRefresh={refreshAll} />
        }
      />

      {/* ── KPI row ──────────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card className={cn('shadow-[0_20px_62px_rgba(35,94,138,0.12)]', shiftPriority.toneClass)}>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">
                  {t('overview.shiftPriority.title')}
                </p>
                <p className="text-2xl font-semibold tracking-tight">{shiftPriority.label}</p>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{shiftPriority.summary}</p>
              </div>
              <Badge variant={shiftPriority.badgeVariant} className="shrink-0">
                {t(`overview.pageStatus.${pageState}`)}
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={(overview?.laneAttentionCount ?? 0) > 0 ? 'amber' : 'outline'}>
                {t('overview.siteOverview.laneAttention', { count: overview?.laneAttentionCount ?? 0 })}
              </Badge>
              <Badge variant={reviewStatusSummary.open > 0 ? 'amber' : 'outline'}>
                {t('overview.shiftPriority.reviewOpen', { count: reviewStatusSummary.open })}
              </Badge>
              <Badge variant={outboxStatusSummary.failed > 0 ? 'destructive' : 'outline'}>
                {t('overview.shiftPriority.outboxFailed', { count: outboxStatusSummary.failed })}
              </Badge>
              <Badge variant={(overview?.offlineLaneCount ?? 0) > 0 ? 'destructive' : 'outline'}>
                {t('overview.shiftPriority.devicesOffline', { count: overview?.offlineLaneCount ?? 0 })}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_20px_62px_rgba(35,94,138,0.12)]">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{t('overview.summary.sitesInScope', { count: effectiveSiteRows.length })}</Badge>
              <Badge variant={(overview?.laneAttentionCount ?? 0) > 0 ? 'amber' : 'outline'}>
                {t('overview.kpi.laneAttention.title')}
              </Badge>
              <Badge variant={(outboxStatusSummary.failed ?? 0) > 0 ? 'destructive' : 'outline'}>
                {t('overview.status.outboxDelivery.title')}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{t('overview.summary.lastRefresh')}</p>
                <p className="mt-2 text-sm font-medium text-foreground">{formatDateTime(refreshedAt, locale, dash)}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{t('overview.summary.staleness')}</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {typeof staleMinutes === 'number' && staleMinutes > 0
                    ? t('overview.summary.minutesBehind', { count: staleMinutes })
                    : t('overview.summary.currentSnapshot')}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{t('overview.summary.openSessions')}</p>
                <p className="mt-2 text-sm font-medium text-foreground">{t('overview.summary.activeSessions', { count: overview?.openSessionCount ?? 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        <div className="sm:col-span-2 xl:col-span-2">
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
        </div>
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
            helper={dashboard.error ? dash : t('overview.kpi.occupancy.helper', { occupied: dashboardData?.occupancy.occupiedTotal ?? 0, total: dashboardData?.occupancy.totalSpots ?? 0 })}
            icon={DatabaseZap}
            tone="default"
            loading={dashboard.loading}
          />
        </Link>
        <Link to="/subscriptions?status=ACTIVE" className="block">
          <KpiCard
            title={t('overview.kpi.subscriptions.title')}
            value={dashboard.loading ? '…' : String(overview?.activeSubscriptionCount ?? 0)}
            helper={dashboard.error ? dash : t('overview.kpi.subscriptions.helper', { expiring: overview?.expiringSubscriptionCount ?? 0 })}
            icon={TimerReset}
            tone={(overview?.expiringSubscriptionCount ?? 0) > 0 ? 'warning' : 'default'}
            loading={dashboard.loading}
          />
        </Link>
        <KpiCard
          title={t('overview.kpi.activePresence.title')}
          value={dashboard.loading ? '…' : String(overview?.activePresenceCount ?? 0)}
          helper={dashboard.error ? dash : t('overview.kpi.activePresence.helper')}
          icon={ArrowRightLeft}
          tone={(overview?.activePresenceCount ?? 0) > 0 ? 'default' : 'success'}
          loading={dashboard.loading}
        />
        <KpiCard
          title={t('overview.kpi.openSessions.title')}
          value={dashboard.loading ? '…' : String(overview?.openSessionCount ?? 0)}
          helper={dashboard.error ? dash : t('overview.kpi.openSessions.helper')}
          icon={GitBranch}
          tone={(overview?.openSessionCount ?? 0) > 0 ? 'warning' : 'default'}
          loading={dashboard.loading}
        />
      </div>

      {/* ── Topology infrastructure summary ───────────────────────── */}
      {!dashboard.loading && topologySummary ? (
        <CollapsibleCard
          title={t('overview.topology.title')}
          description={t('overview.topology.sites', { count: topologySummary.siteCount })}
          defaultOpen={false}
          count={topologySummary.siteCount}
          countVariant="success"
          icon={<Layers className="h-4 w-4" />}
          className="border-border/80 bg-card/95 shadow-[0_18px_56px_rgba(35,94,138,0.1)]"
          contentClassName="pt-0"
          renderContent={() => (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs font-mono-data">
                {t('overview.topology.sites', { count: topologySummary.siteCount })}
              </Badge>
              <Badge variant="outline" className="text-xs font-mono-data">
                {topologySummary.totalZones}z
              </Badge>
              <Badge variant="outline" className="text-xs font-mono-data">
                {topologySummary.totalGates}g
              </Badge>
              <Badge variant="outline" className="text-xs font-mono-data">
                {topologySummary.totalLanes}l
              </Badge>
              <Badge variant="outline" className="text-xs font-mono-data">
                {topologySummary.totalDevices}d
              </Badge>
              {topologySummary.allVehicleTypes.length > 0 ? (
                <Badge variant="outline" className="text-xs font-mono-data">
                  {topologySummary.allVehicleTypes.join('+')}
                </Badge>
              ) : null}
              {topologySummary.allZoneNames.length > 0 ? (
                <Badge variant="outline" className="text-xs">
                  {topologySummary.allZoneNames.slice(0, 4).join(', ')}
                  {topologySummary.allZoneNames.length > 4 ? ` +${topologySummary.allZoneNames.length - 4}` : ''}
                </Badge>
              ) : null}
            </div>
          )}
        />
      ) : null}

      {/* ── Operational status row ─────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <OverviewLanePressureCard
          fallbackAttention={dashboardData?.lanes.attentionCount ?? 0}
          fallbackTotal={dashboardData?.lanes.totalLanes ?? 0}
          fallbackOffline={dashboardData?.lanes.offlineCount ?? 0}
          fallbackBarrierFault={dashboardData?.lanes.barrierFaultCount ?? 0}
          fallbackOpenSessions={dashboardData?.lanes.openSessionCount ?? 0}
          loading={dashboard.loading}
        />

        <OperationalStatusCard
          title={t('overview.status.reviewQueue.title')}
          value={queueSummary.loading ? '…' : String(reviewStatusSummary.open)}
          helper={queueSummary.error ? queueSummary.error : reviewStatusSummary.open > 0 ? t('overview.status.reviewQueue.helperHasItems') : t('overview.status.reviewQueue.helperEmpty')}
          icon={ClipboardCheck}
          status={queueSummary.error ? 'unavailable' : reviewStatusSummary.open > 0 ? 'attention' : queueSummary.loading ? 'degraded' : 'ready'}
          chips={reviewQueueChips}
          loading={queueSummary.loading}
        />

        <OperationalStatusCard
          title={t('overview.status.outboxDelivery.title')}
          value={outboxSummary.loading ? '…' : String(outboxStatusSummary.failed)}
          helper={outboxSummary.error ? outboxSummary.error : outboxStatusSummary.failed > 0 ? t('overview.status.outboxDelivery.helperHasItems') : t('overview.status.outboxDelivery.helperEmpty')}
          icon={RadioTower}
          status={outboxSummary.error ? 'unavailable' : outboxStatusSummary.failed > 0 ? 'attention' : outboxStatusSummary.pending > 0 ? 'degraded' : 'ready'}
          chips={outboxDeliveryChips}
          loading={outboxSummary.loading}
        />

        <OverviewDeviceHealthCard />
      </div>

      {/* ── Quick actions ─────────────────────────────────────── */}
      <QuickActionsCard
        actions={QUICK_ACTIONS}
        title={t('overview.quickActions.title')}
        description={t('overview.quickActions.description')}
        defaultOpen={false}
      />

      {/* ── Site overview + Live watchlist ─────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SiteAttentionTable
          rows={effectiveSiteRows}
          loading={dashboard.loading}
          error={dashboard.error}
          selectedSiteCode={selectedSiteCode}
          onSelectSite={setSelectedSiteCode}
          defaultOpen={true}
        />

        <LiveWatchlistPanel
          selectedSiteCode={selectedSiteCode}
          dash={dash}
        />
      </div>

      {/* ── Recent sessions + Dependency status ───────────────── */}
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <RecentSessionsPanel
          loading={recentSessions.loading}
          error={recentSessions.error}
          sessions={recentSessions.data}
        />

        <DependencyStatusPanel
          dashboardError={dashboard.error}
          dashboardLoading={dashboard.loading}
          sinceHours={dashboardData?.filters.sinceHours ?? '?'}
          expiringInDays={dashboardData?.filters.expiringInDays ?? '?'}
          recentSessionsError={recentSessions.error}
          recentSessionsLoading={recentSessions.loading}
          recentSessionCount={recentSessions.data.length}
          queueError={queueSummary.error}
          queueLoading={queueSummary.loading}
          reviewOpen={reviewStatusSummary.open}
          reviewClaimed={reviewStatusSummary.claimed}
          outboxError={outboxSummary.error}
          outboxLoading={outboxSummary.loading}
          outboxFailed={outboxStatusSummary.failed}
          outboxPending={outboxStatusSummary.pending}
        />
      </div>
    </div>
  )
}
