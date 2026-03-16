import { Link } from 'react-router-dom'
import { Activity, ArrowRightLeft, ClipboardCheck, History, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/ops/console'
import { Card, CardContent } from '@/components/ui/card'
import { LaneMonitorPanel } from '@/features/lane-monitor/LaneMonitorPanel'

export function LaneMonitorPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Lane Monitor"
        description="Live lane health, barrier status, and latest session state. This is a read-only monitoring screen, not an action screen. màn hình triage, không phải nơi thao tác quyết định."
        badges={[
          { label: 'lane realtime', variant: 'secondary' },
          { label: 'SSE', variant: 'outline' },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/run-lane">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <ArrowRightLeft className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Run Lane</p>
                <p className="mt-1 text-sm text-muted-foreground">Switch to the operations screen when a lane needs a decision.ường hợp cần xử lý.</p>
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
                <p className="mt-1 text-sm text-muted-foreground">Go to the queue when a lane is waiting for manual confirmation.</p>
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
                <p className="mt-1 text-sm text-muted-foreground">View the timeline and evidence when tracing a recent session.ết hơn.</p>
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
                <p className="text-sm font-medium">Reading priority</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Check aggregate health first, then review latest session state and barrier status to determine action.nh lane cần xử lý ngay.
              </p>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Screen role</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Lane Monitor is for observation and fault isolation. Decision actions should be taken in Run Lane or Review Queue.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
