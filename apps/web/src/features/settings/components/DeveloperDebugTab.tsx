import { useTranslation } from 'react-i18next'
import { HardDriveDownload, RefreshCcw, ShieldAlert, Trash2, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { InlineMessage } from '@/components/ops/console'
import type { DefaultContextPrefs } from '@/lib/api'

type DeveloperDebugTabProps = {
  apiBase: string
  tokenPreview: string
  buildInfo: {
    mode: string
    dev: boolean
    prod: boolean
    baseUrl: string
  }
  prefs: DefaultContextPrefs
  cacheKeys: string[]
  message: string
  onClearCache: () => void
  onResetPrefs: () => void
}

export function DeveloperDebugTab({
  apiBase,
  tokenPreview,
  buildInfo,
  prefs,
  cacheKeys,
  message,
  onClearCache,
  onResetPrefs,
}: DeveloperDebugTabProps) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
      {/* Left Column - Environment Info */}
      <Card className="border-border/80 bg-card/95 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-5">
          <CardTitle className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Wrench className="h-5 w-5 text-primary" />
            {t('developer.localEnv')}
          </CardTitle>
        </div>

        <CardContent className="p-6 space-y-5">
          {/* Environment Metrics */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Metric label={t('developer.apiBase')} value={apiBase || t('developer.none')} />
            <Metric label={t('developer.tokenPreview')} value={tokenPreview || t('developer.tokenNone')} />
            <Metric label={t('developer.mode')} value={buildInfo.mode || t('developer.unknown')} />
            <Metric label={t('developer.baseUrl')} value={buildInfo.baseUrl || '/'} />
          </div>

          {/* Info Box */}
          <InlineMessage tone="info">
            <div>
              <p className="font-semibold">{t('developer.surfaceTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {t('developer.surfaceBody')}
              </p>
            </div>
          </InlineMessage>

          <Separator />

          {/* Default Context */}
          <div className="space-y-4">
            <p className="font-semibold text-foreground">{t('developer.defaultContextCurrent')}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label={t('laneContext.site')} value={prefs.siteCode || t('common.dash')} />
              <Metric label={t('laneContext.lane')} value={prefs.laneCode || t('common.dash')} />
              <Metric label={t('laneContext.direction')} value={prefs.direction} />
            </div>
          </div>

          {message ? <InlineMessage tone="warning">{message}</InlineMessage> : null}
        </CardContent>
      </Card>

      {/* Right Column - Cache Management */}
      <Card className="border-border/80 bg-card/95 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-5">
          <CardTitle className="text-lg font-bold tracking-tight">{t('developer.clearLocalTitle')}</CardTitle>
        </div>

        <CardContent className="p-6 space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">{t('developer.clearLocalDesc')}</p>

          {/* Action Buttons - Large */}
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full gap-2 text-base h-12 px-6"
              onClick={onResetPrefs}
            >
              <RefreshCcw className="h-5 w-5" />
              {t('developer.resetContextBtn')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="w-full gap-2 text-base h-12 px-6"
              onClick={onClearCache}
            >
              <Trash2 className="h-5 w-5" />
              {t('developer.clearCache')}
            </Button>
          </div>

          {/* Cache Keys */}
          <div className="rounded-2xl border border-border/70 bg-muted/35 p-5">
            <div className="flex items-center gap-2.5 mb-4 text-sm font-semibold text-foreground">
              <HardDriveDownload className="h-5 w-5 text-primary" />
              {t('developer.localKeys')}
            </div>
            <div className="flex flex-wrap gap-2">
              {cacheKeys.length ? (
                cacheKeys.map((key) => (
                  <Badge key={key} variant="secondary" className="text-xs px-2.5 py-1">
                    {key}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{t('developer.noLocalKeys')}</p>
              )}
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-5">
            <div className="flex items-center gap-2.5 mb-4 text-sm font-semibold text-foreground">
              <ShieldAlert className="h-5 w-5 text-primary" />
              {t('developer.troubleTitle')}
            </div>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1 shrink-0">•</span>
                {t('developer.trouble1')}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1 shrink-0">•</span>
                {t('developer.trouble2')}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1 shrink-0">•</span>
                {t('developer.trouble3')}
              </li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">{t('developer.refreshHint')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-5">
      <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">{label}</p>
      <p className="break-all font-semibold text-base text-foreground leading-snug">{value}</p>
    </div>
  )
}
