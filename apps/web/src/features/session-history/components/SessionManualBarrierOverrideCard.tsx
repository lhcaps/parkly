import { useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, DoorOpen, Loader2 } from 'lucide-react'
import { DangerConfirmDialog } from '@/components/state/danger-confirm-dialog'
import { DegradedBanner } from '@/components/state/degraded-banner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  getManualBarrierOverrideLockReason,
  isSessionTerminal,
  type OperatorRole,
} from '@/features/manual-control/session-action-access'
import { manualOpenBarrierSession } from '@/lib/api/sessions'
import type { SessionDetail } from '@/lib/contracts/sessions'
import { toAppErrorDisplay } from '@/lib/http/errors'

function rid() {
  return `ui_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="max-w-[68%] break-all text-right text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function SessionManualBarrierOverrideCard({
  detail,
  role,
  onUpdated,
}: {
  detail: SessionDetail
  role: OperatorRole
  onUpdated: () => Promise<void>
}) {
  const [reasonCode, setReasonCode] = useState('MANUAL_OPEN_BARRIER')
  const [note, setNote] = useState('Manual barrier open from Session History — operator confirmed.')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ReturnType<typeof toAppErrorDisplay> | null>(null)
  const [success, setSuccess] = useState('')

  const sessionId = String(detail.session.sessionId)
  const sessionStatus = detail.session.status
  const allowedActions = detail.session.allowedActions ?? []
  const terminal = isSessionTerminal(sessionStatus)

  // Lock reason checks role, live session status, and live allowedActions
  const lockReason = getManualBarrierOverrideLockReason(role, sessionStatus, allowedActions)
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
        note: note.trim() || 'Manual barrier open from Session History.',
      })

      setSuccess(
        result.reviewId
          ? `Barrier override recorded. reviewId=${result.reviewId}. Refreshing session snapshot.`
          : 'Barrier override recorded. Refreshing session snapshot.',
      )
      await onUpdated()
    } catch (actionError) {
      setError(toAppErrorDisplay(actionError, 'Manual barrier open failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DoorOpen className="h-4 w-4" />
          Manual barrier override
        </CardTitle>
        <CardDescription>
          For OPS or ADMIN to manually open the barrier from desktop. The action is tied to the current session for full audit trail.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="info" label={`role ${role || '—'}`} />
          <StatusBadge tone="neutral" label={`session ${sessionId}`} />
          <StatusBadge
            tone={terminal ? 'error' : detail.session.reviewRequired ? 'warning' : 'neutral'}
            label={terminal ? sessionStatus : detail.session.reviewRequired ? 'review required' : 'review cleared'}
          />
        </div>

        {/* Terminal session — prominent lock banner */}
        {terminal ? (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Session is {sessionStatus} — barrier override is not possible</p>
              <p className="mt-1 text-destructive/80">
                This session has reached a terminal state. Open a new session in Run Lane to process the vehicle.
              </p>
            </div>
          </div>
        ) : null}

        <div className="rounded-3xl border border-border/80 bg-muted/25 p-4">
          <MetaRow label="Lane" value={`${detail.session.siteCode} / ${detail.session.gateCode} / ${detail.session.laneCode}`} />
          <MetaRow label="Direction" value={detail.session.direction} />
          <MetaRow label="Plate" value={detail.session.plateCompact || '—'} />
          <MetaRow label="Session status" value={sessionStatus} />
          <MetaRow label="Barrier commands" value={String(detail.session.barrierCommandCount)} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Reason code</p>
            <Input
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
              className="mt-2"
              placeholder="MANUAL_OPEN_BARRIER"
              disabled={disabled}
            />
          </div>
          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Operator note</p>
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-2"
              placeholder="Reason for manual action"
              disabled={disabled}
            />
          </div>
        </div>

        {lockReason && !terminal ? (
          <DegradedBanner
            tone="warning"
            title="Manual override locked"
            description={lockReason}
            meta="The backend endpoint requires OPS or ADMIN role."
          />
        ) : !lockReason ? (
          <DegradedBanner
            tone="info"
            title="Override will refresh the session snapshot"
            description="After the backend accepts the request, the UI will force-reload session detail and the list to avoid stale state."
            meta="If the backend returns 500, check lane topology, barrier device, and outbox."
          />
        ) : null}

        {!terminal ? (
          <div className="flex flex-wrap gap-2">
            <DangerConfirmDialog
              title="Open barrier manually for this session?"
              description="This will record a manual review, decision, barrier command, and incident. Only run after on-site confirmation."
              confirmLabel="Open barrier"
              onConfirm={handleConfirm}
              disabled={disabled}
              busy={busy}
              tone="warning"
              meta={
                <div className="space-y-1">
                  <p>sessionId={sessionId}</p>
                  <p>reasonCode={reasonCode.trim() || 'MANUAL_OPEN_BARRIER'}</p>
                </div>
              }
              trigger={(triggerProps) => (
                <Button variant="entry" size="sm" {...triggerProps}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
                  Manual open barrier
                </Button>
              )}
            />
          </div>
        ) : null}

        {success ? (
          <div className="flex items-start gap-2 rounded-2xl border border-success/25 bg-success/10 px-4 py-4 text-sm text-success">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-all">{success}</span>
          </div>
        ) : null}

        {error ? (
          <div className="space-y-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">{error.title}</p>
                <p className="mt-1 break-all text-destructive/90">{error.message}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="error" label={error.code || 'UNKNOWN_ERROR'} icon={false} />
              {error.status != null ? <StatusBadge tone="warning" label={`HTTP ${error.status}`} icon={false} /> : null}
              {error.requestId ? <StatusBadge tone="neutral" label={`requestId ${error.requestId}`} icon={false} /> : null}
            </div>

            {error.nextAction ? <p className="text-xs text-destructive/85">Next: {error.nextAction}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
