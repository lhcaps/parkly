import {
  Activity,
  ArrowRightLeft,
  Camera,
  ClipboardCheck,
  Cpu,
  RadioTower,
  RefreshCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConnectionBadge, PageHeader, SurfaceState } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/features/overview/components/KpiCard'
import { QuickActionsCard, type QuickActionItem } from '@/features/overview/components/QuickActionsCard'
import { useOverviewData } from '@/features/overview/hooks/useOverviewData'
import type { SessionSummary } from '@/lib/contracts/sessions'

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    to: '/run-lane',
    label: 'Run Lane',
    helper: 'Xử lý lượt xe đang tới lane.',
    badge: 'Lane',
    icon: ArrowRightLeft,
  },
  {
    to: '/review-queue',
    label: 'Review Queue',
    helper: 'Giải quyết các ca cần xác nhận thủ công.',
    badge: 'Review',
    icon: ClipboardCheck,
  },
  {
    to: '/lane-monitor',
    label: 'Lane Monitor',
    helper: 'Theo dõi lane, barrier và cảnh báo realtime.',
    badge: 'Live',
    icon: Activity,
  },
  {
    to: '/device-health',
    label: 'Device Health',
    helper: 'Kiểm tra heartbeat và suy giảm thiết bị.',
    badge: 'Health',
    icon: Cpu,
  },
  {
    to: '/sync-outbox',
    label: 'Sync Outbox',
    helper: 'Theo dõi backlog đồng bộ và retry.',
    badge: 'Queue',
    icon: RadioTower,
  },
  {
    to: '/capture-debug',
    label: 'Capture Debug',
    helper: 'Xem feed capture và kết quả ALPR.',
    badge: 'Capture',
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
          <p className="font-mono-data text-sm font-semibold">{session.sessionId || '—'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {session.siteCode || '—'} / {session.gateCode || '—'} / {session.laneCode || '—'} · {session.direction}
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
      <PageHeader
        title="Overview"
        description="Điểm vào điều phối ca trực. Trang này gom chỉ số chính, đường dẫn thao tác nhanh và các lát cắt cần ưu tiên xử lý."
        badges={[
          { label: 'Operations', variant: 'secondary' },
          { label: siteCode ? `Site ${siteCode}` : 'All sites', variant: 'outline' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ConnectionBadge connected={deviceHealthState.connected} label="Device stream" />
            <Button variant="outline" size="sm" onClick={() => void refreshAll()}>
              <RefreshCcw className="h-4 w-4" />
              Làm mới
            </Button>
          </div>
        }
      />

      {refreshedAt ? <p className="text-xs text-muted-foreground">Cập nhật {new Date(refreshedAt).toLocaleString('vi-VN')}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          title="7-day entry"
          value={reports.loading ? '...' : String(reports.data?.entry ?? 0)}
          helper={reports.error ? reports.error : 'Lượt vào trong 7 ngày gần nhất.'}
          icon={ArrowRightLeft}
          tone="success"
        />
        <KpiCard
          title="7-day exit"
          value={reports.loading ? '...' : String(reports.data?.exit ?? 0)}
          helper={reports.error ? 'Không đọc được số liệu thoát xe.' : 'Lượt ra trong 7 ngày gần nhất.'}
          icon={ArrowRightLeft}
          tone="default"
        />
        <KpiCard
          title="7-day throughput"
          value={reports.loading ? '...' : String(reports.data?.total ?? 0)}
          helper="Tổng lưu lượng để nhìn nhanh mức vận hành."
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
          title="open review"
          value={queueSummary.loading ? '...' : String(queueSummary.data.length)}
          helper={queueSummary.error ? queueSummary.error : 'Review đang mở trong lát cắt hiện tại.'}
          icon={ClipboardCheck}
          tone={queueSummary.data.length > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          title="failed outbox"
          value={outboxSummary.loading ? '...' : String(outboxFailedCount)}
          helper={outboxSummary.error ? outboxSummary.error : 'Row lỗi trong lát cắt outbox hiện tại.'}
          icon={RadioTower}
          tone={outboxFailedCount > 0 ? 'danger' : 'default'}
        />
      </div>

      <QuickActionsCard
        actions={QUICK_ACTIONS}
        title="Đi nhanh tới màn hình làm việc"
        description="Mở đúng màn hình theo việc cần xử lý, không phải đi qua nhiều route trung gian."
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
          <CardHeader>
            <CardTitle>Recent sessions</CardTitle>
            <CardDescription>Các phiên mới nhất để nhìn nhanh lane nào đang chờ quyết định hoặc có vấn đề.</CardDescription>
          </CardHeader>

          <CardContent>
            {recentSessions.loading ? (
              <SurfaceState tone="loading" title="Đang tải session" description="Hệ thống đang nạp lát cắt session gần đây." className="min-h-[220px]" />
            ) : recentSessions.error ? (
              <SurfaceState tone="error" title="Không tải được session" description={recentSessions.error} className="min-h-[220px]" />
            ) : recentSessions.data.length === 0 ? (
              <SurfaceState title="Chưa có session" description="Không có session nào trong lát cắt overview hiện tại." className="min-h-[220px]" />
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
            <CardTitle>Device alerts</CardTitle>
            <CardDescription>Cảnh báo thiết bị theo snapshot realtime, giữ riêng khỏi các khối còn lại để lỗi cục bộ không kéo sập trang.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Total devices</p>
                <p className="mt-2 text-2xl font-semibold">{deviceAlertSummary.total}</p>
              </div>
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Attention</p>
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
              <SurfaceState tone="error" title="Stream thiết bị gặp lỗi" description={deviceHealthState.error} className="min-h-[120px]" />
            ) : (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                {deviceHealthState.connected
                  ? 'Thiết bị đang đẩy snapshot realtime. Ưu tiên kiểm tra OFFLINE trước, sau đó tới DEGRADED.'
                  : 'Chưa kết nối được stream thiết bị. Có thể xem lane monitor hoặc capture debug để đối chiếu thêm.'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
          <CardHeader>
            <CardTitle>Queue focus</CardTitle>
            <CardDescription>Hai lát cắt cần ưu tiên nếu đang xử lý sự cố vận hành hoặc đồng bộ.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Review queue</p>
                  <p className="mt-1 text-sm text-muted-foreground">Các ca đang chờ xác nhận thủ công.</p>
                </div>
                <Badge variant={queueSummary.data.length > 0 ? 'amber' : 'secondary'}>{queueSummary.data.length}</Badge>
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Outbox failed</p>
                  <p className="mt-1 text-sm text-muted-foreground">Bản ghi đồng bộ lỗi hoặc timeout.</p>
                </div>
                <Badge variant={outboxFailedCount > 0 ? 'destructive' : 'secondary'}>{outboxFailedCount}</Badge>
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/40 p-4 text-sm text-muted-foreground">
              Queue review và outbox nên được xem song song khi lane có sự cố nhưng backend vẫn nhận sự kiện.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
