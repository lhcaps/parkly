import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, DoorOpen, ShieldCheck, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { DangerConfirmDialog } from '@/components/state/danger-confirm-dialog'
import { StatusBadge } from '@/components/ui/status-badge'
import { Input } from '@/components/ui/input'
import {
  cancelSession,
  confirmPass,
  manualOpenBarrierSession,
  resolveSession,
} from '@/lib/api/sessions'
import type { SessionAllowedAction, SessionDetail } from '@/lib/contracts/sessions'
import { toAppErrorDisplay } from '@/lib/http/errors'
import { formatTimeValue } from '@/i18n/format'
import {
  getManualBarrierOverrideLockReason,
  getSessionActionLockReason,
  isSessionTerminal,
  type OperatorRole,
} from '@/features/manual-control/session-action-access'
import { formatDateTime, formatNumber, readLatestDecision } from '@/features/session-history/session-history-model'

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
  const { t } = useTranslation()
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
      setError(toAppErrorDisplay(actionError, t('sessionHistory.detail.actions.rejected')))
    } finally {
      setBusy('')
    }
  }

  if (terminal) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{t('sessionHistory.detail.actions.terminalLocked')}</span>
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
          const buttonProps = {
            disabled,
            title: lockReason || undefined,
            onClick: () => void run(action),
          }

          if (action === 'APPROVE') {
            return (
              <Button key={action} variant="secondary" size="sm" className="h-7 text-xs" {...buttonProps}>
                {busy === action ? '…' : <ShieldCheck className="h-3.5 w-3.5" />}
                {t('sessionHistory.detail.actions.approve')}
              </Button>
            )
          }
          if (action === 'REQUIRE_PAYMENT') {
            return (
              <Button key={action} variant="outline" size="sm" className="h-7 text-xs" {...buttonProps}>
                {busy === action ? '…' : t('sessionHistory.detail.actions.paymentHold')}
              </Button>
            )
          }
          if (action === 'DENY') {
            return (
              <Button key={action} variant="destructive" size="sm" className="h-7 text-xs" {...buttonProps}>
                {busy === action ? '…' : <XCircle className="h-3.5 w-3.5" />}
                {t('sessionHistory.detail.actions.reject')}
              </Button>
            )
          }
          if (action === 'CONFIRM_PASS') {
            return (
              <Button key={action} variant="entry" size="sm" className="h-7 text-xs" {...buttonProps}>
                {busy === action ? '…' : <CheckCircle2 className="h-3.5 w-3.5" />}
                {t('sessionHistory.detail.actions.confirmPass')}
              </Button>
            )
          }
          return (
            <Button key={action} variant="ghost" size="sm" className="h-7 text-xs" {...buttonProps}>
              {t('sessionHistory.detail.actions.cancel')}
            </Button>
          )
        })}
        {actions.length === 0 ? <span className="text-xs text-muted-foreground">{t('sessionHistory.detail.actions.none')}</span> : null}
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
  const { t } = useTranslation()
  const [reasonCode, setReasonCode] = useState('MANUAL_OPEN_BARRIER')
  const [note, setNote] = useState(t('sessionHistory.detail.barrier.defaultNote'))
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
        requestId: rid(),
        idempotencyKey: rid(),
        occurredAt: new Date().toISOString(),
        reasonCode: reasonCode.trim() || 'MANUAL_OPEN_BARRIER',
        note: note.trim() || t('sessionHistory.detail.barrier.fallbackNote'),
      })
      setSuccess(
        result.reviewId
          ? t('sessionHistory.detail.barrier.successWithReview', { reviewId: result.reviewId })
          : t('sessionHistory.detail.barrier.success'),
      )
      await onUpdated()
    } catch (actionError) {
      setError(toAppErrorDisplay(actionError, t('sessionHistory.detail.barrier.failed')))
    } finally {
      setBusy(false)
    }
  }

  if (terminal) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t('sessionHistory.detail.barrier.terminalUnavailable')}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="info" label={t('sessionHistory.detail.barrier.roleBadge', { role: role || t('common.dash') })} />
        <StatusBadge tone="neutral" label={t('sessionHistory.detail.barrier.sessionBadge', { sessionId })} />
        <StatusBadge
          tone={detail.session.reviewRequired ? 'warning' : 'neutral'}
          label={detail.session.reviewRequired ? t('sessionHistory.detail.barrier.reviewRequired') : t('sessionHistory.detail.barrier.reviewCleared')}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2">
          <label htmlFor="session-barrier-reason-code" className="text-[10px] font-mono-data uppercase tracking-[0.15em] text-muted-foreground/70">
            {t('sessionHistory.detail.barrier.reasonCode')}
          </label>
          <Input
            id="session-barrier-reason-code"
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value)}
            className="mt-1 h-7 text-xs"
            disabled={disabled}
          />
        </div>
        <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2">
          <label htmlFor="session-barrier-note" className="text-[10px] font-mono-data uppercase tracking-[0.15em] text-muted-foreground/70">
            {t('sessionHistory.detail.barrier.operatorNote')}
          </label>
          <Input
            id="session-barrier-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-1 h-7 text-xs"
            disabled={disabled}
          />
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

      {lockReason ? <div className="text-xs text-amber-600 dark:text-amber-400">{t('sessionHistory.detail.barrier.lockPrefix')} {lockReason}</div> : null}

      <DangerConfirmDialog
        title={t('sessionHistory.detail.barrier.confirmTitle')}
        description={t('sessionHistory.detail.barrier.confirmDescription')}
        confirmLabel={t('sessionHistory.detail.barrier.confirmButton')}
        onConfirm={handleConfirm}
        disabled={disabled}
        busy={busy}
        tone="warning"
        meta={
          <div>
            <p>sessionId={sessionId}</p>
            <p>reasonCode={reasonCode.trim() || 'MANUAL_OPEN_BARRIER'}</p>
          </div>
        }
        trigger={(triggerProps) => (
          <Button variant="entry" size="sm" className="h-7 text-xs" {...triggerProps}>
            {busy ? '…' : <DoorOpen className="h-3.5 w-3.5" />}
            {t('sessionHistory.detail.barrier.openButton')}
          </Button>
        )}
      />
    </div>
  )
}

