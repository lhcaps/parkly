import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRightLeft,
  Camera,
  ClipboardCheck,
  Cpu,
  Loader2,
  RadioTower,
  RefreshCcw,
  ShieldAlert,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { KpiCard } from '@/features/overview/components/KpiCard'
import { QuickActionsCard, type QuickActionItem } from '@/features/overview/components/QuickActionsCard'
import { useOverviewData } from '@/features/overview/hooks/useOverviewData'
import type { SessionSummary } from '@/lib/contracts/sessions'

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    to: '/run-lane',
    label: 'Run Lane',
    helper: 'Đi thẳng vào workflow xử lý lượt xe hiện tại.',
    badge: 'entry',
    icon: ArrowRightLeft,
  },
  {
    to: '/review-queue',
    label: 'Review Queue',
    helper: 'Xử lý các case ambiguous và manual review.',
    badge: 'review',
    icon: ClipboardCheck,
  },
  {
    to: '/lane-monitor',
    label: 'Lane Monitor',
    helper: 'Theo dõi lane aggregate health và barrier lifecycle.',
    badge: 'SSE',
    icon: Activity,
  },
  {
    to: '/device-health',
    label: 'Device Health',
    helper: 'Kiểm tra heartbeat và thiết bị đang degraded/offline.',
    badge: 'health',
    icon: Cpu,
  },
  {
    to: '/sync-outbox',
    label: 'Sync Outbox',
    helper: 'Theo dõi backlog đồng bộ và retry queue.',
    badge: 'queue',
    icon: RadioTower,
  },
  {
    to: '/capture-debug',
    label: 'Capture Debug',
    helper: 'Debug capture feed, upload và ALPR ingestion.',
    badge: 'debug',
    icon: Camera,
  },
]

function sessionVariant(status: string | null | undefined) {
  if (!status) return 'outline' as const
  if (status === 'APPROVED' || status === 'PASSED') return 'entry' as const
  if (status === 'WAITING_DECISION' || status === 'WAITING_PAYMENT') return 'amber' as const
  if (status === 'DENIED' || status === 'ERROR' || status === 'CANCELLED' || status === 'TIMEOUT') return 'destructive' as const
  return 'secondary' as const
}

function SessionRow({ session }: { session: SessionSummary }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono-data text-sm font-semibold">session={session.sessionId}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {session.siteCode} / {session.gateCode} / {session.laneCode} · {session.direction}
          </p>
        </div>
        <Badge variant={sessionVariant(session.status)}>{session.status}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono-data text-muted-foreground">
        <Badge variant="outline">reads={session.readCount}</Badge>
        <Badge variant="outline">decisions={session.decisionCount}</Badge>
        <Badge variant="outline">plate={session.plateCompact || '—'}</Badge>
      </div>
    </div>
  )
}

