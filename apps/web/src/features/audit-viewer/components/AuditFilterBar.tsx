import { FilterCard } from '@/components/ops/console'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import type { AuditQuickFilter } from '@/features/audit-viewer/audit-viewer-model'
import type { SiteRow } from '@/lib/contracts/topology'

const QUICK_FILTER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All records', description: 'No action filter', badge: 'all', badgeVariant: 'neutral' },
  { value: 'request', label: 'Request linked', description: 'Records with a request ID only', badge: 'rid', badgeVariant: 'neutral' },
  { value: 'correlation', label: 'Correlation linked', description: 'Records with a correlation ID only', badge: 'cid', badgeVariant: 'neutral' },
  { value: 'manual', label: 'Manual override', description: 'Manual review or override cases', badge: 'manual', badgeVariant: 'warning' },
  { value: 'gate-session', label: 'Gate session', description: 'Case session, review, resolve', badge: 'session', badgeVariant: 'neutral' },
  { value: 'barrier', label: 'Barrier actions', description: 'Case barrier/open/timeout', badge: 'barrier', badgeVariant: 'warning' },
]

const ACTION_OPTIONS: SelectOption[] = [
  { value: '', label: 'All actions', description: 'No specific action filter', badge: 'any', badgeVariant: 'neutral' },
  { value: 'SESSION_OPEN', label: 'SESSION_OPEN', description: 'Session opened', badge: 'open', badgeVariant: 'neutral' },
  { value: 'SESSION_RESOLVE', label: 'SESSION_RESOLVE', description: 'Resolve session', badge: 'resolve', badgeVariant: 'neutral' },
  { value: 'MANUAL_APPROVE', label: 'MANUAL_APPROVE', description: 'Manual approve', badge: 'manual', badgeVariant: 'warning' },
  { value: 'MANUAL_REJECT', label: 'MANUAL_REJECT', description: 'Manual reject', badge: 'manual', badgeVariant: 'warning' },
  { value: 'MANUAL_OPEN_BARRIER', label: 'MANUAL_OPEN_BARRIER', description: 'Manual barrier open', badge: 'barrier', badgeVariant: 'warning' },
  { value: 'BARRIER_OPEN', label: 'BARRIER_OPEN', description: 'Barrier action', badge: 'barrier', badgeVariant: 'neutral' },
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

export function AuditFilterBar({
  sites,
  siteCode,
  quickFilter,
  action,
  keyword,
  correlationId,
  requestId,
  entityTable,
  entityId,
  actorUserId,
  onSiteCodeChange,
  onQuickFilterChange,
  onActionChange,
  onKeywordChange,
  onCorrelationIdChange,
  onRequestIdChange,
  onEntityTableChange,
  onEntityIdChange,
  onActorUserIdChange,
  onApply,
  onReset,
  loading,
}: {
  sites: SiteRow[]
  siteCode: string
  quickFilter: AuditQuickFilter
  action: string
  keyword: string
  correlationId: string
  requestId: string
  entityTable: string
  entityId: string
  actorUserId: string
  onSiteCodeChange: (value: string) => void
  onQuickFilterChange: (value: AuditQuickFilter) => void
  onActionChange: (value: string) => void
  onKeywordChange: (value: string) => void
  onCorrelationIdChange: (value: string) => void
  onRequestIdChange: (value: string) => void
  onEntityTableChange: (value: string) => void
  onEntityIdChange: (value: string) => void
  onActorUserIdChange: (value: string) => void
  onApply: () => void
  onReset: () => void
  loading: boolean
}) {
  return (
    <FilterCard
      className="ops-sticky-bar"
      contentClassName="pt-0"
      title="Audit filters"
      description="Stable query state by request ID, correlation ID, entity, and actor — trace the event chain.n lại đúng chuỗi hành động."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onReset} disabled={loading}>Reset</Button>
          <Button variant="secondary" size="sm" onClick={onApply} disabled={loading}>Apply</Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Select value={siteCode} onChange={onSiteCodeChange} options={buildSiteOptions(sites)} disabled={loading} />
        <Select value={quickFilter} onChange={(value) => onQuickFilterChange(value as AuditQuickFilter)} options={QUICK_FILTER_OPTIONS} disabled={loading} />
        <Select value={action} onChange={onActionChange} options={ACTION_OPTIONS} disabled={loading} />
        <Input value={keyword} onChange={(event) => onKeywordChange(event.target.value)} placeholder="Audit, action, entity hoặc actor..." aria-label="Tìm bản ghi audit" disabled={loading} />
        <Input value={correlationId} onChange={(event) => onCorrelationIdChange(event.target.value)} placeholder="Correlation ID" disabled={loading} />
        <Input value={requestId} onChange={(event) => onRequestIdChange(event.target.value)} placeholder="Request ID" disabled={loading} />
        <Input value={entityTable} onChange={(event) => onEntityTableChange(event.target.value)} placeholder="entityTable" disabled={loading} />
        <Input value={entityId} onChange={(event) => onEntityIdChange(event.target.value)} placeholder="entityId" disabled={loading} />
        <Input value={actorUserId} onChange={(event) => onActorUserIdChange(event.target.value)} placeholder="actorUserId" disabled={loading} className="md:col-span-2 xl:col-span-1" />
      </div>
    </FilterCard>
  )
}
