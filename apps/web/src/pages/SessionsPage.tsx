import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { SessionFilterBar } from '@/features/session-history/components/SessionFilterBar'
import { SessionMediaStrip } from '@/features/session-history/components/SessionMediaStrip'
import { SessionTimeline } from '@/features/session-history/components/SessionTimeline'
import { SessionDetailConsole } from '@/features/session-history/SessionDetailConsole'
import { collectSessionMedia } from '@/features/session-history/session-history-model'
import { getSessionDetail, getSessions } from '@/lib/api/sessions'
import { getMe } from '@/lib/api/system'
import { getLanes, getSites } from '@/lib/api/topology'
import type { Direction } from '@/lib/contracts/common'
import type { SessionDetail, SessionState, SessionSummary } from '@/lib/contracts/sessions'
import type { LaneRow, SiteRow } from '@/lib/contracts/topology'
import { formatDateTimeValue } from '@/i18n/format'
import { measureAsync } from '@/lib/query/perf'
import { useDebouncedValue } from '@/lib/query/use-debounced-value'
import { cn } from '@/lib/utils'

function sessionVariant(status: SessionState): 'secondary' | 'entry' | 'amber' | 'destructive' | 'muted' {
  if (status === 'APPROVED' || status === 'PASSED') return 'entry'
  if (status === 'WAITING_READ' || status === 'WAITING_DECISION' || status === 'WAITING_PAYMENT' || status === 'OPEN') return 'amber'
  if (status === 'DENIED' || status === 'ERROR') return 'destructive'
  return 'muted'
}

