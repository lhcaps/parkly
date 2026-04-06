import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

export function TopologyPage() {
  const { t } = useTranslation()
  const siteCode = useTopologyAdminStore((s) => s.siteCode)
  const setSiteCode = useTopologyAdminStore((s) => s.setSiteCode)
  const [sites, setSites] = useState<{ siteCode: string }[]>([])
  const [loadingSites, setLoadingSites] = useState(true)

  const [isAddGateOpen, setIsAddGateOpen] = useState(false)
  const [isAddLaneOpen, setIsAddLaneOpen] = useState(false)
  const [editLaneId, setEditLaneId] = useState<string | null>(null)

  // Callback prop for TopologyVisualizer — replaces CustomEvent anti-pattern
  const handleEditLane = useCallback((laneId: string) => {
    setEditLaneId(laneId)
  }, [])

  useEffect(() => {
    async function loadSites() {
      try {
        const res = await apiFetch<{ rows: { siteCode: string }[] }>('/api/sites')
        if (res.rows && res.rows.length > 0) {
          setSites(res.rows)
          if (!siteCode) {
            setSiteCode(res.rows[0].siteCode)
          }
        }
      } catch (err) {
        console.error('Failed to load sites for topology', err)
      } finally {
        setLoadingSites(false)
      }
    }
    loadSites()
  }, [siteCode, setSiteCode])

  const { data: topology, isLoading, isError } = useTopologyData(siteCode ?? '')

  // Loading skeleton
  if (loadingSites || (siteCode && isLoading)) {
    return (
      <div className="flex h-[calc(100vh-4rem)] bg-background animate-fade-in">
        <div className="w-80 border-r bg-card flex flex-col shrink-0 p-4 space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-full" />
          <div className="space-y-3 mt-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm text-muted-foreground">{t('topologyPage.loadingTopology')}</span>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (siteCode && (isError || !topology)) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background animate-fade-in">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="h-12 w-12 rounded-2xl border border-destructive/30 bg-destructive/10 flex items-center justify-center">
            <span className="text-destructive text-xl">!</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t('topologyPage.loadFailed')}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t('topologyPage.loadFailedDesc')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            {t('common.retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background animate-fade-in">
      {/* Left Sidebar: Device Pool */}
      <div className="w-80 border-r bg-card flex flex-col items-stretch shrink-0">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">{t('topologyPage.devicePool')}</h2>
          <SelectBox
            className="w-[160px]"
            value={siteCode || ''}
            onChange={setSiteCode}
          >
            {sites.map((s) => (
              <option key={s.siteCode} value={s.siteCode}>
                {s.siteCode}
              </option>
            ))}
          </SelectBox>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <DevicePool siteCode={siteCode} />
        </div>
      </div>

      {/* Main Canvas: Gates -> Lanes Visualizer */}
      <div className="flex-1 relative border-r">
        <div className="absolute top-0 right-0 z-10 flex gap-2 p-4">
          <Button variant="secondary" size="sm" onClick={() => setIsAddGateOpen(true)}>
            {t('topologyPage.addGate')}
          </Button>
          <Button variant="default" size="sm" onClick={() => setIsAddLaneOpen(true)}>
            {t('topologyPage.addLane')}
          </Button>
        </div>
        {topology && (
          <TopologyVisualizer
            gates={topology.gates as TopologyGate[]}
            onEditLane={handleEditLane}
          />
        )}
      </div>

      {/* Right Drawer: Device Configuration */}
      <DeviceConfigDrawer />

      <CreateGateDialog isOpen={isAddGateOpen} onClose={() => setIsAddGateOpen(false)} />
      <CreateLaneDialog isOpen={isAddLaneOpen} onClose={() => setIsAddLaneOpen(false)} />
      <EditLaneDialog laneId={editLaneId} isOpen={!!editLaneId} onClose={() => setEditLaneId(null)} />
    </div>
  )
}
