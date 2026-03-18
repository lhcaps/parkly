import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, CalendarRange, ExternalLink, RefreshCw, TrendingDown, TrendingUp, AlertTriangle, Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, type SelectOption } from '@/components/ui/select'
import { PageHeader } from '@/components/ops/console'
import { PageStateRenderer, StateBanner } from '@/components/state/page-state'
import { ValidationSummary } from '@/components/forms/validation-summary'
import { getReportsSummary, getSites, type ReportsSummaryRes, type SiteRow } from '@/lib/api'
import { getDashboardSummary } from '@/lib/api/dashboard'
import { extractValidationFieldErrors } from '@/lib/http/errors'
import { buildSearchParams, readNumberSearchParam, readTrimmedSearchParam, syncSearchParams } from '@/lib/router/url-state'
import { cn } from '@/lib/utils'

const REPORT_DAY_VALUES = [1, 3, 7, 14, 30] as const

type DashboardSummary = Awaited<ReturnType<typeof getDashboardSummary>>

function Metric({ label, value, helper, positive = false, negative = false, href }: { label: string; value: string | number; helper: string; positive?: boolean; negative?: boolean; href?: string }) {
  const content = (
    <Card>
      <CardContent className="pt-4">
        <p className="text-[11px] font-mono-data uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={cn('mt-2 font-mono-data text-3xl font-semibold', positive && 'text-success', negative && 'text-destructive')}>{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
  
  if (href) {
    return (
      <a href={href} className="block transition-opacity hover:opacity-80">
        {content}
      </a>
    )
  }
  
  return content
}

function buildSiteOptions(sites: SiteRow[]): SelectOption[] {
  return sites.map<SelectOption>((site) => ({
    value: site.siteCode,
    label: site.siteCode,
    description: site.name,
    badge: site.isActive ? 'active' : 'off',
    badgeVariant: site.isActive ? 'success' : 'neutral',
  }))
}

const DAY_OPTIONS: SelectOption[] = REPORT_DAY_VALUES.map<SelectOption>((n) => ({
  value: String(n),
  label: `${n} days`,
  description: `Aggregation window ${n} days most recent`,
  badge: `${n}d`,
  badgeVariant: 'neutral',
}))

function parseReportsSearchParams(searchParams: URLSearchParams) {
  return {
    siteCode: readTrimmedSearchParam(searchParams, 'siteCode'),
    days: readNumberSearchParam(searchParams, 'days', { fallback: 7, allowed: REPORT_DAY_VALUES }),
  }
}

export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const routeState = useMemo(() => parseReportsSearchParams(searchParams), [searchParams])

  const [sites, setSites] = useState<SiteRow[]>([])
  const [siteCode, setSiteCode] = useState(routeState.siteCode)
  const [days, setDays] = useState(routeState.days)
  const [summary, setSummary] = useState<ReportsSummaryRes | null>(null)
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    setSiteCode(routeState.siteCode)
    setDays(routeState.days)
  }, [routeState])

  useEffect(() => {
    const next = buildSearchParams({ siteCode, days })
    syncSearchParams(searchParams, next, setSearchParams)
  }, [siteCode, days, searchParams, setSearchParams])

  async function load(nextSiteCode?: string, nextDays?: number) {
    try {
      setLoading(true)
      setError(null)
      const effectiveSiteCode = nextSiteCode || siteCode
      const effectiveDays = nextDays || days
      if (!effectiveSiteCode) {
        setSummary(null)
        setDashboard(null)
        return
      }
      const [summaryData, dashboardData] = await Promise.all([
        getReportsSummary(effectiveSiteCode, effectiveDays),
        getDashboardSummary({ siteCode: effectiveSiteCode }).catch(() => null),
      ])
      setSummary(summaryData)
      setDashboard(dashboardData)
    } catch (loadError) {
      setError(loadError)
      setSummary(null)
      setDashboard(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    async function bootstrap() {
      try {
        const siteRes = await getSites()
        if (!active) return
        setSites(siteRes.rows)
        const fallbackSiteCode = siteRes.rows[0]?.siteCode || ''
        const nextSiteCode = routeState.siteCode && siteRes.rows.some((site) => site.siteCode === routeState.siteCode)
          ? routeState.siteCode
          : fallbackSiteCode
        setSiteCode(nextSiteCode)
        if (nextSiteCode) await load(nextSiteCode, routeState.days)
        else setLoading(false)
      } catch (bootstrapError) {
        if (!active) return
        setError(bootstrapError)
        setLoading(false)
      }
    }
    void bootstrap()
    return () => {
      active = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!siteCode) return
    void load(siteCode, days)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode, days])

  const entryShare = summary?.total ? Math.round((summary.entry / summary.total) * 100) : 0
  const exitShare = summary?.total ? Math.round((summary.exit / summary.total) * 100) : 0
  const validationItems = useMemo(() => extractValidationFieldErrors(error instanceof Error ? (error as any).details : undefined), [error])

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        eyebrow="Monitoring"
        title="Reports"
        description="Summary is filtered by site and time window. The URL is stable for bookmarks and sharing.h route sâu và handoff giữa operator không bị rơi về default ngẫu nhiên."
        badges={[
          { label: siteCode ? `site ${siteCode}` : 'site —', variant: 'outline' },
          { label: `${days}d`, variant: 'secondary' },
          { label: summary ? 'ready' : loading ? 'loading' : error ? 'degraded' : 'empty', variant: summary ? 'secondary' : error ? 'destructive' : 'outline' },
        ]}
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading || !siteCode}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Report filters</CardTitle>
          <CardDescription>Summary is filtered by site code and number of days.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(280px,1fr)_220px_auto]">
          <Select value={siteCode} onChange={setSiteCode} options={buildSiteOptions(sites)} disabled={loading} />
          <Select value={String(days)} onChange={(value) => setDays(readNumberSearchParam(new URLSearchParams(`days=${value}`), 'days', { fallback: 7, allowed: REPORT_DAY_VALUES }))} options={DAY_OPTIONS} disabled={loading} />
          <Button onClick={() => void load(siteCode, days)} disabled={loading || !siteCode}>
            <BarChart3 className="h-4 w-4" />
            Load
          </Button>
        </CardContent>
      </Card>

      <ValidationSummary items={validationItems} />
      {error ? <StateBanner error={error} onRetry={() => void load(siteCode, days)} /> : null}

      <PageStateRenderer
        loading={loading && !summary}
        error={error && !summary ? error : null}
        empty={!loading && !error && !summary}
        emptyTitle="No summary available"
        emptyDescription="Select a valid site and load the summary. No data will show until the backend returns results for this site."
        onRetry={() => void load(siteCode, days)}
      >
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Metric label="Site" value={summary?.siteCode || '—'} helper="Site code" />
            <Metric label="Window" value={summary ? `${summary.days}d` : '—'} helper="Aggregation window" />
            <Metric label="Total" value={summary?.total || 0} helper="Total gate events" positive={Boolean(summary && summary.total > 0)} />
            <Metric label="Entry vs Exit" value={summary ? `${entryShare}% / ${exitShare}%` : '—'} helper="Entry vs exit split" />
          </div>

          {dashboard && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Incidents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono-data text-2xl font-semibold">{dashboard.incidents.openCount}</span>
                    <span className="text-xs text-muted-foreground">open</span>
                  </div>
                  {dashboard.incidents.criticalOpenCount > 0 && (
                    <Badge variant="destructive" className="mt-2">
                      {dashboard.incidents.criticalOpenCount} critical
                    </Badge>
                  )}
                  <a
                    href={`/review-queue?siteCode=${siteCode}&status=OPEN`}
                    className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View in Review Queue <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4 text-success" />
                    Lanes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono-data text-2xl font-semibold">{dashboard.lanes.totalLanes}</span>
                    <span className="text-xs text-muted-foreground">total</span>
                  </div>
                  <div className="mt-2 flex gap-3 text-xs">
                    {dashboard.lanes.attentionCount > 0 && (
                      <span className="text-amber-600">{dashboard.lanes.attentionCount} attention</span>
                    )}
                    {dashboard.lanes.offlineCount > 0 && (
                      <span className="text-destructive">{dashboard.lanes.offlineCount} offline</span>
                    )}
                  </div>
                  <a
                    href={`/lane-monitor?siteCode=${siteCode}`}
                    className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View Lane Monitor <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Subscriptions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono-data text-2xl font-semibold">{dashboard.subscriptions.activeCount}</span>
                    <span className="text-xs text-muted-foreground">active</span>
                  </div>
                  {dashboard.subscriptions.expiringSoonCount > 0 && (
                    <Badge variant="amber" className="mt-2">
                      {dashboard.subscriptions.expiringSoonCount} expiring soon
                    </Badge>
                  )}
                  <a
                    href={`/subscriptions?siteCode=${siteCode}`}
                    className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View Subscriptions <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Summary breakdown</CardTitle>
                <CardDescription>Showing data exactly as returned by the backend.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-success/20 bg-success/6 px-5 py-5">
                    <div className="flex items-center gap-2 text-success">
                      <TrendingUp className="h-4 w-4" />
                      <p className="text-sm font-semibold">ENTRY</p>
                    </div>
                    <p className="mt-3 font-mono-data text-4xl font-semibold">{summary?.entry || 0}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Vehicle entries in the report window.</p>
                  </div>
                  <div className="rounded-xl border border-destructive/20 bg-destructive/6 px-5 py-5">
                    <div className="flex items-center gap-2 text-destructive">
                      <TrendingDown className="h-4 w-4" />
                      <p className="text-sm font-semibold">EXIT</p>
                    </div>
                    <p className="mt-3 font-mono-data text-4xl font-semibold">{summary?.exit || 0}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Vehicle exits in the report window.</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 px-4 py-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-muted-foreground" />
                    <p className="text-[11px] font-mono-data uppercase tracking-widest text-muted-foreground">Data notes</p>
                  </div>
                  <ul className="space-y-2 text-sm text-foreground/85">
                    <li>The backend groups gate events by direction over the selected time window.</li>
                    <li>No breakdown by gate or lane in the current endpoint.</li>
                    <li>Dependency failures and empty data are distinguished so operators can tell the difference.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick facts</CardTitle>
                <CardDescription>Directly from current summary.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-foreground/85">
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <Badge variant="secondary">{summary?.siteCode || siteCode || '—'}</Badge>
                  <p className="mt-2 text-xs text-muted-foreground">Site being summarised.</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <Badge variant="outline">{summary ? `${summary.days} days` : `${days} days`}</Badge>
                  <p className="mt-2 text-xs text-muted-foreground">Time window for the report query.</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <Badge variant="entry">ENTRY {summary?.entry || 0}</Badge>
                  <Badge variant="exit" className="ml-2">EXIT {summary?.exit || 0}</Badge>
                  <p className="mt-2 text-xs text-muted-foreground">These two figures represent all analytics exposed by the current API.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      </PageStateRenderer>
    </div>
  )
}
