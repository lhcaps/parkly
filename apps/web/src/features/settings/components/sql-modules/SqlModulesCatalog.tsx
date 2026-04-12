import { Link } from 'react-router-dom'
import { ArrowUpRight, Box, Compass, Database, GitBranch, Layers3, Link2, Sparkles } from 'lucide-react'
import type { ComponentType } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, type SelectOption } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SqlCatalogObject } from '@/lib/api/sql-surface'
import { cn } from '@/lib/utils'

import {
  MODULE_ROUTES,
  type SqlCatalogTab,
  type SqlModuleLabels,
  type SqlSurfaceData,
} from './sqlModules.utils'

function tabCount(data: SqlSurfaceData, tab: SqlCatalogTab) {
  if (tab === 'views') return data.objects?.views?.length ?? 0
  if (tab === 'procedures') return data.objects?.procedures?.length ?? 0
  if (tab === 'triggers') return data.objects?.triggers?.length ?? 0
  if (tab === 'constraints') return data.objects?.constraints?.length ?? 0
  return data.moduleGroups?.length ?? 0
}

function typeBadgeVariant(item: SqlCatalogObject) {
  if (item.objectType === 'PACKAGE') return 'secondary' as const
  if (item.objectType === 'FOREIGN KEY') return 'amber' as const
  return 'outline' as const
}

function detailPrefix(item: SqlCatalogObject, labels: SqlModuleLabels) {
  if (item.objectType === 'PACKAGE') return labels.catalogPackageCoverage
  if (item.objectType === 'FOREIGN KEY' || item.objectType === 'PRIMARY KEY' || item.objectType === 'UNIQUE') {
    return labels.catalogTable
  }
  return labels.catalogObjectType
}

function InventoryTile({
  item,
  labels,
}: {
  item: SqlCatalogObject
  labels: SqlModuleLabels
}) {
  const route = MODULE_ROUTES[item.moduleKey] ?? '/settings'

  return (
    <div className="group relative overflow-hidden rounded-[1.45rem] border border-border/70 bg-background/35 p-4 transition-colors duration-150 hover:border-primary/30 hover:bg-primary/5 [content-visibility:auto] [contain-intrinsic-size:220px]">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <Badge variant={typeBadgeVariant(item)}>{item.objectType ?? 'SQL'}</Badge>
            <Badge variant="outline">{item.moduleLabel}</Badge>
            {item.objectCount != null ? <Badge variant="secondary">{item.objectCount}</Badge> : null}
          </div>

          <p className="mt-3 font-mono-data text-sm font-semibold leading-6 tracking-[0.01em] break-all">
            {item.name}
          </p>

          {item.detail ? (
            <div className="mt-3 rounded-2xl border border-border/60 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/85">{detailPrefix(item, labels)}:</span>{' '}
              <span className={item.objectType === 'PACKAGE' ? '' : 'font-mono-data'}>{item.detail}</span>
            </div>
          ) : null}
        </div>

        <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full border border-border/60 bg-background/40">
          <Link to={route} aria-label={labels.catalogRoute} title={labels.catalogRoute}>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function CatalogDeck({
  items,
  empty,
  labels,
}: {
  items: SqlCatalogObject[]
  empty: string
  labels: SqlModuleLabels
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-[1.45rem] border border-dashed border-border/70 bg-background/35 px-4 py-10 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    )
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {items.map((item) => (
        <InventoryTile key={`${item.objectType ?? 'sql'}:${item.name}`} item={item} labels={labels} />
      ))}
    </div>
  )
}

function CoverageStat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-[1.1rem] border border-border/60 bg-background/40 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  )
}

