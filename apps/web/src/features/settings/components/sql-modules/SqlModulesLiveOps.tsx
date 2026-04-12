import { useMemo } from 'react'
import { Activity, FileCode2, LockKeyhole, PlayCircle } from 'lucide-react'

import { InlineMessage, SurfaceState } from '@/components/ops/console'
import { DangerConfirmDialog } from '@/components/state/danger-confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

import {
  compareTuple,
  dt,
  getOpsSummary,
  healthVariant,
  laneNeedsAttention,
  lanePriority,
  laneSeverity,
  queueNeedsAttention,
  queuePriority,
  sessionNeedsAttention,
  sessionPriority,
  t2,
  testId,
  type SqlBoardKey,
  type SqlLaneLens,
  type SqlModuleLabels,
  type SqlReviewLens,
  type SqlSurfaceData,
} from './sqlModules.utils'

type RevokeControls = {
  isPending: boolean
  activeUserId?: string
  onConfirm: (userId: string) => Promise<unknown>
}

type RecoverControls = {
  isPending: boolean
  activeLaneId?: string
  onConfirm: (laneId: string) => Promise<unknown>
}

type ReviewControls = {
  isPending: boolean
  activeSessionId?: string
  onConfirm: (sessionId: string) => Promise<unknown>
}

function BoardToggle({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      aria-pressed={active}
      onClick={onClick}
      className="h-8 rounded-full px-3 text-[11px]"
    >
      {label}
    </Button>
  )
}

function LensToggle({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'ghost'}
      aria-pressed={active}
      onClick={onClick}
      className="h-8 rounded-full px-3 text-[11px]"
    >
      {label}
    </Button>
  )
}

function boardGridClass(enabledCount: number) {
  if (enabledCount <= 1) return 'grid-cols-1'
  if (enabledCount === 2) return 'xl:grid-cols-2'
  return 'xl:grid-cols-[0.95fr_1.12fr_1fr]'
}

