import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  DoorOpen,
  Loader2,
  RefreshCw,
  ShieldX,
} from 'lucide-react'
import { PageHeader, SurfaceState } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ReviewFilterBar, type ReviewStatus } from '@/features/review-queue/components/ReviewFilterBar'
import { ReviewTable } from '@/features/review-queue/components/ReviewTable'
import { isSessionTerminal } from '@/features/manual-control/session-action-access'
import { getSites } from '@/lib/api/topology'
import { getMe } from '@/lib/api/system'
import { getSessionDetail } from '@/lib/api/sessions'
import {
  claimReview,
  getReviewQueue,
  manualApproveSession,
  manualOpenBarrier,
  manualRejectSession,
} from '@/lib/api/reviews'
import type { ManualAuditPayload, ReviewQueueItem } from '@/lib/contracts/reviews'
import type { SessionDetail } from '@/lib/contracts/sessions'
import type { SiteRow } from '@/lib/contracts/topology'
import { measureAsync } from '@/lib/query/perf'

function rid() {
  return `ui_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function toMs(value: string) {
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : NaN
}

function reviewTime(row: ReviewQueueItem) {
  const raw = row as unknown as Record<string, unknown>
  return readString(raw.updatedAt) || readString(raw.createdAt) || readString(raw.claimedAt)
}

function reviewMatchesTime(row: ReviewQueueItem, from: string, to: string) {
  const value = reviewTime(row)
  if (!value) return true
  const current = toMs(value)
  if (!Number.isFinite(current)) return true
  const fromMs = from ? toMs(from) : NaN
  const toMsValue = to ? toMs(to) : NaN
  if (Number.isFinite(fromMs) && current < fromMs) return false
  if (Number.isFinite(toMsValue) && current > toMsValue) return false
  return true
}

function queueActionLabel(action: string) {
  if (action === 'MANUAL_APPROVE') return 'Approve'
  if (action === 'MANUAL_REJECT') return 'Reject'
  if (action === 'MANUAL_OPEN_BARRIER') return 'Open barrier'
  if (action === 'CLAIM') return 'Claim'
  return action
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="max-w-[68%] break-all text-right text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function ReviewQueuePage() {
  const [sites, setSites] = useState<SiteRow[]>([])
  const [siteCode, setSiteCode] = useState('')
  const [status, setStatus] = useState<ReviewStatus>('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [rows, setRows] = useState<ReviewQueueItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState('')
  const [error, setError] = useState('')
  const [operatorRole, setOperatorRole] = useState('')
  const [reasonCode, setReasonCode] = useState('MANUAL_OVERRIDE')
  const [note, setNote] = useState('Confirmed on-site at lane.')

  // Live session detail for the selected review — used to gate actions against real-time state
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const deferredSearch = useDeferredValue(search)
  const detailAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const [siteRes, me] = await Promise.all([getSites(), getMe()])
        if (!active) return
        setSites(siteRes.rows)
        setSiteCode(siteRes.rows[0]?.siteCode || '')
        setOperatorRole(me.role)
      } catch (bootstrapError) {
        if (!active) return
        setError(bootstrapError instanceof Error ? bootstrapError.message : String(bootstrapError))
      }
    }

    void bootstrap()
    return () => { active = false }
  }, [])

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const res = await measureAsync(
        'review-refresh',
        () => getReviewQueue({ siteCode: siteCode || undefined, status: status || undefined, from: from || undefined, to: to || undefined, limit: 100 }),
        [siteCode || 'all', status || 'all'].join(':'),
      )
      setRows(res.rows)
      if (!selectedId && res.rows[0]) setSelectedId(res.rows[0].reviewId)
      if (selectedId && !res.rows.some((row) => row.reviewId === selectedId)) {
        setSelectedId(res.rows[0]?.reviewId || '')
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  async function loadSessionDetail(sessionId: string) {
    if (detailAbortRef.current) detailAbortRef.current.abort()
    const ctrl = new AbortController()
    detailAbortRef.current = ctrl

    setDetailLoading(true)
    setDetailError('')
    setSessionDetail(null)

    try {
      const detail = await getSessionDetail(String(sessionId))
      if (ctrl.signal.aborted) return
      setSessionDetail(detail)
    } catch (err) {
      if (ctrl.signal.aborted) return
      setDetailError(err instanceof Error ? err.message : String(err))
    } finally {
      if (!ctrl.signal.aborted) setDetailLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [siteCode, status, from, to])

  const filteredRows = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase()
    return rows.filter((row) => {
      if (!reviewMatchesTime(row, from, to)) return false
      if (!keyword) return true
      const haystack = [
        row.reviewId, row.status, row.queueReasonCode,
        row.session.sessionId, row.session.siteCode, row.session.gateCode,
        row.session.laneCode, row.session.plateCompact || '',
      ].join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
  }, [deferredSearch, from, rows, to])

  const selected = useMemo(
    () => filteredRows.find((row) => row.reviewId === selectedId) || filteredRows[0] || null,
    [filteredRows, selectedId],
  )

  // Load live session detail whenever the selected review changes
  useEffect(() => {
    if (selected?.session.sessionId) {
      void loadSessionDetail(String(selected.session.sessionId))
    } else {
      setSessionDetail(null)
      setDetailLoading(false)
    }
  }, [selected?.reviewId])

  // Effective live session status — prefer detail, fall back to queue snapshot
  const liveStatus = sessionDetail?.session.status ?? selected?.session.status ?? ''
  const liveAllowedActions = sessionDetail?.session.allowedActions ?? selected?.session.allowedActions ?? []
  const isTerminal = liveStatus ? isSessionTerminal(liveStatus) : false

  async function run(action: 'claim' | 'approve' | 'reject' | 'barrier') {
    if (!selected) return

    setActionBusy(action)
    setError('')

    const body: ManualAuditPayload = {
      requestId: rid(),
      idempotencyKey: rid(),
      occurredAt: new Date().toISOString(),
      reasonCode: reasonCode.trim() || 'MANUAL_OVERRIDE',
      note: note.trim() || 'Manual review queue action.',
    }

    try {
      if (action === 'claim') {
        await claimReview(selected.reviewId, body)
      } else if (action === 'approve') {
        await manualApproveSession(selected.session.sessionId, body)
      } else if (action === 'reject') {
        await manualRejectSession(selected.session.sessionId, body)
      } else {
        await manualOpenBarrier(selected.session.sessionId, body)
      }

      // Refresh both queue and session detail after any mutation
      await Promise.all([
        refresh(),
        loadSessionDetail(String(selected.session.sessionId)),
      ])
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError))
    } finally {
      setActionBusy('')
    }
  }

  function resetFilters() {
    setStatus('')
    setSearch('')
    setFrom('')
    setTo('')
  }

  // Compute per-action disabled state: queue action must exist AND session must not be terminal
  function isActionDisabled(queueAction: string) {
    if (actionBusy !== '') return true
    if (isTerminal) return true
    if (liveAllowedActions.length === 0 && queueAction !== 'CLAIM') return true
    return !selected?.actions.includes(queueAction as ReviewQueueItem['actions'][number])
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Review Queue"
        description="Manually review cases requiring operator confirmation. Select a case, verify context, and apply the appropriate action."
        badges={[
          { label: 'manual review', variant: 'secondary' },
          { label: operatorRole || '—', variant: 'muted' },
        ]}
        actions={
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      <ReviewFilterBar
        sites={sites}
        siteCode={siteCode}
        status={status}
        search={search}
        from={from}
        to={to}
        loading={loading}
        onSiteCodeChange={setSiteCode}
        onStatusChange={setStatus}
        onSearchChange={setSearch}
        onFromChange={setFrom}
        onToChange={setTo}
        onRefresh={() => void refresh()}
        onReset={resetFilters}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.05fr)]">
        <ReviewTable
          rows={filteredRows}
          selectedId={selected?.reviewId || ''}
          loading={loading}
          error={error}
          onSelect={setSelectedId}
        />

        <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
            <CardHeader>
              <CardTitle>Review detail</CardTitle>
              <CardDescription>Verify session context, confirm the reason, and apply the action permitted for this case.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {!selected ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
                  Select a case from the list to view detail.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="amber">{selected.status}</Badge>
                    <Badge variant={selected.session.direction === 'ENTRY' ? 'entry' : 'exit'}>{selected.session.direction}</Badge>
                    {/* Live session status badge — overrides queue snapshot when loaded */}
                    {liveStatus && liveStatus !== selected.session.status ? (
                      <Badge variant={isTerminal ? 'destructive' : 'amber'}>session {liveStatus}</Badge>
                    ) : null}
                    {selected.session.reviewRequired ? <Badge variant="amber">review required</Badge> : null}
                    {selected.actions.map((action) => (
                      <Badge key={action} variant="muted">{queueActionLabel(action)}</Badge>
                    ))}
                  </div>

                  {/* Terminal session banner — highest priority UI signal */}
                  {isTerminal ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">Session is {liveStatus} — no actions available</p>
                        <p className="mt-1 text-destructive/80">
                          This session has reached a terminal state. To process a new vehicle on this lane, open a new session in Run Lane.
                        </p>
                      </div>
                    </div>
                  ) : detailLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Verifying live session state…
                    </div>
                  ) : detailError ? (
                    <div className="flex items-start gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-3 text-xs text-primary">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Could not verify live session state — actions are based on queue snapshot only. {detailError}</span>
                    </div>
                  ) : null}

                  <div className="rounded-3xl border border-border/80 bg-muted/25 p-4">
                    <SummaryRow label="Review ID" value={selected.reviewId} />
                    <SummaryRow label="Queue reason" value={selected.queueReasonCode} />
                    <SummaryRow label="Session" value={String(selected.session.sessionId)} />
                    <SummaryRow label="Site / Gate / Lane" value={`${selected.session.siteCode} / ${selected.session.gateCode} / ${selected.session.laneCode}`} />
                    <SummaryRow label="Plate" value={selected.session.plateCompact || '—'} />
                    <SummaryRow label="Session status" value={liveStatus || selected.session.status || '—'} />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Reason code</p>
                      <Input value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="mt-2" disabled={isTerminal || actionBusy !== ''} />
                    </div>
                    <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Note</p>
                      <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-2" disabled={isTerminal || actionBusy !== ''} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isActionDisabled('CLAIM')}
                      title={isTerminal ? `Session is ${liveStatus}` : !selected.actions.includes('CLAIM') ? 'Claim not available for this queue item' : undefined}
                      onClick={() => void run('claim')}
                    >
                      {actionBusy === 'claim' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                      Claim
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isActionDisabled('MANUAL_APPROVE')}
                      title={isTerminal ? `Session is ${liveStatus}` : !selected.actions.includes('MANUAL_APPROVE') ? 'Approve not permitted' : undefined}
                      onClick={() => void run('approve')}
                    >
                      {actionBusy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Approve
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isActionDisabled('MANUAL_REJECT')}
                      title={isTerminal ? `Session is ${liveStatus}` : !selected.actions.includes('MANUAL_REJECT') ? 'Reject not permitted' : undefined}
                      onClick={() => void run('reject')}
                    >
                      {actionBusy === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldX className="h-4 w-4" />}
                      Reject
                    </Button>

                    <Button
                      variant="entry"
                      size="sm"
                      disabled={isActionDisabled('MANUAL_OPEN_BARRIER')}
                      title={isTerminal ? `Session is ${liveStatus}` : !selected.actions.includes('MANUAL_OPEN_BARRIER') ? 'Open barrier not permitted' : undefined}
                      onClick={() => void run('barrier')}
                    >
                      {actionBusy === 'barrier' ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
                      Open barrier
                    </Button>
                  </div>

                  {error ? (
                    <div className="flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="break-all">{error}</span>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
