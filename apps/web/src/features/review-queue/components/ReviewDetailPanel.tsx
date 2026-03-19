import { AlertCircle, AlertTriangle, ArrowRight, ClipboardCheck, DoorOpen, ExternalLink, Loader2, RefreshCw, ShieldCheck, ShieldX, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { OperatorRole } from '@/features/manual-control/session-action-access'
import { isSessionTerminal } from '@/features/manual-control/session-action-access'
import { getReviewWorkspaceActionLockReason } from '@/features/manual-control/session-action-access'
import {
  describeReviewReason,
  formatDateTime,
  getPrimaryReviewAction,
  getReviewNextActionText,
  getSessionContextHeadline,
  labelReviewAction,
  prettyJson,
} from '@/features/review-queue/review-workspace'
import { ReviewImagePreview } from '@/features/review-queue/components/ReviewImagePreview'
import type { ReviewQueueAction, ReviewQueueItem } from '@/lib/contracts/reviews'
import type { SessionAllowedAction, SessionDetail } from '@/lib/contracts/sessions'
import { cn } from '@/lib/utils'

function toneClass(tone: 'warning' | 'error' | 'info') {
  if (tone === 'error') return 'border-destructive/25 bg-destructive/10 text-destructive'
  if (tone === 'warning') return 'border-primary/25 bg-primary/10 text-primary'
  return 'border-border/80 bg-background/40 text-foreground'
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function ReviewActionButton({
  action,
  role,
  allowedActions,
  busyAction,
  liveSessionStatus,
  liveSessionAllowedActions,
  onRun,
}: {
  action: ReviewQueueAction
  role: OperatorRole
  allowedActions: ReviewQueueAction[]
  busyAction: string
  liveSessionStatus?: string
  liveSessionAllowedActions?: SessionAllowedAction[]
  onRun: (action: ReviewQueueAction) => Promise<void>
}) {
  const lockReason = getReviewWorkspaceActionLockReason(role, action, allowedActions, liveSessionStatus, liveSessionAllowedActions)
  const disabled = Boolean(lockReason) || Boolean(busyAction)
  const busy = busyAction === action

  const commonProps = {
    disabled,
    title: lockReason || undefined,
    onClick: () => void onRun(action),
    size: 'sm' as const,
  }

  if (action === 'CLAIM') {
    return <Button variant="outline" {...commonProps}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}Claim</Button>
  }
  if (action === 'MANUAL_APPROVE') {
    return <Button variant="secondary" {...commonProps}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Approve</Button>
  }
  if (action === 'MANUAL_REJECT') {
    return <Button variant="destructive" {...commonProps}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldX className="h-4 w-4" />}Reject</Button>
  }
  return <Button variant="entry" {...commonProps}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}Open barrier</Button>
}

function TimelineList({ detail }: { detail: SessionDetail }) {
  if (detail.timeline.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-8 text-sm text-muted-foreground">No timeline events for this session.</div>
  }

  return (
    <div className="space-y-3">
      {detail.timeline.map((item, index) => (
        <div key={`${item.kind}:${item.at}:${index}`} className="rounded-2xl border border-border/80 bg-background/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{item.kind}</Badge>
              <p className="text-xs text-muted-foreground">{formatDateTime(item.at)}</p>
            </div>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-muted/40 p-3 text-[11px] leading-5 text-foreground">{prettyJson(item.payload)}</pre>
        </div>
      ))}
    </div>
  )
}

function ContextList({ title, empty, items }: { title: string; empty: string; items: Array<{ key: string; badge: string; title: string; detail: string }> }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-8 text-sm text-muted-foreground">{empty}</div>
      ) : (
        items.map((item) => (
          <div key={item.key} className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{item.badge}</Badge>
              <p className="text-sm font-medium text-foreground">{item.title}</p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p>
          </div>
        ))
      )}
    </div>
  )
}

