import { useCallback, useEffect, useRef } from 'react'
import { ArrowRightLeft, LayoutPanelTop, ScanSearch, Workflow } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { LaneContextPanel } from '@/features/run-lane/components/LaneContextPanel'
import { CapturePreviewPanel } from '@/features/run-lane/components/CapturePreviewPanel'
import { SubmitResultPanel } from '@/features/run-lane/components/SubmitResultPanel'
import { selectRunLaneSiteCode } from '@/features/run-lane/store/runLaneSelectors'
import { RunLaneStoreProvider, useRunLaneActions, useRunLaneStore } from '@/features/run-lane/store/runLaneStoreContext'
import { getDevices } from '@/lib/api/devices'
import { getGates, getLanes, getSites } from '@/lib/api/topology'

function RunLaneScreen() {
  const actions = useRunLaneActions()
  const siteCode = useRunLaneStore(selectRunLaneSiteCode)
  const topologyRequestIdRef = useRef(0)

  const loadSiteTopology = useCallback(async (nextSiteCode: string) => {
    if (!nextSiteCode) return

    const requestId = ++topologyRequestIdRef.current

    try {
      actions.setTopologyLoading()
      const [gateRes, laneRes, deviceRes] = await Promise.all([
        getGates(nextSiteCode),
        getLanes(nextSiteCode),
        getDevices({ siteCode: nextSiteCode }),
      ])

      if (topologyRequestIdRef.current !== requestId) return

      actions.hydrateSiteTopology({
        siteCode: nextSiteCode,
        gates: gateRes.rows,
        lanes: laneRes.rows,
        devices: deviceRes.rows,
      })
    } catch (error) {
      if (topologyRequestIdRef.current !== requestId) return
      actions.setTopologyError(error instanceof Error ? error.message : String(error))
    }
  }, [actions])

  useEffect(() => {
    let active = true

    async function bootstrapSites() {
      try {
        actions.setTopologyLoading()
        const response = await getSites()
        if (!active) return
        actions.hydrateSites(response.rows)
      } catch (error) {
        if (!active) return
        actions.setTopologyError(error instanceof Error ? error.message : String(error))
      }
    }

    bootstrapSites()

    return () => {
      active = false
    }
  }, [actions])

  useEffect(() => {
    if (!siteCode) return
    void loadSiteTopology(siteCode)
  }, [siteCode, loadSiteTopology])

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-border/80 bg-card/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.2)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <Badge variant="entry">PR-08</Badge>
              <Badge variant="secondary">scoped store</Badge>
              <Badge variant="outline">3-column lane workflow</Badge>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Run Lane đã tách khỏi GatePage monolith</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Page mới dựng theo workflow vận hành: lane context bên trái, capture/preview ở giữa, submit/result bên phải. Ở PR này chỉ mount skeleton + scoped store, chưa nối preview và submit thật.
            </p>
          </div>

          <div className="grid min-w-[240px] gap-3 sm:grid-cols-3 lg:w-[420px] lg:grid-cols-1 xl:w-[480px] xl:grid-cols-3">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">
                <Workflow className="h-3.5 w-3.5" />
                Scoped flow
              </div>
              <p className="text-sm font-medium">Provider chỉ cấp store instance, panel subscribe selector hẹp.</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">
                <ScanSearch className="h-3.5 w-3.5" />
                Capture first
              </div>
              <p className="text-sm font-medium">Capture placeholder có local preview để QA flow trước khi nối ALPR.</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">
                <LayoutPanelTop className="h-3.5 w-3.5" />
                Result slot
              </div>
              <p className="text-sm font-medium">Đã chừa panel phải cho decision/session/event của PR-10.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(290px,0.95fr)_minmax(420px,1.35fr)_minmax(320px,0.95fr)]">
        <LaneContextPanel onReloadTopology={() => void loadSiteTopology(siteCode)} />
        <CapturePreviewPanel />
        <SubmitResultPanel />
      </div>

      <div className="rounded-3xl border border-border/80 bg-card/90 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Manual QA focus cho PR-08</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Route <span className="font-mono-data">/run-lane</span> bây giờ không còn render thẳng <span className="font-mono-data">GatePage</span>. Đó là điểm quan trọng nhất để cắt monolith và chuẩn bị cho preview concurrency ở PR-09.
        </p>
      </div>
    </div>
  )
}

export function RunLanePage() {
  return (
    <RunLaneStoreProvider>
      <RunLaneScreen />
    </RunLaneStoreProvider>
  )
}
