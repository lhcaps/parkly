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
    { value: '', label: 'All sites', description: 'Tất cả site đang cấu hình' },
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
    { value: '', label: 'All lanes', description: 'Tất cả lane trong scope hiện tại' },
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
    { value: '', label: 'All status', description: 'Không giới hạn trạng thái session' },
    ...SESSION_STATES.map<SelectOption>((item) => ({
      value: item,
      label: item,
      description:
        item === 'WAITING_DECISION'
          ? 'Đang chờ quyết định'
          : item === 'WAITING_PAYMENT'
            ? 'Đang giữ để xử lý thanh toán'
            : item === 'PASSED'
              ? 'Đã qua barrier'
              : item === 'DENIED'
                ? 'Bị từ chối'
                : 'Trạng thái session',
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
  { value: '', label: 'All directions', description: 'Không giới hạn chiều di chuyển' },
  { value: 'ENTRY', label: 'ENTRY', description: 'Luồng xe vào', badge: 'in', badgeVariant: 'success' },
  { value: 'EXIT', label: 'EXIT', description: 'Luồng xe ra', badge: 'out', badgeVariant: 'warning' },
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
      title="Bộ lọc session"
      description="Lọc theo site, lane, hướng và trạng thái để vào đúng phiên cần truy vết."
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_220px_220px_220px_minmax(260px,1fr)_220px_220px]">
        <Select
          value={siteCode}
          onChange={onSiteCodeChange}
          options={buildSiteOptions(sites)}
          placeholder="Chọn site"
          disabled={loading}
        />

        <Select
          value={laneCode}
          onChange={onLaneCodeChange}
          options={buildLaneOptions(lanes)}
          placeholder="Chọn lane"
          disabled={loading}
        />

        <Select
          value={status}
          onChange={(value) => onStatusChange(value as SessionState | '')}
          options={buildStatusOptions()}
          placeholder="Chọn trạng thái"
          disabled={loading}
        />

        <Select
          value={direction}
          onChange={(value) => onDirectionChange(value as Direction | '')}
          options={DIRECTION_OPTIONS}
          placeholder="Chọn hướng"
          disabled={loading}
        />

        <div className="relative">
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
    </FilterCard>
  )
}
