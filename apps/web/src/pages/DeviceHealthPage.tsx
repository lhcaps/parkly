import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Camera, Cpu, RadioTower, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/ops/console'
import { Card, CardContent } from '@/components/ui/card'
import { DeviceHealthPanel } from '@/features/device-health/DeviceHealthPanel'

export function DeviceHealthPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('deviceHealthPage.title')}
        description={t('deviceHealthPage.description')}
        badges={[
          { label: t('deviceHealthPage.badges.devices'), variant: 'secondary' },
          { label: t('deviceHealthPage.badges.heartbeat'), variant: 'outline' },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/capture-debug">
          <Card className="h-full border-border/80 bg-card/95 transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-[0_18px_42px_rgba(35,94,138,0.12)] motion-reduce:transform-none">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <Camera className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{t('deviceHealthPage.links.captureDebug.title')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('deviceHealthPage.links.captureDebug.description')}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/lane-monitor">
          <Card className="h-full border-border/80 bg-card/95 transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-[0_18px_42px_rgba(35,94,138,0.12)] motion-reduce:transform-none">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <Cpu className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{t('deviceHealthPage.links.laneMonitor.title')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('deviceHealthPage.links.laneMonitor.description')}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/sync-outbox">
          <Card className="h-full border-border/80 bg-card/95 transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-[0_18px_42px_rgba(35,94,138,0.12)] motion-reduce:transform-none">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <RadioTower className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{t('deviceHealthPage.links.syncOutbox.title')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('deviceHealthPage.links.syncOutbox.description')}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <DeviceHealthPanel />

        <Card className="border-border/80 bg-card/95">
          <CardContent className="space-y-4 pt-5">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">{t('deviceHealthPage.howToRead.title')}</p>
              </div>
              <p className="text-sm text-muted-foreground">{t('deviceHealthPage.howToRead.body')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
