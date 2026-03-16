import { Search } from 'lucide-react'
import { FilterCard } from '@/components/ops/console'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import type { SiteRow } from '@/lib/contracts/topology'

export type ReviewStatus = '' | 'OPEN' | 'CLAIMED' | 'RESOLVED' | 'CANCELLED'

const REVIEW_STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All statuses', description: 'No status filter applied' },
  { value: 'OPEN', label: 'OPEN', description: 'Waiting to be claimed', badge: 'open', badgeVariant: 'warning' },
  { value: 'CLAIMED', label: 'CLAIMED', description: 'Claimed by an operator', badge: 'claimed', badgeVariant: 'neutral' },
  { value: 'RESOLVED', label: 'RESOLVED', description: 'Fully resolved', badge: 'done', badgeVariant: 'success' },
  { value: 'CANCELLED', label: 'CANCELLED', description: 'Cancelled', badge: 'stop', badgeVariant: 'error' },
]

function buildSiteOptions(sites: SiteRow[]): SelectOption[] {
  return [
    { value: '', label: 'All sites', description: 'All configured sites' },
    ...sites.map<SelectOption>((site) => ({
      value: site.siteCode,
      label: site.siteCode,
      description: site.name,
      badge: site.isActive ? 'active' : 'off',
      badgeVariant: site.isActive ? 'success' : 'neutral',
    })),
  ]
}

export function ReviewFilterBar({
  sites,
  siteCode,
  status,
  search,
  from,
  to,
  loading,
  onSiteCodeChange,
  onStatusChange,
  onSearchChange,
  onFromChange,
  onToChange,
  onRefresh,
  onReset,
}: {
  sites: SiteRow[]
  siteCode: string
  status: ReviewStatus
  search: string
  from: string
  to: string
  loading: boolean
  onSiteCodeChange: (value: string) => void
  onStatusChange: (value: ReviewStatus) => void
  onSearchChange: (value: string) => void
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  onRefresh: () => void
  onReset: () => void
}) {
  return (
    <FilterCard
      className="ops-sticky-bar"
      contentClassName="pt-0"
      title="Filters"
      description="Narrow open, claimed, or resolved cases."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset} disabled={loading}>
            Reset
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Row 1: selects + search */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[240px_240px_1fr]">
          <Select
            value={siteCode}
            onChange={onSiteCodeChange}
            options={buildSiteOptions(sites)}
            placeholder="Select site"
            disabled={loading}
          />

          <Select
            value={status}
            onChange={(value) => onStatusChange(value as ReviewStatus)}
            options={REVIEW_STATUS_OPTIONS}
            placeholder="Select status"
            disabled={loading}
          />

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Plate, lane, session or review ID…"
              aria-label="Search reviews by plate, lane or session"
              className="pl-9"
            />
          </div>
        </div>

        {/* Row 2: date range */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-1">
            <p className="text-[10px] font-mono-data uppercase tracking-[0.16em] text-muted-foreground/70">From</p>
            <Input
              type="datetime-local"
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
              aria-label="From date"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-mono-data uppercase tracking-[0.16em] text-muted-foreground/70">To</p>
            <Input
              type="datetime-local"
              value={to}
              onChange={(e) => onToChange(e.target.value)}
              aria-label="To date"
              disabled={loading}
            />
          </div>
        </div>
      </div>
    </FilterCard>
  )
}
