import { Link } from 'react-router-dom'
import { Activity, ArrowRightLeft, ClipboardCheck, History, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LaneMonitorPanel } from '@/features/lane-monitor/LaneMonitorPanel'

export function LaneMonitorPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">monitoring</Badge>
              <Badge variant="outline">lane status</Badge>
              <Badge variant="outline">SSE dedicated</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Lane Monitor</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Đây là trang chuyên cho lane health, barrier lifecycle và session gần nhất theo lane. Nó không còn đóng vai trò overview tổng hợp; nó là màn hình triage realtime riêng.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/40 p-4 text-sm text-muted-foreground">
            Ưu tiên dùng trang này khi bạn cần xác định lane nào đang unhealthy hoặc lane nào vừa phát sinh trạng thái bất thường.
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/run-lane">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <ArrowRightLeft className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Run Lane</p>
                <p className="mt-1 text-sm text-muted-foreground">Nhảy thẳng vào surface xử lý lượt xe nếu lane vừa cần thao tác.</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/review-queue">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <ClipboardCheck className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Review Queue</p>
                <p className="mt-1 text-sm text-muted-foreground">Đi tiếp sang queue nếu lane đang kẹt vì review/manual decision.</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/session-history">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <History className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Session History</p>
                <p className="mt-1 text-sm text-muted-foreground">Đọc timeline và event nếu cần forensic/debug sâu hơn.</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <LaneMonitorPanel />

        <Card className="border-border/80 bg-card/95">
          <CardContent className="space-y-4 pt-5">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Cách đọc màn hình này</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Nhìn lane aggregate health trước, sau đó nhìn session status gần nhất và barrier status gần nhất. Nếu lane unhealthy, chuyển tiếp đúng route thay vì cố xử lý mọi thứ trong một màn.
              </p>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Vai trò của page</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Lane Monitor là trang quan sát realtime. Run Lane mới là nơi thao tác submit/override. Tách vai trò vậy sẽ đỡ thành một page monolith.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
