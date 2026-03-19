import { useDeferredValue, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  DoorOpen,
  Keyboard,
  Loader2,
  RefreshCw,
  ShieldX,
} from 'lucide-react'
import { PageHeader } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  getReviewWorkspaceActionLockReason,
  isSessionTerminal,
} from '@/features/manual-control/session-action-access'
import { ReviewFilterBar, type ReviewStatus } from '@/features/review-queue/components/ReviewFilterBar'
import { ReviewTable } from '@/features/review-queue/components/ReviewTable'
import { getReviewQueue, claimReview, manualApproveSession, manualOpenBarrier, manualRejectSession } from '@/lib/api/reviews'
import { getSessionDetail } from '@/lib/api/sessions'
import { getMe } from '@/lib/api/system'
import { getSites } from '@/lib/api/topology'
import type { ManualAuditPayload, ReviewQueueAction, ReviewQueueItem } from '@/lib/contracts/reviews'
import type { SessionDetail } from '@/lib/contracts/sessions'
import type { SiteRow } from '@/lib/contracts/topology'
import { toAppErrorDisplay, type AppErrorDisplay } from '@/lib/http/errors'
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

function queueActionLabel(action: ReviewQueueAction) {
  if (action === 'MANUAL_APPROVE') return 'Approve'
  if (action === 'MANUAL_REJECT') return 'Reject'
  if (action === 'MANUAL_OPEN_BARRIER') return 'Open barrier'
  if (action === 'CLAIM') return 'Claim'
  return action
}

