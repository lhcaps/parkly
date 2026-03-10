import { AlertCircle, ClipboardCheck, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ReviewQueueItem } from '@/lib/contracts/reviews'
import { cn } from '@/lib/utils'

function reviewVariant(status: string): 'amber' | 'secondary' | 'muted' {
  if (status === 'CLAIMED') return 'secondary'
  if (status === 'RESOLVED' || status === 'CANCELLED') return 'muted'
  return 'amber'
}

function readTimestamp(value: unknown) {
  if (typeof value !== 'string') return ''
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? new Date(ms).toLocaleString('vi-VN') : value
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

export function ReviewTable({
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
        <p className="mt-1 text-xs text-muted-foreground">{rows.length} item khớp filter hiện tại.</p>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải review queue...
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-12 text-center">
            <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Không có review nào khớp filter</p>
            <p className="mt-1 text-xs text-muted-foreground">Thử nới filter hoặc đổi time range.</p>
          </div>
        ) : (
          <ScrollArea className="h-[640px] pr-3">
            <div className="space-y-3">
              {rows.map((row) => (
                <button
                  key={row.reviewId}
                  onClick={() => onSelect(row.reviewId)}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-4 text-left transition',
                    row.reviewId === selectedId ? 'border-primary/35 bg-primary/8' : 'border-border bg-background/40 hover:bg-muted/40',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={reviewVariant(row.status)}>{row.status}</Badge>
                        <Badge variant={row.session.direction === 'ENTRY' ? 'entry' : 'exit'}>{row.session.direction}</Badge>
                        {row.session.reviewRequired ? <Badge variant="amber">review</Badge> : null}
                      </div>

                      <p className="mt-2 break-all font-mono-data text-sm font-semibold">
                        {row.queueReasonCode}
                      </p>
                      <p className="mt-1 break-all text-[11px] font-mono-data text-muted-foreground">
                        review={row.reviewId}  session={row.session.sessionId}
                      </p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {row.session.siteCode} / {row.session.gateCode} / {row.session.laneCode}  plate={row.session.plateCompact || ''}
                      </p>
                    </div>

                    <div className="text-right text-[11px] font-mono-data text-muted-foreground">
                      <p>{getReviewTime(row) || ''}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.actions.map((action) => (
                      <Badge key={action} variant="muted">
                        {queueActionLabel(action)}
                      </Badge>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
