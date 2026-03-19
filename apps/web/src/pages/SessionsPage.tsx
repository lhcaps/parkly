import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { PageHeader } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { SessionFilterBar } from '@/features/session-history/components/SessionFilterBar'
import { SessionTimeline } from '@/features/session-history/components/SessionTimeline'
import { SessionDetailConsole } from '@/features/session-history/SessionDetailConsole'
import { SessionMediaStrip } from '@/features/session-history/components/SessionMediaStrip'
import { getSessions, getSessionDetail } from '@/lib/api/sessions'
import { getMe } from '@/lib/api/system'
import { getLanes, getSites } from '@/lib/api/topology'
import type { Direction } from '@/lib/contracts/common'
import type { SessionState, SessionSummary } from '@/lib/contracts/sessions'
import type { LaneRow, SiteRow } from '@/lib/contracts/topology'
import { toAppErrorDisplay } from '@/lib/http/errors'
import { measureAsync } from '@/lib/query/perf'
import { useDebouncedValue } from '@/lib/query/use-debounced-value'
import { cn } from '@/lib/utils'
import type { SessionDetail } from '@/lib/contracts/sessions'
import { Link } from 'react-router-dom'
import { collectSessionMedia } from '@/features/session-history/session-history-model'

function rid() {
  return `ui_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

function sessionVariant(status: SessionState): 'secondary' | 'entry' | 'amber' | 'destructive' | 'muted' {
  if (status === 'APPROVED' || status === 'PASSED') return 'entry'
  if (status === 'WAITING_READ' || status === 'WAITING_DECISION' || status === 'WAITING_PAYMENT' || status === 'OPEN') return 'amber'
  if (status === 'DENIED' || status === 'ERROR') return 'destructive'
  return 'muted'
}

function QuickSummaryCard({ detail }: { detail: SessionDetail }) {
  const s = detail.session
  const media = collectSessionMedia(detail)

  return (
    <CollapsibleSection title="Session summary" defaultOpen={true} className="mb-4">
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant={s.direction === 'ENTRY' ? 'entry' : 'exit'} className="text-xs px-2.5 py-1">{s.direction}</Badge>
        <Badge variant={sessionVariant(s.status)} className="text-xs px-2.5 py-1">{s.status}</Badge>
        {s.reviewRequired ? <Badge variant="amber" className="text-xs px-2.5 py-1">review</Badge> : null}
        {detail.incidents.some((i) => i.status === 'OPEN') ? <Badge variant="destructive" className="text-xs px-2.5 py-1">incident</Badge> : null}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div className="space-y-2">
          <div>
            <p className="text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70 mb-1">Session</p>
            <p className="text-sm font-semibold font-mono-data break-all">{String(s.sessionId)}</p>
          </div>
          <div>
            <p className="text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70 mb-1">Plate</p>
            <p className="text-sm font-semibold font-mono-data">{s.plateCompact || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70 mb-1">Opened</p>
            <p className="text-sm font-mono-data">{new Date(s.openedAt).toLocaleString('vi-VN')}</p>
          </div>
          {s.resolvedAt ? (
            <div>
              <p className="text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70 mb-1">Resolved</p>
              <p className="text-sm font-mono-data">{new Date(s.resolvedAt).toLocaleString('vi-VN')}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70 mb-1">Location</p>
            <p className="text-sm font-semibold font-mono-data">{s.siteCode} / {s.gateCode} / {s.laneCode}</p>
          </div>
          <div>
            <p className="text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70 mb-1">RFID</p>
            <p className="text-sm font-mono-data">{s.rfidUid || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70 mb-1">Counts</p>
            <p className="text-sm font-mono-data">{s.readCount}r · {s.decisionCount}d · {s.barrierCommandCount}b</p>
          </div>
          {s.ticketId ? (
            <div>
              <p className="text-xs font-mono-data uppercase tracking-widest text-muted-foreground/70 mb-1">Ticket</p>
              <p className="text-sm font-mono-data">{s.ticketId}</p>
            </div>
          ) : null}
        </div>
      </div>

      {media.length > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
          <span className="text-xs font-mono-data text-muted-foreground">Evidence</span>
          <Badge variant="secondary" className="text-xs px-2.5 py-1">{media.length} media</Badge>
          <Button asChild variant="ghost" size="sm" className="ml-auto h-8 px-3 text-xs">
            <Link to={`/review-queue?siteCode=${encodeURIComponent(s.siteCode)}&q=${encodeURIComponent(String(s.sessionId))}`}>
              Review Queue
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
    <div className="rounded-2xl border border-border/70 bg-card/80 p-6 space-y-4 animate-pulse">
      <div className="flex gap-2">
        <div className="h-6 w-16 rounded-full bg-muted" />
        <div className="h-6 w-20 rounded-full bg-muted" />
        <div className="h-6 w-18 rounded-full bg-muted" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between gap-4">
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
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 py-20 text-center">
      <ClipboardList className="h-12 w-12 text-muted-foreground/40" />
      <p className="mt-4 text-base font-semibold text-foreground">No session selected</p>
      <p className="mt-2 text-sm text-muted-foreground/80 max-w-[280px]">
        {filtersActive
          ? `${rows} session${rows !== 1 ? 's' : ''} match current filters — pick one to inspect`
          : 'Select a session from the list to view its details and run actions'}
      </p>
    </div>
  )
}

export function SessionsPage() {
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
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : String(e))
      }
    }
    void bootstrap()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    async function loadLanes() {
      if (!siteCode) { setLanes([]); return }
      try {
        const laneRes = await getLanes(siteCode)
        if (!active) return
        setLanes(laneRes.rows)
        if (laneCode && !laneRes.rows.some((l) => l.laneCode === laneCode)) setLaneCode('')
      } catch {
        if (!active) return
        setLanes([])
      }
    }
    void loadLanes()
    return () => { active = false }
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
    } catch (e) {
      if (requestSeq !== detailRequestSeq.current) return false
      setDetailError(e instanceof Error ? e.message : String(e))
      setDetail(null)
      return false
    } finally {
      if (requestSeq === detailRequestSeq.current) setDetailLoading(false)
    }
  }

  async function refresh(preferredId?: string) {
    const requestSeq = ++refreshRequestSeq.current
    try {
      setLoading(true)
      setError('')
      const data = await measureAsync('sessions-refresh', () => getSessions({
        siteCode: siteCode || undefined,
        laneCode: laneCode || undefined,
        status: status || undefined,
        direction: direction || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 100,
      }), [siteCode || 'all', laneCode || 'all', status || 'all', direction || 'all'].join(':'))

      if (requestSeq !== refreshRequestSeq.current) return false
      setRows(data.rows)

      const nextSelectedId =
        preferredId && data.rows.some((row) => String(row.sessionId) === String(preferredId))
          ? String(preferredId)
          : data.rows[0] ? String(data.rows[0].sessionId) : ''

      setSelectedId(nextSelectedId)

      if (nextSelectedId) {
        const detailOk = await loadDetail(nextSelectedId)
        if (requestSeq !== refreshRequestSeq.current) return false
        return detailOk
      }
      setDetail(null)
      setDetailError('')
      return true
    } catch (e) {
      if (requestSeq !== refreshRequestSeq.current) return false
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
      setDetail(null)
      return false
    } finally {
      if (requestSeq === refreshRequestSeq.current) setLoading(false)
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
      ].join(' ').toLowerCase()
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
        eyebrow="Operations"
        title="Session History"
        actions={
          <Button variant="outline" size="lg" onClick={() => void refresh(selectedId || undefined)} disabled={loading} className="h-11 px-5 gap-2">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
            Refresh
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

      {/* Error banner */}
      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[400px_1fr] xl:items-start">
        {/* Left: Session list */}
        <div className="rounded-2xl border border-border/70 bg-card/95 shadow-[0_8px_32px_rgba(0,0,0,0.10)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
            <div>
              <p className="text-base font-bold">Sessions</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filteredRows.length} result{filteredRows.length !== 1 ? 's' : ''}
                {filtersActive ? ' · filtered' : ''}
              </p>
            </div>
            {filtersActive && (
              <Badge variant="amber" className="text-xs px-2.5 py-1 shrink-0">filtered</Badge>
            )}
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

        {/* Right: Detail panel */}
        <div className="xl:sticky xl:top-20 xl:self-start xl:space-y-0">
          {/* Stale warning */}
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
  return (
    <div className="p-4">
      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/80 px-5 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 px-5 py-16 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-base font-semibold text-foreground">No sessions</p>
          <p className="mt-2 text-sm text-muted-foreground/70">Try widening the time range or removing filters.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[720px] overflow-y-auto pr-2 -mr-2">
          {rows.map((row) => (
            <button
              key={String(row.sessionId)}
              onClick={() => onSelect(String(row.sessionId))}
              className={cn(
                'w-full rounded-2xl border-2 px-4 py-4 text-left transition-all duration-200',
                String(row.sessionId) === selectedId
                  ? 'border-primary/50 bg-primary/10 shadow-lg shadow-primary/10'
                  : 'border-border/70 bg-background/40 hover:bg-muted/50 hover:border-primary/30 hover:shadow-md',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant={row.direction === 'ENTRY' ? 'entry' : 'exit'} className="text-xs px-2 py-0.5">
                      {row.direction}
                    </Badge>
                    <Badge variant={sessionVariant(row.status)} className="text-xs px-2 py-0.5">{row.status}</Badge>
                    {row.reviewRequired ? <Badge variant="amber" className="text-xs px-2 py-0.5">review</Badge> : null}
                  </div>
                  <p className="mb-1.5 font-mono-data text-sm font-bold">
                    {row.siteCode} / {row.gateCode} / {row.laneCode}
                  </p>
                  <p className="mb-1 text-xs text-muted-foreground font-mono-data">
                    {String(row.sessionId)}
                    {row.plateCompact ? ` · ${row.plateCompact}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-mono-data text-muted-foreground font-medium">
                    {new Date(row.openedAt).toLocaleString('vi-VN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="mt-1 text-xs font-mono-data text-muted-foreground/70">
                    {row.readCount}r · {row.decisionCount}d
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
