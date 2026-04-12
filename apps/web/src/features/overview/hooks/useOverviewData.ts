import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDashboardSummary } from '@/lib/api/dashboard'
import { getOutboxItems } from '@/lib/api/outbox'
import { getReviewQueue } from '@/lib/api/reviews'
import { getSessions } from '@/lib/api/sessions'
import { getSites } from '@/lib/api/topology'
import type { DashboardSiteOverviewRow, DashboardSummaryDocument } from '@/lib/contracts/dashboard'
import type { SelectOption } from '@/components/ui/select'
import type { OutboxListItem, ReviewQueueItem, SessionSummary } from '@/lib/api'

type AsyncSection<T> = {
  loading: boolean
  error: string
  data: T
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function makeSection<T>(data: T): AsyncSection<T> {
  return {
    loading: false,
    error: '',
    data,
  }
}

function makeLoadingSection<T>(data: T): AsyncSection<T> {
  return {
    loading: true,
    error: '',
    data,
  }
}

export function useOverviewData() {
  const [selectedSiteCode, setSelectedSiteCode] = useState('')
  const [siteOptions, setSiteOptions] = useState<SelectOption[]>([
    {
      value: '',
      label: 'All accessible sites',
      description: 'All sites within the current role scope.',
      badge: 'scope',
      badgeVariant: 'neutral',
    },
  ])
  const [dashboard, setDashboard] = useState<AsyncSection<DashboardSummaryDocument | null>>(makeLoadingSection(null))
  const [recentSessions, setRecentSessions] = useState<AsyncSection<SessionSummary[]>>(makeLoadingSection([]))
  const [queueSummary, setQueueSummary] = useState<AsyncSection<ReviewQueueItem[]>>(makeLoadingSection([]))
  const [outboxSummary, setOutboxSummary] = useState<AsyncSection<OutboxListItem[]>>(makeLoadingSection([]))
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadOverviewData = useCallback(async () => {
    setRefreshing(true)
    setDashboard((current) => ({ ...current, loading: true, error: '' }))
    setRecentSessions((current) => ({ ...current, loading: true, error: '' }))
    setQueueSummary((current) => ({ ...current, loading: true, error: '' }))
    setOutboxSummary((current) => ({ ...current, loading: true, error: '' }))

    const siteCode = selectedSiteCode || undefined
    const [sitesResult, dashboardResult, sessionsResult, queueResult, outboxResult] = await Promise.allSettled([
      getSites(),
      getDashboardSummary({ siteCode, sinceHours: 24, expiringInDays: 7 }),
      getSessions({ siteCode, limit: 8 }),
      getReviewQueue({ siteCode, limit: 12 }),
      getOutboxItems({ siteCode, limit: 12 }),
    ])

    if (sitesResult.status === 'fulfilled') {
      const options: SelectOption[] = [
        {
          value: '',
          label: 'All accessible sites',
          description: `Showing merged data for ${sitesResult.value.rows.length} sites in scope.`,
          badge: 'scope',
          badgeVariant: 'neutral',
        },
        ...sitesResult.value.rows.map((site): SelectOption => ({
          value: site.siteCode,
          label: site.siteCode,
          description: `${site.name} · ${site.timezone}`,
          badge: site.isActive ? 'active' : 'inactive',
          badgeVariant: site.isActive ? 'success' : 'warning',
        })),
      ]
      setSiteOptions(options)

      if (selectedSiteCode && !sitesResult.value.rows.some((row) => row.siteCode === selectedSiteCode)) {
        setSelectedSiteCode('')
      }
    }

    if (dashboardResult.status === 'fulfilled') {
      setDashboard(makeSection(dashboardResult.value))
    } else {
      setDashboard({
        loading: false,
        error: toMessage(dashboardResult.reason),
        data: null,
      })
    }

    if (sessionsResult.status === 'fulfilled') {
      setRecentSessions(makeSection(sessionsResult.value.rows))
    } else {
      setRecentSessions({
        loading: false,
        error: toMessage(sessionsResult.reason),
        data: [],
      })
    }

    if (queueResult.status === 'fulfilled') {
      setQueueSummary(makeSection(queueResult.value.rows))
    } else {
      setQueueSummary({
        loading: false,
        error: toMessage(queueResult.reason),
        data: [],
      })
    }

    if (outboxResult.status === 'fulfilled') {
      setOutboxSummary(makeSection(outboxResult.value.rows))
    } else {
      setOutboxSummary({
        loading: false,
        error: toMessage(outboxResult.reason),
        data: [],
      })
    }

    setRefreshing(false)
    setRefreshedAt(new Date().toISOString())
  }, [selectedSiteCode])

  useEffect(() => {
    void loadOverviewData()
  }, [loadOverviewData])

  const reviewStatusSummary = useMemo(() => ({
    open: queueSummary.data.filter((row) => row.status === 'OPEN').length,
    claimed: queueSummary.data.filter((row) => row.status === 'CLAIMED').length,
    resolved: queueSummary.data.filter((row) => row.status === 'RESOLVED').length,
    cancelled: queueSummary.data.filter((row) => row.status === 'CANCELLED').length,
  }), [queueSummary.data])

  const outboxStatusSummary = useMemo(() => ({
    pending: outboxSummary.data.filter((row) => row.status === 'PENDING' || row.status === 'RETRYING').length,
    failed: outboxSummary.data.filter((row) => row.status === 'FAILED' || row.status === 'TIMEOUT' || row.status === 'NACKED').length,
    sent: outboxSummary.data.filter((row) => row.status === 'SENT' || row.status === 'ACKED').length,
  }), [outboxSummary.data])

  const staleMinutes = useMemo(() => {
    const generatedAt = dashboard.data?.generatedAt
    if (!generatedAt) return null
    const generated = new Date(generatedAt).getTime()
    if (!Number.isFinite(generated)) return null
    return Math.max(0, Math.floor((Date.now() - generated) / 60000))
  }, [dashboard.data?.generatedAt])

  const dashboardSiteRows = useMemo(() => {
    const rows = dashboard.data?.sites ?? []
    return [...rows].sort((a, b) => {
      const attentionDelta = (b.offlineLaneCount + b.criticalIncidentsOpenCount + b.laneAttentionCount + b.incidentsOpenCount) - (a.offlineLaneCount + a.criticalIncidentsOpenCount + a.laneAttentionCount + a.incidentsOpenCount)
      if (attentionDelta !== 0) return attentionDelta
      return b.openSessionCount - a.openSessionCount || a.siteCode.localeCompare(b.siteCode)
    })
  }, [dashboard.data?.sites])

  const effectiveSiteRows = useMemo<DashboardSiteOverviewRow[]>(() => {
    if (!selectedSiteCode) return dashboardSiteRows
    return dashboardSiteRows.filter((row) => row.siteCode === selectedSiteCode)
  }, [dashboardSiteRows, selectedSiteCode])

  const dependencyErrors = [dashboard.error, recentSessions.error, queueSummary.error, outboxSummary.error].filter(Boolean)
  const pageState = useMemo<'ready' | 'attention' | 'degraded' | 'unavailable'>(() => {
    const allHttpUnavailable = Boolean(dashboard.error && recentSessions.error && queueSummary.error && outboxSummary.error)
    if (allHttpUnavailable) return 'unavailable'
    if (dependencyErrors.length > 0) return 'degraded'
    if (
      (dashboard.data?.overview.laneAttentionCount ?? 0) > 0
      || reviewStatusSummary.open > 0
      || outboxStatusSummary.failed > 0
    ) {
      return 'attention'
    }
    return 'ready'
  }, [dashboard.data?.overview.laneAttentionCount, dashboard.error, dependencyErrors.length, outboxStatusSummary.failed, outboxSummary.error, queueSummary.error, recentSessions.error, reviewStatusSummary.open])

  return {
    selectedSiteCode,
    setSelectedSiteCode,
    siteOptions,
    dashboard,
    recentSessions,
    queueSummary,
    outboxSummary,
    reviewStatusSummary,
    outboxStatusSummary,
    dashboardSiteRows,
    effectiveSiteRows,
    staleMinutes,
    pageState,
    refreshedAt,
    refreshing,
    refreshAll: loadOverviewData,
  }
}