function summaryActionLabel(action: ReviewQueueAction) {
  if (action === 'CLAIM') return 'claim'
  if (action === 'MANUAL_APPROVE') return 'approve'
  if (action === 'MANUAL_REJECT') return 'reject'
  return 'open barrier'
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
  const [actionError, setActionError] = useState<AppErrorDisplay | null>(null)
  const [staleWarning, setStaleWarning] = useState('')

  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null)

  const deferredSearch = useDeferredValue(search)
  const refreshSeqRef = useRef(0)
  const detailSeqRef = useRef(0)
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const refreshInProgressRef = useRef(false)
  const detailInProgressRef = useRef<string | null>(null)
  const sessionDetailCacheRef = useRef<Map<string, { detail: SessionDetail; timestamp: number }>>(new Map())
  const lastRefreshTimeRef = useRef(0)
  const MIN_REFRESH_INTERVAL = 5000 // 5 seconds minimum between refreshes

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
    return () => {
      active = false
    }
  }, [])

  async function loadSessionDetail(sessionId: string, forceRefresh = false) {
    const sessionIdStr = String(sessionId)
    
    // Check cache first (5 minute TTL)
    if (!forceRefresh) {
      const cached = sessionDetailCacheRef.current.get(sessionIdStr)
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        setSessionDetail(cached.detail)
        setDetailLoading(false)
        setDetailError('')
        return true
      }
    }

    // Prevent duplicate requests for the same session
    if (detailInProgressRef.current === sessionIdStr) {
      return false
    }

    const requestSeq = ++detailSeqRef.current
    detailInProgressRef.current = sessionIdStr
    setDetailLoading(true)
    setDetailError('')

    try {
      const detail = await getSessionDetail(sessionIdStr)
      if (requestSeq !== detailSeqRef.current) return false
      
      // Cache the result
      sessionDetailCacheRef.current.set(sessionIdStr, {
        detail,
        timestamp: Date.now(),
      })
      
      setSessionDetail(detail)
      return true
    } catch (err) {
      if (requestSeq !== detailSeqRef.current) return false
      setDetailError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      if (requestSeq === detailSeqRef.current) {
        setDetailLoading(false)
        detailInProgressRef.current = null
      }
    }
  }

  const refresh = useCallback(async (preferredReviewId?: string) => {
    // Prevent duplicate refresh requests
    if (refreshInProgressRef.current) {
      return false
    }

    // Minimum interval between refreshes (5 seconds)
    const now = Date.now()
    if (now - lastRefreshTimeRef.current < MIN_REFRESH_INTERVAL) {
      return false
    }

    const requestSeq = ++refreshSeqRef.current
    refreshInProgressRef.current = true
    lastRefreshTimeRef.current = now

    setLoading(true)
    setError('')
    setStaleWarning('')

    try {
      const res = await measureAsync(
        'review-refresh',
        () => getReviewQueue({
          siteCode: siteCode || undefined,
          status: status || undefined,
          from: from || undefined,
          to: to || undefined,
          limit: 100,
        }),
        [siteCode || 'all', status || 'all'].join(':'),
      )

      if (requestSeq !== refreshSeqRef.current) return false

      setRows(res.rows)
      setLastRefreshAt(new Date())

      const nextSelected =
        preferredReviewId && res.rows.some((row) => row.reviewId === preferredReviewId)
          ? res.rows.find((row) => row.reviewId === preferredReviewId) || null
          : res.rows[0] || null

      // Only update selected if it changed
      setSelectedId((prevId) => {
        const newId = nextSelected?.reviewId || ''
        return prevId !== newId ? newId : prevId
      })

      // Load session detail for the selected item (if session changed or not loaded)
      if (nextSelected?.session.sessionId) {
        const newSessionId = String(nextSelected.session.sessionId)
        void loadSessionDetail(newSessionId, false)
      } else {
        setSessionDetail(null)
        setDetailError('')
      }

      return true
    } catch (refreshError) {
      if (requestSeq !== refreshSeqRef.current) return false
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError))
      setRows([])
      setSessionDetail(null)
      setStaleWarning('Review queue could not be refreshed. Any previously visible state may now be stale.')
      return false
    } finally {
      if (requestSeq === refreshSeqRef.current) {
        setLoading(false)
        refreshInProgressRef.current = false
      }
    }
  }, [siteCode, status, from, to])

  const filteredRows = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase()
    return rows.filter((row) => {
      if (!reviewMatchesTime(row, from, to)) return false
      if (!keyword) return true
      const haystack = [
        row.reviewId,
        row.status,
        row.queueReasonCode,
        row.session.sessionId,
        row.session.siteCode,
        row.session.gateCode,
        row.session.laneCode,
        row.session.plateCompact || '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(keyword)
    })
  }, [deferredSearch, from, rows, to])

  const selected = useMemo(
    () => filteredRows.find((row) => row.reviewId === selectedId) || filteredRows[0] || null,
    [filteredRows, selectedId],
  )

  const liveStatus = sessionDetail?.session.status ?? selected?.session.status ?? ''
  const liveSessionAllowedActions = sessionDetail?.session.allowedActions ?? selected?.session.allowedActions ?? []
  const isTerminal = liveStatus ? isSessionTerminal(liveStatus) : false
  const liveContextReady = Boolean(selected && sessionDetail && !detailLoading && !detailError)

  const getActionLockReason = useCallback((action: ReviewQueueAction) => {
    if (!selected) return 'Select a review item first.'
    if (!liveContextReady) {
      return detailLoading
        ? 'Verifying live session detail. Wait for refresh to finish.'
        : 'Live session detail is unavailable. Refresh context before running actions.'
    }
    return getReviewWorkspaceActionLockReason(
      operatorRole,
      action,
      selected.actions,
      liveStatus || undefined,
      liveSessionAllowedActions,
    )
  }, [selected, liveContextReady, detailLoading, operatorRole, liveStatus, liveSessionAllowedActions])

  const isActionDisabled = useCallback((action: ReviewQueueAction) => {
    if (actionBusy !== '') return true
    return Boolean(getActionLockReason(action))
  }, [actionBusy, getActionLockReason])

  async function run(action: 'claim' | 'approve' | 'reject' | 'barrier') {
    if (!selectedId) return

    const selectedRow = rows.find((row) => row.reviewId === selectedId)
    if (!selectedRow) return

    const queueAction: ReviewQueueAction =
      action === 'claim'
        ? 'CLAIM'
        : action === 'approve'
          ? 'MANUAL_APPROVE'
          : action === 'reject'
            ? 'MANUAL_REJECT'
            : 'MANUAL_OPEN_BARRIER'

    const lockReason = getActionLockReason(queueAction)
    if (lockReason) {
      setActionError({
        kind: 'conflict',
        title: `${summaryActionLabel(queueAction)} is locked`,
        message: lockReason,
        tone: 'warning',
        status: null,
        code: 'UI_LOCKED',
        fieldErrors: [],
      })
      return
    }

    setActionBusy(action)
    setActionError(null)
    setStaleWarning('')

    const body: ManualAuditPayload = {
      requestId: rid(),
      idempotencyKey: rid(),
      occurredAt: new Date().toISOString(),
      reasonCode: reasonCode.trim() || 'MANUAL_OVERRIDE',
      note: note.trim() || 'Manual review queue action.',
    }

    try {
      if (action === 'claim') {
        await claimReview(selectedRow.reviewId, body)
      } else if (action === 'approve') {
        await manualApproveSession(selectedRow.session.sessionId, body)
      } else if (action === 'reject') {
        await manualRejectSession(selectedRow.session.sessionId, body)
      } else {
        await manualOpenBarrier(selectedRow.session.sessionId, body)
      }

      const refreshOk = await refresh(selectedRow.reviewId)
      if (!refreshOk) {
        setActionError({
          kind: 'realtimeStale',
          title: 'Action completed but state may be stale',
          message: 'The backend may have accepted the mutation, but the list/detail refresh did not complete. Refresh the queue and session context now.',
          tone: 'warning',
          status: null,
          code: 'POST_MUTATION_REFRESH_FAILED',
          fieldErrors: [],
          nextAction: 'Use Refresh and verify the live session detail before the next action.',
        })
      }
    } catch (runError) {
      setActionError(toAppErrorDisplay(runError, `${summaryActionLabel(queueAction)} failed`))
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

  // Auto-refresh setup - only refresh queue, not session detail
  useEffect(() => {
    if (!autoRefreshEnabled || !siteCode) {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
        autoRefreshIntervalRef.current = null
      }
      return
    }

    // Initial refresh on mount
    void refresh()

    // Auto-refresh every 30 seconds
    autoRefreshIntervalRef.current = setInterval(() => {
      void refresh()
    }, 30000)

    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
        autoRefreshIntervalRef.current = null
      }
    }
  }, [autoRefreshEnabled, siteCode])

  // Session detail loading when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setSessionDetail(null)
      setDetailLoading(false)
      setDetailError('')
      return
    }

    // Find the selected row
    const selectedRow = rows.find((row) => row.reviewId === selectedId)
    if (!selectedRow?.session.sessionId) {
      setSessionDetail(null)
      setDetailLoading(false)
      setDetailError('')
      return
    }

    const sessionId = String(selectedRow.session.sessionId)
    void loadSessionDetail(sessionId, false)
  }, [selectedId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement)?.isContentEditable
      ) {
        return
      }

      // Ctrl/Cmd + R: Refresh
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault()
        void refresh()
        return
      }

      // Arrow keys: Navigate list
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const currentIndex = rows.findIndex((row) => row.reviewId === selectedId)
        const nextIndex =
          event.key === 'ArrowDown'
            ? Math.min(currentIndex + 1, rows.length - 1)
            : Math.max(currentIndex - 1, 0)
        if (rows[nextIndex]) {
          setSelectedId(rows[nextIndex].reviewId)
        }
        return
      }

      // Number keys: Quick actions (1=Claim, 2=Approve, 3=Reject, 4=Barrier)
      if (selectedId && !actionBusy && event.key >= '1' && event.key <= '4') {
        const actionMap: Record<string, 'claim' | 'approve' | 'reject' | 'barrier'> = {
          '1': 'claim',
          '2': 'approve',
          '3': 'reject',
          '4': 'barrier',
        }
        const action = actionMap[event.key]
        if (action) {
          const queueAction: ReviewQueueAction =
            action === 'claim'
              ? 'CLAIM'
              : action === 'approve'
                ? 'MANUAL_APPROVE'
                : action === 'reject'
                  ? 'MANUAL_REJECT'
                  : 'MANUAL_OPEN_BARRIER'
          if (!isActionDisabled(queueAction)) {
            void run(action)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [rows, selectedId, actionBusy, isActionDisabled])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Review Queue"
        description="Manually review cases requiring operator confirmation. Select a case, verify context, and apply the appropriate action."
        badges={[
          { label: 'manual review', variant: 'secondary' },
          { label: operatorRole || '—', variant: 'muted' },
          { label: `${filteredRows.length} cases`, variant: 'outline' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={autoRefreshEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              title={autoRefreshEnabled ? 'Auto-refresh enabled (every 10s)' : 'Auto-refresh disabled'}
            >
              {autoRefreshEnabled ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Auto
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Manual
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refresh(selectedId || undefined)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            {lastRefreshAt && (
              <span className="text-xs text-muted-foreground">
                {Math.round((Date.now() - lastRefreshAt.getTime()) / 1000)}s ago
              </span>
            )}
          </div>
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
        onRefresh={() => void refresh(selectedId || undefined)}
        onReset={resetFilters}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.05fr)]">
        <ReviewTable
          rows={filteredRows}
          selectedId={selected?.reviewId || ''}
          loading={loading}
          error={error}
          onSelect={(reviewId) => {
            setSelectedId(reviewId)
            setActionError(null)
            setStaleWarning('')
          }}
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
                    {liveStatus && liveStatus !== selected.session.status ? (
                      <Badge variant={isTerminal ? 'destructive' : 'amber'}>session {liveStatus}</Badge>
                    ) : null}
                    {selected.session.reviewRequired ? <Badge variant="amber">review required</Badge> : null}
                    {selected.actions.map((action) => (
                      <Badge key={action} variant="muted">{queueActionLabel(action)}</Badge>
                    ))}
                  </div>

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
                    <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/40 px-3 py-3 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Verifying live session state… all actions stay locked until the authoritative detail returns.
                    </div>
                  ) : detailError ? (
                    <div className="flex items-start gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-3 text-xs text-primary">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Could not verify live session state. Actions remain locked until context refresh succeeds. {detailError}</span>
                    </div>
                  ) : null}

                  {staleWarning ? (
                    <div className="flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-sm text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">State may be stale</p>
                        <p className="mt-1">{staleWarning}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-3xl border border-border/80 bg-muted/25 p-4">
                    <SummaryRow label="Review ID" value={selected.reviewId} />
                    <SummaryRow label="Queue reason" value={selected.queueReasonCode} />
                    <SummaryRow label="Session" value={String(selected.session.sessionId)} />
                    <SummaryRow label="Site / Gate / Lane" value={`${selected.session.siteCode} / ${selected.session.gateCode} / ${selected.session.laneCode}`} />
                    <SummaryRow label="Plate" value={selected.session.plateCompact || '—'} />
                    <SummaryRow label="Session status" value={liveStatus || selected.session.status || '—'} />
                    <SummaryRow label="Live allowed actions" value={liveSessionAllowedActions.length > 0 ? liveSessionAllowedActions.join(', ') : 'none'} />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Reason code</p>
                      <Input value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="mt-2" disabled={!liveContextReady || actionBusy !== ''} />
                    </div>
                    <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Note</p>
                      <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-2" disabled={!liveContextReady || actionBusy !== ''} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isActionDisabled('CLAIM')}
                        title={getActionLockReason('CLAIM') || 'Claim this review (1)'}
                        onClick={() => void run('claim')}
                      >
                        {actionBusy === 'claim' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                        Claim
                        <kbd className="ml-1.5 hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono sm:inline">1</kbd>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isActionDisabled('MANUAL_APPROVE')}
                        title={getActionLockReason('MANUAL_APPROVE') || 'Approve session (2)'}
                        onClick={() => void run('approve')}
                      >
                        {actionBusy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Approve
                        <kbd className="ml-1.5 hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono sm:inline">2</kbd>
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isActionDisabled('MANUAL_REJECT')}
                        title={getActionLockReason('MANUAL_REJECT') || 'Reject session (3)'}
                        onClick={() => void run('reject')}
                      >
                        {actionBusy === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldX className="h-4 w-4" />}
                        Reject
                        <kbd className="ml-1.5 hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono sm:inline">3</kbd>
                      </Button>

                      <Button
                        variant="entry"
                        size="sm"
                        disabled={isActionDisabled('MANUAL_OPEN_BARRIER')}
                        title={getActionLockReason('MANUAL_OPEN_BARRIER') || 'Open barrier (4)'}
                        onClick={() => void run('barrier')}
                      >
                        {actionBusy === 'barrier' ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
                        Open barrier
                        <kbd className="ml-1.5 hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono sm:inline">4</kbd>
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Keyboard className="h-3 w-3" />
                      <span>Keyboard: ↑↓ navigate, 1-4 quick actions, Ctrl+R refresh</span>
                    </div>
                  </div>

                  {actionError ? (
                    <div className="space-y-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold">{actionError.title}</p>
                          <p className="mt-1 break-all text-destructive/90">{actionError.message}</p>
                        </div>
                      </div>
                      {(actionError.status != null || actionError.requestId || actionError.nextAction) ? (
                        <div className="space-y-2 text-xs text-destructive/85">
                          {actionError.status != null ? <p>HTTP {actionError.status}</p> : null}
                          {actionError.requestId ? <p>requestId={actionError.requestId}</p> : null}
                          {actionError.nextAction ? <p>Next: {actionError.nextAction}</p> : null}
                        </div>
                      ) : null}
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
