import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightLeft, Camera, ClipboardList, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ops/console'
import { Card, CardContent } from '@/components/ui/card'
import { PreviewDebugPanel } from '@/features/capture-debug/components/PreviewDebugPanel'
import { CaptureFeedTable } from '@/features/capture-debug/components/CaptureFeedTable'
import type { GateEventStreamItem } from '@/lib/contracts/mobile'

export function CaptureDebugPage() {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<GateEventStreamItem | null>(null)

  const summary = useMemo(() => {
    if (!selected) return null
    return [
      [t('captureDebugPage.summary.siteCode'), selected.siteCode || '—'],
      [t('captureDebugPage.summary.laneCode'), selected.laneCode || '—'],
      [t('captureDebugPage.summary.deviceCode'), selected.deviceCode || '—'],
      [t('captureDebugPage.summary.eventId'), selected.eventId],
      [t('captureDebugPage.summary.outboxId'), selected.outboxId],
      [t('captureDebugPage.summary.direction'), selected.direction || '—'],
      [t('captureDebugPage.summary.plate'), selected.plateDisplay || selected.plateCompact || selected.licensePlateRaw || '—'],
      [
        t('captureDebugPage.summary.reviewRequired'),
        selected.reviewRequired ? t('captureDebugPage.summary.yes') : t('captureDebugPage.summary.no'),
      ],
    ] as Array<[string, string | number | null | undefined]>
  }, [selected, t])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('captureDebugPage.eyebrow')}
        title={t('captureDebugPage.title')}
        description={t('captureDebugPage.description')}
        badges={[
          { label: t('captureDebugPage.badges.capture'), variant: 'secondary' },
          { label: t('captureDebugPage.badges.debugOnly'), variant: 'outline' },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/mobile-camera-pair">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <Smartphone className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{t('captureDebugPage.links.mobilePair.title')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('captureDebugPage.links.mobilePair.description')}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/mobile-capture">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <Camera className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{t('captureDebugPage.links.mobileCapture.title')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('captureDebugPage.links.mobileCapture.description')}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/run-lane">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <ArrowRightLeft className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{t('captureDebugPage.links.runLane.title')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('captureDebugPage.links.runLane.description')}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <PreviewDebugPanel />

        <div className="space-y-5">
          <CaptureFeedTable selectedEventId={selected?.eventId || ''} onSelect={setSelected} />

          <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">{t('captureDebugPage.summary.title')}</p>
            </div>

            {!summary ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
                {t('captureDebugPage.summary.empty')}
              </div>
            ) : (
              <div className="space-y-2 rounded-2xl border border-border/80 bg-background/40 p-4">
                {summary.map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-b-0">
                    <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                    <p className="max-w-[68%] break-all text-right text-sm text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/95 p-4 text-sm text-muted-foreground">
            {t('captureDebugPage.footnote')}
          </div>
        </div>
      </div>
    </div>
  )
}
