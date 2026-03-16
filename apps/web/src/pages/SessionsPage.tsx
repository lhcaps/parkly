import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  canRunSessionAction,
  getSessionActionLockReason,
  isSessionTerminal,
  type OperatorRole,
} from '@/features/manual-control/session-action-access'
import { SessionFilterBar } from '@/features/session-history/components/SessionFilterBar'
import { SessionManualBarrierOverrideCard } from '@/features/session-history/components/SessionManualBarrierOverrideCard'
import { SessionTable } from '@/features/session-history/components/SessionTable'
import { SessionTimeline } from '@/features/session-history/components/SessionTimeline'
import { SessionDetailConsole } from '@/features/session-history/SessionDetailConsole'
import { cancelSession, confirmPass, getSessionDetail, getSessions, resolveSession } from '@/lib/api/sessions'
import { getMe } from '@/lib/api/system'
import { getLanes, getSites } from '@/lib/api/topology'
import type { Direction } from '@/lib/contracts/common'
import type { SessionAllowedAction, SessionDetail, SessionState, SessionSummary } from '@/lib/contracts/sessions'
import type { LaneRow, SiteRow } from '@/lib/contracts/topology'
import { toAppErrorDisplay, type AppErrorDisplay } from '@/lib/http/errors'
import { measureAsync } from '@/lib/query/perf'
import { useDebouncedValue } from '@/lib/query/use-debounced-value'