export function SqlModulesLiveOps({
  data,
  labels,
  locale,
  isEn,
  canManage,
  boards,
  laneLens,
  reviewLens,
  onToggleBoard,
  onSetLaneLens,
  onSetReviewLens,
  revokeControls,
  recoverControls,
  reviewControls,
}: {
  data: SqlSurfaceData
  labels: SqlModuleLabels
  locale: string
  isEn: boolean
  canManage: boolean
  boards: Record<SqlBoardKey, boolean>
  laneLens: SqlLaneLens
  reviewLens: SqlReviewLens
  onToggleBoard: (key: SqlBoardKey) => void
  onSetLaneLens: (lens: SqlLaneLens) => void
  onSetReviewLens: (lens: SqlReviewLens) => void
  revokeControls: RevokeControls
  recoverControls: RecoverControls
  reviewControls: ReviewControls
}) {
  const ops = getOpsSummary(data)

  const activeSessions = useMemo(
    () => [...data.previews.activeSessions].sort((left, right) => compareTuple(sessionPriority(left), sessionPriority(right))),
    [data.previews.activeSessions],
  )

  const laneRows = useMemo(() => {
    const sorted = [...data.previews.laneHealth].sort((left, right) => compareTuple(lanePriority(left), lanePriority(right)))
    return laneLens === 'focus' ? sorted.filter(laneNeedsAttention) : sorted
  }, [data.previews.laneHealth, laneLens])

  const queueRows = useMemo(() => {
    const sorted = [...data.previews.activeQueue].sort((left, right) => compareTuple(queuePriority(left), queuePriority(right)))
    return reviewLens === 'attention' ? sorted.filter(queueNeedsAttention) : sorted
  }, [data.previews.activeQueue, reviewLens])

  const enabledBoardCount = Object.values(boards).filter(Boolean).length

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_56px_rgba(35,94,138,0.10)]">
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold tracking-tight">{labels.liveOps}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{labels.liveOpsDesc}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={ops.laneAttentionCount > 0 ? 'amber' : 'secondary'}>{ops.laneAttentionCount} lanes</Badge>
            <Badge variant={ops.queueAttentionCount > 0 ? 'amber' : 'secondary'}>{ops.queueAttentionCount} reviews</Badge>
            <Badge variant={ops.staleSessionCount > 0 ? 'amber' : 'secondary'}>{ops.staleSessionCount} stale</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {!canManage ? (
          <InlineMessage tone="info">
            <div>
              <p className="font-semibold">{labels.liveOps}</p>
              <p className="mt-1 text-sm text-muted-foreground">{labels.inspectOnly}</p>
            </div>
          </InlineMessage>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[1.35rem] border border-border/70 bg-background/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{labels.visibleBoards}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <BoardToggle label={labels.sessionsBoard} active={boards.sessions} onClick={() => onToggleBoard('sessions')} />
              <BoardToggle label={labels.laneBoard} active={boards.laneHealth} onClick={() => onToggleBoard('laneHealth')} />
              <BoardToggle label={labels.queueBoard} active={boards.queue} onClick={() => onToggleBoard('queue')} />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-[1.35rem] border border-border/70 bg-background/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{labels.laneLens}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <LensToggle label={labels.laneFocusOnly} active={laneLens === 'focus'} onClick={() => onSetLaneLens('focus')} />
                <LensToggle label={labels.showAllLanes} active={laneLens === 'all'} onClick={() => onSetLaneLens('all')} />
              </div>
            </section>

            <section className="rounded-[1.35rem] border border-border/70 bg-background/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{labels.reviewLens}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <LensToggle label={labels.queueFocusOnly} active={reviewLens === 'attention'} onClick={() => onSetReviewLens('attention')} />
                <LensToggle label={labels.showAllQueue} active={reviewLens === 'all'} onClick={() => onSetReviewLens('all')} />
              </div>
            </section>
          </div>
        </div>

        {enabledBoardCount === 0 ? (
          <SurfaceState title={labels.liveOps} description={labels.boardHidden} className="min-h-[220px]" />
        ) : (
          <div className={`grid gap-5 ${boardGridClass(enabledBoardCount)}`}>
            {boards.sessions ? (
              <Card className="border-border/70 bg-background/35">
                <CardHeader className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                    <LockKeyhole className="h-4 w-4 text-primary" />
                    {labels.activeSessions}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">`pkg_auth_active_sessions_v` • {labels.activeSessionsDesc}</p>
                </CardHeader>

                <CardContent className="pt-0">
                  {activeSessions.length === 0 ? (
                    <SurfaceState title={labels.activeSessions} description={labels.empty} className="min-h-[220px]" />
                  ) : (
                    <ScrollArea className="max-h-[720px] pr-2">
                      <div className="space-y-3">
                        {activeSessions.map((session) => {
                          const needsAttention = sessionNeedsAttention(session)
                          return (
                            <div
                              key={`${session.sessionId}:${session.userId}`}
                              className={`rounded-[1.35rem] border p-4 [content-visibility:auto] [contain-intrinsic-size:240px] ${
                                needsAttention ? 'border-primary/25 bg-primary/6' : 'border-border/70 bg-background/40'
                              }`}
                              data-testid={`sql-active-session-${testId(session.userId)}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{session.username}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{session.roleCode}</p>
                                </div>
                                <Badge variant={needsAttention ? 'amber' : 'outline'} className="font-mono-data">
                                  {session.sessionState}
                                </Badge>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                <Badge variant="outline">
                                  {labels.lastSeen}: {dt(session.lastSeenAt, locale)}
                                </Badge>
                                <Badge variant="outline" className="font-mono-data">
                                  {session.sessionId}
                                </Badge>
                              </div>

                              <div className="mt-4">
                                <DangerConfirmDialog
                                  title={t2(isEn, `Revoke toàn bộ session của ${session.username}?`, `Revoke all sessions for ${session.username}?`)}
                                  description={t2(
                                    isEn,
                                    'Tác vụ này sẽ đánh dấu revoke cho mọi auth session còn hiệu lực của user này.',
                                    'This action revokes every currently valid auth session for this user.',
                                  )}
                                  confirmLabel={labels.revokeBtn}
                                  cancelLabel={labels.confirmCancel}
                                  disabled={!canManage}
                                  busy={revokeControls.isPending}
                                  dialogTestId={`sql-revoke-dialog-${testId(session.userId)}`}
                                  cancelTestId={`sql-revoke-cancel-${testId(session.userId)}`}
                                  confirmTestId={`sql-revoke-confirm-${testId(session.userId)}`}
                                  meta={
                                    <div className="flex flex-wrap gap-2">
                                      <Badge variant="outline">{session.roleCode}</Badge>
                                      <Badge variant="outline" className="font-mono-data">
                                        {session.sessionId}
                                      </Badge>
                                    </div>
                                  }
                                  onConfirm={async () => {
                                    await revokeControls.onConfirm(session.userId)
                                  }}
                                  trigger={({ onClick, disabled, ...triggerProps }) => (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full gap-2"
                                      onClick={onClick}
                                      disabled={disabled}
                                      data-testid={`sql-revoke-trigger-${testId(session.userId)}`}
                                      {...triggerProps}
                                    >
                                      <PlayCircle className={`h-4 w-4 ${revokeControls.isPending && revokeControls.activeUserId === session.userId ? 'animate-pulse' : ''}`} />
                                      {labels.revokeBtn}
                                    </Button>
                                  )}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {boards.laneHealth ? (
              <Card className="border-border/70 bg-background/35">
                <CardHeader className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                    <Activity className="h-4 w-4 text-primary" />
                    {labels.laneHealth}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">`pkg_gate_lane_health_v` • {labels.laneHealthDesc}</p>
                </CardHeader>

                <CardContent className="pt-0">
                  {data.previews.laneHealth.length === 0 ? (
                    <SurfaceState title={labels.laneHealth} description={labels.empty} className="min-h-[220px]" />
                  ) : laneRows.length === 0 ? (
                    <SurfaceState title={labels.laneHealth} description={labels.laneFocusEmpty} className="min-h-[220px]" />
                  ) : (
                    <ScrollArea className="max-h-[720px] pr-2">
                      <div className="space-y-3">
                        {laneRows.map((lane) => {
                          const severity = laneSeverity(lane)
                          const toneClass =
                            severity <= 1
                              ? 'border-destructive/25 bg-destructive/8'
                              : severity === 2
                                ? 'border-primary/25 bg-primary/6'
                                : 'border-border/70 bg-background/40'

                          return (
                            <div
                              key={lane.laneId}
                              className={`rounded-[1.35rem] border p-4 [content-visibility:auto] [contain-intrinsic-size:240px] ${toneClass}`}
                              data-testid={`sql-lane-health-${testId(lane.laneId)}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{lane.siteCode} / {lane.gateCode} / {lane.laneCode}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {labels.status}: {lane.laneOperationalStatus}
                                  </p>
                                </div>
                                <Badge variant={healthVariant(lane.aggregateHealth)}>{lane.aggregateHealth}</Badge>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                <Badge variant="outline">{labels.barrier}: {lane.lastBarrierStatus ?? '--'}</Badge>
                                <Badge variant="outline">{labels.presence}: {lane.activePresenceCount}</Badge>
                              </div>

                              <div className="mt-4">
                                <DangerConfirmDialog
                                  title={t2(isEn, `Force recovery cho ${lane.gateCode}/${lane.laneCode}?`, `Force recovery for ${lane.gateCode}/${lane.laneCode}?`)}
                                  description={t2(
                                    isEn,
                                    'Tác vụ này sẽ huỷ barrier command đang chờ và chuyển session còn mở sang trạng thái cần review nếu cần.',
                                    'This action cancels pending barrier commands and flags live sessions for review when needed.',
                                  )}
                                  confirmLabel={labels.recoverBtn}
                                  cancelLabel={labels.confirmCancel}
                                  tone="warning"
                                  disabled={!canManage}
                                  busy={recoverControls.isPending}
                                  dialogTestId={`sql-recovery-dialog-${testId(lane.laneId)}`}
                                  cancelTestId={`sql-recovery-cancel-${testId(lane.laneId)}`}
                                  confirmTestId={`sql-recovery-confirm-${testId(lane.laneId)}`}
                                  meta={
                                    <div className="flex flex-wrap gap-2">
                                      <Badge variant={healthVariant(lane.aggregateHealth)}>{lane.aggregateHealth}</Badge>
                                      <Badge variant="outline">{lane.laneOperationalStatus}</Badge>
                                    </div>
                                  }
                                  onConfirm={async () => {
                                    await recoverControls.onConfirm(lane.laneId)
                                  }}
                                  trigger={({ onClick, disabled, ...triggerProps }) => (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full gap-2"
                                      onClick={onClick}
                                      disabled={disabled}
                                      data-testid={`sql-recovery-trigger-${testId(lane.laneId)}`}
                                      {...triggerProps}
                                    >
                                      <PlayCircle className={`h-4 w-4 ${recoverControls.isPending && recoverControls.activeLaneId === lane.laneId ? 'animate-pulse' : ''}`} />
                                      {labels.recoverBtn}
                                    </Button>
                                  )}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {boards.queue ? (
              <Card className="border-border/70 bg-background/35">
                <CardHeader className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                    <FileCode2 className="h-4 w-4 text-primary" />
                    {labels.queue}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">`pkg_gate_active_queue_v` • {labels.queueDesc}</p>
                </CardHeader>

                <CardContent className="pt-0">
                  {data.previews.activeQueue.length === 0 ? (
                    <SurfaceState title={labels.queue} description={labels.empty} className="min-h-[220px]" />
                  ) : queueRows.length === 0 ? (
                    <SurfaceState title={labels.queue} description={labels.queueFocusEmpty} className="min-h-[220px]" />
                  ) : (
                    <ScrollArea className="max-h-[720px] pr-2">
                      <div className="space-y-3">
                        {queueRows.map((row) => {
                          const reviewOpen = row.openManualReviewCount > 0
                          const attention = queueNeedsAttention(row)
                          const toneClass = reviewOpen
                            ? 'border-destructive/25 bg-destructive/8'
                            : attention
                              ? 'border-primary/25 bg-primary/6'
                              : 'border-border/70 bg-background/40'

                          return (
                            <div
                              key={row.sessionId}
                              className={`rounded-[1.35rem] border p-4 [content-visibility:auto] [contain-intrinsic-size:240px] ${toneClass}`}
                              data-testid={`sql-active-queue-${testId(row.sessionId)}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{row.siteCode} / {row.laneCode}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {labels.status}: {row.status}
                                  </p>
                                </div>
                                <Badge variant={reviewOpen || row.reviewRequired ? 'amber' : 'outline'}>
                                  {row.plateCompact ?? row.sessionId}
                                </Badge>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                <Badge variant="outline">
                                  {labels.openedAt}: {dt(row.openedAt, locale)}
                                </Badge>
                                <Badge variant="outline">{labels.presence}: {row.activePresenceCount}</Badge>
                                <Badge variant={reviewOpen ? 'amber' : 'outline'}>review: {row.openManualReviewCount}</Badge>
                              </div>

                              <div className="mt-4">
                                <DangerConfirmDialog
                                  title={t2(isEn, `Mở manual review cho session ${row.sessionId}?`, `Open manual review for session ${row.sessionId}?`)}
                                  description={t2(
                                    isEn,
                                    'Tác vụ này sẽ tạo một review đang mở cho session trong hàng đợi gate hiện tại.',
                                    'This action creates an open manual review for the selected gate queue session.',
                                  )}
                                  confirmLabel={labels.reviewBtn}
                                  cancelLabel={labels.confirmCancel}
                                  tone="warning"
                                  disabled={!canManage || reviewOpen}
                                  busy={reviewControls.isPending}
                                  dialogTestId={`sql-review-dialog-${testId(row.sessionId)}`}
                                  cancelTestId={`sql-review-cancel-${testId(row.sessionId)}`}
                                  confirmTestId={`sql-review-confirm-${testId(row.sessionId)}`}
                                  meta={
                                    <div className="flex flex-wrap gap-2">
                                      <Badge variant="outline">{row.status}</Badge>
                                      <Badge variant="outline">{row.plateCompact ?? row.sessionId}</Badge>
                                    </div>
                                  }
                                  onConfirm={async () => {
                                    await reviewControls.onConfirm(row.sessionId)
                                  }}
                                  trigger={({ onClick, disabled, ...triggerProps }) => (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full gap-2"
                                      onClick={onClick}
                                      disabled={disabled}
                                      data-testid={`sql-review-trigger-${testId(row.sessionId)}`}
                                      {...triggerProps}
                                    >
                                      <PlayCircle className={`h-4 w-4 ${reviewControls.isPending && reviewControls.activeSessionId === row.sessionId ? 'animate-pulse' : ''}`} />
                                      {reviewOpen ? labels.reviewOpen : labels.reviewBtn}
                                    </Button>
                                  )}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
