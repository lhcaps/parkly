import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Boxes, Cpu, GitBranch, MapPinned, Network, Plus, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/http/client'

import { SelectBox } from '@/components/ui/select'
import { useTopologyData } from '@/features/topology-admin/useTopologyAdmin'
import TopologyVisualizer from '@/features/topology-admin/TopologyVisualizer'
import DevicePool from '@/features/topology-admin/DevicePool'
import DeviceConfigDrawer from '@/features/topology-admin/DeviceConfigDrawer'
import CreateLaneDialog from '@/features/topology-admin/CreateLaneDialog'
import CreateGateDialog from '@/features/topology-admin/CreateGateDialog'
import EditLaneDialog from '@/features/topology-admin/EditLaneDialog'
import { useTopologyAdminStore } from '@/features/topology-admin/topology-admin-store'
import type { TopologyGate } from '@/lib/api/topology-admin-queries'

function TopologyStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: typeof Network
}) {
  return (
    <div className="rounded-[1rem] border border-border/60 bg-background/45 p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  )
}

function TopologyShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="-mx-4 -my-5 sm:-mx-6 lg:-mx-8 lg:-my-7 h-[calc(100vh-4rem)] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.10),transparent_38%),linear-gradient(180deg,rgba(8,15,28,0.96),rgba(15,23,42,0.92))] px-4 py-4 md:px-5 md:py-5 animate-fade-in">
      {children}
    </div>
  )
}

