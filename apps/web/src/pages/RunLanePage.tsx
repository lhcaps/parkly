import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Wifi, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CapturePreviewPanel } from '@/features/run-lane/components/CapturePreviewPanel'
import { LaneContextPanel } from '@/features/run-lane/components/LaneContextPanel'
import { LiveLaneStateCard } from '@/features/run-lane/components/LiveLaneStateCard'
import { SubmitResultPanel } from '@/features/run-lane/components/SubmitResultPanel'
import {
  selectRunLaneCanSubmit,
  selectRunLaneLaneCode,
  selectRunLaneSiteCode,
} from '@/features/run-lane/store/runLaneSelectors'
import { RunLaneStoreProvider, useRunLaneActions, useRunLaneStore } from '@/features/run-lane/store/runLaneStoreContext'
import { useRunLaneLiveState } from '@/features/run-lane/hooks/useRunLaneLiveState'
import { useRunLaneSubmit } from '@/features/run-lane/hooks/useRunLaneSubmit'
import { getDevices } from '@/lib/api/devices'
import { getGates, getLanes, getSites } from '@/lib/api/topology'
import { invalidateCachedRead } from '@/lib/query/policies'
import { buildSearchParams, readTrimmedSearchParam, syncSearchParams } from '@/lib/router/url-state'

function parseRunLaneSearchParams(searchParams: URLSearchParams) {
  return {
    siteCode: readTrimmedSearchParam(searchParams, 'siteCode'),
    gateCode: readTrimmedSearchParam(searchParams, 'gateCode'),
    laneCode: readTrimmedSearchParam(searchParams, 'laneCode'),
  }
}

const StatusPill = memo(function StatusPill({ connected }: { connected: boolean }) {
  const { t } = useTranslation()

  return connected ? (
    <Badge variant="entry" className="gap-1">
      <Wifi className="h-3 w-3" />
      {t('runLanePage.live')}
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1">
      <WifiOff className="h-3 w-3" />
      {t('runLanePage.offline')}
    </Badge>
  )
})

function RunLaneScreen() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const routeState = useMemo(() => parseRunLaneSearchParams(searchParams), [searchParams])
  const actions = useRunLaneActions()
  const topology = useRunLaneStore((s) => s.topology)
  const siteCode = useRunLaneStore(selectRunLaneSiteCode)
  const gateCode = useRunLaneStore((s) => s.topology.gateCode)
  const laneCode = useRunLaneStore(selectRunLaneLaneCode)
  const topologyRequestIdRef = useRef(0)
  const [showLivePanel, setShowLivePanel] = useState(false)

  const { submitCurrentLaneFlow } = useRunLaneSubmit()
  const submit = useRunLaneStore((s) => s.submit)
  const canSubmit = useRunLaneStore(selectRunLaneCanSubmit)
  const liveState = useRunLaneLiveState()
  const streamConnected = liveState.streamConnected

  const busy = submit.stage === 'submitting'

  const loadSiteTopology = useCallback(
    async (nextSiteCode: string, preserve?: { gateCode?: string; laneCode?: string }) => {
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

        actions.hydrateSiteTopology(
          {
            siteCode: nextSiteCode,
            gates: gateRes.rows,
            lanes: laneRes.rows,
            devices: deviceRes.rows,
          },
          preserve,
        )
      } catch (error) {
        if (topologyRequestIdRef.current !== requestId) return
        actions.setTopologyError(error instanceof Error ? error.message : String(error))
      }
    },
    [actions],
  )

  useEffect(() => {
    let active = true

    async function bootstrapSites() {
      try {
        actions.setTopologyLoading()
        const response = await getSites()
        if (!active) return
        actions.hydrateSites(response.rows, routeState.siteCode || undefined)
      } catch (error) {
        if (!active) return
        actions.setTopologyError(error instanceof Error ? error.message : String(error))
      }
    }

    void bootstrapSites()

    return () => {
      active = false
    }
  }, [actions, routeState.siteCode])

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
    const preserve =
      routeState.siteCode === siteCode && (routeState.gateCode || routeState.laneCode)
        ? { gateCode: routeState.gateCode || undefined, laneCode: routeState.laneCode || undefined }
        : undefined
    void loadSiteTopology(siteCode, preserve)
  }, [siteCode, routeState.gateCode, routeState.laneCode, routeState.siteCode, loadSiteTopology])

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

  const handleReloadTopology = useCallback(() => {
    if (!siteCode) return
    invalidateCachedRead('topology:')
    void loadSiteTopology(siteCode, {
      gateCode: gateCode || undefined,
      laneCode: laneCode || undefined,
    })
  }, [gateCode, laneCode, loadSiteTopology, siteCode])

  const handleSubmit = useCallback(() => {
    void submitCurrentLaneFlow()
  }, [submitCurrentLaneFlow])

  return (
    <div className="space-y-3 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/65 bg-card/96 px-4 py-4 shadow-[0_14px_40px_rgba(35,94,138,0.09)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={siteCode ? 'secondary' : 'outline'} className="font-mono-data text-xs">
              {siteCode || t('common.dash')}
            </Badge>
            {siteCode ? (
              <>
                <span className="text-muted-foreground/60">/</span>
                <Badge variant="secondary" className="font-mono-data text-xs">
                  {laneCode || t('common.dash')}
                </Badge>
              </>
            ) : null}
          </div>
          <StatusPill connected={streamConnected} />
        </div>

        <Button
          variant="default"
          size="lg"
          onClick={handleSubmit}
          disabled={busy || !canSubmit}
          className="min-w-[180px] gap-2 shadow-[0_12px_30px_hsl(var(--primary)/0.22)] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 motion-reduce:transform-none"
        >
          {busy ? <span className="animate-spin">⟳</span> : null}
          {busy ? t('runLanePage.submitting') : t('runLanePage.submit')}
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_minmax(0,1.25fr)_minmax(320px,0.9fr)]">
        <div className="lg:col-span-1 xl:col-span-1">
          <LaneContextPanel onReloadTopology={handleReloadTopology} />
        </div>
        <div className="lg:col-span-1 xl:col-span-1">
          <CapturePreviewPanel />
        </div>
        <div className="lg:col-span-2 xl:col-span-1">
          <SubmitResultPanel />
        </div>
      </div>

      <Card className="border-border/60 bg-card/96">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusPill connected={streamConnected} />
              {liveState.stale ? <Badge variant="amber" className="text-[10px]">{t('runLanePage.stale')}</Badge> : null}
              {liveState.reconnectCount > 0 ? (
                <Badge variant="outline" className="text-[10px]">
                  {t('runLanePage.reconnects', { count: liveState.reconnectCount })}
                </Badge>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLivePanel((v) => !v)}
              className="h-7 text-[11px]"
            >
              {showLivePanel ? t('runLanePage.hideDetails') : t('runLanePage.showDetails')}
            </Button>
          </div>

          {showLivePanel ? <LiveLaneStateCard onClose={() => setShowLivePanel(false)} /> : null}
        </CardContent>
      </Card>
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
