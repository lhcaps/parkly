import { useDeferredValue, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  getReviewWorkspaceActionLockReason,
  isSessionTerminal,
} from '@/features/manual-control/session-action-access'
import { getReviewQueue, claimReview, manualApproveSession, manualOpenBarrier, manualRejectSession } from '@/lib/api/reviews'
import { getSessionDetail } from '@/lib/api/sessions'
import { getMe } from '@/lib/api/system'
import { getSites } from '@/lib/api/topology'
import type { ManualAuditPayload, ReviewQueueAction, ReviewQueueItem } from '@/lib/contracts/reviews'
import type { SessionDetail } from '@/lib/contracts/sessions'
import type { SiteRow } from '@/lib/contracts/topology'
import { toAppErrorDisplay, type AppErrorDisplay } from '@/lib/http/errors'
import { measureAsync } from '@/lib/query/perf'
import { toast } from 'sonner'

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

export type ListScope = 'active' | 'done'
export type ReviewAction = 'claim' | 'approve' | 'reject' | 'barrier'

const MIN_REFRESH_INTERVAL = 5000
const AUTO_REFRESH_MS = 60_000

export function useReviewQueue() {
  // ─── Filter State ──────────────────────────────────────
  const [sites, setSites] = useState<SiteRow[]>([])
  const [siteCode, setSiteCode] = useState('')
  const [status, setStatus] = useState<'OPEN' | 'CLAIMED' | 'RESOLVED' | 'CANCELLED' | ''>('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // ─── Data State ────────────────────────────────────────
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

  // ─── Session Detail ────────────────────────────────────
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  // ─── UI State ──────────────────────────────────────────
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null)
  const [listScope, setListScope] = useState<ListScope>('active')

  // ─── Refs ──────────────────────────────────────────────
  const deferredSearch = useDeferredValue(search)
  const refreshSeqRef = useRef(0)
  const detailSeqRef = useRef(0)
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const refreshInProgressRef = useRef(false)
  const detailInProgressRef = useRef<string | null>(null)
  const sessionDetailCacheRef = useRef<Map<string, { detail: SessionDetail; timestamp: number }>>(new Map())
  const lastRefreshTimeRef = useRef(0)

  // ─── Derived ───────────────────────────────────────────
  const queueApiStatus = useMemo((): 'OPEN' | 'CLAIMED' | 'RESOLVED' | 'CANCELLED' | 'DONE' | undefined => {
    if (listScope === 'done') {
      if (status === 'RESOLVED' || status === 'CANCELLED') return status
      return 'DONE'
    }
    if (status === 'OPEN' || status === 'CLAIMED') return status
    return undefined
  }, [listScope, status])

  const switchListScope = useCallback((next: ListScope) => {
    setListScope(next)
    setStatus('')
    setSelectedId('')
    setActionError(null)
    setStaleWarning('')
  }, [])

  // ─── Bootstrap ─────────────────────────────────────────
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

  // ─── Session Detail Loading ────────────────────────────
  const loadSessionDetail = useCallback(async (sessionId: string, forceRefresh = false) => {
    const sessionIdStr = String(sessionId)
    if (!forceRefresh) {
      const cached = sessionDetailCacheRef.current.get(sessionIdStr)
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        setSessionDetail(cached.detail)
        setDetailLoading(false)
        setDetailError('')
        return true
      }
    }
    if (detailInProgressRef.current === sessionIdStr) return false

    const requestSeq = ++detailSeqRef.current
    detailInProgressRef.current = sessionIdStr
    setDetailLoading(true)
    setDetailError('')
    try {
      const detail = await getSessionDetail(sessionIdStr)
      if (requestSeq !== detailSeqRef.current) return false
      sessionDetailCacheRef.current.set(sessionIdStr, { detail, timestamp: Date.now() })
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
  }, [])

  // ─── Refresh ───────────────────────────────────────────
  const refresh = useCallback(async (preferredReviewId?: string, opts?: { force?: boolean }) => {
    if (refreshInProgressRef.current) return false
    const now = Date.now()
    if (!opts?.force && now - lastRefreshTimeRef.current < MIN_REFRESH_INTERVAL) return false

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
          status: queueApiStatus,
          from: from || undefined,
          to: to || undefined,
          limit: 100,
        }),
        [siteCode || 'all', queueApiStatus ?? 'default', listScope].join(':'),
      )
      if (requestSeq !== refreshSeqRef.current) return false

      setRows(res.rows)
      setLastRefreshAt(new Date())

      const nextSelected =
        preferredReviewId && res.rows.some((row) => row.reviewId === preferredReviewId)
          ? res.rows.find((row) => row.reviewId === preferredReviewId) || null
          : res.rows[0] || null

      setSelectedId((prevId) => {
        const newId = nextSelected?.reviewId || ''
        return prevId !== newId ? newId : prevId
      })

      if (nextSelected?.session.sessionId) {
        void loadSessionDetail(String(nextSelected.session.sessionId), false)
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
  }, [siteCode, queueApiStatus, from, to, listScope, loadSessionDetail])

  // ─── Filtered Rows ─────────────────────────────────────
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

  // ─── Live Session Context ──────────────────────────────
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
      operatorRole, action, selected.actions, liveStatus || undefined, liveSessionAllowedActions,
    )
  }, [selected, liveContextReady, detailLoading, operatorRole, liveStatus, liveSessionAllowedActions])

  const isActionDisabled = useCallback((action: ReviewQueueAction) => {
    if (listScope !== 'active') return true
    if (actionBusy !== '') return true
    return Boolean(getActionLockReason(action))
  }, [listScope, actionBusy, getActionLockReason])

  // ─── Run Action ────────────────────────────────────────
  const run = useCallback(async (action: ReviewAction) => {
    if (!selectedId || listScope !== 'active') return
    const selectedRow = rows.find((row) => row.reviewId === selectedId)
    if (!selectedRow) return

    const queueAction: ReviewQueueAction =
      action === 'claim' ? 'CLAIM'
        : action === 'approve' ? 'MANUAL_APPROVE'
          : action === 'reject' ? 'MANUAL_REJECT'
            : 'MANUAL_OPEN_BARRIER'

    const lockReason = getActionLockReason(queueAction)
    if (lockReason) {
      setActionError({
        kind: 'conflict',
        title: `${action} is locked`,
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
      if (action === 'claim') await claimReview(selectedRow.reviewId, body)
      else if (action === 'approve') await manualApproveSession(selectedRow.session.sessionId, body)
      else if (action === 'reject') await manualRejectSession(selectedRow.session.sessionId, body)
      else await manualOpenBarrier(selectedRow.session.sessionId, body)

      const labels = {
        claim: 'Claimed case',
        approve: 'Approved session',
        reject: 'Rejected session',
        barrier: 'Barrier open command sent',
      } satisfies Record<typeof action, string>
      toast.success(labels[action])

      const refreshOk = await refresh(selectedRow.reviewId, { force: true })
      if (!refreshOk) {
        setActionError({
          kind: 'realtimeStale',
          title: 'Action completed but state may be stale',
          message: 'Refresh the queue to verify.',
          tone: 'warning',
          status: null,
          code: 'POST_MUTATION_REFRESH_FAILED',
          fieldErrors: [],
          nextAction: 'Use Refresh and verify the live session detail before the next action.',
        })
      }
    } catch (runError) {
      const label = action === 'claim' ? 'Claim' : action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : 'Open barrier'
      setActionError(toAppErrorDisplay(runError, `${label} failed`))
      toast.error(`${label} failed`)
    } finally {
      setActionBusy('')
    }
  }, [selectedId, listScope, rows, getActionLockReason, reasonCode, note, refresh])

  const resetFilters = useCallback(() => {
    setStatus('')
    setSearch('')
    setFrom('')
    setTo('')
  }, [])

  // ─── Auto-refresh ──────────────────────────────────────
  useEffect(() => {
    if (!autoRefreshEnabled || !siteCode) {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
        autoRefreshIntervalRef.current = null
      }
      return
    }
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      void refresh(undefined, { force: false })
    }
    void refresh(undefined, { force: true })
    autoRefreshIntervalRef.current = setInterval(tick, AUTO_REFRESH_MS)
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void refresh(undefined, { force: false })
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
        autoRefreshIntervalRef.current = null
      }
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [autoRefreshEnabled, siteCode, refresh, listScope])

  // ─── Session detail on selection change ────────────────
  useEffect(() => {
    if (!selectedId) {
      setSessionDetail(null)
      setDetailLoading(false)
      setDetailError('')
      return
    }
    const selectedRow = rows.find((row) => row.reviewId === selectedId)
    if (!selectedRow?.session.sessionId) {
      setSessionDetail(null)
      setDetailLoading(false)
      setDetailError('')
      return
    }
    void loadSessionDetail(String(selectedRow.session.sessionId), false)
  }, [selectedId, rows, loadSessionDetail])

  // ─── Keyboard shortcuts ────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement)?.isContentEditable
      ) return

      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault()
        void refresh(selectedId || undefined, { force: true })
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const list = filteredRows
        const currentIndex = list.findIndex((row) => row.reviewId === selectedId)
        const nextIndex = event.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, list.length - 1)
          : Math.max(currentIndex - 1, 0)
        if (list[nextIndex]) setSelectedId(list[nextIndex].reviewId)
        return
      }

      if (listScope === 'active' && selectedId && !actionBusy && event.key >= '1' && event.key <= '4') {
        const actionMap: Record<string, ReviewAction> = { '1': 'claim', '2': 'approve', '3': 'reject', '4': 'barrier' }
        const a = actionMap[event.key]
        if (a) {
          const queueAction: ReviewQueueAction =
            a === 'claim' ? 'CLAIM' : a === 'approve' ? 'MANUAL_APPROVE' : a === 'reject' ? 'MANUAL_REJECT' : 'MANUAL_OPEN_BARRIER'
          if (!isActionDisabled(queueAction)) void run(a)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredRows, selectedId, actionBusy, isActionDisabled, listScope, refresh, run])

  return {
    // Filters
    filters: { sites, siteCode, status, search, from, to, listScope },
    setFilters: { setSiteCode, setStatus, setSearch, setFrom, setTo, switchListScope, resetFilters },
    // Data
    filteredRows,
    selected,
    loading,
    error,
    // Detail
    sessionDetail,
    detailLoading,
    detailError,
    // Live context
    liveStatus,
    liveSessionAllowedActions,
    isTerminal,
    liveContextReady,
    // Actions
    actionBusy,
    actionError,
    staleWarning,
    operatorRole,
    reasonCode, setReasonCode,
    note, setNote,
    run,
    getActionLockReason,
    isActionDisabled,
    // Refresh
    autoRefreshEnabled, setAutoRefreshEnabled,
    lastRefreshAt,
    refresh,
    selectedId, setSelectedId,
    setActionError, setStaleWarning,
    AUTO_REFRESH_MS,
  }
}
