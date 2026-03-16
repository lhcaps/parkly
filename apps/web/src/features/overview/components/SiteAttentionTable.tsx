import { Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SurfaceState } from '@/components/ops/console'
import type { DashboardSiteOverviewRow } from '@/lib/contracts/dashboard'
import { cn } from '@/lib/utils'

function rowTone(row: DashboardSiteOverviewRow) {
  if (row.offlineLaneCount > 0 || row.criticalIncidentsOpenCount > 0) return 'destructive' as const
  if (row.laneAttentionCount > 0 || row.incidentsOpenCount > 0 || row.expiringSubscriptionCount > 0) return 'amber' as const
  return 'secondary' as const
}

function rowStatusLabel(row: DashboardSiteOverviewRow) {
  if (row.offlineLaneCount > 0) return `${row.offlineLaneCount} lane${row.offlineLaneCount > 1 ? 's' : ''} offline`
  if (row.laneAttentionCount > 0) return `${row.laneAttentionCount} lane${row.laneAttentionCount > 1 ? 's' : ''} attention`
  return 'Stable'
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
  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <CardHeader>
        <CardTitle>Site overview</CardTitle>
        <CardDescription>Compare incident load, lane status, and open sessions across sites to prioritise scope.</CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <SurfaceState tone="loading" title="Loading site summary" description="Fetching site-level snapshot from the dashboard." className="min-h-[220px]" />
        ) : error ? (
          <SurfaceState tone="error" title="Site summary unavailable" description={error} className="min-h-[220px]" />
        ) : rows.length === 0 ? (
          <SurfaceState title="No sites in scope" description="Your current role or site scope returned no summary rows." className="min-h-[220px]" />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={selectedSiteCode ? 'outline' : 'default'} onClick={() => onSelectSite('')}>
                All sites
              </Button>
              {rows.map((row) => (
                <Button
                  key={row.siteCode}
                  type="button"
                  size="sm"
                  variant={selectedSiteCode === row.siteCode ? 'default' : 'outline'}
                  onClick={() => onSelectSite(row.siteCode)}
                >
                  {row.siteCode}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              {rows.map((row) => {
                const active = selectedSiteCode === row.siteCode
                return (
                  <button
                    type="button"
                    key={row.siteCode}
                    onClick={() => onSelectSite(active ? '' : row.siteCode)}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition',
                      active
                        ? 'border-primary/30 bg-primary/8 shadow-[0_0_0_1px_hsl(var(--primary)/0.08)]'
                        : 'border-border/80 bg-background/40 hover:border-primary/20 hover:bg-primary/5',
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
                            {row.occupancyRate.toFixed(1)}% occupancy &middot; {row.activePresenceCount} presence
                          </p>
                        </div>
                      </div>
                      <Badge variant={rowTone(row)}>{rowStatusLabel(row)}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant={row.incidentsOpenCount > 0 ? 'amber' : 'outline'}>
                        {row.incidentsOpenCount} incident{row.incidentsOpenCount !== 1 ? 's' : ''}
                      </Badge>
                      {row.criticalIncidentsOpenCount > 0 ? (
                        <Badge variant="destructive">{row.criticalIncidentsOpenCount} critical</Badge>
                      ) : null}
                      <Badge variant={row.laneAttentionCount > 0 ? 'amber' : 'outline'}>
                        {row.laneAttentionCount} lane attention
                      </Badge>
                      {row.offlineLaneCount > 0 ? (
                        <Badge variant="destructive">{row.offlineLaneCount} offline</Badge>
                      ) : null}
                      <Badge variant="outline">{row.openSessionCount} open sessions</Badge>
                      {row.expiringSubscriptionCount > 0 ? (
                        <Badge variant="amber">{row.expiringSubscriptionCount} expiring</Badge>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
