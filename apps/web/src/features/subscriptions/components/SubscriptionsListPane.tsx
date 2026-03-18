import { Building2, ChevronRight, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StateBanner, PageStateBlock } from '@/components/state/page-state'
import type { SubscriptionRow } from '../types'

function statusVariant(status: string): 'entry' | 'amber' | 'destructive' | 'muted' | 'outline' {
  if (status === 'ACTIVE') return 'entry'
  if (status === 'SUSPENDED') return 'amber'
  if (status === 'CANCELLED') return 'destructive'
  if (status === 'EXPIRED') return 'muted'
  return 'outline'
}

function planVariant(planType: string): 'secondary' | 'outline' {
  return planType === 'VIP' ? 'secondary' : 'outline'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return value.slice(0, 10)
}

function SubscriptionStatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{status}</Badge>
}

type Props = {
  rows: SubscriptionRow[]
  selectedId: string
  loading: boolean
  loadingMore: boolean
  error: string
  nextCursor: string | null
  onSelect: (subscriptionId: string) => void
  onReset: () => void
  onLoadMore: () => void
}

export function SubscriptionsListPane({
  rows,
  selectedId,
  loading,
  loadingMore,
  error,
  nextCursor,
  onSelect,
  onReset,
  onLoadMore,
}: Props) {
  return (
    <div className="space-y-3">
      {error ? <StateBanner error={error} title="Subscription list degraded" /> : null}

      {loading ? (
        <PageStateBlock variant="loading" title="Loading subscriptions" description="Fetching the current subscription slice for the active filters." />
      ) : rows.length === 0 ? (
        <PageStateBlock
          variant="empty"
          title="No subscriptions found"
          description="This is an empty business result, not a dependency failure. Adjust filters or reset the workspace to load a broader result set."
          onRetry={onReset}
          retryLabel="Reset filters"
        />
      ) : (
        <>
          <div className="space-y-1.5">
            {rows.map((row) => {
              const isSelected = row.subscriptionId === selectedId
              return (
                <button
                  key={row.subscriptionId}
                  type="button"
                  onClick={() => onSelect(row.subscriptionId)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-all hover:border-primary/30 hover:bg-primary/5 ${
                    isSelected
                      ? 'border-primary/40 bg-primary/8 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]'
                      : 'border-border/70 bg-card/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <SubscriptionStatusBadge status={row.effectiveStatus} />
                        <Badge variant={planVariant(row.planType)}>{row.planType}</Badge>
                        <span className="font-mono-data text-[11px] text-muted-foreground">{row.subscriptionId}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <p className="truncate text-sm font-medium text-foreground">{row.customerName}</p>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{row.siteCode}</p>
                        <span className="text-muted-foreground/40">·</span>
                        <p className="text-xs text-muted-foreground">{formatDate(row.startDate)} — {formatDate(row.endDate)}</p>
                      </div>
                    </div>
                    <ChevronRight className={`mt-1 h-4 w-4 shrink-0 transition-colors ${isSelected ? 'text-primary' : 'text-muted-foreground/40'}`} />
                  </div>
                </button>
              )
            })}
          </div>

          {nextCursor ? (
            <div className="flex justify-center pt-1">
              <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
