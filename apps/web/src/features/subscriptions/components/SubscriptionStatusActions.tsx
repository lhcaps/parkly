import { InlineMessage } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DangerConfirmDialog } from '@/components/state/danger-confirm-dialog'
import { Loader2 } from 'lucide-react'
import type { SubscriptionDetail, SubscriptionStatus } from '../types'
import { SUBSCRIPTION_MUTABLE_STATUS_VALUES } from '../types'

function buttonVariant(status: SubscriptionStatus): 'secondary' | 'outline' | 'destructive' {
  if (status === 'CANCELLED') return 'destructive'
  if (status === 'ACTIVE') return 'secondary'
  return 'outline'
}

function describeTransition(current: string, next: SubscriptionStatus) {
  if (next === 'SUSPENDED') return `Suspend this subscription. Current status is ${current}. Linked vehicles and spot assignments remain visible, but operational flows should treat the subscription as suspended.`
  if (next === 'CANCELLED') return `Cancel this subscription. Current status is ${current}. This is the most destructive lifecycle change exposed in this shell.`
  return `Move this subscription to ACTIVE. Current status is ${current}.`
}

export function SubscriptionStatusActions({
  detail,
  canMutate,
  busy,
  error,
  success,
  onPatchStatus,
}: {
  detail: SubscriptionDetail
  canMutate: boolean
  busy: boolean
  error: string
  success: string
  onPatchStatus: (status: SubscriptionStatus) => Promise<void>
}) {
  const availableStatuses = SUBSCRIPTION_MUTABLE_STATUS_VALUES.filter((status) => status !== detail.effectiveStatus)

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono-data uppercase tracking-[0.16em] text-muted-foreground">Lifecycle actions</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">current {detail.effectiveStatus}</Badge>
            <Badge variant="outline">explicit {detail.status}</Badge>
          </div>
        </div>
        {!canMutate ? <p className="text-xs text-muted-foreground">Read-only role</p> : null}
      </div>

      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      {success ? <InlineMessage tone="success">{success}</InlineMessage> : null}

      {canMutate ? (
        <div className="flex flex-wrap gap-2">
          {availableStatuses.map((status) => (
            <DangerConfirmDialog
              key={status}
              title={`Change status to ${status}`}
              description={describeTransition(detail.effectiveStatus, status)}
              confirmLabel={`Confirm ${status}`}
              busy={busy}
              onConfirm={() => onPatchStatus(status)}
              trigger={(triggerProps) => (
                <Button type="button" variant={buttonVariant(status)} size="sm" {...triggerProps}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {status}
                </Button>
              )}
            />
          ))}
        </div>
      ) : (
        <InlineMessage tone="info">This role can read subscription detail but cannot change lifecycle state.</InlineMessage>
      )}
    </div>
  )
}