export function ReviewDetailPanel({
  selected,
  detail,
  role,
  loading,
  error,
  busyAction,
  actionError,
  reasonCode,
  note,
  onReasonCodeChange,
  onNoteChange,
  onRunAction,
  onRefreshContext,
  onJumpToSession,
  onClose,
}: {
  selected: ReviewQueueItem | null
  detail: SessionDetail | null
  role: OperatorRole
  loading: boolean
  error: string
  busyAction: string
  actionError: string
  reasonCode: string
  note: string
  onReasonCodeChange: (value: string) => void
  onNoteChange: (value: string) => void
  onRunAction: (action: ReviewQueueAction) => Promise<void>
  onRefreshContext: () => Promise<void>
  onJumpToSession: () => void
  onClose: () => void
}) {
  if (!selected) {
    return (
      <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
        <CardHeader>
          <CardTitle>Review detail</CardTitle>
          <CardDescription>Select a case from the queue to open the workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-12 text-center text-sm text-muted-foreground">
            The detail workspace will appear here once you select a case.
          </div>
        </CardContent>
      </Card>
    )
  }

  const reasonProfile = describeReviewReason(selected.queueReasonCode)
  const primaryAction = getPrimaryReviewAction(selected, role)
  const latestDecision = detail?.decisions[detail.decisions.length - 1] ?? selected.latestDecision

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)] xl:sticky xl:top-20 xl:self-start">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Review detail</CardTitle>
            <CardDescription>Live manual review workspace with session context, incident context, and full audit lineage.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="icon" onClick={onClose} title="Close detail panel">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="amber">{selected.status}</Badge>
          <Badge variant={selected.session.direction === 'ENTRY' ? 'entry' : 'exit'}>{selected.session.direction}</Badge>
          {selected.claimedByUserId ? <Badge variant="muted">claimed {selected.claimedByUserId}</Badge> : <Badge variant="outline">unclaimed</Badge>}
          {primaryAction ? <Badge variant="outline">next {labelReviewAction(primaryAction)}</Badge> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className={cn('rounded-3xl border p-4', toneClass(reasonProfile.tone))}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{selected.queueReasonCode}</Badge>
            <Badge variant="muted">role {role || '—'}</Badge>
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">{reasonProfile.title}</p>
          <p className="mt-2 text-sm text-muted-foreground">{reasonProfile.summary}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-current/15 bg-transparent p-3">
              <p className="text-[11px] font-mono-data uppercase tracking-[0.18em]">Operator hint</p>
              <p className="mt-2 text-sm text-current">{reasonProfile.operatorHint}</p>
            </div>
            <div className="rounded-2xl border border-current/15 bg-transparent p-3">
              <p className="text-[11px] font-mono-data uppercase tracking-[0.18em]">Next action</p>
              <p className="mt-2 text-sm text-current">{getReviewNextActionText(selected, role)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SummaryCell label="Review ID" value={selected.reviewId} />
          <SummaryCell label="Session" value={String(selected.session.sessionId)} />
          <SummaryCell label="Site / Gate / Lane" value={`${selected.session.siteCode} / ${selected.session.gateCode} / ${selected.session.laneCode}`} />
          <SummaryCell label="Plate" value={selected.session.plateCompact || '—'} />
          <SummaryCell label="Queued at" value={formatDateTime(selected.createdAt)} />
          <SummaryCell label="Claimed at" value={formatDateTime(selected.claimedAt)} />
          {selected.claimedByUserId && (
            <SummaryCell label="Claimed by" value={selected.claimedByUserId} />
          )}
          {selected.resolvedByUserId && (
            <SummaryCell label="Resolved by" value={selected.resolvedByUserId} />
          )}
        </div>

        <div className="rounded-3xl border border-border/80 bg-background/35 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Action desk</p>
              <p className="mt-1 text-xs text-muted-foreground">Only actions permitted by the backend and your current role are shown. Actions are gated on live session state — the queue snapshot may lag.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void onRefreshContext()} disabled={loading || Boolean(busyAction)}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh context
              </Button>
              <Button variant="ghost" size="sm" onClick={onJumpToSession}>
                Open session history
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {detail?.session.status && isSessionTerminal(detail.session.status) ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Session is {detail.session.status} — no actions available</p>
                <p className="mt-1 text-destructive/80">This session has reached a terminal state. A new session must be opened in Run Lane to process the vehicle.</p>
              </div>
            </div>
          ) : !detail ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Live session detail not loaded</p>
                <p className="mt-1">Actions stay locked until the authoritative session detail finishes refreshing.</p>
              </div>
            </div>
          ) : error ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">State may be stale</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {(['CLAIM', 'MANUAL_APPROVE', 'MANUAL_REJECT', 'MANUAL_OPEN_BARRIER'] as ReviewQueueAction[]).map((action) => (
                <ReviewActionButton
                  key={action}
                  action={action}
                  role={role}
                  allowedActions={selected.actions}
                  busyAction={busyAction}
                  liveSessionStatus={detail?.session.status}
                  liveSessionAllowedActions={detail?.session.allowedActions}
                  onRun={onRunAction}
                />
              ))}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Reason code</p>
              <input
                value={reasonCode}
                onChange={(event) => onReasonCodeChange(event.target.value)}
                className="mt-2 flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Operator note</p>
              <textarea
                value={note}
                onChange={(event) => onNoteChange(event.target.value)}
                className="mt-2 min-h-[104px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {actionError ? (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-all">{actionError}</span>
            </div>
          ) : null}
        </div>

        {/* Image Preview Section - Always visible when available */}
        {detail && detail.reads.length > 0 && (
          <ReviewImagePreview reads={detail.reads} />
        )}

        <Tabs defaultValue="context" className="space-y-4">
          <TabsList>
            <TabsTrigger value="context">Context</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="snapshot">Snapshot</TabsTrigger>
          </TabsList>

          <TabsContent value="context" className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading session context…
              </div>
            ) : error ? (
              <div className="flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-all">{error}</span>
              </div>
            ) : !detail ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-sm text-muted-foreground">
                No session detail to display.
              </div>
            ) : (
              <>
                <div className="rounded-3xl border border-border/80 bg-background/35 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">session headline</Badge>
                    {latestDecision ? <Badge variant="muted">{latestDecision.finalAction || latestDecision.recommendedAction}</Badge> : null}
                  </div>
                  <p className="mt-3 text-sm font-medium text-foreground">{getSessionContextHeadline(detail)}</p>
                  {latestDecision ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <SummaryCell label="Decision code" value={latestDecision.decisionCode} />
                      <SummaryCell label="Final action" value={latestDecision.finalAction} />
                      <SummaryCell label="Reason code" value={latestDecision.reasonCode} />
                      <SummaryCell label="Decision at" value={formatDateTime(latestDecision.createdAt)} />
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <ContextList
                    title="Manual review chain"
                    empty="No manual review chain beyond the current item."
                    items={detail.manualReviews.map((review) => ({
                      key: review.reviewId,
                      badge: review.status,
                      title: `${review.queueReasonCode} · ${formatDateTime(review.createdAt)}`,
                      detail: `claimed=${review.claimedByUserId || '—'} · resolved=${review.resolvedByUserId || '—'} · note=${review.note || '—'}`,
                    }))}
                  />

                  <ContextList
                    title="Incidents linked"
                    empty="No incidents recorded for this session."
                    items={detail.incidents.map((incident) => ({
                      key: incident.incidentId,
                      badge: `${incident.severity}/${incident.status}`,
                      title: `${incident.incidentType} · ${incident.title}`,
                      detail: `${formatDateTime(incident.createdAt)} · ${incident.detail || 'None detail'}`,
                    }))}
                  />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="timeline">
            {!detail ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-sm text-muted-foreground">
                Timeline not yet available — session detail is still loading.
              </div>
            ) : (
              <ScrollArea className="h-[460px] pr-3">
                <TimelineList detail={detail} />
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="snapshot">
            <ScrollArea className="h-[460px] rounded-2xl border border-border/80 bg-background/40 p-4">
              <pre className="text-[11px] leading-5 text-foreground">{prettyJson(selected.snapshot)}</pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="rounded-2xl border border-border/80 bg-background/40 p-4 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">handoff</Badge>
            <ArrowRight className="h-3.5 w-3.5" />
            <span>Session History will open with the same session filter for deeper investigation in the full timeline.</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