function rid() {
  return `ui_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

function sessionVariant(status: SessionState): 'secondary' | 'entry' | 'amber' | 'destructive' | 'muted' {
  if (status === 'APPROVED' || status === 'PASSED') return 'entry'
  if (status === 'WAITING_READ' || status === 'WAITING_DECISION' || status === 'WAITING_PAYMENT' || status === 'OPEN') return 'amber'
  if (status === 'DENIED' || status === 'ERROR') return 'destructive'
  return 'muted'
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="max-w-[68%] break-all text-right text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function ActionButton({
  action,
  role,
  busy,
  allowedActions,
  liveSessionStatus,
  onRun,
}: {
  action: SessionAllowedAction
  role: OperatorRole
  busy: string
  allowedActions: SessionAllowedAction[]
  liveSessionStatus: string
  onRun: (action: SessionAllowedAction) => Promise<void>
}) {
  const lockReason = getSessionActionLockReason(role, action, allowedActions, liveSessionStatus)
  const disabled = Boolean(lockReason) || Boolean(busy)

  const props = {
    disabled,
    title: lockReason || undefined,
    onClick: () => void onRun(action),
  }

  if (action === 'APPROVE') {
    return <Button variant="secondary" size="sm" {...props}>{busy === action ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Approve</Button>
  }
  if (action === 'REQUIRE_PAYMENT') {
    return <Button variant="outline" size="sm" {...props}>{busy === action ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}Payment hold</Button>
  }
  if (action === 'DENY') {
    return <Button variant="destructive" size="sm" {...props}>{busy === action ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}Deny</Button>
  }
  if (action === 'CONFIRM_PASS') {
    return <Button variant="entry" size="sm" {...props}>{busy === action ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Confirm pass</Button>
  }
  return <Button variant="ghost" size="sm" {...props}>{busy === action ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}Cancel</Button>
}

function DetailActionBar({
  detail,
  role,
  onUpdated,
}: {
  detail: SessionDetail
  role: OperatorRole
  onUpdated: () => Promise<boolean | void>
}) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<AppErrorDisplay | null>(null)
  const actions = detail.session.allowedActions ?? []
  const terminal = isSessionTerminal(detail.session.status)

  async function run(action: SessionAllowedAction) {
    try {
      setBusy(action)
      setError(null)

      const sessionId = String(detail.session.sessionId)

      if (action === 'APPROVE') {
        await resolveSession({
          requestId: rid(),
          idempotencyKey: rid(),
          sessionId,
          approved: true,
          reasonCode: 'MANUAL_APPROVE',
          reasonDetail: 'Action from Session History',
        })
      } else if (action === 'REQUIRE_PAYMENT') {
        await resolveSession({
          requestId: rid(),
          idempotencyKey: rid(),
          sessionId,
          paymentRequired: true,
          reasonCode: 'PAYMENT_REQUIRED_UI',
          reasonDetail: 'Hold barrier from Session History',
        })
      } else if (action === 'DENY') {
        await resolveSession({
          requestId: rid(),
          idempotencyKey: rid(),
          sessionId,
          denied: true,
          reasonCode: 'MANUAL_DENY',
          reasonDetail: 'Manual reject from Session History',
        })
      } else if (action === 'CONFIRM_PASS') {
        await confirmPass(sessionId, {
          requestId: rid(),
          idempotencyKey: rid(),
          occurredAt: new Date().toISOString(),
          reasonCode: 'UI_CONFIRM_PASS',
        })
      } else {
        await cancelSession(sessionId, {
          requestId: rid(),
          idempotencyKey: rid(),
          occurredAt: new Date().toISOString(),
          reasonCode: 'UI_CANCEL',
          note: 'Cancel from Session History',
        })
      }

      await onUpdated()
    } catch (actionError) {
      setError(toAppErrorDisplay(actionError, 'Session action rejected'))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-3">
      {terminal ? (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Session is {detail.session.status} — actions locked</p>
            <p className="mt-1 text-destructive/80">The backend has already moved this session to a terminal state. Refresh is still safe, mutate actions are not.</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Badge variant="muted">role {role || '—'}</Badge>
        {(['APPROVE', 'REQUIRE_PAYMENT', 'DENY', 'CONFIRM_PASS', 'CANCEL'] as SessionAllowedAction[]).map((action) => (
          <ActionButton
            key={action}
            action={action}
            role={role}
            busy={busy}
            allowedActions={actions}
            liveSessionStatus={detail.session.status}
            onRun={run}
          />
        ))}
        {actions.length === 0 ? <Badge variant="muted">No allowed actions</Badge> : null}
      </div>

      {actions.filter((action) => canRunSessionAction(role, action)).length === 0 && actions.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          The backend still exposes actions for this session, but your current role cannot perform any of them.
        </div>
      ) : null}

      {error ? (
        <div className="space-y-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">{error.title}</p>
              <p className="mt-1 break-all text-destructive/90">{error.message}</p>
            </div>
          </div>
          {error.nextAction ? <p className="text-xs text-destructive/85">Next: {error.nextAction}</p> : null}
        </div>
      ) : null}
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
  const [role, setRole] = useState<OperatorRole>('')

  const [rows, setRows] = useState<SessionSummary[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [staleWarning, setStaleWarning] = useState('')
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
    } catch (detailLoadError) {
      if (requestSeq !== detailRequestSeq.current) return false
      setDetailError(detailLoadError instanceof Error ? detailLoadError.message : String(detailLoadError))
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
          : data.rows[0]
            ? String(data.rows[0].sessionId)
            : ''

      setSelectedId(nextSelectedId)

      if (nextSelectedId) {
        const detailOk = await loadDetail(nextSelectedId)
        if (requestSeq !== refreshRequestSeq.current) return false
        if (detailOk) {
          setStaleWarning('')
        } else {
          setStaleWarning('Session detail could not be refreshed after the latest list sync. State may be stale until you reload detail again.')
        }
        return detailOk
      }

      setDetail(null)
      setDetailError('')
      setStaleWarning('')
      return true
    } catch (loadError) {
      if (requestSeq !== refreshRequestSeq.current) return false
      setError(loadError instanceof Error ? loadError.message : String(loadError))
      setRows([])
      setDetail(null)
      setStaleWarning('Session list refresh failed. Any previously visible state may now be stale.')
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
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(keyword)
    })
  }, [debouncedSearch, rows])

  const activeDetail = detail && String(detail.session.sessionId) === String(selectedId) ? detail : null

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
        description="Look up a session, review the timeline, and run permitted actions without leaving this screen."
        badges={[
          { label: 'history', variant: 'secondary' },
          { label: role ? `role ${role}` : 'role —', variant: 'muted' },
        ]}
        actions={
          <Button variant="outline" onClick={() => void refresh(selectedId || undefined)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
        <SessionTable
          rows={filteredRows}
          selectedId={selectedId}
          loading={loading}
          error={error}
          onSelect={(sessionId) => {
            setSelectedId(sessionId)
            setStaleWarning('')
            void loadDetail(sessionId).then((ok) => {
              if (!ok) {
                setStaleWarning('Session detail could not be refreshed for the selected row. State may be stale until you retry refresh.')
              }
            })
          }}
        />

        <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
            <CardHeader>
              <CardTitle>Session detail</CardTitle>
              <CardDescription>Session detail — review context, check permitted actions, and track processing state.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {staleWarning ? (
                <div className="flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-sm text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">State may be stale</p>
                    <p className="mt-1">{staleWarning}</p>
                  </div>
                </div>
              ) : null}

              {detailLoading ? (
                <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading session detail...
                </div>
              ) : !activeDetail ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
                  Select a session to view detail.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{activeDetail.session.siteCode}</Badge>
                    <Badge variant="outline">{activeDetail.session.gateCode}</Badge>
                    <Badge variant={activeDetail.session.direction === 'ENTRY' ? 'entry' : 'exit'}>{activeDetail.session.laneCode}</Badge>
                    <Badge variant={sessionVariant(activeDetail.session.status)}>{activeDetail.session.status}</Badge>
                    {activeDetail.session.reviewRequired ? <Badge variant="amber">review required</Badge> : null}
                  </div>

                  {detailError ? (
                    <div className="flex items-start gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-4 text-sm text-primary">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="break-all">Live detail could not be refreshed for this session. {detailError}</span>
                    </div>
                  ) : null}

                  {isSessionTerminal(activeDetail.session.status) ? (
                    <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">Session is {activeDetail.session.status} — no further actions should be run</p>
                        <p className="mt-1 text-destructive/80">The page remains readable, but mutate controls are locked by the live session state and backend allowedActions.</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-3xl border border-border/80 bg-muted/25 p-4">
                    <SummaryRow label="Session" value={String(activeDetail.session.sessionId)} />
                    <SummaryRow label="Plate" value={activeDetail.session.plateCompact || '—'} />
                    <SummaryRow label="Opened at" value={new Date(activeDetail.session.openedAt).toLocaleString('vi-VN')} />
                    <SummaryRow label="Resolved at" value={activeDetail.session.resolvedAt ? new Date(activeDetail.session.resolvedAt).toLocaleString('vi-VN') : '—'} />
                    <SummaryRow label="RFID UID" value={activeDetail.session.rfidUid || '—'} />
                    <SummaryRow label="Allowed actions" value={activeDetail.session.allowedActions.length > 0 ? activeDetail.session.allowedActions.join(', ') : 'none'} />
                    <SummaryRow label="Counts" value={`${activeDetail.session.readCount} reads · ${activeDetail.session.decisionCount} decisions · ${activeDetail.session.barrierCommandCount} barriers`} />
                  </div>

                  <DetailActionBar
                    detail={activeDetail}
                    role={role}
                    onUpdated={() => refresh(String(activeDetail.session.sessionId))}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {activeDetail ? <SessionManualBarrierOverrideCard detail={activeDetail} role={role} onUpdated={() => refresh(String(activeDetail.session.sessionId))} /> : null}
          {activeDetail ? <SessionTimeline detail={activeDetail} /> : null}
          {activeDetail ? <SessionDetailConsole detail={activeDetail} /> : null}
        </div>
      </div>
    </div>
  )
}
