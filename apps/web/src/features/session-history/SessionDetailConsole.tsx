import { AlertTriangle, CheckCircle2, DoorOpen, ShieldCheck, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  canRunSessionAction,
  getManualBarrierOverrideLockReason,
  getSessionActionLockReason,
  isSessionTerminal,
  type OperatorRole,
} from '@/features/manual-control/session-action-access'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { DangerConfirmDialog } from '@/components/state/danger-confirm-dialog'
import { StatusBadge } from '@/components/ui/status-badge'
import { Input } from '@/components/ui/input'
import {
  cancelSession,
  confirmPass,
  getSessionDetail,
  manualOpenBarrierSession,
  resolveSession,
} from '@/lib/api/sessions'
import type { SessionAllowedAction, SessionDetail } from '@/lib/contracts/sessions'
import { formatDateTime, formatNumber, readLatestDecision, readLatestRead } from '@/features/session-history/session-history-model'
import { toAppErrorDisplay } from '@/lib/http/errors'
import { useState } from 'react'

function rid() {
  return `ui_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

function sessionVariant(status: string): 'secondary' | 'entry' | 'amber' | 'destructive' | 'muted' {
  if (status === 'APPROVED' || status === 'PASSED') return 'entry'
  if (status === 'WAITING_READ' || status === 'WAITING_DECISION' || status === 'WAITING_PAYMENT' || status === 'OPEN') return 'amber'
  if (status === 'DENIED' || status === 'ERROR') return 'destructive'
  return 'muted'
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-2.5 first:pt-0 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-mono-data uppercase tracking-[0.15em] text-muted-foreground/80">{label}</p>
      <p className="max-w-[65%] break-all text-right text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function ActionBar({
  detail,
  role,
  onUpdated,
}: {
  detail: SessionDetail
  role: OperatorRole
  onUpdated: () => Promise<boolean | void>
}) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<ReturnType<typeof toAppErrorDisplay> | null>(null)
  const actions = detail.session.allowedActions ?? []
  const terminal = isSessionTerminal(detail.session.status)

  async function run(action: SessionAllowedAction) {
    try {
      setBusy(action)
      setError(null)
      const sessionId = String(detail.session.sessionId)
      if (action === 'APPROVE') {
        await resolveSession({ requestId: rid(), idempotencyKey: rid(), sessionId, approved: true, reasonCode: 'MANUAL_APPROVE', reasonDetail: 'Action from Session History' })
      } else if (action === 'REQUIRE_PAYMENT') {
        await resolveSession({ requestId: rid(), idempotencyKey: rid(), sessionId, paymentRequired: true, reasonCode: 'PAYMENT_REQUIRED_UI', reasonDetail: 'Hold barrier from Session History' })
      } else if (action === 'DENY') {
        await resolveSession({ requestId: rid(), idempotencyKey: rid(), sessionId, denied: true, reasonCode: 'MANUAL_DENY', reasonDetail: 'Manual reject from Session History' })
      } else if (action === 'CONFIRM_PASS') {
        await confirmPass(sessionId, { requestId: rid(), idempotencyKey: rid(), occurredAt: new Date().toISOString(), reasonCode: 'UI_CONFIRM_PASS' })
      } else {
        await cancelSession(sessionId, { requestId: rid(), idempotencyKey: rid(), occurredAt: new Date().toISOString(), reasonCode: 'UI_CANCEL', note: 'Cancel from Session History' })
      }
      await onUpdated()
    } catch (e) {
      setError(toAppErrorDisplay(e, 'Session action rejected'))
    } finally {
      setBusy('')
    }
  }

  if (terminal) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Terminal — actions locked</span>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {(['APPROVE', 'REQUIRE_PAYMENT', 'DENY', 'CONFIRM_PASS', 'CANCEL'] as SessionAllowedAction[]).map((action) => {
          const lockReason = getSessionActionLockReason(role, action, actions, detail.session.status)
          const disabled = Boolean(lockReason) || Boolean(busy)
          if (!actions.includes(action) && action !== 'CANCEL') return null
          const btnProps = { disabled, title: lockReason || undefined, onClick: () => void run(action) }
          if (action === 'APPROVE') return <Button key={action} variant="secondary" size="sm" className="h-7 text-xs" {...btnProps}>{busy === action ? '…' : <ShieldCheck className="h-3.5 w-3.5" />}</Button>
          if (action === 'REQUIRE_PAYMENT') return <Button key={action} variant="outline" size="sm" className="h-7 text-xs" {...btnProps}>{busy === action ? '…' : 'Payment hold'}</Button>
          if (action === 'DENY') return <Button key={action} variant="destructive" size="sm" className="h-7 text-xs" {...btnProps}>{busy === action ? '…' : <XCircle className="h-3.5 w-3.5" />}</Button>
          if (action === 'CONFIRM_PASS') return <Button key={action} variant="entry" size="sm" className="h-7 text-xs" {...btnProps}>{busy === action ? '…' : <CheckCircle2 className="h-3.5 w-3.5" />}</Button>
          return <Button key={action} variant="ghost" size="sm" className="h-7 text-xs" {...btnProps}>Cancel</Button>
        })}
        {actions.length === 0 ? <span className="text-xs text-muted-foreground">No allowed actions</span> : null}
      </div>
      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {error.title} — {error.message}
        </div>
      ) : null}
    </div>
  )
}

function BarrierOverrideCard({
  detail,
  role,
  onUpdated,
}: {
  detail: SessionDetail
  role: OperatorRole
  onUpdated: () => Promise<boolean | void>
}) {
  const [reasonCode, setReasonCode] = useState('MANUAL_OPEN_BARRIER')
  const [note, setNote] = useState('Manual barrier open from Session History.')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ReturnType<typeof toAppErrorDisplay> | null>(null)
  const [success, setSuccess] = useState('')

  const sessionId = String(detail.session.sessionId)
  const terminal = isSessionTerminal(detail.session.status)
  const lockReason = getManualBarrierOverrideLockReason(role, detail.session.status, detail.session.allowedActions ?? [])
  const disabled = Boolean(lockReason) || busy

  async function handleConfirm() {
    try {
      setBusy(true)
      setError(null)
      setSuccess('')
      const result = await manualOpenBarrierSession(sessionId, {
        requestId: rid(), idempotencyKey: rid(), occurredAt: new Date().toISOString(),
        reasonCode: reasonCode.trim() || 'MANUAL_OPEN_BARRIER',
        note: note.trim() || 'Manual barrier open.',
      })
      setSuccess(result.reviewId ? `Override recorded · reviewId=${result.reviewId}` : 'Override recorded.')
      await onUpdated()
    } catch (e) {
      setError(toAppErrorDisplay(e, 'Manual barrier open failed'))
    } finally {
      setBusy(false)
    }
  }

  if (terminal) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Terminal state — barrier override not available
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="info" label={`role ${role || '—'}`} />
        <StatusBadge tone="neutral" label={`session ${sessionId}`} />
        <StatusBadge tone={detail.session.reviewRequired ? 'warning' : 'neutral'} label={detail.session.reviewRequired ? 'review required' : 'review cleared'} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2">
          <p className="text-[10px] font-mono-data uppercase tracking-[0.15em] text-muted-foreground/70">Reason code</p>
          <Input value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="mt-1 h-7 text-xs" disabled={disabled} />
        </div>
        <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2">
          <p className="text-[10px] font-mono-data uppercase tracking-[0.15em] text-muted-foreground/70">Operator note</p>
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 h-7 text-xs" disabled={disabled} />
        </div>
      </div>
      {success ? (
        <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success/8 px-3 py-2 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {success}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {error.title} — {error.message}
        </div>
      ) : null}
      {lockReason && !terminal ? (
        <div className="text-xs text-amber-600 dark:text-amber-400">Lock: {lockReason}</div>
      ) : null}
      {!terminal ? (
        <DangerConfirmDialog
          title="Open barrier manually?"
          description="Records a manual review, decision, barrier command, and incident. Run only after on-site confirmation."
          confirmLabel="Open barrier"
          onConfirm={handleConfirm}
          disabled={disabled}
          busy={busy}
          tone="warning"
          meta={<div><p>sessionId={sessionId}</p><p>reasonCode={reasonCode.trim() || 'MANUAL_OPEN_BARRIER'}</p></div>}
          trigger={(triggerProps) => (
            <Button variant="entry" size="sm" className="h-7 text-xs" {...triggerProps}>
              {busy ? '…' : <><DoorOpen className="h-3.5 w-3.5" /> Manual open barrier</>}
            </Button>
          )}
        />
      ) : null}
    </div>
  )
}

function ReadsSection({ detail }: { detail: SessionDetail }) {
  const count = detail.reads.length
  const hasMedia = detail.reads.some((r) => r.evidence.media || r.evidence.cameraFrameRef || r.evidence.cropRef)
  return (
    <CollapsibleSection
      title="Reads"
      description={`${count} event${count !== 1 ? 's' : ''}`}
      defaultOpen={count > 0}
      count={count}
      countVariant={count === 0 ? 'neutral' : 'success'}
      className="mt-3"
    >
      {count === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No read events.</p>
      ) : (
        <div className="space-y-2">
          {detail.reads.map((read) => (
            <div key={read.readEventId} className="rounded-xl border border-border/60 bg-background/35 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">{read.readType}</Badge>
                <span className="text-[11px] font-mono-data text-muted-foreground">
                  {new Date(read.occurredAt).toLocaleTimeString('vi-VN')}
                </span>
                {typeof read.ocrConfidence === 'number' ? (
                  <Badge variant="amber" className="text-[10px]">ocr {formatNumber(read.ocrConfidence, 2)}</Badge>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs text-foreground/80">
                {read.plateCompact || read.plateRaw || '—'}
                <span className="text-muted-foreground"> · rfid={read.rfidUid || '—'} · sensor={read.sensorState || '—'}</span>
              </p>
              {(read.evidence.sourceDeviceCode || hasMedia) ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {read.evidence.sourceDeviceCode ? `device ${read.evidence.sourceDeviceCode}` : ''}
                  {read.evidence.media?.mediaId ? ` · media ${read.evidence.media.mediaId}` : ''}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}

function DecisionsSection({ detail }: { detail: SessionDetail }) {
  const count = detail.decisions.length
  const hasReview = detail.decisions.some((d) => d.reviewRequired)
  return (
    <CollapsibleSection
      title="Decisions"
      description={`${count} decision${count !== 1 ? 's' : ''}`}
      defaultOpen={count > 0}
      count={count}
      countVariant={count === 0 ? 'neutral' : hasReview ? 'amber' : 'success'}
      className="mt-3"
    >
      {count === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No decisions yet — session is likely in a waiting state.</p>
      ) : (
        <div className="space-y-2">
          {detail.decisions.map((decision) => (
            <div key={decision.decisionId} className="rounded-xl border border-border/60 bg-background/35 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="amber" className="text-[10px]">{decision.decisionCode}</Badge>
                <Badge variant="outline" className="text-[10px]">{decision.finalAction || decision.recommendedAction || '—'}</Badge>
                {decision.reviewRequired ? <Badge variant="amber" className="text-[10px]">review</Badge> : null}
              </div>
              <p className="mt-1.5 text-xs text-foreground/90">{decision.explanation}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {decision.reasonCode}{decision.reasonDetail ? ` · ${decision.reasonDetail}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}

