import { ArrowRightLeft, ExternalLink, Image as ImageIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTimeValue, formatNumberValue } from '@/i18n/format'
import type { CaptureReadRes } from '@/lib/contracts/mobile'

export function MobileCaptureReceiptCard({ value }: { value: CaptureReadRes }) {
  const { t } = useTranslation()
  const dash = t('common.dash')

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <CardTitle>{t('mobileCaptureReceipt.title')}</CardTitle>
        <CardDescription>{t('mobileCaptureReceipt.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{value.deviceCode}</Badge>
          <Badge variant="outline">{value.laneCode}</Badge>
          <Badge variant={value.direction === 'ENTRY' ? 'entry' : 'exit'}>{t(`direction.${value.direction}`)}</Badge>
          <Badge variant="secondary">{value.sessionStatus}</Badge>
          {value.changed ? <Badge variant="outline">{t('mobileCaptureReceipt.changed')}</Badge> : <Badge variant="muted">{t('mobileCaptureReceipt.idempotent')}</Badge>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{t('mobileCaptureReceipt.session')}</p>
            <p className="mt-2 font-mono-data text-sm text-foreground">{value.sessionId || dash}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('mobileCaptureReceipt.readEvent', { value: String(value.readEventId || dash) })}</p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{t('mobileCaptureReceipt.plate')}</p>
            <p className="mt-2 text-sm font-medium text-foreground">{value.plateDisplay || value.plateCompact || value.plateRaw || dash}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('mobileCaptureReceipt.confidenceOccurred', {
                confidence: formatNumberValue(value.ocrConfidence, { maximumFractionDigits: 2 }, dash),
                occurred: formatDateTimeValue(value.occurredAt, { timeStyle: 'short', dateStyle: 'short' }, dash),
              })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {value.imageUrl ? (
            <Button type="button" variant="outline" size="sm" onClick={() => window.open(value.imageUrl || '', '_blank', 'noopener,noreferrer')}>
              <ImageIcon className="h-4 w-4" />
              {t('mobileCaptureReceipt.openEvidence')}
            </Button>
          ) : null}
          {value.sessionId ? (
            <Button type="button" variant="outline" size="sm" onClick={() => window.open(`/session-history?sessionId=${encodeURIComponent(value.sessionId)}`, '_blank', 'noopener,noreferrer')}>
              <ArrowRightLeft className="h-4 w-4" />
              {t('mobileCaptureReceipt.openSessionHistory')}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => window.open('/run-lane', '_blank', 'noopener,noreferrer')}>
            <ExternalLink className="h-4 w-4" />
            {t('mobileCaptureReceipt.openRunLane')}
          </Button>
        </div>

        {value.imageUrl ? <img src={value.imageUrl} alt={t('mobileCaptureReceipt.evidenceAlt')} className="max-h-80 w-full rounded-2xl border border-border object-contain" width={1280} height={720} /> : null}
      </CardContent>
    </Card>
  )
}
