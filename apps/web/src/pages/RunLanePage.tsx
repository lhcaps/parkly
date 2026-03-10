import { useCallback, useEffect, useRef } from 'react'
import { ArrowRightLeft, ScanSearch, Workflow } from 'lucide-react'
import { PageHeader } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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

    void bootstrapSites()

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
      <PageHeader
        eyebrow="Operations"
        title="Run Lane"
        description="Màn hình thao tác tập trung cho một lane. Chọn ngữ cảnh ở cột trái, xem preview ở giữa và chốt kết quả ở cột phải."
        badges={[
          { label: 'workflow', variant: 'secondary' },
          { label: '3-column', variant: 'outline' },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 bg-card/95">
          <CardContent className="flex items-start gap-3 pt-5">
            <Workflow className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Lane context</p>
              <p className="mt-1 text-sm text-muted-foreground">Chốt site, gate, lane và topology trước khi gửi dữ liệu xử lý.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardContent className="flex items-start gap-3 pt-5">
            <ScanSearch className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Capture preview</p>
              <p className="mt-1 text-sm text-muted-foreground">Xem ảnh local, preview backend và plate override trong cùng một nhịp thao tác.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardContent className="flex items-start gap-3 pt-5">
            <ArrowRightLeft className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Submit result</p>
              <p className="mt-1 text-sm text-muted-foreground">Nhìn rõ session, decision và action tiếp theo ngay sau khi submit.</p>
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
          <p className="text-sm font-medium">Dùng Run Lane khi cần xử lý một lượt xe từ đầu tới cuối trên cùng một màn hình.</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Review Queue phù hợp cho các ca đang chờ xác nhận thủ công. Session History phù hợp để tra cứu và truy vết sau xử lý.
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
