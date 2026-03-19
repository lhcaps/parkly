import { memo, useMemo } from 'react'
import { AlertCircle, ClipboardCheck, Loader2, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ReviewQueueItem } from '@/lib/contracts/reviews'
import { cn } from '@/lib/utils'
import { formatRelativeMinutes } from '@/features/review-queue/review-workspace'

function reviewVariant(status: string): 'amber' | 'secondary' | 'muted' | 'destructive' | 'default' {
  if (status === 'CLAIMED') return 'secondary'
  if (status === 'RESOLVED') return 'default'
  if (status === 'CANCELLED') return 'muted'
  return 'amber'
}

function getStatusIcon(status: string) {
  if (status === 'OPEN') return <AlertTriangle className="h-3 w-3" />
  if (status === 'CLAIMED') return <Clock className="h-3 w-3" />
  if (status === 'RESOLVED') return <CheckCircle2 className="h-3 w-3" />
  if (status === 'CANCELLED') return <XCircle className="h-3 w-3" />
  return null
}

function getPriorityClass(queueReasonCode: string): 'high' | 'medium' | 'low' {
  const code = queueReasonCode.toUpperCase()
  if (code.includes('DEVICE_OFFLINE') || code.includes('ANTI_PASSBACK') || code.includes('MISMATCH')) return 'high'
  if (code.includes('OCR') || code.includes('PLATE') || code.includes('PAYMENT')) return 'medium'
  return 'low'
}

function readTimestamp(value: unknown) {
  if (typeof value !== 'string') return ''
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? new Date(ms).toLocaleString('en-GB') : value
}

function getReviewTime(row: ReviewQueueItem) {
  const raw = row as unknown as Record<string, unknown>
  return readTimestamp(raw.updatedAt) || readTimestamp(raw.createdAt) || readTimestamp(raw.claimedAt)
}

function queueActionLabel(action: string) {
  if (action === 'MANUAL_APPROVE') return 'Approve'
  if (action === 'MANUAL_REJECT') return 'Reject'
  if (action === 'MANUAL_OPEN_BARRIER') return 'Open barrier'
  if (action === 'CLAIM') return 'Claim'
  return action
}

const ReviewTableRow = memo(function ReviewTableRow({
  row,
  isSelected,
  onSelect,
}: {
  row: ReviewQueueItem
  isSelected: boolean
  onSelect: (reviewId: string) => void
}) {
  const priority = useMemo(() => getPriorityClass(row.queueReasonCode), [row.queueReasonCode])
  const timeAgo = useMemo(() => {
    const raw = row as unknown as Record<string, unknown>
    const timeValue = raw.updatedAt || raw.createdAt || raw.claimedAt
    return formatRelativeMinutes(typeof timeValue === 'string' ? timeValue : null)
  }, [row.createdAt, row.claimedAt])
  const reviewTimeStr = useMemo(() => getReviewTime(row) || '', [row.createdAt, row.claimedAt])

  return (
    <button
      onClick={() => onSelect(row.reviewId)}
      className={cn(
        'perf-list-item group relative w-full rounded-2xl border px-4 py-4 text-left transition-all',
        isSelected
          ? 'border-primary/50 bg-primary/10 shadow-md ring-2 ring-primary/20'
          : 'border-border/60 bg-background/50 hover:border-border hover:bg-muted/30 hover:shadow-sm',
        priority === 'high' && row.status === 'OPEN' && 'border-amber-500/30 bg-amber-500/5',
      )}
    >
      {/* Priority indicator bar */}
      {priority === 'high' && row.status === 'OPEN' && (
        <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-amber-500" />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={reviewVariant(row.status)} className="gap-1">
              {getStatusIcon(row.status)}
              {row.status}
            </Badge>
            <Badge variant={row.session.direction === 'ENTRY' ? 'entry' : 'exit'}>
              {row.session.direction}
            </Badge>
            {row.session.reviewRequired && (
              <Badge variant="amber" className="text-[10px]">
                Review required
              </Badge>
            )}
            {priority === 'high' && (
              <Badge variant="destructive" className="text-[10px]">
                High priority
              </Badge>
            )}
          </div>

          <p className="mt-2.5 break-all font-mono-data text-sm font-semibold leading-tight text-foreground">
            {row.queueReasonCode}
          </p>
          <p className="mt-1.5 break-all text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium">{row.session.siteCode}</span> / {row.session.gateCode} /{' '}
            {row.session.laneCode}
            {row.session.plateCompact && (
              <>
                {' · '}
                <span className="font-mono-data font-semibold text-foreground/90">
                  {row.session.plateCompact}
                </span>
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="break-all text-[11px] font-mono-data text-muted-foreground/70">
              ID: {row.reviewId.slice(0, 12)}…
            </p>
            {timeAgo && (
              <span className="text-[11px] text-muted-foreground/60">· {timeAgo}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 text-right">
          <p className="text-[11px] font-mono-data text-muted-foreground">
            {reviewTimeStr}
          </p>
          {timeAgo && (
            <p className="text-[10px] text-muted-foreground/60">{timeAgo}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {row.actions.map((action) => (
          <Badge key={action} variant="muted" className="text-[10px]">
            {queueActionLabel(action)}
          </Badge>
        ))}
      </div>
    </button>
  )
}, (prev, next) => {
  return prev.row.reviewId === next.row.reviewId && prev.isSelected === next.isSelected
})

export const ReviewTable = memo(function ReviewTable({
  rows,
  selectedId,
  loading,
  error,
  onSelect,
}: {
  rows: ReviewQueueItem[]
  selectedId: string
  loading: boolean
  error: string
  onSelect: (reviewId: string) => void
}) {
  return (
    <div className="rounded-3xl border border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <div className="border-b border-border/80 px-4 py-4">
        <p className="text-sm font-medium">Review list</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? 'case' : 'cases'} matching current filters.
        </p>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading review queue…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-12 text-center">
            <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No cases match current filters</p>
            <p className="mt-1 text-xs text-muted-foreground">Try adjusting filters or widening the time range.</p>
          </div>
        ) : (
          <ScrollArea className="h-[640px] pr-3">
            <div className="space-y-3">
              {rows.map((row) => (
                <ReviewTableRow
                  key={row.reviewId}
                  row={row}
                  isSelected={row.reviewId === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
})
