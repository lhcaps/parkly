import { memo, useDeferredValue, useMemo, useState } from 'react'
import { Building2, Layers, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SurfaceState } from '@/components/ops/console'
import type { DashboardSiteOverviewRow } from '@/lib/contracts/dashboard'
import { cn } from '@/lib/utils'

type SortKey = 'attention' | 'name' | 'occupancy' | 'sessions'

function rowTone(row: DashboardSiteOverviewRow) {
  if (row.offlineLaneCount > 0 || row.criticalIncidentsOpenCount > 0) return 'destructive' as const
  if (row.laneAttentionCount > 0 || row.incidentsOpenCount > 0 || row.expiringSubscriptionCount > 0) return 'amber' as const
  return 'secondary' as const
}

function rowStatusLabel(row: DashboardSiteOverviewRow, t: ReturnType<typeof useTranslation>['t']) {
  if (row.offlineLaneCount > 0) return t('overview.siteOverview.offline', { count: row.offlineLaneCount })
  if (row.laneAttentionCount > 0) return t('overview.siteOverview.laneAttention', { count: row.laneAttentionCount })
  return t('overview.siteOverview.stable')
}

export const SiteAttentionTable = memo(function SiteAttentionTable({
  rows,
  loading,
  error,
  selectedSiteCode,
  onSelectSite,
  defaultOpen = true,
}: {
  rows: DashboardSiteOverviewRow[]
  loading: boolean
  error: string
  selectedSiteCode: string
  onSelectSite: (siteCode: string) => void
  defaultOpen?: boolean
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('attention')
  const deferredSearch = useDeferredValue(search)

  const filteredRows = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim()
    const base = q ? rows.filter((r) => r.siteCode.toLowerCase().includes(q)) : rows
    return [...base].sort((a, b) => {
      if (sortKey === 'attention') {
        const ad = a.offlineLaneCount + a.criticalIncidentsOpenCount + a.laneAttentionCount + a.incidentsOpenCount
        const bd = b.offlineLaneCount + b.criticalIncidentsOpenCount + b.laneAttentionCount + b.incidentsOpenCount
        if (ad !== bd) return bd - ad
        return b.openSessionCount - a.openSessionCount
      }
      if (sortKey === 'name') return a.siteCode.localeCompare(b.siteCode)
      if (sortKey === 'occupancy') return b.occupancyRate - a.occupancyRate
      if (sortKey === 'sessions') return b.openSessionCount - a.openSessionCount
      return 0
    })
  }, [deferredSearch, rows, sortKey])

  return (
    <CollapsibleCard
      title={t('overview.siteOverview.title')}
      description={t('overview.siteOverview.description')}
      defaultOpen={defaultOpen}
      count={rows.length}
      countVariant={
        rows.some((row) => row.offlineLaneCount > 0 || row.criticalIncidentsOpenCount > 0)
          ? 'destructive'
          : rows.some((row) => row.laneAttentionCount > 0 || row.incidentsOpenCount > 0)
            ? 'amber'
            : 'success'
      }
      icon={<Building2 className="h-4 w-4" />}
      className="border-border/80 bg-card/95 shadow-[0_20px_62px_rgba(35,94,138,0.12)]"
      contentClassName="pt-0"
      renderContent={() => (
        <>
          {!loading && rows.length > 0 ? (
            <ScrollArea className="mb-4 w-full whitespace-nowrap">
              <div className="flex w-max gap-2 pb-1 pr-2">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedSiteCode ? 'outline' : 'default'}
                  onClick={() => onSelectSite('')}
                  className="h-9 rounded-full px-4 text-xs"
                >
                  {t('overview.siteOverview.allSites')}
                </Button>
                {rows.map((row) => (
                  <Button
                    key={row.siteCode}
                    type="button"
                    size="sm"
                    variant={selectedSiteCode === row.siteCode ? 'default' : 'outline'}
                    onClick={() => onSelectSite(selectedSiteCode === row.siteCode ? '' : row.siteCode)}
                    className="h-9 rounded-full px-4 text-xs"
                  >
                    {row.siteCode}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          ) : null}

          {!loading && rows.length > 3 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('overview.siteOverview.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-9 text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {([
                  { key: 'attention', label: t('overview.siteOverview.sortPriority') },
                  { key: 'name', label: t('overview.siteOverview.sortName') },
                  { key: 'occupancy', label: t('overview.siteOverview.sortOccupancy') },
                  { key: 'sessions', label: t('overview.siteOverview.sortSessions') },
                ] as Array<{ key: SortKey; label: string }>).map(({ key, label }) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={sortKey === key ? 'default' : 'ghost'}
                    onClick={() => setSortKey(key)}
                    className="h-7 px-2 text-[11px]"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {loading ? (
            <SurfaceState tone="loading" title={t('overview.siteOverview.loading')} className="min-h-[220px]" />
          ) : error ? (
            <SurfaceState tone="error" title={t('overview.siteOverview.error')} description={error} className="min-h-[220px]" />
          ) : rows.length === 0 ? (
            <SurfaceState title={t('overview.siteOverview.empty')} className="min-h-[220px]" />
          ) : filteredRows.length === 0 ? (
            <SurfaceState
              title={t('overview.siteOverview.noMatchesTitle')}
              description={t('overview.siteOverview.noMatchesDescription', { search })}
              className="min-h-[160px]"
            />
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filteredRows.map((row) => {
                const active = selectedSiteCode === row.siteCode
                return (
                  <button
                    type="button"
                    key={row.siteCode}
                    onClick={() => onSelectSite(active ? '' : row.siteCode)}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition-colors duration-150 [content-visibility:auto] [contain-intrinsic-size:280px]',
                      active
                        ? 'border-primary/35 bg-primary/8 shadow-[0_0_0_1px_hsl(var(--primary)/0.12)]'
                        : 'border-border/60 bg-background/40 hover:border-primary/25 hover:bg-primary/5',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-mono-data text-sm font-semibold">{row.siteCode}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t('overview.siteOverview.occupancy', { rate: row.occupancyRate.toFixed(1) })} &middot;{' '}
                            {t('overview.siteOverview.presence', { count: row.activePresenceCount })}
                          </p>
                        </div>
                      </div>
                      <Badge variant={rowTone(row)} className="shrink-0 text-[10px]">{rowStatusLabel(row, t)}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant={row.incidentsOpenCount > 0 ? 'amber' : 'outline'} className="text-[10px]">
                        {t('overview.siteOverview.incidents', { count: row.incidentsOpenCount })}
                      </Badge>
                      {row.criticalIncidentsOpenCount > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          {t('overview.siteOverview.critical', { count: row.criticalIncidentsOpenCount })}
                        </Badge>
                      ) : null}
                      <Badge variant={row.laneAttentionCount > 0 ? 'amber' : 'outline'} className="text-[10px]">
                        {t('overview.siteOverview.laneAttention', { count: row.laneAttentionCount })}
                      </Badge>
                      {row.offlineLaneCount > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          {t('overview.siteOverview.offline', { count: row.offlineLaneCount })}
                        </Badge>
                      ) : null}
                      <Badge variant="outline" className="text-[10px]">
                        {t('overview.siteOverview.openSessions', { count: row.openSessionCount })}
                      </Badge>
                      {row.expiringSubscriptionCount > 0 ? (
                        <Badge variant="amber" className="text-[10px]">
                          {t('overview.siteOverview.expiring', { count: row.expiringSubscriptionCount })}
                        </Badge>
                      ) : null}
                    </div>

                    {row.zoneCount > 0 ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-border/40 bg-background/30 p-3">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Layers className="h-3 w-3" />
                          <span className="font-medium">{t('overview.topology.title')}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">
                            {row.zoneCount}z / {row.gateCount}g / {row.laneCount}l / {row.deviceCount}d
                          </Badge>
                          {row.zoneCodes.map((code) => (
                            <Badge key={code} variant="outline" className="text-[10px]">
                              {code}
                            </Badge>
                          ))}
                          {row.vehicleTypes.length > 0 ? (
                            <Badge variant="outline" className="text-[10px]">
                              {row.vehicleTypes.join('+')}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    />
  )
})
