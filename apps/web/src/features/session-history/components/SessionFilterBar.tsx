import { Filter, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
    <div className="rounded-3xl border border-border/80 bg-card/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <div className="mb-4 flex items-center gap-2">
        <Filter className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">Session filters</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <select
          value={siteCode}
          onChange={(e) => onSiteCodeChange(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">All sites</option>
          {sites.map((site) => (
            <option key={site.siteCode} value={site.siteCode}>
              {site.siteCode}
            </option>
          ))}
        </select>

        <select
          value={laneCode}
          onChange={(e) => onLaneCodeChange(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">All lanes</option>
          {lanes.map((lane) => (
            <option key={`${lane.gateCode}:${lane.laneCode}:${lane.deviceCode}`} value={lane.laneCode}>
              {lane.gateCode}  {lane.laneCode}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as SessionState | '')}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">All status</option>
          {SESSION_STATES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={direction}
          onChange={(e) => onDirectionChange(e.target.value as Direction | '')}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">All directions</option>
          <option value="ENTRY">ENTRY</option>
          <option value="EXIT">EXIT</option>
        </select>

        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="session / plate / lane / status..."
            className="pl-9"
          />
        </div>

        <Input type="datetime-local" value={from} onChange={(e) => onFromChange(e.target.value)} />
        <Input type="datetime-local" value={to} onChange={(e) => onToChange(e.target.value)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          Refresh
        </Button>
        <Button variant="ghost" size="sm" onClick={onReset} disabled={loading}>
          Reset filters
        </Button>
      </div>
    </div>
  )
}
