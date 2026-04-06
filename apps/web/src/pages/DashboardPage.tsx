import { Activity, ClipboardCheck, Cpu, History, RadioTower } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LaneMonitorPanel } from '@/features/lane-monitor/LaneMonitorPanel'
import { DeviceHealthPanel } from '@/features/device-health/DeviceHealthPanel'
import { OutboxMonitorPanel } from '@/features/outbox-monitor/OutboxMonitorPanel'
import { ReviewQueueSummaryPanel } from '@/features/review-queue/ReviewQueueSummaryPanel'

function MetricCard({
  label,
  helper,
  icon: Icon,
}: {
  label: string
  helper: string
  icon: typeof Activity
}) {
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
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{t('dashboardPage.eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('dashboardPage.title')}</h1>
          <p className="mt-2 max-w-4xl text-sm text-muted-foreground">{t('dashboardPage.description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{t('dashboardPage.badges.laneCards')}</Badge>
          <Badge variant="outline">{t('dashboardPage.badges.reviewQueue')}</Badge>
          <Badge variant="outline">{t('dashboardPage.badges.timeline')}</Badge>
          <Badge variant="outline">{t('dashboardPage.badges.deviceHealth')}</Badge>
          <Badge variant="outline">{t('dashboardPage.badges.outbox')}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t('dashboardPage.cards.laneMonitor.title')} helper={t('dashboardPage.cards.laneMonitor.description')} icon={Activity} />
        <MetricCard label={t('dashboardPage.cards.reviewQueue.title')} helper={t('dashboardPage.cards.reviewQueue.description')} icon={ClipboardCheck} />
        <MetricCard label={t('dashboardPage.cards.deviceHealth.title')} helper={t('dashboardPage.cards.deviceHealth.description')} icon={Cpu} />
        <MetricCard label={t('dashboardPage.cards.outbox.title')} helper={t('dashboardPage.cards.outbox.description')} icon={RadioTower} />
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
            <p className="font-medium">{t('dashboardPage.sessionDetail.title')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('dashboardPage.sessionDetail.description')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
