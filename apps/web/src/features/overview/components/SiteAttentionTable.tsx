import { useState, useMemo } from 'react'
import { Building2, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  if (row.offlineLaneCount > 0) return `${row.offlineLaneCount} ${row.offlineLaneCount > 1 ? 'lanes' : 'lane'} offline`
  if (row.laneAttentionCount > 0) return `${row.laneAttentionCount} ${row.laneAttentionCount > 1 ? 'lanes' : 'lane'} attention`
  return t('overview.siteOverview.stable')
}

export function SiteAttentionTable({
  rows,
  loading,
  error,
  selectedSiteCode,
  onSelectSite,
}: {
  rows: DashboardSiteOverviewRow[]
  loading: boolean
  error: string
  selectedSiteCode: string
  onSelectSite: (siteCode: string) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('attention')

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim()
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
  }, [rows, search, sortKey])

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t('overview.siteOverview.title')}</CardTitle>
            <CardDescription className="mt-1">{t('overview.siteOverview.description')}</CardDescription>
          </div>
          {!loading && rows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={selectedSiteCode ? 'outline' : 'default'}
                onClick={() => onSelectSite('')}
                className="text-xs"
              >
                {t('overview.siteOverview.allSites')}
              </Button>
              {rows.slice(0, 6).map((row) => (
                <Button
                  key={row.siteCode}
                  type="button"
                  size="sm"
                  variant={selectedSiteCode === row.siteCode ? 'default' : 'outline'}
                  onClick={() => onSelectSite(selectedSiteCode === row.siteCode ? '' : row.siteCode)}
                  className="text-xs"
                >
                  {row.siteCode}
                </Button>
              ))}
            </div>
          )}
        </div>

        {!loading && rows.length > 3 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('overview.siteOverview.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {([
                { key: 'attention', label: 'Ưu tiên' },
                { key: 'name', label: 'Tên' },
                { key: 'occupancy', label: 'Lấp đầy' },
                { key: 'sessions', label: 'Phiên' },
              ] as Array<{ key: SortKey; label: string }>).map(({ key, label }) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={sortKey === key ? 'default' : 'ghost'}
                  onClick={() => setSortKey(key)}
                  className="h-7 text-[11px] px-2"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <SurfaceState tone="loading" title={t('overview.siteOverview.loading')} className="min-h-[220px]" />
        ) : error ? (
          <SurfaceState tone="error" title={t('overview.siteOverview.error')} description={error} className="min-h-[220px]" />
        ) : rows.length === 0 ? (
          <SurfaceState title={t('overview.siteOverview.empty')} className="min-h-[220px]" />
        ) : filteredRows.length === 0 ? (
          <SurfaceState title="Không tìm thấy bãi phù hợp" description={`Không có bãi nào khớp với "${search}".`} className="min-h-[160px]" />
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
                    'group rounded-2xl border p-4 text-left transition-all duration-200',
                    active
                      ? 'border-primary/35 bg-primary/8 shadow-[0_0_0_1px_hsl(var(--primary)/0.12),0_8px_24px_rgba(0,0,0,0.12)]'
                      : 'border-border/60 bg-background/40 hover:border-primary/25 hover:bg-primary/5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
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
                      {row.incidentsOpenCount} incident{row.incidentsOpenCount !== 1 ? 's' : ''}
                    </Badge>
                    {row.criticalIncidentsOpenCount > 0 ? (
                      <Badge variant="destructive" className="text-[10px]">
                        {row.criticalIncidentsOpenCount} critical
                      </Badge>
                    ) : null}
                    <Badge variant={row.laneAttentionCount > 0 ? 'amber' : 'outline'} className="text-[10px]">
                      {row.laneAttentionCount} lane attention
                    </Badge>
                    {row.offlineLaneCount > 0 ? (
                      <Badge variant="destructive" className="text-[10px]">
                        {row.offlineLaneCount} offline
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="text-[10px]">
                      {row.openSessionCount} open
                    </Badge>
                    {row.expiringSubscriptionCount > 0 ? (
                      <Badge variant="amber" className="text-[10px]">
                        {row.expiringSubscriptionCount} expiring
                      </Badge>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
