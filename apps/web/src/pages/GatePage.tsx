import { Link, Navigate } from 'react-router-dom'
import { ArrowRightLeft, ArchiveX, Camera } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function GatePage() {
  const { t } = useTranslation()

  if (typeof window !== 'undefined' && window.location.pathname === '/gate') {
    return <Navigate to="/run-lane" replace />
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t('gatePage.badges.legacy')}</Badge>
            <Badge variant="outline">{t('gatePage.badges.deprecated')}</Badge>
          </div>
          <CardTitle>{t('gatePage.title')}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('gatePage.description')}</p>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/run-lane">
                <ArrowRightLeft className="h-4 w-4" />
                {t('gatePage.links.runLane')}
              </Link>
            </Button>

            <Button asChild variant="outline">
              <Link to="/capture-debug">
                <Camera className="h-4 w-4" />
                {t('gatePage.links.captureDebug')}
              </Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <ArchiveX className="h-4 w-4 text-amber-500" />
              <span className="font-medium">{t('gatePage.cleanup.title')}</span>
            </div>
            {t('gatePage.cleanup.description')}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