function ReadsSection({ detail }: { detail: SessionDetail }) {
  const { t } = useTranslation()
  const count = detail.reads.length
  const hasMedia = detail.reads.some((item) => item.evidence.media || item.evidence.cameraFrameRef || item.evidence.cropRef)

  return (
    <CollapsibleSection
      title={t('sessionHistory.detail.reads.title')}
      description={t('sessionHistory.detail.reads.count', { count })}
      defaultOpen={count > 0}
      count={count}
      countVariant={count === 0 ? 'neutral' : 'success'}
      className="mt-3"
    >
      {count === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">{t('sessionHistory.detail.reads.empty')}</p>
      ) : (
        <div className="space-y-2">
          {detail.reads.map((read) => (
            <div key={read.readEventId} className="rounded-xl border border-border/60 bg-background/35 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">{read.readType}</Badge>
                <span className="text-[11px] font-mono-data text-muted-foreground">{formatTimeValue(read.occurredAt)}</span>
                {typeof read.ocrConfidence === 'number' ? (
                  <Badge variant="amber" className="text-[10px]">
                    {t('sessionHistory.detail.reads.ocr', { value: formatNumber(read.ocrConfidence, 2) })}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs text-foreground/80">
                {read.plateCompact || read.plateRaw || t('common.dash')}
                <span className="text-muted-foreground">
                  {' '}
                  · {t('sessionHistory.detail.reads.rfid', { value: read.rfidUid || t('common.dash') })} · {t('sessionHistory.detail.reads.sensor', { value: read.sensorState || t('common.dash') })}
                </span>
              </p>
              {(read.evidence.sourceDeviceCode || hasMedia) ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {read.evidence.sourceDeviceCode ? t('sessionHistory.detail.reads.device', { value: read.evidence.sourceDeviceCode }) : ''}
                  {read.evidence.media?.mediaId ? ` · ${t('sessionHistory.detail.reads.media', { value: read.evidence.media.mediaId })}` : ''}
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
  const { t } = useTranslation()
  const count = detail.decisions.length
  const hasReview = detail.decisions.some((item) => item.reviewRequired)

  return (
    <CollapsibleSection
      title={t('sessionHistory.detail.decisions.title')}
      description={t('sessionHistory.detail.decisions.count', { count })}
      defaultOpen={count > 0}
      count={count}
      countVariant={count === 0 ? 'neutral' : hasReview ? 'amber' : 'success'}
      className="mt-3"
    >
      {count === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">{t('sessionHistory.detail.decisions.empty')}</p>
      ) : (
        <div className="space-y-2">
          {detail.decisions.map((decision) => (
            <div key={decision.decisionId} className="rounded-xl border border-border/60 bg-background/35 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="amber" className="text-[10px]">{decision.decisionCode}</Badge>
                <Badge variant="outline" className="text-[10px]">{decision.finalAction || decision.recommendedAction || t('common.dash')}</Badge>
                {decision.reviewRequired ? <Badge variant="amber" className="text-[10px]">{t('sessionHistory.summary.reviewRequired')}</Badge> : null}
              </div>
              <p className="mt-1.5 text-xs text-foreground/90">{decision.explanation}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {decision.reasonCode}
                {decision.reasonDetail ? ` · ${decision.reasonDetail}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}

function BarrierSection({ detail }: { detail: SessionDetail }) {
  const { t } = useTranslation()
  const count = detail.barrierCommands.length
  const openCount = detail.barrierCommands.filter((item) => item.commandType === 'OPEN' && item.status !== 'REJECTED').length

  return (
    <CollapsibleSection
      title={t('sessionHistory.detail.barrierCommands.title')}
      description={t('sessionHistory.detail.barrierCommands.count', { count })}
      defaultOpen={count > 0 && openCount > 0}
      count={count}
      countVariant={count === 0 ? 'neutral' : openCount > 0 ? 'success' : 'amber'}
      className="mt-3"
    >
      {count === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">{t('sessionHistory.detail.barrierCommands.empty')}</p>
      ) : (
        <div className="space-y-2">
          {detail.barrierCommands.map((command) => (
            <div key={command.commandId} className="rounded-xl border border-border/60 bg-background/35 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">{command.commandType}</Badge>
                <Badge variant={command.status === 'ACKNOWLEDGED' ? 'entry' : command.status === 'REJECTED' ? 'destructive' : 'outline'} className="text-[10px]">
                  {command.status}
                </Badge>
                <span className="text-[11px] font-mono-data text-muted-foreground">
                  {formatTimeValue(command.issuedAt)}
                  {command.ackAt ? ` · ${t('sessionHistory.detail.barrierCommands.acknowledged')}` : ` · ${t('sessionHistory.detail.barrierCommands.pendingAck')}`}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{command.reasonCode || t('common.dash')}</p>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}

function ReviewsSection({ detail }: { detail: SessionDetail }) {
  const { t } = useTranslation()
  const count = detail.manualReviews.length

  return (
    <CollapsibleSection
      title={t('sessionHistory.detail.reviews.title')}
      description={t('sessionHistory.detail.reviews.count', { count })}
      defaultOpen={count > 0}
      count={count}
      countVariant={count === 0 ? 'neutral' : detail.manualReviews.some((item) => item.status === 'OPEN') ? 'amber' : 'success'}
      className="mt-3"
    >
      {count === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">{t('sessionHistory.detail.reviews.empty')}</p>
      ) : (
        <div className="space-y-2">
          {detail.manualReviews.map((review) => (
            <div key={review.reviewId} className="rounded-xl border border-border/60 bg-background/35 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={review.status === 'OPEN' ? 'amber' : 'muted'} className="text-[10px]">{review.status}</Badge>
                <span className="text-[10px] font-mono-data text-muted-foreground">{review.queueReasonCode}</span>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {t('sessionHistory.detail.reviews.claimAndResolve', {
                  claim: review.claimedByUserId || t('common.dash'),
                  resolve: review.resolvedByUserId || t('common.dash'),
                })}
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
  const { t } = useTranslation()
  const count = detail.incidents.length
  const openCount = detail.incidents.filter((item) => item.status === 'OPEN').length

  return (
    <CollapsibleSection
      title={t('sessionHistory.detail.incidents.title')}
      description={t('sessionHistory.detail.incidents.count', { count })}
      defaultOpen={count > 0}
      count={count}
      countVariant={openCount > 0 ? 'destructive' : count === 0 ? 'neutral' : 'amber'}
      className="mt-3"
    >
      {count === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">{t('sessionHistory.detail.incidents.empty')}</p>
      ) : (
        <div className="space-y-2">
          {detail.incidents.map((incident) => (
            <div key={incident.incidentId} className="rounded-xl border border-border/60 bg-background/35 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={incident.status === 'OPEN' ? 'destructive' : 'muted'} className="text-[10px]">{incident.status}</Badge>
                <span className="text-[10px] font-mono-data text-muted-foreground">
                  {incident.incidentType} · {incident.title}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {t('sessionHistory.detail.incidents.severity', { value: incident.severity })}
                {incident.detail ? ` · ${incident.detail}` : ''}
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
  const { t } = useTranslation()
  const latestDecision = readLatestDecision(detail)
  const session = detail.session

  return (
    <div className="space-y-0">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Badge variant={session.direction === 'ENTRY' ? 'entry' : 'exit'} className="text-[10px]">
          {session.direction}
        </Badge>
        <Badge variant={sessionVariant(session.status)} className="text-[10px]">{session.status}</Badge>
        {session.reviewRequired ? <Badge variant="amber" className="text-[10px]">{t('sessionHistory.summary.reviewRequired')}</Badge> : null}
        {detail.incidents.some((item) => item.status === 'OPEN') ? <Badge variant="destructive" className="text-[10px]">{t('sessionHistory.summary.incidentOpen')}</Badge> : null}
        <span className="ml-auto text-[10px] font-mono-data text-muted-foreground">
          {session.siteCode} / {session.gateCode} / {session.laneCode}
        </span>
      </div>

      <CollapsibleSection title={t('sessionHistory.detail.metadata.title')} description={t('sessionHistory.detail.metadata.description')} defaultOpen={true} className="mt-3">
        <div className="grid grid-cols-2 gap-x-6">
          <MetaRow label={t('sessionHistory.summary.session')} value={String(session.sessionId)} />
          <MetaRow label={t('sessionHistory.summary.plate')} value={session.plateCompact || t('common.dash')} />
          <MetaRow label={t('sessionHistory.summary.opened')} value={formatDateTime(session.openedAt)} />
          <MetaRow label={t('sessionHistory.summary.resolved')} value={session.resolvedAt ? formatDateTime(session.resolvedAt) : t('common.dash')} />
          <MetaRow label={t('sessionHistory.summary.ticket')} value={session.ticketId || t('common.dash')} />
          <MetaRow label={t('sessionHistory.summary.rfid')} value={session.rfidUid || t('common.dash')} />
          <MetaRow label={t('sessionHistory.detail.metadata.reads')} value={String(session.readCount)} />
          <MetaRow label={t('sessionHistory.detail.metadata.decisions')} value={String(session.decisionCount)} />
          <MetaRow label={t('sessionHistory.detail.metadata.barriers')} value={String(session.barrierCommandCount)} />
          <MetaRow
            label={t('sessionHistory.detail.metadata.allowedActions')}
            value={session.allowedActions.length > 0 ? session.allowedActions.join(', ') : t('sessionHistory.detail.actions.none')}
          />
        </div>
      </CollapsibleSection>

      {latestDecision ? (
        <CollapsibleSection title={t('sessionHistory.detail.latestDecision.title')} description={latestDecision.decisionCode} defaultOpen={true} className="mt-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="amber" className="text-[10px]">{latestDecision.decisionCode}</Badge>
            <Badge variant="outline" className="text-[10px]">{latestDecision.finalAction || latestDecision.recommendedAction || t('common.dash')}</Badge>
            {latestDecision.reviewRequired ? <Badge variant="amber" className="text-[10px]">{t('sessionHistory.summary.reviewRequired')}</Badge> : null}
          </div>
          <p className="mt-1.5 text-xs text-foreground">{latestDecision.explanation}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {latestDecision.reasonCode}
            {latestDecision.reasonDetail ? ` · ${latestDecision.reasonDetail}` : ''}
          </p>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection title={t('sessionHistory.detail.actions.title')} description={t('sessionHistory.detail.actions.description')} defaultOpen={true} className="mt-3">
        <ActionBar detail={detail} role={role} onUpdated={onUpdated} />
      </CollapsibleSection>

      {(['SUPER_ADMIN', 'SITE_ADMIN', 'MANAGER', 'OPERATOR'] as const).includes(role as never) ? (
        <CollapsibleSection title={t('sessionHistory.detail.barrier.title')} description={t('sessionHistory.detail.barrier.description')} defaultOpen={false} className="mt-3">
          <BarrierOverrideCard detail={detail} role={role} onUpdated={onUpdated} />
        </CollapsibleSection>
      ) : null}

      <ReadsSection detail={detail} />
      <DecisionsSection detail={detail} />
      <BarrierSection detail={detail} />
      <ReviewsSection detail={detail} />
      <IncidentsSection detail={detail} />
    </div>
  )
}
