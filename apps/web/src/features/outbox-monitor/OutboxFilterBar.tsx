import { FilterCard } from '@/components/ops/console'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import type { OutboxQuickFilter } from '@/features/outbox-monitor/outbox-triage-model'
import type { SiteRow } from '@/lib/contracts/topology'

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All statuses', description: 'No status filter', badge: 'any', badgeVariant: 'neutral' },
  { value: 'PENDING', label: 'PENDING', description: 'Not yet synced', badge: 'pending', badgeVariant: 'neutral' },
  { value: 'SENT', label: 'SENT', description: 'Synced', badge: 'sent', badgeVariant: 'success' },
  { value: 'FAILED', label: 'FAILED', description: 'Terminal fail', badge: 'fail', badgeVariant: 'error' },
]

const QUICK_FILTER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All triage', description: 'All records', badge: 'all', badgeVariant: 'neutral' },
  { value: 'failed', label: 'Failures', description: 'Failed records only', badge: 'fail', badgeVariant: 'error' },
  { value: 'pending', label: 'Pending', description: 'Unsent queue', badge: 'pending', badgeVariant: 'neutral' },
  { value: 'retrying', label: 'Retrying', description: 'Has nextRetry or is retrying', badge: 'retry', badgeVariant: 'warning' },
  { value: 'sent', label: 'Sent', description: 'Synced', badge: 'sent', badgeVariant: 'success' },
  { value: 'barrier', label: 'Barrier-linked', description: 'Barrier-linked action or entity', badge: 'barrier', badgeVariant: 'warning' },
  { value: 'review', label: 'Review-linked', description: 'Review-required payload', badge: 'review', badgeVariant: 'warning' },
]

function buildSiteOptions(sites: SiteRow[]): SelectOption[] {
  return [
    { value: '', label: 'All sites', description: 'No specific site', badge: 'all', badgeVariant: 'neutral' },
    ...sites.map<SelectOption>((site) => ({
      value: site.siteCode,
      label: site.siteCode,
      description: site.name,
      badge: site.isActive ? 'active' : 'off',
      badgeVariant: site.isActive ? 'success' : 'neutral',
    })),
  ]
}

export function OutboxFilterBar({
  sites,
  siteCode,
  status,
  quickFilter,
  keyword,
  correlationId,
  requestId,
  entity,
  onSiteCodeChange,
  onStatusChange,
  onQuickFilterChange,
  onKeywordChange,
  onCorrelationIdChange,
  onRequestIdChange,
  onEntityChange,
  onApply,
  onReset,
  loading,
}: {
  sites: SiteRow[]
  siteCode: string
  status: string
  quickFilter: OutboxQuickFilter
  keyword: string
  correlationId: string
  requestId: string
  entity: string
  onSiteCodeChange: (value: string) => void
  onStatusChange: (value: string) => void
  onQuickFilterChange: (value: OutboxQuickFilter) => void
  onKeywordChange: (value: string) => void
  onCorrelationIdChange: (value: string) => void
  onRequestIdChange: (value: string) => void
  onEntityChange: (value: string) => void
  onApply: () => void
  onReset: () => void
  loading: boolean
}) {
  return (
    <FilterCard
      className="ops-sticky-bar"
      contentClassName="pt-0"
      title="Outbox triage filters"
      description="Stable filter and search for tracing failed cases by correlation, request, or entity.entity mà không mất state giữa các lần refresh."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onReset} disabled={loading}>Reset</Button>
          <Button variant="secondary" size="sm" onClick={onApply} disabled={loading}>Apply</Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Select value={siteCode} onChange={onSiteCodeChange} options={buildSiteOptions(sites)} disabled={loading} />
        <Select value={status} onChange={onStatusChange} options={STATUS_OPTIONS} disabled={loading} />
        <Select value={quickFilter} onChange={(value) => onQuickFilterChange(value as OutboxQuickFilter)} options={QUICK_FILTER_OPTIONS} disabled={loading} />
        <Input value={keyword} onChange={(event) => onKeywordChange(event.target.value)} placeholder="Outbox, biển số, lane hoặc lỗi..." aria-label="Tìm bản ghi outbox" disabled={loading} />
        <Input value={correlationId} onChange={(event) => onCorrelationIdChange(event.target.value)} placeholder="Correlation ID" disabled={loading} />
        <Input value={requestId} onChange={(event) => onRequestIdChange(event.target.value)} placeholder="Request ID" disabled={loading} />
        <Input value={entity} onChange={(event) => onEntityChange(event.target.value)} placeholder="entityTable or entityId" disabled={loading} className="md:col-span-2 xl:col-span-1" />
      </div>
    </FilterCard>
  )
}
