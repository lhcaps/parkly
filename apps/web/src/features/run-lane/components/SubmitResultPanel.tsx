import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DatabaseZap,
  FileStack,
  Layers3,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

function SubmitStagePill({ stage, error }: { stage: string; error: string | null }) {
  if (stage === 'success') return <Badge variant="entry" className="text-[10px]">Thành công</Badge>
  if (stage === 'error') return <Badge variant="destructive" className="text-[10px]">Lỗi</Badge>
  if (stage === 'submitting') return <Badge variant="amber" className="text-[10px]">Đang gửi...</Badge>
  return <Badge variant="outline" className="text-[10px]">Sẵn sàng</Badge>
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
  className,
  badge,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
  badge?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={cn('rounded-xl border border-border/50 bg-muted/15', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
          {badge}
        </div>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && <div className="border-t border-border/40 px-3 pb-3 pt-1">{children}</div>}
    </div>
  )
}

function DecisionBadge({ code }: { code: string | null | undefined }) {
  if (!code) return <Badge variant="outline" className="text-[10px]">Chưa có</Badge>
  if (code.includes('APPROVE') || code.includes('PASS')) return <Badge variant="entry" className="text-[10px]">{code}</Badge>
  if (code.includes('REVIEW')) return <Badge variant="amber" className="text-[10px]">{code}</Badge>
  if (code.includes('DENY') || code.includes('BLOCK') || code.includes('ERROR')) return <Badge variant="destructive" className="text-[10px]">{code}</Badge>
  return <Badge variant="secondary" className="text-[10px]">{code}</Badge>
}

function DecisionSection({
  decision,
}: {
  decision: ResolveSessionRes['decision']
}) {
  return (
    <CollapsibleSection
      title="Quyết định"
      defaultOpen={true}
      badge={decision && <DecisionBadge code={decision.decisionCode} />}
    >
      {decision ? (
        <div className="space-y-0.5">
          <SummaryRow label="Mã quyết định" value={decision.decisionCode} />
          <SummaryRow label="Hành động" value={decision.finalAction || decision.recommendedAction} />
          <SummaryRow label="Lý do" value={decision.reasonDetail || decision.reasonCode || '—'} />
          {decision.reviewRequired && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-600">Cần review trước khi tiếp tục</p>
            </div>
          )}
          {!decision.reviewRequired && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">Không cần review thêm</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
          Chưa có quyết định — gửi lane flow để nhận kết quả
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
  return (
    <CollapsibleSection
      title="Session"
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
          <Badge variant="outline" className="text-[10px]">Chưa có</Badge>
        )
      }
    >
      {session ? (
        <div className="space-y-0.5">
          <SummaryRow label="Session ID" value={String(session.sessionId)} />
          <SummaryRow label="Biển số" value={session.plateCompact || '—'} />
          <SummaryRow label="Mở lúc" value={session.openedAt ? new Date(session.openedAt).toLocaleString('vi-VN') : '—'} />
          <SummaryRow label="Đọc / Quyết định" value={`${session.readCount} / ${session.decisionCount}`} />
          {allowedActions.length > 0 && (
            <SummaryRow label="Hành động" value={allowedActions.join(', ')} mono={false} />
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
          Chưa có session — gửi lane flow để tạo
        </div>
      )}
    </CollapsibleSection>
  )
}

function GateEventSection({
  event,
}: {
  event: ReturnType<typeof selectRunLaneSubmitEvent>
}) {
  return (
    <CollapsibleSection
      title="Gate Event"
      defaultOpen={false}
      badge={
        event ? (
          <Badge variant={event.changed ? 'entry' : 'outline'} className="text-[10px]">
            {event.changed ? 'Đã thay đổi' : 'Không đổi'}
          </Badge>
        ) : null
      }
    >
      {event ? (
        <div className="space-y-0.5">
          <SummaryRow label="Event ID" value={String(event.eventId)} />
          <SummaryRow label="Thời gian" value={event.eventTime ? new Date(event.eventTime).toLocaleString('vi-VN') : '—'} />
          <SummaryRow label="Outbox ID" value={String(event.outboxId)} />
          <SummaryRow label="Thiết bị" value={event.deviceCode || '—'} />
        </div>
      ) : (
        <div className="py-2 text-xs text-muted-foreground">
          Chưa có gate event
        </div>
      )}
    </CollapsibleSection>
  )
}

function ActionsSection() {
  const submit = useRunLaneStore(selectRunLaneSubmit)
  const currentSessionId = useRunLaneStore(selectRunLaneCurrentSessionId)
  const allowedActions = useRunLaneStore(selectRunLaneSessionAllowedActions)
  const effectivePlate = useRunLaneStore(selectRunLaneEffectivePlateForSubmit)
  const canSubmit = useRunLaneStore(selectRunLaneCanSubmit)
  const topology = useRunLaneStore(selectRunLaneTopology)

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
    <CollapsibleSection title="Actions" defaultOpen={true}>
      {submit.error && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>{submit.error}</p>
        </div>
      )}

      {submit.message && submit.stage !== 'idle' && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Layers3 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          <p>{submit.message}</p>
        </div>
      )}

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
          Gửi Flow
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void openSessionDetail()}
          disabled={busy || !currentSessionId}
          className="h-8 gap-1.5 text-[11px]"
        >
          {submit.actionStage === 'running' && submit.lastAction === 'open_session_detail' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void confirmCurrentSessionPass()}
          disabled={busy || !canConfirmPass}
          className="h-8 gap-1.5 text-[11px]"
        >
          {submit.actionStage === 'running' && submit.lastAction === 'confirm_pass' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          Confirm Pass
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void cancelCurrentSession()}
          disabled={busy || !canCancelSession}
          className="h-8 gap-1.5 text-[11px] text-destructive hover:text-destructive"
        >
          {submit.actionStage === 'running' && submit.lastAction === 'cancel_session' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          Hủy
        </Button>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          resetSubmitResult('Đã reset. Preview và override được giữ nguyên.')
        }
        disabled={busy && submit.stage === 'submitting'}
        className="mt-2 w-full h-8 gap-1.5 text-[11px]"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset Result
      </Button>
    </CollapsibleSection>
  )
}

export function SubmitResultPanel() {
  const submit = useRunLaneStore(selectRunLaneSubmit)
  const topology = useRunLaneStore(selectRunLaneTopology)
  const effectivePlate = useRunLaneStore(selectRunLaneEffectivePlateForSubmit)
  const effectiveSource = useRunLaneStore(selectRunLaneEffectivePlateSource)
  const session = useRunLaneStore(selectRunLaneSubmitSession)
  const decision = useRunLaneStore(selectRunLaneSubmitDecision)
  const event = useRunLaneStore(selectRunLaneSubmitEvent)
  const allowedActions = useRunLaneStore(selectRunLaneSessionAllowedActions)

  const effectivePlateForDisplay = effectivePlate || '—'

  return (
    <div className="space-y-3">
      <Card className="border-border/60 bg-card/95">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <SubmitStagePill stage={submit.stage} error={submit.error} />
              <Badge variant="secondary" className="text-[10px]">
                {topology.siteCode || '—'}/{topology.laneCode || '—'}
              </Badge>
              <EffectivePlateSourceBadge source={effectiveSource} hasValue={Boolean(effectivePlate)} />
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Effective Plate</p>
              <p className="font-mono-data text-base font-semibold text-foreground">{effectivePlateForDisplay}</p>
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
