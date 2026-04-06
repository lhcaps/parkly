import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Activity, AlertTriangle, BarChart3, CalendarRange, ExternalLink, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ValidationSummary } from '@/components/forms/validation-summary'
import { PageHeader } from '@/components/ops/console'
import { PageStateRenderer, StateBanner } from '@/components/state/page-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, type SelectOption } from '@/components/ui/select'
import { getReportsSummary, getSites, type ReportsSummaryRes, type SiteRow } from '@/lib/api'
import { getDashboardSummary } from '@/lib/api/dashboard'
import { extractValidationFieldErrors } from '@/lib/http/errors'
import { buildSearchParams, readNumberSearchParam, readTrimmedSearchParam, syncSearchParams } from '@/lib/router/url-state'
import { cn } from '@/lib/utils'

const REPORT_DAY_VALUES = [1, 3, 7, 14, 30] as const

type DashboardSummary = Awaited<ReturnType<typeof getDashboardSummary>>
type Translate = ReturnType<typeof useTranslation>['t']

function Metric({
  label,
  value,
  helper,
  positive = false,
  negative = false,
}: {
  label: string
  value: string | number
  helper: string
  positive?: boolean
  negative?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-[11px] font-mono-data uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={cn('mt-2 font-mono-data text-3xl font-semibold', positive && 'text-success', negative && 'text-destructive')}>{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

function buildSiteOptions(sites: SiteRow[], t: Translate): SelectOption[] {
  return sites.map<SelectOption>((site) => ({
    value: site.siteCode,
    label: site.siteCode,
    description: site.name,
    badge: site.isActive ? t('reportsPage.siteOptions.active') : t('reportsPage.siteOptions.off'),
    badgeVariant: site.isActive ? 'success' : 'neutral',
  }))
}

function buildDayOptions(t: Translate): SelectOption[] {
  return REPORT_DAY_VALUES.map<SelectOption>((n) => ({
    value: String(n),
    label: t('reportsPage.days.label', { count: n }),
    description: t('reportsPage.days.description', { count: n }),
    badge: t('reportsPage.days.badge', { count: n }),
    badgeVariant: 'neutral',
  }))
}

function parseReportsSearchParams(searchParams: URLSearchParams) {
  return {
    siteCode: readTrimmedSearchParam(searchParams, 'siteCode'),
    days: readNumberSearchParam(searchParams, 'days', { fallback: 7, allowed: REPORT_DAY_VALUES }),
  }
}

export function ReportsPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const routeState = useMemo(() => parseReportsSearchParams(searchParams), [searchParams])
  const dash = t('common.dash')

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
        const nextSiteCode =
          routeState.siteCode && siteRes.rows.some((site) => site.siteCode === routeState.siteCode)
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
  const validationItems = useMemo(
    () => extractValidationFieldErrors(error instanceof Error ? (error as any).details : undefined),
    [error],
  )
  const dayOptions = useMemo(() => buildDayOptions(t), [t])

  const statusLabel = summary
    ? t('reportsPage.states.ready')
    : loading
      ? t('reportsPage.states.loading')
      : error
        ? t('reportsPage.states.degraded')
        : t('reportsPage.states.empty')

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        eyebrow={t('reportsPage.eyebrow')}
        title={t('reportsPage.title')}
        description={t('reportsPage.description')}
        badges={[
          { label: t('reportsPage.badges.site', { value: siteCode || dash }), variant: 'outline' },
          { label: `${days}d`, variant: 'secondary' },
          { label: statusLabel, variant: summary ? 'secondary' : error ? 'destructive' : 'outline' },
        ]}
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading || !siteCode}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            {t('reportsPage.actions.refresh')}
          </Button>
        }
      />

      <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{t('reportsPage.badges.sitePending', { value: siteCode || dash })}</Badge>
            <Badge variant="secondary">{t('reportsPage.badges.window', { count: days })}</Badge>
            <Badge variant={summary ? 'secondary' : error ? 'destructive' : 'outline'}>
              {summary ? t('reportsPage.states.summaryReady') : error ? t('reportsPage.states.degraded') : t('reportsPage.states.awaitingLoad')}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(280px,1fr)_220px_minmax(220px,0.8fr)_auto]">
            <Select value={siteCode} onChange={setSiteCode} options={buildSiteOptions(sites, t)} disabled={loading} />
            <Select
              value={String(days)}
              onChange={(value) =>
                setDays(
                  readNumberSearchParam(new URLSearchParams(`days=${value}`), 'days', {
                    fallback: 7,
                    allowed: REPORT_DAY_VALUES,
                  }),
                )
              }
              options={dayOptions}
              disabled={loading}
            />
            <div className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3">
              <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{t('reportsPage.operatorNote.title')}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t('reportsPage.operatorNote.description')}</p>
            </div>
            <Button onClick={() => void load(siteCode, days)} disabled={loading || !siteCode} className="h-11 px-5">
              <BarChart3 className="h-4 w-4" />
              {t('reportsPage.actions.load')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ValidationSummary items={validationItems} />
      {error ? <StateBanner error={error} onRetry={() => void load(siteCode, days)} /> : null}

      <PageStateRenderer
        loading={loading && !summary}
        error={error && !summary ? error : null}
        empty={!loading && !error && !summary}
        emptyTitle={t('reportsPage.empty.title')}
        emptyDescription={t('reportsPage.empty.description')}
        onRetry={() => void load(siteCode, days)}
      >
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Metric label={t('reportsPage.metrics.site.label')} value={summary?.siteCode || dash} helper={t('reportsPage.metrics.site.helper')} />
            <Metric label={t('reportsPage.metrics.window.label')} value={summary ? `${summary.days}d` : dash} helper={t('reportsPage.metrics.window.helper')} />
            <Metric label={t('reportsPage.metrics.total.label')} value={summary?.total || 0} helper={t('reportsPage.metrics.total.helper')} positive={Boolean(summary && summary.total > 0)} />
            <Metric label={t('reportsPage.metrics.entryExit.label')} value={summary ? `${entryShare}% / ${exitShare}%` : dash} helper={t('reportsPage.metrics.entryExit.helper')} />
          </div>

          {dashboard ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    {t('reportsPage.panels.incidents.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono-data text-2xl font-semibold">{dashboard.incidents.openCount}</span>
                    <span className="text-xs text-muted-foreground">{t('reportsPage.panels.incidents.open')}</span>
                  </div>
                  {dashboard.incidents.criticalOpenCount > 0 ? (
                    <Badge variant="destructive" className="mt-2">
                      {t('reportsPage.panels.incidents.critical', { count: dashboard.incidents.criticalOpenCount })}
                    </Badge>
                  ) : null}
                  <a
                    href={`/review-queue?siteCode=${siteCode}&status=OPEN`}
                    className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {t('reportsPage.panels.incidents.link')} <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4 text-success" />
                    {t('reportsPage.panels.lanes.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono-data text-2xl font-semibold">{dashboard.lanes.totalLanes}</span>
                    <span className="text-xs text-muted-foreground">{t('reportsPage.panels.lanes.total')}</span>
                  </div>
                  <div className="mt-2 flex gap-3 text-xs">
                    {dashboard.lanes.attentionCount > 0 ? (
                      <span className="text-amber-600">{t('reportsPage.panels.lanes.attention', { count: dashboard.lanes.attentionCount })}</span>
                    ) : null}
                    {dashboard.lanes.offlineCount > 0 ? (
                      <span className="text-destructive">{t('reportsPage.panels.lanes.offline', { count: dashboard.lanes.offlineCount })}</span>
                    ) : null}
                  </div>
                  <a
                    href={`/lane-monitor?siteCode=${siteCode}`}
                    className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {t('reportsPage.panels.lanes.link')} <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    {t('reportsPage.panels.subscriptions.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono-data text-2xl font-semibold">{dashboard.subscriptions.activeCount}</span>
                    <span className="text-xs text-muted-foreground">{t('reportsPage.panels.subscriptions.active')}</span>
                  </div>
                  {dashboard.subscriptions.expiringSoonCount > 0 ? (
                    <Badge variant="amber" className="mt-2">
                      {t('reportsPage.panels.subscriptions.expiringSoon', { count: dashboard.subscriptions.expiringSoonCount })}
                    </Badge>
                  ) : null}
                  <a
                    href={`/subscriptions?siteCode=${siteCode}`}
                    className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {t('reportsPage.panels.subscriptions.link')} <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle>{t('reportsPage.breakdown.title')}</CardTitle>
                <CardDescription>{t('reportsPage.breakdown.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-success/20 bg-success/6 px-5 py-5">
                    <div className="flex items-center gap-2 text-success">
                      <TrendingUp className="h-4 w-4" />
                      <p className="text-sm font-semibold">{t('reportsPage.breakdown.entry.title')}</p>
                    </div>
                    <p className="mt-3 font-mono-data text-4xl font-semibold">{summary?.entry || 0}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{t('reportsPage.breakdown.entry.description')}</p>
                  </div>

                  <div className="rounded-xl border border-destructive/20 bg-destructive/6 px-5 py-5">
                    <div className="flex items-center gap-2 text-destructive">
                      <TrendingDown className="h-4 w-4" />
                      <p className="text-sm font-semibold">{t('reportsPage.breakdown.exit.title')}</p>
                    </div>
                    <p className="mt-3 font-mono-data text-4xl font-semibold">{summary?.exit || 0}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{t('reportsPage.breakdown.exit.description')}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 px-4 py-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-muted-foreground" />
                    <p className="text-[11px] font-mono-data uppercase tracking-widest text-muted-foreground">{t('reportsPage.notes.title')}</p>
                  </div>
                  <ul className="space-y-2 text-sm text-foreground/85">
                    <li>{t('reportsPage.notes.items.groupByDirection')}</li>
                    <li>{t('reportsPage.notes.items.noGateLaneBreakdown')}</li>
                    <li>{t('reportsPage.notes.items.dependencyVsEmpty')}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('reportsPage.quickFacts.title')}</CardTitle>
                <CardDescription>{t('reportsPage.quickFacts.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-foreground/85">
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <Badge variant="secondary">{summary?.siteCode || siteCode || dash}</Badge>
                  <p className="mt-2 text-xs text-muted-foreground">{t('reportsPage.quickFacts.site')}</p>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <Badge variant="outline">
                    {summary
                      ? t('reportsPage.days.label', { count: summary.days })
                      : t('reportsPage.days.label', { count: days })}
                  </Badge>
                  <p className="mt-2 text-xs text-muted-foreground">{t('reportsPage.quickFacts.window')}</p>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <Badge variant="entry">{t('reportsPage.breakdown.entry.title')} {summary?.entry || 0}</Badge>
                  <Badge variant="exit" className="ml-2">{t('reportsPage.breakdown.exit.title')} {summary?.exit || 0}</Badge>
                  <p className="mt-2 text-xs text-muted-foreground">{t('reportsPage.quickFacts.analytics')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      </PageStateRenderer>
    </div>
  )
}
