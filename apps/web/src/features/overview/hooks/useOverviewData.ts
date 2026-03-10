import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSseSnapshot } from '@/features/_shared/use-sse-snapshot'
import { getOutboxItems } from '@/lib/api/outbox'
import { getReviewQueue } from '@/lib/api/reviews'
import { getSessions } from '@/lib/api/sessions'
import { getReportsSummary, getSites } from '@/lib/api/topology'
import { makeSseUrl, type DeviceHealthSnapshot, type OutboxListItem, type ReviewQueueItem, type SessionSummary } from '@/lib/api'

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

export function useOverviewData() {
  const [siteCode, setSiteCode] = useState('')
  const [reports, setReports] = useState<AsyncSection<{ entry: number; exit: number; total: number } | null>>({
    loading: true,
    error: '',
    data: null,
  })
  const [recentSessions, setRecentSessions] = useState<AsyncSection<SessionSummary[]>>({
    loading: true,
    error: '',
    data: [],
  })
  const [queueSummary, setQueueSummary] = useState<AsyncSection<ReviewQueueItem[]>>({
    loading: true,
    error: '',
    data: [],
  })
  const [outboxSummary, setOutboxSummary] = useState<AsyncSection<OutboxListItem[]>>({
    loading: true,
    error: '',
    data: [],
  })
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)

  const { data: deviceHealthSnapshot, state: deviceHealthState } = useSseSnapshot<DeviceHealthSnapshot>({
    url: makeSseUrl('/api/stream/device-health'),
    eventName: 'device_health_snapshot',
  })

  const loadOverviewData = useCallback(async () => {
    setReports((current) => ({ ...current, loading: true, error: '' }))
    setRecentSessions((current) => ({ ...current, loading: true, error: '' }))
    setQueueSummary((current) => ({ ...current, loading: true, error: '' }))
    setOutboxSummary((current) => ({ ...current, loading: true, error: '' }))

    let nextSiteCode = ''

    try {
      const sites = await getSites()
      nextSiteCode = sites.rows[0]?.siteCode ?? ''
      setSiteCode(nextSiteCode)

      if (!nextSiteCode) {
        setReports({
          loading: false,
          error: 'Chưa có site nào để tính KPI 7 ngày.',
          data: null,
        })
      } else {
        try {
          const summary = await getReportsSummary(nextSiteCode, 7)
          setReports(makeSection({
            entry: summary.entry,
            exit: summary.exit,
            total: summary.total,
          }))
        } catch (error) {
          setReports({
            loading: false,
            error: toMessage(error),
            data: null,
          })
        }
      }
    } catch (error) {
      setSiteCode('')
      setReports({
        loading: false,
        error: `Không tải được site/reports summary: ${toMessage(error)}`,
        data: null,
      })
    }

    const [sessionsResult, queueResult, outboxResult] = await Promise.allSettled([
      getSessions({ limit: 6 }),
      getReviewQueue({ status: 'OPEN', limit: 8 }),
      getOutboxItems({ limit: 12 }),
    ])

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

    setRefreshedAt(new Date().toISOString())
  }, [])

  useEffect(() => {
    void loadOverviewData()
  }, [loadOverviewData])

  const deviceAlertSummary = useMemo(() => {
    const rows = deviceHealthSnapshot?.rows ?? []
    const deduped = new Map<string, typeof rows[number]>()

    for (const row of rows) {
      const key = [
        row.siteCode,
        row.gateCode ?? 'NA',
        row.laneCode ?? 'UNASSIGNED',
        row.deviceCode,
        row.deviceRole ?? row.deviceType ?? 'NA',
      ].join(':')

      if (!deduped.has(key)) deduped.set(key, row)
    }

    const normalized = Array.from(deduped.values())
    const offline = normalized.filter((row) => row.derivedHealth === 'OFFLINE').length
    const degraded = normalized.filter((row) => row.derivedHealth === 'DEGRADED').length
    const online = normalized.filter((row) => row.derivedHealth === 'ONLINE').length

    return {
      total: normalized.length,
      offline,
      degraded,
      online,
      attention: offline + degraded,
    }
  }, [deviceHealthSnapshot?.rows])

  const outboxFailedCount = useMemo(
    () => outboxSummary.data.filter((row) => row.status === 'FAILED' || row.status === 'TIMEOUT' || row.status === 'NACKED').length,
    [outboxSummary.data],
  )

  return {
    siteCode,
    reports,
    recentSessions,
    queueSummary,
    outboxSummary,
    deviceAlertSummary,
    deviceHealthState,
    outboxFailedCount,
    refreshedAt,
    refreshAll: loadOverviewData,
  }
}
