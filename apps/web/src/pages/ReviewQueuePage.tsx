import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, ClipboardCheck, DoorOpen, Loader2, RefreshCw, ShieldX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ReviewFilterBar, type ReviewStatus } from '@/features/review-queue/components/ReviewFilterBar'
import { ReviewTable } from '@/features/review-queue/components/ReviewTable'
import { getSites } from '@/lib/api/topology'
import { getMe } from '@/lib/api/system'
import {
  claimReview,
  getReviewQueue,
  manualApproveSession,
  manualOpenBarrier,
  manualRejectSession,
} from '@/lib/api/reviews'
import type { ManualAuditPayload, ReviewQueueItem } from '@/lib/contracts/reviews'
import type { SiteRow } from '@/lib/contracts/topology'

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
  if (action === 'MANUAL_APPROVE') return 'Manual approve'
  if (action === 'MANUAL_REJECT') return 'Manual reject'
  if (action === 'MANUAL_OPEN_BARRIER') return 'Manual open barrier'
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
  const [note, setNote] = useState('Operator xác nhận đã kiểm tra thực địa tại lane.')

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

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const res = await getReviewQueue({
        siteCode: siteCode || undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 100,
      })
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

  useEffect(() => {
    void refresh()
  }, [siteCode, status, from, to])

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()

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
  }, [rows, search, from, to])

  const selected = useMemo(
    () => filteredRows.find((row) => row.reviewId === selectedId) || filteredRows[0] || null,
    [filteredRows, selectedId],
  )

  async function run(action: 'claim' | 'approve' | 'reject' | 'barrier') {
    if (!selected) return

    setActionBusy(action)
    setError('')

    const body: ManualAuditPayload = {
      requestId: rid(),
      idempotencyKey: rid(),
      occurredAt: new Date().toISOString(),
      reasonCode: reasonCode.trim() || 'MANUAL_OVERRIDE',
      note: note.trim() || 'Operator xử lý review queue thủ công.',
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

      await refresh()
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

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">operations detail</Badge>
              <Badge variant="outline">review queue</Badge>
              <Badge variant="outline">filter-first</Badge>
              <Badge variant="muted">role {operatorRole || '—'}</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Review Queue</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Flow này dành cho OPS xử lý case ambiguous. Filter bars, list state và detail surface giờ rõ vai trò hơn, không còn là một màn nhồi cả đống panel rời rạc.
            </p>
          </div>

          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

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
              <CardDescription>
                Detail surface này đóng vai trò như một drawer làm việc. Click item bên trái là nội dung bên phải đổi ngay, không đẩy operator sang raw JSON.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {!selected ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
                  Chọn một review để xem chi tiết.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="amber">{selected.status}</Badge>
                    <Badge variant={selected.session.direction === 'ENTRY' ? 'entry' : 'exit'}>{selected.session.direction}</Badge>
                    {selected.session.reviewRequired ? <Badge variant="amber">review required</Badge> : null}
                    {selected.actions.map((action) => (
                      <Badge key={action} variant="muted">{queueActionLabel(action)}</Badge>
                    ))}
                  </div>

                  <div className="rounded-3xl border border-border/80 bg-muted/25 p-4">
                    <SummaryRow label="Review ID" value={selected.reviewId} />
                    <SummaryRow label="Queue reason" value={selected.queueReasonCode} />
                    <SummaryRow label="Session" value={String(selected.session.sessionId)} />
                    <SummaryRow label="Site / Gate / Lane" value={`${selected.session.siteCode} / ${selected.session.gateCode} / ${selected.session.laneCode}`} />
                    <SummaryRow label="Plate" value={selected.session.plateCompact || '—'} />
                    <SummaryRow label="Status" value={selected.status} />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Reason code</p>
                      <Input value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="mt-2" />
                    </div>
                    <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Note</p>
                      <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-2" />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionBusy !== '' || !selected.actions.includes('CLAIM')}
                      onClick={() => void run('claim')}
                    >
                      {actionBusy === 'claim' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                      Claim
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={actionBusy !== '' || !selected.actions.includes('MANUAL_APPROVE')}
                      onClick={() => void run('approve')}
                    >
                      {actionBusy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Approve
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={actionBusy !== '' || !selected.actions.includes('MANUAL_REJECT')}
                      onClick={() => void run('reject')}
                    >
                      {actionBusy === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldX className="h-4 w-4" />}
                      Reject
                    </Button>

                    <Button
                      variant="entry"
                      size="sm"
                      disabled={actionBusy !== '' || !selected.actions.includes('MANUAL_OPEN_BARRIER')}
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

