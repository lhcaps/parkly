import { Search } from 'lucide-react'
import { FilterCard } from '@/components/ops/console'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import type { SiteRow } from '@/lib/contracts/topology'

export type ReviewStatus = '' | 'OPEN' | 'CLAIMED' | 'RESOLVED' | 'CANCELLED'

const REVIEW_STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All status', description: 'Không giới hạn trạng thái review' },
  { value: 'OPEN', label: 'OPEN', description: 'Chờ được nhận xử lý', badge: 'open', badgeVariant: 'warning' },
  { value: 'CLAIMED', label: 'CLAIMED', description: 'Đã có operator nhận xử lý', badge: 'claimed', badgeVariant: 'neutral' },
  { value: 'RESOLVED', label: 'RESOLVED', description: 'Đã hoàn tất xử lý', badge: 'done', badgeVariant: 'success' },
  { value: 'CANCELLED', label: 'CANCELLED', description: 'Đã bị hủy', badge: 'stop', badgeVariant: 'error' },
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
      title="Bộ lọc review"
      description="Khoanh nhanh các ca đang mở, đang được nhận xử lý hoặc đã chốt."
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[240px_240px_minmax(280px,1fr)_240px_240px]">
        <Select
          value={siteCode}
          onChange={onSiteCodeChange}
          options={buildSiteOptions(sites)}
          placeholder="Chọn site"
          disabled={loading}
        />

        <Select
          value={status}
          onChange={(value) => onStatusChange(value as ReviewStatus)}
          options={REVIEW_STATUS_OPTIONS}
          placeholder="Chọn trạng thái"
          disabled={loading}
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="plate / lane / session / review..."
            className="pl-9"
          />
        </div>

        <Input type="datetime-local" value={from} onChange={(e) => onFromChange(e.target.value)} />
        <Input type="datetime-local" value={to} onChange={(e) => onToChange(e.target.value)} />
      </div>
    </FilterCard>
  )
}
