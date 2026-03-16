import { ArrowRightLeft, DatabaseZap, FileStack, Loader2, RefreshCw, RotateCcw, ShieldCheck, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRunLaneSubmit } from '@/features/run-lane/hooks/useRunLaneSubmit'
import { useRunLaneStore } from '@/features/run-lane/store/runLaneStoreContext'
import {
  selectRunLaneCanSubmit,
  selectRunLaneCurrentSessionId,
  selectRunLaneEffectivePlateForSubmit,
  selectRunLaneSessionAllowedActions,
  selectRunLaneSubmit,
} from '@/features/run-lane/store/runLaneSelectors'

export function PostSubmitActionsCard() {
  const submit = useRunLaneStore(selectRunLaneSubmit)
  const currentSessionId = useRunLaneStore(selectRunLaneCurrentSessionId)
  const allowedActions = useRunLaneStore(selectRunLaneSessionAllowedActions)
  const effectivePlate = useRunLaneStore(selectRunLaneEffectivePlateForSubmit)
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
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">post-submit actions</Badge>
          {currentSessionId ? <Badge variant="muted">session {currentSessionId}</Badge> : null}
          {submit.lastAction ? <Badge variant="outline">last action {submit.lastAction}</Badge> : null}
        </div>
        <CardTitle className="text-sm sm:text-base">Post-submit Actions</CardTitle>
        <CardDescription>
          Continue with confirm-pass, cancel, or refresh session detail here — no need to open another tab.không cần rời màn.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-3xl border border-border/80 bg-background/40 p-4">
          <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Current submit state</p>
          <p className="mt-2 text-sm font-medium text-foreground">{submit.message}</p>
          {submit.error ? <p className="mt-2 text-sm text-destructive">{submit.error}</p> : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Effective plate: <span className="font-mono-data text-foreground">{effectivePlate || '—'}</span>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="entry"
            className="justify-start"
            onClick={() => void submitCurrentLaneFlow()}
            disabled={busy || !canSubmit}
          >
            {submit.stage === 'submitting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            Submit lane flow
          </Button>

          <Button
            type="button"
            variant="outline"
            className="justify-start"
            onClick={() => void openSessionDetail()}
            disabled={busy || !currentSessionId}
          >
            {submit.actionStage === 'running' && submit.lastAction === 'open_session_detail'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            Open session detail
          </Button>

          <Button
            type="button"
            variant="outline"
            className="justify-start"
            onClick={() => void confirmCurrentSessionPass()}
            disabled={busy || !canConfirmPass}
          >
            {submit.actionStage === 'running' && submit.lastAction === 'confirm_pass'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <ShieldCheck className="h-4 w-4" />}
            Confirm pass
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="justify-start"
            onClick={() => void cancelCurrentSession()}
            disabled={busy || !canCancelSession}
          >
            {submit.actionStage === 'running' && submit.lastAction === 'cancel_session'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <XCircle className="h-4 w-4" />}
            Cancel session
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-muted/25 p-4 text-sm text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <DatabaseZap className="h-4 w-4 text-primary" />
              <span className="font-medium">Allowed actions</span>
            </div>
            {allowedActions.length > 0 ? allowedActions.join(', ') : 'No allowed actions — session not loaded yet.ydrate.'}
          </div>

          <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => resetSubmitResult('Result surface manually reset. Current preview and override are preserved.i vẫn được giữ nguyên.')}
              disabled={busy && submit.stage === 'submitting'}
            >
              <RotateCcw className="h-4 w-4" />
              Reset result surface
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Resetting the result does not affect preview or override. Prepare for a new submission without losing context.g mất dữ liệu capture hiện tại.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 text-foreground">
            <FileStack className="h-4 w-4 text-primary" />
            <span className="font-medium">PR-10 principle</span>
          </div>
          Failed submit preserves preview and override. Successful submit loads the latest decision, session, and event. chốt ngay trên surface này để operator đọc và hành động tiếp.
        </div>
      </CardContent>
    </Card>
  )
}