function BarrierSection({ detail }: { detail: SessionDetail }) {
  const count = detail.barrierCommands.length
  const openCount = detail.barrierCommands.filter((c) => c.commandType === 'OPEN' && c.status !== 'REJECTED').length
  return (
    <CollapsibleSection
      title="Barrier commands"
      description={`${count} command${count !== 1 ? 's' : ''}`}
      defaultOpen={count > 0 && openCount > 0}
      count={count}
      countVariant={count === 0 ? 'neutral' : openCount > 0 ? 'success' : 'amber'}
      className="mt-3"
    >
      {count === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No barrier commands.</p>
      ) : (
        <div className="space-y-2">
          {detail.barrierCommands.map((cmd) => (
            <div key={cmd.commandId} className="rounded-xl border border-border/60 bg-background/35 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">{cmd.commandType}</Badge>
                <Badge variant={cmd.status === 'ACKNOWLEDGED' ? 'entry' : cmd.status === 'REJECTED' ? 'destructive' : 'outline'} className="text-[10px]">{cmd.status}</Badge>
                <span className="text-[11px] font-mono-data text-muted-foreground">
                  {new Date(cmd.issuedAt).toLocaleTimeString('vi-VN')}
                  {cmd.ackAt ? ' · ack ✓' : ' · ack —'}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {cmd.reasonCode || '—'}
              </p>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}

function ReviewsSection({ detail }: { detail: SessionDetail }) {
  const count = detail.manualReviews.length
  return (
    <CollapsibleSection
      title="Manual reviews"
      description={`${count} review${count !== 1 ? 's' : ''}`}
      defaultOpen={count > 0}
      count={count}
      countVariant={count === 0 ? 'neutral' : detail.manualReviews.some((r) => r.status === 'OPEN') ? 'amber' : 'success'}
      className="mt-3"
    >
      {count === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No manual reviews.</p>
      ) : (
        <div className="space-y-2">
          {detail.manualReviews.map((review) => (
            <div key={review.reviewId} className="rounded-xl border border-border/60 bg-background/35 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={review.status === 'OPEN' ? 'amber' : 'muted'} className="text-[10px]">{review.status}</Badge>
                <span className="text-[10px] font-mono-data text-muted-foreground">{review.queueReasonCode}</span>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                claim={review.claimedByUserId || '—'} · resolve={review.resolvedByUserId || '—'}
              </p>
              {review.note ? <p className="mt-1 text-xs text-foreground/80">{review.note}</p> : null}
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}

function IncidentsSection({ detail }: { detail: SessionDetail }) {
  const count = detail.incidents.length
  const openCount = detail.incidents.filter((i) => i.status === 'OPEN').length
  return (
    <CollapsibleSection
      title="Incidents"
      description={`${count} incident${count !== 1 ? 's' : ''}`}
      defaultOpen={count > 0}
      count={count}
      countVariant={openCount > 0 ? 'destructive' : count === 0 ? 'neutral' : 'amber'}
      className="mt-3"
    >
      {count === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No incidents.</p>
      ) : (
        <div className="space-y-2">
          {detail.incidents.map((incident) => (
            <div key={incident.incidentId} className="rounded-xl border border-border/60 bg-background/35 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={incident.status === 'OPEN' ? 'destructive' : 'muted'} className="text-[10px]">{incident.status}</Badge>
                <span className="text-[10px] font-mono-data text-muted-foreground">{incident.incidentType} · {incident.title}</span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                severity={incident.severity}{incident.detail ? ` · ${incident.detail}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}

export function SessionDetailConsole({
  detail,
  role,
  onUpdated,
}: {
  detail: SessionDetail
  role: OperatorRole
  onUpdated: () => Promise<boolean | void>
}) {
  const latestDecision = readLatestDecision(detail)
  const latestRead = readLatestRead(detail)
  const session = detail.session

  return (
    <div className="space-y-0">
      {/* Quick stats row */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Badge variant={session.direction === 'ENTRY' ? 'entry' : 'exit'} className="text-[10px]">
          {session.direction}
        </Badge>
        <Badge variant={sessionVariant(session.status)} className="text-[10px]">{session.status}</Badge>
        {session.reviewRequired ? <Badge variant="amber" className="text-[10px]">review required</Badge> : null}
        {detail.incidents.some((i) => i.status === 'OPEN') ? <Badge variant="destructive" className="text-[10px]">incident open</Badge> : null}
        <span className="ml-auto text-[10px] font-mono-data text-muted-foreground">
          {session.siteCode} / {session.gateCode} / {session.laneCode}
        </span>
      </div>

      {/* Metadata grid — compact 2 col */}
      <CollapsibleSection title="Metadata" description="Core fields" defaultOpen={true} className="mt-3">
        <div className="grid grid-cols-2 gap-x-6">
          <MetaRow label="Session" value={String(session.sessionId)} />
          <MetaRow label="Plate" value={session.plateCompact || '—'} />
          <MetaRow label="Opened" value={formatDateTime(session.openedAt)} />
          <MetaRow label="Resolved" value={session.resolvedAt ? formatDateTime(session.resolvedAt) : '—'} />
          <MetaRow label="Ticket" value={session.ticketId || '—'} />
          <MetaRow label="RFID UID" value={session.rfidUid || '—'} />
          <MetaRow label="Reads" value={String(session.readCount)} />
          <MetaRow label="Decisions" value={String(session.decisionCount)} />
          <MetaRow label="Barriers" value={String(session.barrierCommandCount)} />
          <MetaRow label="Actions" value={session.allowedActions.length > 0 ? session.allowedActions.join(', ') : 'none'} />
        </div>
      </CollapsibleSection>

      {/* Decision highlight */}
      {latestDecision ? (
        <CollapsibleSection
          title="Latest decision"
          description={latestDecision.decisionCode}
          defaultOpen={true}
          className="mt-3"
        >
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="amber" className="text-[10px]">{latestDecision.decisionCode}</Badge>
            <Badge variant="outline" className="text-[10px]">{latestDecision.finalAction || latestDecision.recommendedAction || '—'}</Badge>
            {latestDecision.reviewRequired ? <Badge variant="amber" className="text-[10px]">review</Badge> : null}
          </div>
          <p className="mt-1.5 text-xs text-foreground">{latestDecision.explanation}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {latestDecision.reasonCode}{latestDecision.reasonDetail ? ` · ${latestDecision.reasonDetail}` : ''}
          </p>
        </CollapsibleSection>
      ) : null}

      {/* Action bar */}
      <CollapsibleSection title="Actions" description="Run permitted session actions" defaultOpen={true} className="mt-3">
        <ActionBar detail={detail} role={role} onUpdated={onUpdated} />
      </CollapsibleSection>

      {/* Barrier override — OPS/ADMIN only */}
      {(role === 'OPS' || role === 'ADMIN') ? (
        <CollapsibleSection title="Barrier override" description="Manual open (OPS/ADMIN)" defaultOpen={false} className="mt-3">
          <BarrierOverrideCard detail={detail} role={role} onUpdated={onUpdated} />
        </CollapsibleSection>
      ) : null}

      {/* Read events */}
      <ReadsSection detail={detail} />

      {/* Decisions */}
      <DecisionsSection detail={detail} />

      {/* Barrier commands */}
      <BarrierSection detail={detail} />

      {/* Manual reviews */}
      <ReviewsSection detail={detail} />

      {/* Incidents */}
      <IncidentsSection detail={detail} />
    </div>
  )
}
