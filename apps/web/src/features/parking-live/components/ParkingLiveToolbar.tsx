import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type ParkingLiveAttentionItem = {
  key: string
  label: string
  count: number
  statusValue: string
}

type Props = {
  siteCode: string
  siteOptions: SelectOption[]
  statusFilter: string
  statusOptions: SelectOption[]
  zoneFilter: string
  zoneOptions: SelectOption[]
  densityMode: 'comfortable' | 'compact'
  densityOptions: SelectOption[]
  searchQuery: string
  attentionItems: ParkingLiveAttentionItem[]
  onSiteChange: (value: string) => void
  onStatusChange: (value: string) => void
  onZoneChange: (value: string) => void
  onDensityChange: (value: 'comfortable' | 'compact') => void
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  onClearFilters: () => void
}

function FocusChip({
  item,
  active,
  onClick,
}: {
  item: ParkingLiveAttentionItem
  active: boolean
  onClick: (item: ParkingLiveAttentionItem) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary/40 bg-primary/12 text-primary'
          : 'border-border/70 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground',
      )}
    >
      <span>{item.label}</span>
      <span className="rounded-full border border-current/15 bg-current/10 px-1.5 py-0.5 font-mono-data text-[10px] leading-none">
        {item.count}
      </span>
    </button>
  )
}

export function ParkingLiveToolbar({
  siteCode,
  siteOptions,
  statusFilter,
  statusOptions,
  zoneFilter,
  zoneOptions,
  densityMode,
  densityOptions,
  searchQuery,
  attentionItems,
  onSiteChange,
  onStatusChange,
  onZoneChange,
  onDensityChange,
  onSearchChange,
  onClearSearch,
  onClearFilters,
}: Props) {
  const hasActiveFilters = Boolean(statusFilter || zoneFilter || searchQuery || densityMode !== 'comfortable')

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-[190px] min-w-[160px]">
          <Select
            value={siteCode}
            onChange={onSiteChange}
            options={siteOptions}
            placeholder="Select site…"
          />
        </div>

        <div className="w-[190px] min-w-[160px]">
          <Select
            value={statusFilter}
            onChange={onStatusChange}
            options={statusOptions}
            placeholder="All statuses"
            disabled={!siteCode}
          />
        </div>

        <div className="w-[180px] min-w-[150px]">
          <Select
            value={zoneFilter}
            onChange={onZoneChange}
            options={zoneOptions}
            placeholder="All zones"
            disabled={!siteCode || zoneOptions.length <= 1}
          />
        </div>

        <div className="w-[180px] min-w-[150px]">
          <Select
            value={densityMode}
            onChange={(value) => onDensityChange(value as 'comfortable' | 'compact')}
            options={densityOptions}
            placeholder="Density mode"
            disabled={!siteCode}
          />
        </div>

        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search spot, zone, plate, subscription…"
            className="pl-8 pr-8 font-mono-data text-sm"
            disabled={!siteCode}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          disabled={!siteCode || !hasActiveFilters}
        >
          Clear filters
        </Button>
      </div>

      {attentionItems.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Quick focus</span>
          {attentionItems.map((item) => (
            <FocusChip
              key={item.key}
              item={item}
              active={statusFilter === item.statusValue}
              onClick={(next) => onStatusChange(statusFilter === next.statusValue ? '' : next.statusValue)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
