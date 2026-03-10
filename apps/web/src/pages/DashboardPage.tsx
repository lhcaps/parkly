import { Activity, ClipboardCheck, Cpu, History, RadioTower } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LaneMonitorPanel } from '@/features/lane-monitor/LaneMonitorPanel'
import { DeviceHealthPanel } from '@/features/device-health/DeviceHealthPanel'
import { OutboxMonitorPanel } from '@/features/outbox-monitor/OutboxMonitorPanel'
import { ReviewQueueSummaryPanel } from '@/features/review-queue/ReviewQueueSummaryPanel'

function MetricCard({ label, helper, icon: Icon }: { label: string; helper: string; icon: typeof Activity }) {
  return (
    <Card className="border-border/80 bg-card/95">
      <CardContent className="flex items-start gap-3 pt-5">
        <Icon className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono-data uppercase tracking-[0.18em] text-muted-foreground">PR-11</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Gate Operations Console</h1>
          <p className="mt-2 max-w-4xl text-sm text-muted-foreground">
            Console vận hành tập trung cho lane monitor, review queue, session history, device health và outbox monitor; toàn bộ panel bám theo API và SSE thật.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">lane cards</Badge>
          <Badge variant="outline">review queue</Badge>
          <Badge variant="outline">timeline</Badge>
          <Badge variant="outline">device health</Badge>
          <Badge variant="outline">outbox</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Lane Monitor" helper="Lane aggregate health, barrier status và session gần nhất." icon={Activity} />
        <MetricCard label="Review Queue" helper="Claim review, manual approve/reject/open barrier với audit." icon={ClipboardCheck} />
        <MetricCard label="Device Health" helper="Heartbeat aging, online/degraded/offline theo thiết bị." icon={Cpu} />
        <MetricCard label="Outbox Monitor" helper="Theo dõi outbox feed và retry thực tế." icon={RadioTower} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <LaneMonitorPanel compact />
        <ReviewQueueSummaryPanel />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <DeviceHealthPanel compact />
        <OutboxMonitorPanel compact />
      </div>

      <Card className="border-border/80 bg-card/95">
        <CardContent className="flex items-start gap-3 pt-5">
          <History className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">Session detail nằm ở Session History</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tại đó operator đọc timeline, decisions, barrier commands, evidence/media, manual actions và chỉ thấy action phù hợp với allowedActions cùng role hiện tại.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
