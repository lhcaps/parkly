import { RefreshCw, X } from 'lucide-react'
import { FilterCard } from '@/components/ops/console'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import type { SiteRow } from '@/lib/contracts/topology'
import type { SubscriptionEffectiveStatus } from '../types'

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'ACTIVE', badge: 'active', badgeVariant: 'success' },
  { value: 'EXPIRED', label: 'EXPIRED', badge: 'expired', badgeVariant: 'neutral' },
  { value: 'SUSPENDED', label: 'SUSPENDED', badge: 'suspended', badgeVariant: 'warning' },
  { value: 'CANCELLED', label: 'CANCELLED', badge: 'cancelled', badgeVariant: 'error' },
]

function buildSiteOptions(sites: SiteRow[]): SelectOption[] {
  return [
    { value: '', label: 'All sites' },
    ...sites.map<SelectOption>((site) => ({
      value: site.siteCode,
      label: site.siteCode,
      description: site.name,
      badge: site.isActive ? 'active' : 'off',
      badgeVariant: site.isActive ? 'success' : 'neutral',
    })),
  ]
}

type Props = {
  sites: SiteRow[]
  siteCode: string
  status: SubscriptionEffectiveStatus | ''
  plateInput: string
  busy?: boolean
  onSiteChange: (value: string) => void
  onStatusChange: (value: SubscriptionEffectiveStatus | '') => void
  onPlateInputChange: (value: string) => void
  onSubmitPlate: () => void
  onClearPlate: () => void
  onReset: () => void
  onRefresh: () => void
}

export function SubscriptionsFilterBar({
  sites,
  siteCode,
  status,
  plateInput,
  busy = false,
  onSiteChange,
  onStatusChange,
  onPlateInputChange,
  onSubmitPlate,
  onClearPlate,
  onReset,
  onRefresh,
}: Props) {
  const siteOptions = buildSiteOptions(sites)

  return (
    <FilterCard
      className="ops-sticky-bar"
      contentClassName="pt-0"
      title="Filters"
      description="Filter by site, effective status, and plate." 
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={busy}>
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>Reset</Button>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Select
          value={siteCode}
          onChange={onSiteChange}
          options={siteOptions}
          placeholder="All sites"
          disabled={busy}
        />
        <Select
          value={status}
          onChange={(value) => onStatusChange(value as SubscriptionEffectiveStatus | '')}
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          disabled={busy}
        />
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmitPlate()
          }}
          className="flex gap-2"
        >
          <Input
            value={plateInput}
            onChange={(event) => onPlateInputChange(event.target.value.toUpperCase())}
            placeholder="Filter by plate"
            className="flex-1 font-mono-data"
          />
          {plateInput ? (
            <Button type="button" variant="ghost" size="icon" onClick={onClearPlate} aria-label="Clear plate filter">
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </form>
      </div>
    </FilterCard>
  )
}
