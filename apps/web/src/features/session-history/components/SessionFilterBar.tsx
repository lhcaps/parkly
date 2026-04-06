import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, Search } from 'lucide-react'
import { FilterCard } from '@/components/ops/console'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { cn } from '@/lib/utils'
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

function buildSiteOptions(sites: SiteRow[], t: (key: string, options?: Record<string, unknown>) => string): SelectOption[] {
  return [
    {
      value: '',
      label: t('sessionHistory.filters.allSites'),
      description: t('sessionHistory.filters.allSitesDescription'),
    },
    ...sites.map<SelectOption>((site) => ({
      value: site.siteCode,
      label: site.siteCode,
      description: site.name,
      badge: site.isActive ? t('sessionHistory.filters.activeBadge') : t('sessionHistory.filters.offBadge'),
      badgeVariant: site.isActive ? 'success' : 'neutral',
    })),
  ]
}

function buildLaneOptions(lanes: LaneRow[], t: (key: string, options?: Record<string, unknown>) => string): SelectOption[] {
  return [
    {
      value: '',
      label: t('sessionHistory.filters.allLanes'),
      description: t('sessionHistory.filters.allLanesDescription'),
    },
    ...lanes.map<SelectOption>((lane) => ({
      value: lane.laneCode,
      label: lane.laneCode,
      description: `${lane.gateCode} · ${lane.label}`,
      badge: t(`direction.${lane.direction}` as 'direction.ENTRY' | 'direction.EXIT'),
      badgeVariant: lane.direction === 'ENTRY' ? 'success' : 'warning',
    })),
  ]
}

function buildStatusOptions(t: (key: string, options?: Record<string, unknown>) => string): SelectOption[] {
  return [
    {
      value: '',
      label: t('sessionHistory.filters.allStatuses'),
      description: t('sessionHistory.filters.allStatusesDescription'),
    },
    ...SESSION_STATES.map<SelectOption>((item) => ({
      value: item,
      label: item,
      description: t(`sessionHistory.filters.statusDescriptions.${item}`),
      badge:
        item === 'APPROVED' || item === 'PASSED'
          ? t('sessionHistory.filters.statusBadges.ok')
          : item === 'DENIED' || item === 'ERROR'
            ? t('sessionHistory.filters.statusBadges.risk')
            : t('sessionHistory.filters.statusBadges.flow'),
      badgeVariant:
        item === 'APPROVED' || item === 'PASSED'
          ? 'success'
          : item === 'DENIED' || item === 'ERROR'
            ? 'error'
            : 'neutral',
    })),
  ]
}

function buildDirectionOptions(t: (key: string, options?: Record<string, unknown>) => string): SelectOption[] {
  return [
    {
      value: '',
      label: t('sessionHistory.filters.allDirections'),
      description: t('sessionHistory.filters.allDirectionsDescription'),
    },
    {
      value: 'ENTRY',
      label: 'ENTRY',
      description: t('sessionHistory.filters.inbound'),
      badge: t('sessionHistory.filters.inBadge'),
      badgeVariant: 'success',
    },
    {
      value: 'EXIT',
      label: 'EXIT',
      description: t('sessionHistory.filters.outbound'),
      badge: t('sessionHistory.filters.outBadge'),
      badgeVariant: 'warning',
    },
  ]
}

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
  const { t } = useTranslation()
  const siteOptions = useMemo(() => buildSiteOptions(sites, t), [sites, t])
  const laneOptions = useMemo(() => buildLaneOptions(lanes, t), [lanes, t])
  const statusOptions = useMemo(() => buildStatusOptions(t), [t])
  const directionOptions = useMemo(() => buildDirectionOptions(t), [t])

  return (
    <FilterCard
      className="ops-sticky-bar"
      contentClassName="pt-0"
      title={t('sessionHistory.filters.title')}
      description={t('sessionHistory.filters.description')}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={onRefresh} disabled={loading} className="h-11 gap-2 px-5">
            {t('common.refresh')}
          </Button>
          <Button variant="ghost" size="lg" onClick={onReset} disabled={loading} className="h-11 px-5">
            {t('sessionHistory.filters.reset')}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[200px_200px_200px_200px_1fr]">
          <Select
            value={siteCode}
            onChange={onSiteCodeChange}
            options={siteOptions}
            placeholder={t('sessionHistory.filters.selectSite')}
            disabled={loading}
            size="md"
          />

          <Select
            value={laneCode}
            onChange={onLaneCodeChange}
            options={laneOptions}
            placeholder={t('sessionHistory.filters.selectLane')}
            disabled={loading}
            size="md"
          />

          <Select
            value={status}
            onChange={(value) => onStatusChange(value as SessionState | '')}
            options={statusOptions}
            placeholder={t('sessionHistory.filters.selectStatus')}
            disabled={loading}
            size="md"
          />

          <Select
            value={direction}
            onChange={(value) => onDirectionChange(value as Direction | '')}
            options={directionOptions}
            placeholder={t('sessionHistory.filters.selectDirection')}
            disabled={loading}
            size="md"
          />

          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t('sessionHistory.filters.searchPlaceholder')}
              aria-label={t('sessionHistory.filters.searchAriaLabel')}
              className="h-12 pl-11 text-base"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              {t('sessionHistory.filters.from')}
            </label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="datetime-local"
                value={from}
                onChange={(event) => onFromChange(event.target.value)}
                aria-label={t('sessionHistory.filters.fromAriaLabel')}
                disabled={loading}
                className={cn(
                  'h-14 border-2 border-border/80 bg-card/80 pl-12 pr-4 text-base font-medium',
                  'transition-[border-color,background-color,box-shadow] duration-200',
                  'hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20',
                )}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              {t('sessionHistory.filters.to')}
            </label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="datetime-local"
                value={to}
                onChange={(event) => onToChange(event.target.value)}
                aria-label={t('sessionHistory.filters.toAriaLabel')}
                disabled={loading}
                className={cn(
                  'h-14 border-2 border-border/80 bg-card/80 pl-12 pr-4 text-base font-medium',
                  'transition-[border-color,background-color,box-shadow] duration-200',
                  'hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20',
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </FilterCard>
  )
}