export function OverviewPage() {
  const {
    siteCode,
    reports,
    recentSessions,
    queueSummary,
    outboxSummary,
    deviceAlertSummary,
    deviceHealthState,
    outboxFailedCount,
    refreshedAt,
    refreshAll,
  } = useOverviewData()

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">operations-first</Badge>
              <Badge variant="outline">overview hub</Badge>
              <Badge variant="outline">partial-failure safe</Badge>
              {siteCode ? <Badge variant="muted">site={siteCode}</Badge> : null}
            </div>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Overview bây giờ là bảng điều hướng công việc</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Trang này không còn là chỗ nhét vài panel ngẫu nhiên. Nó chốt KPI, quick actions, recent sessions, queue summary và device alerts để operator quyết định bước tiếp theo ngay.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={deviceHealthState.connected ? 'entry' : 'outline'}
              className="px-3 py-1.5"
            >
              {deviceHealthState.connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              device SSE {deviceHealthState.connected ? 'connected' : 'disconnected'}
            </Badge>

            <Button variant="outline" size="sm" onClick={() => void refreshAll()}>
              <RefreshCcw className="h-4 w-4" />
              Refresh overview
            </Button>
          </div>
        </div>

        {refreshedAt ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Refreshed {new Date(refreshedAt).toLocaleString('vi-VN')}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          title="7-day entry"
          value={reports.loading ? '...' : String(reports.data?.entry ?? 0)}
          helper={reports.error ? reports.error : 'Tổng lượt entry trong 7 ngày gần nhất.'}
          icon={ArrowRightLeft}
          tone="success"
        />
        <KpiCard
          title="7-day exit"
          value={reports.loading ? '...' : String(reports.data?.exit ?? 0)}
          helper={reports.error ? 'Reports summary đang lỗi riêng.' : 'Tổng lượt exit trong 7 ngày gần nhất.'}
          icon={ArrowRightLeft}
          tone="default"
        />
        <KpiCard
          title="7-day throughput"
          value={reports.loading ? '...' : String(reports.data?.total ?? 0)}
          helper="KPI tổng lưu lượng để nhìn nhanh mức vận hành."
          icon={Activity}
          tone="default"
        />
        <KpiCard
          title="device alerts"
          value={String(deviceAlertSummary.attention)}
          helper={deviceHealthState.error || `${deviceAlertSummary.offline} offline · ${deviceAlertSummary.degraded} degraded`}
          icon={Cpu}
          tone={deviceAlertSummary.attention > 0 ? 'danger' : 'success'}
        />
        <KpiCard
          title="open review slice"
          value={queueSummary.loading ? '...' : String(queueSummary.data.length)}
          helper={queueSummary.error ? queueSummary.error : 'Số case review mở vừa được nạp ở overview.'}
          icon={ClipboardCheck}
          tone={queueSummary.data.length > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          title="failed outbox slice"
          value={outboxSummary.loading ? '...' : String(outboxFailedCount)}
          helper={outboxSummary.error ? outboxSummary.error : 'Số row lỗi trong lát cắt outbox hiện tại.'}
          icon={RadioTower}
          tone={outboxFailedCount > 0 ? 'danger' : 'default'}
        />
      </div>

      <QuickActionsCard actions={QUICK_ACTIONS} />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
            <CardDescription>
              Session gần đây để operator nhìn nhanh lane nào đang chờ quyết định hoặc có lỗi.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {recentSessions.loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải recent sessions...
              </div>
            ) : recentSessions.error ? (
              <div className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
                {recentSessions.error}
              </div>
            ) : recentSessions.data.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 p-6 text-sm text-muted-foreground">
                Chưa có session nào trong lát cắt overview.
              </div>
            ) : (
              <ScrollArea className="h-[340px]">
                <div className="space-y-3 pr-3">
                  {recentSessions.data.map((session) => (
                    <SessionRow key={String(session.sessionId)} session={session} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
          <CardHeader>
            <CardTitle>Device Alerts</CardTitle>
            <CardDescription>
              Overview chỉ lấy một SSE nhẹ cho device health, không mount toàn bộ monitoring panels.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Total devices</p>
                <p className="mt-2 text-2xl font-semibold">{deviceAlertSummary.total}</p>
              </div>
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Attention needed</p>
                <p className="mt-2 text-2xl font-semibold">{deviceAlertSummary.attention}</p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Offline</p>
                <p className="mt-2 text-2xl font-semibold">{deviceAlertSummary.offline}</p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Degraded</p>
                <p className="mt-2 text-2xl font-semibold">{deviceAlertSummary.degraded}</p>
              </div>
            </div>

            {deviceHealthState.error ? (
              <div className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
                {deviceHealthState.error}
              </div>
            ) : (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                {deviceHealthState.connected ? 'Device SSE đang connected.' : 'Device SSE đang disconnected nhưng Overview vẫn load được các khối khác.'}
              </div>
            )}

            <Button asChild variant="outline" className="w-full justify-start">
              <Link to="/device-health">Mở Device Health</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
          <CardHeader>
            <CardTitle>Queue Summary</CardTitle>
            <CardDescription>
              Review queue và outbox summary đứng cạnh nhau để operator quyết định nên xử lý hàng đợi nào trước.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Review queue</p>
              </div>
              {queueSummary.loading ? (
                <p className="mt-2 text-sm text-muted-foreground">Đang tải review queue...</p>
              ) : queueSummary.error ? (
                <p className="mt-2 text-sm text-destructive">{queueSummary.error}</p>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-semibold">{queueSummary.data.length}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Case OPEN trong lát cắt overview.</p>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <div className="flex items-center gap-2">
                <RadioTower className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Outbox summary</p>
              </div>
              {outboxSummary.loading ? (
                <p className="mt-2 text-sm text-muted-foreground">Đang tải outbox summary...</p>
              ) : outboxSummary.error ? (
                <p className="mt-2 text-sm text-destructive">{outboxSummary.error}</p>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-semibold">{outboxFailedCount}</p>
                  <p className="mt-1 text-sm text-muted-foreground">FAILED / TIMEOUT / NACKED trong lát cắt hiện tại.</p>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 text-foreground">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span className="font-medium">Error isolation</span>
              </div>
              Nếu review queue hoặc outbox lỗi riêng, các khối khác của overview vẫn render bình thường.
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild variant="outline" className="justify-start">
                <Link to="/review-queue">Mở Review Queue</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to="/sync-outbox">Mở Sync Outbox</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
