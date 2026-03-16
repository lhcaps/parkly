import { Search } from 'lucide-react'
import { FilterCard } from '@/components/ops/console'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import type { Direction } from '@/lib/contracts/common'
import type { SessionState } from '@/lib/contracts/sessions'
import type { LaneRow, SiteRow } from '@/lib/contracts/topology'

const SESSION_STATES: SessionState[] = [
  'OPEN',
  'WAITING_READ',
  'WAITING_DECISION',
  'APPROVED',
  'WAITING_PAYMENT',
  'DENIED',
  'PASSED',
  'TIMEOUT',
  'CANCELLED',
  'ERROR',
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

function buildLaneOptions(lanes: LaneRow[]): SelectOption[] {
  return [
    { value: '', label: 'All lanes', description: 'All lanes in current scope' },
    ...lanes.map<SelectOption>((lane) => ({
      value: lane.laneCode,
      label: lane.laneCode,
      description: `${lane.gateCode} · ${lane.label}`,
      badge: lane.direction,
      badgeVariant: lane.direction === 'ENTRY' ? 'success' : 'warning',
    })),
  ]
}

function buildStatusOptions(): SelectOption[] {
  return [
    { value: '', label: 'All statuses', description: 'No status filter applied' },
    ...SESSION_STATES.map<SelectOption>((item) => ({
      value: item,
      label: item,
      description:
        item === 'WAITING_DECISION'
          ? 'Awaiting decision'
          : item === 'WAITING_PAYMENT'
            ? 'On hold for payment'
            : item === 'PASSED'
              ? 'Passed barrier'
              : item === 'DENIED'
                ? 'Denied'
                : 'Session status',
      badge:
        item === 'APPROVED' || item === 'PASSED'
          ? 'ok'
          : item === 'DENIED' || item === 'ERROR'
            ? 'risk'
            : 'flow',
      badgeVariant:
        item === 'APPROVED' || item === 'PASSED'
          ? 'success'
          : item === 'DENIED' || item === 'ERROR'
            ? 'error'
            : 'neutral',
    })),
  ]
}

const DIRECTION_OPTIONS: SelectOption[] = [
  { value: '', label: 'All directions', description: 'No direction filter' },
  { value: 'ENTRY', label: 'ENTRY', description: 'Inbound', badge: 'in', badgeVariant: 'success' },
  { value: 'EXIT', label: 'EXIT', description: 'Outbound', badge: 'out', badgeVariant: 'warning' },
]

export function SessionFilterBar({
  sites,
  lanes,
  siteCode,
  laneCode,
  status,
  direction,
  search,
  from,
  to,
  loading,
  onSiteCodeChange,
  onLaneCodeChange,
  onStatusChange,
  onDirectionChange,
  onSearchChange,
  onFromChange,
  onToChange,
  onRefresh,
  onReset,
}: {
  sites: SiteRow[]
  lanes: LaneRow[]
  siteCode: string
  laneCode: string
  status: SessionState | ''
  direction: Direction | ''
  search: string
  from: string
  to: string
  loading: boolean
  onSiteCodeChange: (value: string) => void
  onLaneCodeChange: (value: string) => void
  onStatusChange: (value: SessionState | '') => void
  onDirectionChange: (value: Direction | '') => void
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
      description="Filter by site, lane, direction, and status to locate the session to investigate."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset} disabled={loading}>
            Reset filters
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Row 1: context selects + search */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[200px_200px_200px_200px_1fr]">
          <Select
            value={siteCode}
            onChange={onSiteCodeChange}
            options={buildSiteOptions(sites)}
            placeholder="Select site"
            disabled={loading}
          />

          <Select
            value={laneCode}
            onChange={onLaneCodeChange}
            options={buildLaneOptions(lanes)}
            placeholder="Select lane"
            disabled={loading}
          />

          <Select
            value={status}
            onChange={(value) => onStatusChange(value as SessionState | '')}
            options={buildStatusOptions()}
            placeholder="Select status"
            disabled={loading}
          />

          <Select
            value={direction}
            onChange={(value) => onDirectionChange(value as Direction | '')}
            options={DIRECTION_OPTIONS}
            placeholder="Select direction"
            disabled={loading}
          />

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Session ID, plate, lane, or status…"
              aria-label="Search sessions by ID, plate, or status"
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
