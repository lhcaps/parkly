import { Link } from 'react-router-dom'
import { Activity, ArrowRightLeft, ClipboardCheck, History, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ops/console'
import { Card, CardContent } from '@/components/ui/card'
import { LaneMonitorPanel } from '@/features/lane-monitor/LaneMonitorPanel'

export function LaneMonitorPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('laneMonitorPage.title')}
        description={t('laneMonitorPage.description')}
        badges={[
          { label: t('laneMonitorPage.badges.realtime'), variant: 'secondary' },
          { label: 'SSE', variant: 'outline' },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/run-lane">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <ArrowRightLeft className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{t('laneMonitorPage.links.runLane.title')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('laneMonitorPage.links.runLane.description')}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/review-queue">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <ClipboardCheck className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{t('laneMonitorPage.links.reviewQueue.title')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('laneMonitorPage.links.reviewQueue.description')}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/session-history">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <History className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{t('laneMonitorPage.links.sessionHistory.title')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('laneMonitorPage.links.sessionHistory.description')}</p>
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
                <p className="text-sm font-medium">{t('laneMonitorPage.readingPriority.title')}</p>
              </div>
              <p className="text-sm text-muted-foreground">{t('laneMonitorPage.readingPriority.description')}</p>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">{t('laneMonitorPage.screenRole.title')}</p>
              </div>
              <p className="text-sm text-muted-foreground">{t('laneMonitorPage.screenRole.description')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
