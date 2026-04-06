import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Layers3,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateTimeValue } from '@/i18n/format'
import { EffectivePlateSourceBadge } from '@/features/run-lane/components/EffectivePlateSourceBadge'
import { useRunLaneSubmit } from '@/features/run-lane/hooks/useRunLaneSubmit'
import { useRunLaneStore } from '@/features/run-lane/store/runLaneStoreContext'
import {
  selectRunLaneCanSubmit,
  selectRunLaneCurrentSessionId,
  selectRunLaneEffectivePlateForSubmit,
  selectRunLaneEffectivePlateSource,
  selectRunLaneSessionAllowedActions,
  selectRunLaneSubmit,
  selectRunLaneSubmitDecision,
  selectRunLaneSubmitEvent,
  selectRunLaneSubmitSession,
  selectRunLaneTopology,
} from '@/features/run-lane/store/runLaneSelectors'
import { cn } from '@/lib/utils'
import type { ResolveSessionRes } from '@/lib/contracts/sessions'

function SubmitStagePill({ stage }: { stage: string }) {
  const { t } = useTranslation()
  if (stage === 'success') return <Badge variant="entry" className="text-[10px]">{t('submitResult.status.success')}</Badge>
  if (stage === 'error') return <Badge variant="destructive" className="text-[10px]">{t('submitResult.status.error')}</Badge>
  if (stage === 'submitting') return <Badge variant="amber" className="text-[10px]">{t('submitResult.status.submitting')}</Badge>
  return <Badge variant="outline" className="text-[10px]">{t('submitResult.status.ready')}</Badge>
}

function SummaryRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-2 first:pt-0 last:border-b-0 last:pb-0">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('max-w-[65%] break-all text-right text-xs', mono ? 'font-mono-data font-medium text-foreground' : 'text-foreground')}>
        {value}
      </p>
    </div>
  )
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  badge,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  badge?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border border-border/50 bg-muted/15">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-muted/20"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
          {badge}
        </div>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open ? <div className="border-t border-border/40 px-3 pb-3 pt-1">{children}</div> : null}
    </div>
  )
}

function DecisionBadge({ code }: { code: string | null | undefined }) {
  const { t } = useTranslation()
  if (!code) return <Badge variant="outline" className="text-[10px]">{t('submitResult.none')}</Badge>
  if (code.includes('APPROVE') || code.includes('PASS')) return <Badge variant="entry" className="text-[10px]">{code}</Badge>
  if (code.includes('REVIEW')) return <Badge variant="amber" className="text-[10px]">{code}</Badge>
  if (code.includes('DENY') || code.includes('BLOCK') || code.includes('ERROR')) return <Badge variant="destructive" className="text-[10px]">{code}</Badge>
  return <Badge variant="secondary" className="text-[10px]">{code}</Badge>
}