export function TopologyPage() {
  const { t } = useTranslation()
  const siteCode = useTopologyAdminStore((state) => state.siteCode)
  const setSiteCode = useTopologyAdminStore((state) => state.setSiteCode)
  const [sites, setSites] = useState<{ siteCode: string }[]>([])
  const [loadingSites, setLoadingSites] = useState(true)

  const [isAddGateOpen, setIsAddGateOpen] = useState(false)
  const [isAddLaneOpen, setIsAddLaneOpen] = useState(false)
  const [editLaneId, setEditLaneId] = useState<string | null>(null)

  const handleEditLane = useCallback((laneId: string) => {
    setEditLaneId(laneId)
  }, [])

  useEffect(() => {
    async function loadSites() {
      try {
        const res = await apiFetch<{ rows: { siteCode: string }[] }>('/api/sites')
        if (res.rows && res.rows.length > 0) {
          setSites(res.rows)
          if (!siteCode) setSiteCode(res.rows[0].siteCode)
        }
      } catch (err) {
        console.error('Failed to load sites for topology', err)
      } finally {
        setLoadingSites(false)
      }
    }

    void loadSites()
  }, [siteCode, setSiteCode])

  const { data: topology, isLoading, isError } = useTopologyData(siteCode ?? '')

  const topologyStats = useMemo(() => {
    const gates = topology?.gates ?? []
    const lanes = gates.flatMap((gate) => gate.lanes)
    const devices = lanes.flatMap((lane) => lane.devices)

    return {
      gateCount: gates.length,
      laneCount: lanes.length,
      deviceCount: devices.length,
      activeLaneCount: lanes.filter((lane) => lane.status === 'ACTIVE').length,
      primaryDeviceCount: devices.filter((device) => device.isPrimary).length,
      offlineDeviceCount: devices.filter((device) => device.heartbeatStatus !== 'ONLINE').length,
    }
  }, [topology])

  if (loadingSites || (siteCode && isLoading)) {
    return (
      <TopologyShell>
        <div className="grid h-full grid-cols-[320px_minmax(0,1fr)] gap-4">
          <div className="border-r border-white/6 p-5">
            <div className="space-y-4">
              <Skeleton className="h-44 w-full rounded-[1.7rem]" />
              <Skeleton className="h-[calc(100vh-20rem)] w-full rounded-[1.7rem]" />
            </div>
          </div>
          <div className="p-5">
            <Skeleton className="h-full w-full rounded-[1.9rem]" />
          </div>
        </div>
      </TopologyShell>
    )
  }

  if (siteCode && (isError || !topology)) {
    return (
      <TopologyShell>
        <div className="flex h-full items-center justify-center p-6">
          <div className="flex max-w-sm flex-col items-center gap-4 rounded-[1.7rem] border border-white/6 bg-card/82 px-8 py-9 text-center shadow-[0_14px_40px_rgba(0,0,0,0.18)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10">
              <span className="text-xl text-destructive">!</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t('topologyPage.loadFailed')}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{t('topologyPage.loadFailedDesc')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="rounded-2xl">
              {t('common.retry')}
            </Button>
          </div>
        </div>
      </TopologyShell>
    )
  }

  return (
    <TopologyShell>
      <div className="grid h-full grid-cols-[320px_minmax(0,1fr)] gap-4">
        <aside className="min-h-0 rounded-[1.6rem] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.82))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_18px_54px_rgba(0,0,0,0.18)]">
          <ScrollArea className="h-full pr-2">
          <div className="space-y-4 pb-4">
            <Card className="overflow-hidden rounded-[1.55rem] border-white/8 bg-card/84 shadow-[0_18px_54px_rgba(0,0,0,0.18)] backdrop-blur-sm">
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <Network className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('topologyPage.siteSelector')}</p>
                    <h1 className="mt-1 text-[1.65rem] font-semibold tracking-tight leading-tight">{topology?.site.name ?? siteCode ?? 'Topology'}</h1>
                    <p className="mt-1 text-sm text-muted-foreground/90">{t('topologyPage.subtitle')}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {t('topologyPage.siteSelector')}
                  </label>
                  <SelectBox className="w-full" value={siteCode || ''} onChange={setSiteCode}>
                    {sites.map((site) => (
                      <option key={site.siteCode} value={site.siteCode}>
                        {site.siteCode}
                      </option>
                    ))}
                  </SelectBox>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{topology?.site.siteCode ?? siteCode}</Badge>
                  <Badge variant="outline">{topology?.site.timezone ?? 'Asia/Ho_Chi_Minh'}</Badge>
                  <Badge variant={topology?.site.isActive ? 'secondary' : 'amber'}>
                    {topology?.site.isActive ? t('topologyPage.siteActive') : t('topologyPage.siteInactive')}
                  </Badge>
                </div>

                <Separator className="bg-white/8" />

                <div className="grid grid-cols-2 gap-3">
                  <TopologyStat label={t('topologyPage.gates')} value={topologyStats.gateCount} icon={GitBranch} />
                  <TopologyStat label={t('topologyPage.lanes')} value={topologyStats.laneCount} icon={MapPinned} />
                  <TopologyStat label={t('topologyPage.devices')} value={topologyStats.deviceCount} icon={Cpu} />
                  <TopologyStat label={t('topologyPage.primaryDevices')} value={topologyStats.primaryDeviceCount} icon={ShieldCheck} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setIsAddGateOpen(true)} className="h-9 rounded-2xl gap-2 shadow-sm">
                    <Plus className="h-3.5 w-3.5" />
                    {t('topologyPage.addGate')}
                  </Button>
                  <Button variant="default" size="sm" onClick={() => setIsAddLaneOpen(true)} className="h-9 rounded-2xl gap-2 shadow-sm">
                    <Plus className="h-3.5 w-3.5" />
                    {t('topologyPage.addLane')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-[1.55rem] border-white/8 bg-card/84 shadow-[0_18px_54px_rgba(0,0,0,0.18)] backdrop-blur-sm">
              <CardHeader className="space-y-1 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold tracking-tight">{t('topologyPage.devicePool')}</CardTitle>
                    <CardDescription className="mt-1 text-sm">{t('topologyPage.devicePoolHint')}</CardDescription>
                  </div>
                  <Badge variant="outline">{t('topologyPage.unassignedDevices')}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <DevicePool siteCode={siteCode} />
              </CardContent>
            </Card>
          </div>
          </ScrollArea>
        </aside>

        <main className="min-h-0 min-w-0">
          <Card className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.7rem] border-white/8 bg-card/82 shadow-[0_24px_72px_rgba(0,0,0,0.20)] backdrop-blur-sm">
            <div className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.10),transparent_48%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.76))] px-4 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <Boxes className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{topology?.site.siteCode ?? siteCode}</p>
                      <h2 className="text-lg font-semibold tracking-tight">{t('topologyPage.canvasTitle')}</h2>
                    </div>
                  </div>
                  <p className="mt-2.5 text-sm text-muted-foreground">{t('topologyPage.canvasDesc')}</p>
                </div>

                <Separator orientation="vertical" className="hidden h-14 bg-white/8 xl:block" />

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{t('topologyPage.gates')}: {topologyStats.gateCount}</Badge>
                  <Badge variant="outline">{t('topologyPage.lanes')}: {topologyStats.laneCount}</Badge>
                  <Badge variant="outline">{t('topologyPage.devices')}: {topologyStats.deviceCount}</Badge>
                  <Badge variant={topologyStats.offlineDeviceCount > 0 ? 'amber' : 'secondary'}>
                    {t('topologyPage.offlineDevices')}: {topologyStats.offlineDeviceCount}
                  </Badge>
                  <Badge variant={topologyStats.activeLaneCount > 0 ? 'secondary' : 'amber'}>
                    {t('topologyPage.activeLanes')}: {topologyStats.activeLaneCount}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden">
              {topology && topology.gates.length > 0 ? (
                <>
                  <TopologyVisualizer
                    gates={topology.gates as TopologyGate[]}
                    onEditLane={handleEditLane}
                  />

                  <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2">
                    <Badge variant="secondary">{t('topologyPage.dragDevicesHint')}</Badge>
                    <Badge variant="outline">{t('topologyPage.clickLaneHint')}</Badge>
                  </div>

                  <div className="pointer-events-none absolute bottom-3 left-16 z-10 rounded-[1.15rem] border border-white/8 bg-card/88 px-3 py-2.5 shadow-[0_10px_34px_rgba(0,0,0,0.20)] backdrop-blur-sm">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#6b7280]" />
                        {t('topologyPage.legendGate')}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                        {t('topologyPage.legendLane')}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                        {t('topologyPage.legendDevice')}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.08),transparent_48%)]">
                  <div className="max-w-md rounded-[1.7rem] border border-border/70 bg-card/90 px-6 py-8 text-center shadow-[0_22px_64px_rgba(0,0,0,0.18)]">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <Network className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold">{t('topologyPage.noGatesTitle')}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{t('topologyPage.noGatesDesc')}</p>
                    <div className="mt-5 flex justify-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setIsAddGateOpen(true)} className="rounded-2xl">
                        {t('topologyPage.addGate')}
                      </Button>
                      <Button variant="default" size="sm" onClick={() => setIsAddLaneOpen(true)} className="rounded-2xl">
                        {t('topologyPage.addLane')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </main>
      </div>

      <DeviceConfigDrawer />

      <CreateGateDialog isOpen={isAddGateOpen} onClose={() => setIsAddGateOpen(false)} />
      <CreateLaneDialog isOpen={isAddLaneOpen} onClose={() => setIsAddLaneOpen(false)} />
      <EditLaneDialog laneId={editLaneId} isOpen={!!editLaneId} onClose={() => setEditLaneId(null)} />
    </TopologyShell>
  )
}