function QuickSummaryCard({ detail }: { detail: SessionDetail }) {
  const { t } = useTranslation()
  const session = detail.session
  const media = collectSessionMedia(detail)

  return (
    <CollapsibleSection title={t('sessionHistory.summary.title')} defaultOpen={true} className="mb-4">
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant={session.direction === 'ENTRY' ? 'entry' : 'exit'} className="px-2.5 py-1 text-xs">
          {session.direction}
        </Badge>
        <Badge variant={sessionVariant(session.status)} className="px-2.5 py-1 text-xs">
          {session.status}
        </Badge>
        {session.reviewRequired ? (
          <Badge variant="amber" className="px-2.5 py-1 text-xs">
            {t('sessionHistory.summary.reviewRequired')}
          </Badge>
        ) : null}
        {detail.incidents.some((item) => item.status === 'OPEN') ? (
          <Badge variant="destructive" className="px-2.5 py-1 text-xs">
            {t('sessionHistory.summary.incidentOpen')}
          </Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div className="space-y-2">
          <div>
            <p className="mb-1 text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70">
              {t('sessionHistory.summary.session')}
            </p>
            <p className="break-all text-sm font-semibold font-mono-data">{String(session.sessionId)}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70">
              {t('sessionHistory.summary.plate')}
            </p>
            <p className="text-sm font-semibold font-mono-data">{session.plateCompact || t('common.dash')}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70">
              {t('sessionHistory.summary.opened')}
            </p>
            <p className="text-sm font-mono-data">{formatDateTimeValue(session.openedAt)}</p>
          </div>
          {session.resolvedAt ? (
            <div>
              <p className="mb-1 text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70">
                {t('sessionHistory.summary.resolved')}
              </p>
              <p className="text-sm font-mono-data">{formatDateTimeValue(session.resolvedAt)}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div>
            <p className="mb-1 text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70">
              {t('sessionHistory.summary.location')}
            </p>
            <p className="text-sm font-semibold font-mono-data">
              {session.siteCode} / {session.gateCode} / {session.laneCode}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70">
              {t('sessionHistory.summary.rfid')}
            </p>
            <p className="text-sm font-mono-data">{session.rfidUid || t('common.dash')}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70">
              {t('sessionHistory.summary.counts')}
            </p>
            <p className="text-sm font-mono-data">
              {t('sessionHistory.summary.countsValue', {
                reads: session.readCount,
                decisions: session.decisionCount,
                barriers: session.barrierCommandCount,
              })}
            </p>
          </div>
          {session.ticketId ? (
            <div>
              <p className="mb-1 text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70">
                {t('sessionHistory.summary.ticket')}
              </p>
              <p className="text-sm font-mono-data">{session.ticketId}</p>
            </div>
          ) : null}
        </div>
      </div>

      {media.length > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
          <span className="text-xs font-mono-data text-muted-foreground">{t('sessionHistory.summary.evidence')}</span>
          <Badge variant="secondary" className="px-2.5 py-1 text-xs">
            {t('sessionHistory.summary.mediaCount', { count: media.length })}
          </Badge>
          <Button asChild variant="ghost" size="sm" className="ml-auto h-8 px-3 text-xs">
            <Link to={`/review-queue?siteCode=${encodeURIComponent(session.siteCode)}&q=${encodeURIComponent(String(session.sessionId))}`}>
              {t('route.reviewQueue.label')}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}
    </CollapsibleSection>
  )
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4 rounded-2xl border border-border/70 bg-card/80 p-6">
      <div className="flex gap-2">
        <div className="h-6 w-16 rounded-full bg-muted" />
        <div className="h-6 w-20 rounded-full bg-muted" />
        <div className="h-6 w-20 rounded-full bg-muted" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="flex justify-between gap-4">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="h-10 w-full rounded-xl bg-muted" />
      <div className="h-10 w-full rounded-xl bg-muted" />
    </div>
  )
}

function EmptyDetail({ rows, filtersActive }: { rows: number; filtersActive: boolean }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 py-20 text-center">
      <ClipboardList className="h-12 w-12 text-muted-foreground/40" />
      <p className="mt-4 text-base font-semibold text-foreground">{t('sessionHistory.empty.title')}</p>
      <p className="mt-2 max-w-[280px] text-sm text-muted-foreground/80">
        {filtersActive
          ? t(rows === 1 ? 'sessionHistory.empty.filteredOne' : 'sessionHistory.empty.filteredOther', { count: rows })
          : t('sessionHistory.empty.description')}
      </p>
    </div>
  )
}

export function SessionsPage() {
  const { t } = useTranslation()
  const [sites, setSites] = useState<SiteRow[]>([])
  const [lanes, setLanes] = useState<LaneRow[]>([])
  const [siteCode, setSiteCode] = useState('')
  const [laneCode, setLaneCode] = useState('')
  const [status, setStatus] = useState<SessionState | ''>('')
  const [direction, setDirection] = useState<Direction | ''>('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [role, setRole] = useState<string>('')

  const [rows, setRows] = useState<SessionSummary[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const detailRequestSeq = useRef(0)
  const refreshRequestSeq = useRef(0)
  const debouncedSearch = useDebouncedValue(search, 180)

  useEffect(() => {
    let active = true
    async function bootstrap() {
      try {
        const [siteRes, me] = await Promise.all([getSites(), getMe()])
        if (!active) return
        setSites(siteRes.rows)
        setSiteCode(siteRes.rows[0]?.siteCode || '')
        setRole(me.role)
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : String(loadError))
      }
    }

    void bootstrap()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    async function loadLanes() {
      if (!siteCode) {
        setLanes([])
        return
      }
      try {
        const laneRes = await getLanes(siteCode)
        if (!active) return
        setLanes(laneRes.rows)
        if (laneCode && !laneRes.rows.some((lane) => lane.laneCode === laneCode)) {
          setLaneCode('')
        }
      } catch {
        if (!active) return
        setLanes([])
      }
    }

    void loadLanes()
    return () => {
      active = false
    }
  }, [siteCode, laneCode])

  async function loadDetail(sessionId: string) {
    const requestSeq = ++detailRequestSeq.current
    try {
      setDetailLoading(true)
      setDetailError('')
      const nextDetail = await measureAsync('session-detail-open', () => getSessionDetail(sessionId), sessionId)
      if (requestSeq !== detailRequestSeq.current) return false
      setDetail(nextDetail)
      return true
    } catch (loadError) {
      if (requestSeq !== detailRequestSeq.current) return false
      setDetailError(loadError instanceof Error ? loadError.message : String(loadError))
      setDetail(null)
      return false
    } finally {
      if (requestSeq === detailRequestSeq.current) {
        setDetailLoading(false)
      }
    }
  }

  async function refresh(preferredId?: string) {
    const requestSeq = ++refreshRequestSeq.current
    try {
      setLoading(true)
      setError('')
      const data = await measureAsync(
        'sessions-refresh',
        () =>
          getSessions({
            siteCode: siteCode || undefined,
            laneCode: laneCode || undefined,
            status: status || undefined,
            direction: direction || undefined,
            from: from || undefined,
            to: to || undefined,
            limit: 100,
          }),
        [siteCode || 'all', laneCode || 'all', status || 'all', direction || 'all'].join(':'),
      )

      if (requestSeq !== refreshRequestSeq.current) return false
      setRows(data.rows)

      const nextSelectedId =
        preferredId && data.rows.some((row) => String(row.sessionId) === String(preferredId))
          ? String(preferredId)
          : data.rows[0]
            ? String(data.rows[0].sessionId)
            : ''

      setSelectedId(nextSelectedId)

      if (nextSelectedId) {
        const detailOk = await loadDetail(nextSelectedId)
        if (requestSeq !== refreshRequestSeq.current) return false
        return detailOk
      }

      setDetail(null)
      setDetailError('')
      return true
    } catch (loadError) {
      if (requestSeq !== refreshRequestSeq.current) return false
      setError(loadError instanceof Error ? loadError.message : String(loadError))
      setRows([])
      setDetail(null)
      return false
    } finally {
      if (requestSeq === refreshRequestSeq.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!siteCode) return
    void refresh(selectedId || undefined)
  }, [siteCode, laneCode, status, direction, from, to])

  const filteredRows = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase()
    if (!keyword) return rows
    return rows.filter((row) => {
      const haystack = [
        row.sessionId,
        row.siteCode,
        row.gateCode,
        row.laneCode,
        row.plateCompact || '',
        row.status,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(keyword)
    })
  }, [debouncedSearch, rows])

  const activeDetail = detail && String(detail.session.sessionId) === String(selectedId) ? detail : null
  const filtersActive = Boolean(siteCode || laneCode || status || direction || debouncedSearch || from || to)

  function resetFilters() {
    setLaneCode('')
    setStatus('')
    setDirection('')
    setSearch('')
    setFrom('')
    setTo('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('navGroup.Operations')}
        title={t('route.sessionHistory.label')}
        description={t('route.sessionHistory.description')}
        actions={
          <Button
            variant="outline"
            size="lg"
            onClick={() => void refresh(selectedId || undefined)}
            disabled={loading}
            className="h-11 gap-2 px-5"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
            {t('common.refresh')}
          </Button>
        }
      />

      <SessionFilterBar
        sites={sites}
        lanes={lanes}
        siteCode={siteCode}
        laneCode={laneCode}
        status={status}
        direction={direction}
        search={search}
        from={from}
        to={to}
        loading={loading}
        onSiteCodeChange={setSiteCode}
        onLaneCodeChange={setLaneCode}
        onStatusChange={setStatus}
        onDirectionChange={setDirection}
        onSearchChange={setSearch}
        onFromChange={setFrom}
        onToChange={setTo}
        onRefresh={() => void refresh(selectedId || undefined)}
        onReset={resetFilters}
      />

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[400px_1fr] xl:items-start">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-[0_12px_36px_rgba(35,94,138,0.12)]">
          <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-r from-primary/8 via-transparent to-transparent px-5 py-4">
            <div>
              <p className="text-base font-bold">{t('sessionHistory.list.title')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('sessionHistory.list.results', { count: filteredRows.length })}
                {filtersActive ? ` · ${t('sessionHistory.list.filtered')}` : ''}
              </p>
            </div>
            {filtersActive ? (
              <Badge variant="amber" className="shrink-0 px-2.5 py-1 text-xs">
                {t('sessionHistory.list.filtered')}
              </Badge>
            ) : null}
          </div>
          <SessionTableRows
            rows={filteredRows}
            selectedId={selectedId}
            loading={loading}
            error={error}
            onSelect={(sessionId) => {
              setSelectedId(sessionId)
              void loadDetail(sessionId)
            }}
          />
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start xl:space-y-0">
          {detailError ? (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="break-all">{detailError}</span>
            </div>
          ) : null}

          {detailLoading ? (
            <DetailSkeleton />
          ) : !activeDetail ? (
            <EmptyDetail rows={filteredRows.length} filtersActive={filtersActive} />
          ) : (
            <div className="space-y-0">
              <QuickSummaryCard detail={activeDetail} />
              <SessionDetailConsole
                detail={activeDetail}
                role={role as never}
                onUpdated={() => refresh(String(activeDetail.session.sessionId))}
              />
              <SessionTimeline detail={activeDetail} />
              {collectSessionMedia(activeDetail).length > 0 ? (
                <div className="mt-4">
                  <SessionMediaStrip detail={activeDetail} />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SessionTableRows({
  rows,
  selectedId,
  loading,
  error,
  onSelect,
}: {
  rows: SessionSummary[]
  selectedId: string
  loading: boolean
  error: string
  onSelect: (sessionId: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="p-4">
      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/80 px-5 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('sessionHistory.list.loading')}
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 px-5 py-16 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-base font-semibold text-foreground">{t('sessionHistory.list.emptyTitle')}</p>
          <p className="mt-2 text-sm text-muted-foreground/70">{t('sessionHistory.list.emptyDescription')}</p>
        </div>
      ) : (
        <div className="-mr-2 max-h-[720px] space-y-3 overflow-y-auto pr-2">
          {rows.map((row) => (
            <button
              key={String(row.sessionId)}
              onClick={() => onSelect(String(row.sessionId))}
              className={cn(
                'w-full rounded-2xl border-2 px-4 py-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 motion-reduce:transform-none',
                String(row.sessionId) === selectedId
                  ? 'border-primary/50 bg-primary/10 shadow-[0_16px_32px_hsl(var(--primary)/0.14)]'
                  : 'border-border/70 bg-background/40 hover:border-primary/30 hover:bg-muted/50 hover:shadow-md',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant={row.direction === 'ENTRY' ? 'entry' : 'exit'} className="px-2 py-0.5 text-xs">
                      {row.direction}
                    </Badge>
                    <Badge variant={sessionVariant(row.status)} className="px-2 py-0.5 text-xs">
                      {row.status}
                    </Badge>
                    {row.reviewRequired ? (
                      <Badge variant="amber" className="px-2 py-0.5 text-xs">
                        {t('sessionHistory.summary.reviewRequired')}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mb-1.5 font-mono-data text-sm font-bold">
                    {row.siteCode} / {row.gateCode} / {row.laneCode}
                  </p>
                  <p className="mb-1 font-mono-data text-xs text-muted-foreground">
                    {String(row.sessionId)}
                    {row.plateCompact ? ` · ${row.plateCompact}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium font-mono-data text-muted-foreground">
                    {formatDateTimeValue(row.openedAt, {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="mt-1 text-xs font-mono-data text-muted-foreground/70">
                    {t('sessionHistory.list.counts', { reads: row.readCount, decisions: row.decisionCount })}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
