import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  DoorOpen,
  Keyboard,
  Loader2,
  ShieldX,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { AppErrorDisplay } from '@/lib/http/errors'
import type { ReviewQueueAction, ReviewQueueItem } from '@/lib/contracts/reviews'
import type { ListScope, ReviewAction } from '../hooks/useReviewQueue'

function queueActionLabel(action: ReviewQueueAction, t: (key: string, options?: Record<string, unknown>) => string) {
  if (action === 'MANUAL_APPROVE') return t('reviewQueuePage.actions.approve')
  if (action === 'MANUAL_REJECT') return t('reviewQueuePage.actions.reject')
  if (action === 'MANUAL_OPEN_BARRIER') return t('reviewQueuePage.actions.openBarrier')
  if (action === 'CLAIM') return t('reviewQueuePage.actions.claim')
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

export interface ReviewActionPanelProps {
  selected: ReviewQueueItem | null
  listScope: ListScope
  liveStatus: string
  liveSessionAllowedActions: string[]
  isTerminal: boolean
  liveContextReady: boolean
  detailLoading: boolean
  detailError: string
  staleWarning: string
  actionBusy: string
  actionError: AppErrorDisplay | null
  reasonCode: string
  note: string
  onReasonCodeChange: (value: string) => void
  onNoteChange: (value: string) => void
  run: (action: ReviewAction) => void
  getActionLockReason: (action: ReviewQueueAction) => string | undefined
  isActionDisabled: (action: ReviewQueueAction) => boolean
}

export function ReviewActionPanel({
  selected,
  listScope,
  liveStatus,
  liveSessionAllowedActions,
  isTerminal,
  liveContextReady,
  detailLoading,
  detailError,
  staleWarning,
  actionBusy,
  actionError,
  reasonCode,
  note,
  onReasonCodeChange,
  onNoteChange,
  run,
  getActionLockReason,
  isActionDisabled,
}: ReviewActionPanelProps) {
  const { t } = useTranslation()

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(35,94,138,0.12)]">
      <CardHeader>
        <CardTitle>{t('reviewQueuePage.detail.title')}</CardTitle>
        <CardDescription>{t('reviewQueuePage.detail.description')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!selected ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
            {t('reviewQueuePage.detail.empty')}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="amber">{selected.status}</Badge>
              <Badge variant={selected.session.direction === 'ENTRY' ? 'entry' : 'exit'}>{selected.session.direction}</Badge>
              {liveStatus && liveStatus !== selected.session.status ? (
                <Badge variant={isTerminal ? 'destructive' : 'amber'}>
                  {t('reviewQueuePage.detail.sessionBadge', { status: liveStatus })}
                </Badge>
              ) : null}
              {selected.session.reviewRequired ? <Badge variant="amber">{t('reviewQueuePage.detail.reviewRequired')}</Badge> : null}
              {selected.actions.map((action) => (
                <Badge key={action} variant="muted">
                  {queueActionLabel(action, t)}
                </Badge>
              ))}
            </div>

            {isTerminal ? (
              <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">{t('reviewQueuePage.detail.terminalTitle', { status: liveStatus })}</p>
                  <p className="mt-1 text-destructive/80">{t('reviewQueuePage.detail.terminalDescription')}</p>
                </div>
              </div>
            ) : null}

            {!isTerminal && detailLoading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/40 px-3 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('reviewQueuePage.detail.loadingLiveState')}
              </div>
            ) : null}

            {!isTerminal && !detailLoading && detailError ? (
              <div className="flex items-start gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-3 text-xs text-primary">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t('reviewQueuePage.detail.liveStateFailed', { error: detailError })}</span>
              </div>
            ) : null}

            {staleWarning ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-sm text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">{t('reviewQueuePage.detail.staleTitle')}</p>
                  <p className="mt-1">{staleWarning}</p>
                </div>
              </div>
            ) : null}

            <div className="rounded-3xl border border-border/80 bg-muted/25 p-4">
              <SummaryRow label={t('reviewQueuePage.detail.reviewId')} value={selected.reviewId} />
              <SummaryRow label={t('reviewQueuePage.detail.queueReason')} value={selected.queueReasonCode} />
              <SummaryRow label={t('sessionHistory.summary.session')} value={String(selected.session.sessionId)} />
              <SummaryRow label={t('reviewQueuePage.detail.location')} value={`${selected.session.siteCode} / ${selected.session.gateCode} / ${selected.session.laneCode}`} />
              <SummaryRow label={t('sessionHistory.summary.plate')} value={selected.session.plateCompact || t('common.dash')} />
              <SummaryRow label={t('reviewQueuePage.detail.sessionStatus')} value={liveStatus || selected.session.status || t('common.dash')} />
              <SummaryRow
                label={t('reviewQueuePage.detail.allowedActions')}
                value={liveSessionAllowedActions.length > 0 ? liveSessionAllowedActions.join(', ') : t('reviewQueuePage.detail.none')}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                <label htmlFor="review-action-reason-code" className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">
                  {t('reviewQueuePage.detail.reasonCode')}
                </label>
                <Input
                  id="review-action-reason-code"
                  value={reasonCode}
                  onChange={(event) => onReasonCodeChange(event.target.value)}
                  className="mt-2"
                  disabled={!liveContextReady || actionBusy !== ''}
                />
              </div>
              <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                <label htmlFor="review-action-note" className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">
                  {t('reviewQueuePage.detail.note')}
                </label>
                <Input
                  id="review-action-note"
                  value={note}
                  onChange={(event) => onNoteChange(event.target.value)}
                  className="mt-2"
                  disabled={!liveContextReady || actionBusy !== ''}
                />
              </div>
            </div>

            <div className="space-y-2">
              {listScope === 'done' ? (
                <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{t('reviewQueuePage.detail.historyOnlyTitle')}</p>
                  <p className="mt-1">{t('reviewQueuePage.detail.historyOnlyDescription')}</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isActionDisabled('CLAIM')}
                      title={getActionLockReason('CLAIM') || t('reviewQueuePage.detail.claimHint')}
                      onClick={() => void run('claim')}
                    >
                      {actionBusy === 'claim' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                      {t('reviewQueuePage.actions.claim')}
                      <kbd className="ml-1.5 hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono sm:inline">1</kbd>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isActionDisabled('MANUAL_APPROVE')}
                      title={getActionLockReason('MANUAL_APPROVE') || t('reviewQueuePage.detail.approveHint')}
                      onClick={() => void run('approve')}
                    >
                      {actionBusy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {t('reviewQueuePage.actions.approve')}
                      <kbd className="ml-1.5 hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono sm:inline">2</kbd>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isActionDisabled('MANUAL_REJECT')}
                      title={getActionLockReason('MANUAL_REJECT') || t('reviewQueuePage.detail.rejectHint')}
                      onClick={() => void run('reject')}
                    >
                      {actionBusy === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldX className="h-4 w-4" />}
                      {t('reviewQueuePage.actions.reject')}
                      <kbd className="ml-1.5 hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono sm:inline">3</kbd>
                    </Button>
                    <Button
                      variant="entry"
                      size="sm"
                      disabled={isActionDisabled('MANUAL_OPEN_BARRIER')}
                      title={getActionLockReason('MANUAL_OPEN_BARRIER') || t('reviewQueuePage.detail.openBarrierHint')}
                      onClick={() => void run('barrier')}
                    >
                      {actionBusy === 'barrier' ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
                      {t('reviewQueuePage.actions.openBarrier')}
                      <kbd className="ml-1.5 hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono sm:inline">4</kbd>
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Keyboard className="h-3 w-3" />
                    <span>{t('reviewQueuePage.detail.shortcuts')}</span>
                  </div>
                </>
              )}
            </div>

            {actionError ? (
              <div className="space-y-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold">{actionError.title}</p>
                    <p className="mt-1 break-all text-destructive/90">{actionError.message}</p>
                  </div>
                </div>
                {(actionError.status != null || actionError.requestId || actionError.nextAction) ? (
                  <div className="space-y-2 text-xs text-destructive/85">
                    {actionError.status != null ? <p>HTTP {actionError.status}</p> : null}
                    {actionError.requestId ? <p>requestId={actionError.requestId}</p> : null}
                    {actionError.nextAction ? <p>{t('reviewQueuePage.detail.nextAction', { value: actionError.nextAction })}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