function DecisionSection({ decision }: { decision: ResolveSessionRes['decision'] }) {
  const { t } = useTranslation()

  return (
    <CollapsibleSection
      title={t('submitResult.decision.title')}
      defaultOpen={true}
      badge={decision ? <DecisionBadge code={decision.decisionCode} /> : undefined}
    >
      {decision ? (
        <div className="space-y-0.5">
          <SummaryRow label={t('submitResult.decision.code')} value={decision.decisionCode} />
          <SummaryRow label={t('submitResult.decision.action')} value={decision.finalAction || decision.recommendedAction} />
          <SummaryRow label={t('submitResult.decision.reason')} value={decision.reasonDetail || decision.reasonCode || t('common.dash')} />
          {decision.reviewRequired ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-600">{t('submitResult.decision.reviewRequired')}</p>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">{t('submitResult.decision.reviewNotRequired')}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
          {t('submitResult.decision.empty')}
        </div>
      )}
    </CollapsibleSection>
  )
}

function SessionSection({
  session,
  allowedActions,
}: {
  session: ReturnType<typeof selectRunLaneSubmitSession>
  allowedActions: ReturnType<typeof selectRunLaneSessionAllowedActions>
}) {
  const { t } = useTranslation()

  return (
    <CollapsibleSection
      title={t('submitResult.session.title')}
      defaultOpen={true}
      badge={
        session ? (
          <Badge
            variant={
              session.status === 'APPROVED' || session.status === 'PASSED'
                ? 'entry'
                : session.status === 'WAITING_DECISION' || session.status === 'WAITING_PAYMENT'
                  ? 'amber'
                  : session.status === 'DENIED' || session.status === 'CANCELLED' || session.status === 'ERROR'
                    ? 'destructive'
                    : 'secondary'
            }
            className="text-[10px]"
          >
            {session.status}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">{t('submitResult.none')}</Badge>
        )
      }
    >
      {session ? (
        <div className="space-y-0.5">
          <SummaryRow label={t('submitResult.session.sessionId')} value={String(session.sessionId)} />
          <SummaryRow label={t('submitResult.session.plate')} value={session.plateCompact || t('common.dash')} />
          <SummaryRow label={t('submitResult.session.openedAt')} value={formatDateTimeValue(session.openedAt)} />
          <SummaryRow label={t('submitResult.session.counts')} value={t('submitResult.session.countsValue', { reads: session.readCount, decisions: session.decisionCount })} mono={false} />
          {allowedActions.length > 0 ? (
            <SummaryRow label={t('submitResult.session.allowedActions')} value={allowedActions.join(', ')} mono={false} />
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
          {t('submitResult.session.empty')}
        </div>
      )}
    </CollapsibleSection>
  )
}

function GateEventSection({ event }: { event: ReturnType<typeof selectRunLaneSubmitEvent> }) {
  const { t } = useTranslation()

  return (
    <CollapsibleSection
      title={t('submitResult.event.title')}
      defaultOpen={false}
      badge={
        event ? (
          <Badge variant={event.changed ? 'entry' : 'outline'} className="text-[10px]">
            {event.changed ? t('submitResult.event.changed') : t('submitResult.event.unchanged')}
          </Badge>
        ) : undefined
      }
    >
      {event ? (
        <div className="space-y-0.5">
          <SummaryRow label={t('submitResult.event.eventId')} value={String(event.eventId)} />
          <SummaryRow label={t('submitResult.event.time')} value={formatDateTimeValue(event.eventTime)} />
          <SummaryRow label={t('submitResult.event.outboxId')} value={String(event.outboxId)} />
          <SummaryRow label={t('submitResult.event.device')} value={event.deviceCode || t('common.dash')} />
        </div>
      ) : (
        <div className="py-2 text-xs text-muted-foreground">{t('submitResult.event.empty')}</div>
      )}
    </CollapsibleSection>
  )
}

function ActionsSection() {
  const { t } = useTranslation()
  const submit = useRunLaneStore(selectRunLaneSubmit)
  const currentSessionId = useRunLaneStore(selectRunLaneCurrentSessionId)
  const allowedActions = useRunLaneStore(selectRunLaneSessionAllowedActions)
  const canSubmit = useRunLaneStore(selectRunLaneCanSubmit)

  const {
    submitCurrentLaneFlow,
    confirmCurrentSessionPass,
    cancelCurrentSession,
    openSessionDetail,
    resetSubmitResult,
  } = useRunLaneSubmit()

  const busy = submit.stage === 'submitting' || submit.actionStage === 'running'
  const canConfirmPass = Boolean(currentSessionId) && allowedActions.includes('CONFIRM_PASS')
  const canCancelSession = Boolean(currentSessionId) && allowedActions.includes('CANCEL')

  return (
    <CollapsibleSection title={t('submitResult.actions.title')} defaultOpen={true}>
      {submit.error ? (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{submit.error}</p>
        </div>
      ) : null}

      {submit.message && submit.stage !== 'idle' ? (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Layers3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p>{submit.message}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => void submitCurrentLaneFlow()}
          disabled={busy || !canSubmit}
          className="h-8 gap-1.5 text-[11px]"
        >
          {submit.stage === 'submitting' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
          {t('submitResult.actions.submit')}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void openSessionDetail()}
          disabled={busy || !currentSessionId}
          className="h-8 gap-1.5 text-[11px]"
        >
          {submit.actionStage === 'running' && submit.lastAction === 'open_session_detail' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {t('submitResult.actions.refresh')}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void confirmCurrentSessionPass()}
          disabled={busy || !canConfirmPass}
          className="h-8 gap-1.5 text-[11px]"
        >
          {submit.actionStage === 'running' && submit.lastAction === 'confirm_pass' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {t('submitResult.actions.confirmPass')}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void cancelCurrentSession()}
          disabled={busy || !canCancelSession}
          className="h-8 gap-1.5 text-[11px] text-destructive hover:text-destructive"
        >
          {submit.actionStage === 'running' && submit.lastAction === 'cancel_session' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          {t('submitResult.actions.cancel')}
        </Button>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => resetSubmitResult(t('submitResult.actions.resetNotice'))}
        disabled={busy && submit.stage === 'submitting'}
        className="mt-2 h-8 w-full gap-1.5 text-[11px]"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {t('submitResult.actions.reset')}
      </Button>
    </CollapsibleSection>
  )
}

export function SubmitResultPanel() {
  const { t } = useTranslation()
  const submit = useRunLaneStore(selectRunLaneSubmit)
  const topology = useRunLaneStore(selectRunLaneTopology)
  const effectivePlate = useRunLaneStore(selectRunLaneEffectivePlateForSubmit)
  const effectiveSource = useRunLaneStore(selectRunLaneEffectivePlateSource)
  const session = useRunLaneStore(selectRunLaneSubmitSession)
  const decision = useRunLaneStore(selectRunLaneSubmitDecision)
  const event = useRunLaneStore(selectRunLaneSubmitEvent)
  const allowedActions = useRunLaneStore(selectRunLaneSessionAllowedActions)

  return (
    <div className="space-y-3">
      <Card className="border-border/60 bg-card/96">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <SubmitStagePill stage={submit.stage} />
              <Badge variant="secondary" className="text-[10px]">
                {(topology.siteCode || t('common.dash'))}/{(topology.laneCode || t('common.dash'))}
              </Badge>
              <EffectivePlateSourceBadge source={effectiveSource} hasValue={Boolean(effectivePlate)} />
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t('submitResult.effectivePlate')}</p>
              <p className="font-mono-data text-base font-semibold text-foreground">{effectivePlate || t('common.dash')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <DecisionSection decision={decision} />
      <SessionSection session={session} allowedActions={allowedActions} />
      <GateEventSection event={event} />
      <ActionsSection />
    </div>
  )
}