export function SqlModulesCatalog({
  data,
  labels,
  tab,
  onTabChange,
  search,
  onSearchChange,
  moduleFilter,
  onModuleFilterChange,
  moduleOptions,
  filteredCatalog,
}: {
  data: SqlSurfaceData
  labels: SqlModuleLabels
  tab: SqlCatalogTab
  onTabChange: (value: SqlCatalogTab) => void
  search: string
  onSearchChange: (value: string) => void
  moduleFilter: string
  onModuleFilterChange: (value: string) => void
  moduleOptions: SelectOption[]
  filteredCatalog: SqlCatalogObject[]
}) {
  const tabs: Array<{ value: SqlCatalogTab; label: string; icon: ComponentType<{ className?: string }> }> = [
    { value: 'views', label: labels.viewsTab, icon: Layers3 },
    { value: 'procedures', label: labels.proceduresTab, icon: Sparkles },
    { value: 'triggers', label: labels.triggersTab, icon: GitBranch },
    { value: 'constraints', label: labels.constraintsTab, icon: Link2 },
    { value: 'packages', label: labels.packagesTab, icon: Box },
  ]

  const moduleGroups = Array.isArray(data.moduleGroups) ? data.moduleGroups : []
  const maxGroupTotal = moduleGroups.reduce((max, group) => Math.max(max, Number(group.total ?? 0)), 1)

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_20px_62px_rgba(35,94,138,0.12)]">
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Database className="h-4 w-4 text-primary" />
              {labels.sqlExplorer}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{labels.sqlExplorerDesc}</p>
          </div>

          <Badge variant="outline">
            {filteredCatalog.length} {labels.matchingObjects}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-[1.55rem] border border-border/70 bg-[linear-gradient(180deg,rgba(58,130,198,0.08),rgba(58,130,198,0.02))] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Compass className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{labels.packageCoverage}</p>
              <p className="mt-1 text-sm text-muted-foreground">{labels.packageCoverageDesc}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <CoverageStat label={labels.packagesTab} value={moduleGroups.length} />
            <CoverageStat label={labels.viewsTab} value={data.counts.views} />
            <CoverageStat label={labels.proceduresTab} value={data.counts.procedures} />
            <CoverageStat label={labels.constraintsTab} value={data.counts.constraints} />
          </div>

          <div className="mt-4 rounded-[1.2rem] border border-border/60 bg-background/35 p-2">
            <Button
              type="button"
              variant={moduleFilter === 'all' ? 'default' : 'ghost'}
              onClick={() => onModuleFilterChange('all')}
              className="h-10 w-full justify-between rounded-[1rem] px-3 text-xs"
            >
              <span className="inline-flex items-center gap-2">
                <Box className="h-4 w-4" />
                {labels.allModules}
              </span>
              <Badge variant={moduleFilter === 'all' ? 'secondary' : 'outline'} className="text-[10px]">
                {moduleGroups.length}
              </Badge>
            </Button>
          </div>

          <ScrollArea className="mt-4 h-[360px] md:h-[420px] xl:h-[640px] pr-2">
            {moduleGroups.length === 0 ? (
              <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-background/35 px-4 py-10 text-center text-sm text-muted-foreground">
                {labels.empty}
              </div>
            ) : (
              <div className="space-y-2">
                {moduleGroups.map((group) => {
                  const views = Array.isArray(group.views) ? group.views : []
                  const procedures = Array.isArray(group.procedures) ? group.procedures : []
                  const triggers = Array.isArray(group.triggers) ? group.triggers : []
                  const constraints = Array.isArray(group.constraints) ? group.constraints : []
                  const isActive = moduleFilter === group.moduleKey
                  const coverage = Math.max(10, Math.round((Number(group.total ?? 0) / maxGroupTotal) * 100))
                  const packageName = group.moduleKey === 'system' ? 'system_ops.*' : `pkg_${group.moduleKey}_*`

                  return (
                    <div
                      key={group.moduleKey}
                      className={cn(
                        'rounded-[1.25rem] border p-3 transition-colors duration-150',
                        isActive
                          ? 'border-primary/35 bg-primary/10 shadow-[0_0_0_1px_rgba(58,130,198,0.12)]'
                          : 'border-border/70 bg-background/45 hover:border-primary/20 hover:bg-background/60',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => onModuleFilterChange(isActive ? 'all' : group.moduleKey)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{group.moduleLabel}</p>
                              <p className="mt-1 truncate font-mono-data text-[11px] text-muted-foreground">{packageName}</p>
                            </div>
                            <Badge variant={isActive ? 'secondary' : 'outline'}>{group.total}</Badge>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                            <div className="rounded-xl border border-border/60 bg-background/35 px-2.5 py-2">
                              <span className="block uppercase tracking-[0.12em]">V/P</span>
                              <span className="mt-1 block font-mono-data text-foreground">{views.length}/{procedures.length}</span>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-background/35 px-2.5 py-2">
                              <span className="block uppercase tracking-[0.12em]">T/C</span>
                              <span className="mt-1 block font-mono-data text-foreground">{triggers.length}/{constraints.length}</span>
                            </div>
                          </div>

                          <div className="mt-3">
                            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                              <span>{labels.catalogCoverage}</span>
                              <span>{coverage}%</span>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-background/70">
                              <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(56,189,248,0.78),rgba(59,130,246,0.92))]"
                                style={{ width: `${coverage}%` }}
                              />
                            </div>
                          </div>
                        </button>

                        <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full border border-border/60 bg-background/35">
                          <Link to={MODULE_ROUTES[group.moduleKey] ?? '/settings'} aria-label={labels.openPage} title={labels.openPage}>
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </aside>

        <section className="rounded-[1.55rem] border border-border/70 bg-background/30 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Database className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{labels.objectInventory}</p>
              <p className="mt-1 text-sm text-muted-foreground">{labels.objectInventoryDesc}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_250px_auto]">
            <Input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={labels.catalogSearch} />
            <Select value={moduleFilter} onChange={onModuleFilterChange} options={moduleOptions} placeholder={labels.allModules} />
            <div className="flex min-h-10 items-center justify-center rounded-2xl border border-border/70 bg-background/50 px-4 text-xs font-medium text-muted-foreground">
              {labels.catalogFilterLabel}
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{labels.catalogScrollHint}</p>

          <Tabs value={tab} onValueChange={(value) => onTabChange(value as SqlCatalogTab)} className="mt-4 space-y-4">
            <TabsList className="grid w-full grid-cols-2 gap-2 rounded-[1.6rem] border border-border/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.76),rgba(15,23,42,0.58))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:grid-cols-5">
              {tabs.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="w-full min-w-0 justify-between rounded-[1.1rem] border border-transparent px-3 py-2.5 text-xs sm:text-sm"
                >
                  <span className="inline-flex min-w-0 items-center gap-2 overflow-hidden">
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{label}</span>
                  </span>
                  <Badge variant={tab === value ? 'secondary' : 'outline'} className="shrink-0 text-[10px]">
                    {tabCount(data, value)}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="rounded-[1.45rem] border border-border/70 bg-background/20 p-3">
              {tabs.map(({ value }) => (
                <TabsContent key={value} value={value} className="mt-0">
                  <ScrollArea className="h-[420px] md:h-[520px] xl:h-[640px] pr-2">
                    <CatalogDeck items={filteredCatalog} empty={labels.empty} labels={labels} />
                  </ScrollArea>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </section>
      </CardContent>
    </Card>
  )
}
