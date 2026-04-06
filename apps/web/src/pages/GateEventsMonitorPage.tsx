import { Link } from 'react-router-dom'
import { Camera, Smartphone, SplitSquareVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function GateEventsMonitorPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t('gateEventsPage.badges.legacy')}</Badge>
            <Badge variant="outline">{t('gateEventsPage.badges.deprecated')}</Badge>
            <Badge variant="outline">{t('gateEventsPage.badges.splitComplete')}</Badge>
          </div>
          <CardTitle>{t('gateEventsPage.title')}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('gateEventsPage.description')}</p>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/capture-debug">
                <Camera className="h-4 w-4" />
                {t('gateEventsPage.links.captureDebug')}
              </Link>
            </Button>

            <Button asChild variant="outline">
              <Link to="/mobile-camera-pair">
                <Smartphone className="h-4 w-4" />
                {t('gateEventsPage.links.mobilePair')}
              </Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <SplitSquareVertical className="h-4 w-4 text-primary" />
              <span className="font-medium">{t('gateEventsPage.whySplit.title')}</span>
            </div>
            {t('gateEventsPage.whySplit.description')}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
