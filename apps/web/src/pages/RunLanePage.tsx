import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRightLeft, ScanSearch, Workflow } from 'lucide-react'
import { PageHeader } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CapturePreviewPanel } from '@/features/run-lane/components/CapturePreviewPanel'
import { LaneContextPanel } from '@/features/run-lane/components/LaneContextPanel'
import { SubmitResultPanel } from '@/features/run-lane/components/SubmitResultPanel'
import {
  selectRunLaneGateCode,
  selectRunLaneLaneCode,
  selectRunLaneSiteCode,
  selectRunLaneTopology,
} from '@/features/run-lane/store/runLaneSelectors'
import { RunLaneStoreProvider, useRunLaneActions, useRunLaneStore } from '@/features/run-lane/store/runLaneStoreContext'
import { getDevices } from '@/lib/api/devices'
import { getGates, getLanes, getSites } from '@/lib/api/topology'
import { buildSearchParams, readTrimmedSearchParam, syncSearchParams } from '@/lib/router/url-state'

function parseRunLaneSearchParams(searchParams: URLSearchParams) {
  return {
    siteCode: readTrimmedSearchParam(searchParams, 'siteCode'),
    gateCode: readTrimmedSearchParam(searchParams, 'gateCode'),
    laneCode: readTrimmedSearchParam(searchParams, 'laneCode'),
  }
}

function RunLaneScreen() {
  const [searchParams, setSearchParams] = useSearchParams()
  const routeState = useMemo(() => parseRunLaneSearchParams(searchParams), [searchParams])
  const actions = useRunLaneActions()
  const topology = useRunLaneStore(selectRunLaneTopology)
  const siteCode = useRunLaneStore(selectRunLaneSiteCode)
  const gateCode = useRunLaneStore(selectRunLaneGateCode)
  const laneCode = useRunLaneStore(selectRunLaneLaneCode)
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

    void bootstrapSites()

    return () => {
      active = false
    }
  }, [actions])

  useEffect(() => {
    if (routeState.siteCode && routeState.siteCode !== siteCode && topology.sites.every((site) => site.siteCode !== siteCode)) {
      actions.setSiteCode(routeState.siteCode)
      return
    }
    if (!siteCode && routeState.siteCode) {
      actions.setSiteCode(routeState.siteCode)
    }
  }, [actions, routeState.siteCode, siteCode, topology.sites])

  useEffect(() => {
    if (!siteCode) return
    void loadSiteTopology(siteCode)
  }, [siteCode, loadSiteTopology])

  useEffect(() => {
    if (!routeState.gateCode) return
    if (topology.gates.some((gate) => gate.gateCode === routeState.gateCode) && gateCode !== routeState.gateCode) {
      actions.setGateCode(routeState.gateCode)
    }
  }, [actions, gateCode, routeState.gateCode, topology.gates])

  useEffect(() => {
    if (!routeState.laneCode) return
    if (topology.lanes.some((lane) => lane.laneCode === routeState.laneCode) && laneCode !== routeState.laneCode) {
      actions.setLaneCode(routeState.laneCode)
    }
  }, [actions, laneCode, routeState.laneCode, topology.lanes])

  useEffect(() => {
    const next = buildSearchParams({ siteCode, gateCode, laneCode })
    syncSearchParams(searchParams, next, setSearchParams)
  }, [siteCode, gateCode, laneCode, searchParams, setSearchParams])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Run Lane"
        description="Single-lane operations screen. Context is synced to the URL for deep-link handoff.L để refresh route sâu, bookmark workspace và handoff ca trực mà không mất context."
        badges={[
          { label: 'workflow', variant: 'secondary' },
          { label: '3-column', variant: 'outline' },
          { label: siteCode ? `${siteCode}${laneCode ? `/${laneCode}` : ''}` : 'context —', variant: 'muted' },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 bg-card/95">
          <CardContent className="flex items-start gap-3 pt-5">
            <Workflow className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Lane context</p>
              <p className="mt-1 text-sm text-muted-foreground">Lock in site, gate, lane, and topology before submitting data for processing.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardContent className="flex items-start gap-3 pt-5">
            <ScanSearch className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Capture preview</p>
              <p className="mt-1 text-sm text-muted-foreground">View local image, backend preview, and plate override in one panel.ide in one panel.ate override trong cùng một nhịp thao tác.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardContent className="flex items-start gap-3 pt-5">
            <ArrowRightLeft className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Submit result</p>
              <p className="mt-1 text-sm text-muted-foreground">See session, decision, and next action immediately after submitting.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(290px,0.95fr)_minmax(420px,1.35fr)_minmax(320px,0.95fr)]">
        <LaneContextPanel onReloadTopology={() => void loadSiteTopology(siteCode)} />
        <CapturePreviewPanel />
        <SubmitResultPanel />
      </div>

      <div className="rounded-3xl border border-border/80 bg-card/90 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">operator flow</Badge>
          <p className="text-sm font-medium">Use Run Lane to process a vehicle from start to finish on a single screen.</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Use Review Queue for cases awaiting confirmation. Use Session History to look up completed sessions. cứu và truy vết sau xử lý.
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
