import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Edit3, ShieldAlert, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTimeValue } from '@/i18n/format'
import { maskDeviceSecret, type EffectiveDeviceContext, type MobileCaptureSeedContext } from '@/lib/api/mobile'

export type MobileContextReadiness = 'ready' | 'attention' | 'blocked'

export type MobileContextDiagnostic = {
  tone: MobileContextReadiness
  code: string
  label: string
  detail: string
}

function readinessMeta(value: MobileContextReadiness, t: (key: string) => string) {
  if (value === 'ready') {
    return { label: t('mobileCaptureContext.ready'), icon: CheckCircle2, badge: 'secondary' as const }
  }
  if (value === 'attention') {
    return { label: t('mobileCaptureContext.attention'), icon: AlertTriangle, badge: 'amber' as const }
  }
  return { label: t('mobileCaptureContext.blocked'), icon: ShieldAlert, badge: 'destructive' as const }
}

function toneClass(tone: MobileContextReadiness) {
  if (tone === 'blocked') return 'border-destructive/25 bg-destructive/10'
  if (tone === 'attention') return 'border-primary/20 bg-primary/8'
  return 'border-success/20 bg-success/8'
}

function ContextChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function MobileContextSummaryCard({
  seedCtx,
  effectiveCtx,
  pairToken,
  readiness,
  diagnostics,
  hasManualOverrides,
  lastHeartbeatAt,
  lastHeartbeatRequestId,
  lastCaptureRequestId,
}: {
  seedCtx: MobileCaptureSeedContext
  effectiveCtx: EffectiveDeviceContext
  pairToken: string
  readiness: MobileContextReadiness
  diagnostics: MobileContextDiagnostic[]
  hasManualOverrides: boolean
  lastHeartbeatAt: string
  lastHeartbeatRequestId?: string
  lastCaptureRequestId?: string
}) {
  const { t } = useTranslation()
  const meta = readinessMeta(readiness, t)
  const Icon = meta.icon
  const dash = t('common.dash')
  const formatDateTime = (value: string) => formatDateTimeValue(value, undefined, dash)

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{t('mobileCaptureContext.title')}</CardTitle>
            <CardDescription>
              {t('mobileCaptureContext.description')}
            </CardDescription>
          </div>
          <Badge variant={meta.badge}>
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <ContextChipRow label={t('mobileCaptureContext.effectiveSigningContext')}>
            <Badge variant="outline">{effectiveCtx.siteCode || t('mobileCaptureContext.noSite')}</Badge>
            <Badge variant="outline">{effectiveCtx.laneCode || t('mobileCaptureContext.noLane')}</Badge>
            <Badge variant={effectiveCtx.direction === 'ENTRY' ? 'entry' : 'exit'}>{t(`direction.${effectiveCtx.direction}`)}</Badge>
            <Badge variant="muted">{effectiveCtx.deviceCode || t('mobileCaptureContext.noDevice')}</Badge>
            {pairToken ? (
              <Badge variant="secondary">{t('mobileCaptureContext.pairToken')}</Badge>
            ) : (
              <Badge variant={effectiveCtx.deviceSecret ? 'secondary' : 'destructive'}>{t('mobileCaptureContext.secretLabel', { value: maskDeviceSecret(effectiveCtx.deviceSecret) })}</Badge>
            )}
            {hasManualOverrides ? (
              <Badge variant="amber">
                <Edit3 className="h-3 w-3" />
                {t('mobileCaptureContext.manualOverrideActive')}
              </Badge>
            ) : null}
          </ContextChipRow>

          <ContextChipRow label={t('mobileCaptureContext.initialSeed')}>
            <Badge variant="outline">{t('mobileCaptureContext.seedLabel', { value: seedCtx.source })}</Badge>
            <Badge variant="outline">{seedCtx.siteCode || t('mobileCaptureContext.noSite')}</Badge>
            <Badge variant="outline">{seedCtx.laneCode || t('mobileCaptureContext.noLane')}</Badge>
            <Badge variant={seedCtx.direction === 'ENTRY' ? 'entry' : 'exit'}>{t(`direction.${seedCtx.direction}`)}</Badge>
            <Badge variant="muted">{seedCtx.deviceCode || t('mobileCaptureContext.noDevice')}</Badge>
            {pairToken ? (
              <Badge variant="outline">{t('mobileCaptureContext.pairToken')}</Badge>
            ) : (
              <Badge variant={seedCtx.deviceSecret ? 'secondary' : 'outline'}>{t('mobileCaptureContext.secretLabel', { value: maskDeviceSecret(seedCtx.deviceSecret) })}</Badge>
            )}
            <Badge variant="outline">{t('mobileCaptureContext.prefillLabel', { value: formatDateTime(seedCtx.prefilledAt) })}</Badge>
          </ContextChipRow>
        </div>

        <ContextChipRow label={t('mobileCaptureContext.transportTraceability')}>
          <Badge variant="outline">{t('mobileCaptureContext.pairLabel', { value: pairToken || t('mobileCaptureContext.localOnly') })}</Badge>
          <Badge variant="outline">{t('mobileCaptureContext.lastHeartbeatLabel', { value: lastHeartbeatAt ? formatDateTime(lastHeartbeatAt) : dash })}</Badge>
          {lastHeartbeatRequestId ? <Badge variant="outline">{t('mobileCaptureContext.heartbeatRequestLabel', { value: lastHeartbeatRequestId })}</Badge> : null}
          {lastCaptureRequestId ? <Badge variant="outline">{t('mobileCaptureContext.captureRequestLabel', { value: lastCaptureRequestId })}</Badge> : null}
        </ContextChipRow>

        {diagnostics.length === 0 ? (
          <div className="rounded-2xl border border-success/20 bg-success/8 px-4 py-4 text-sm text-foreground">
            <p className="font-medium">{t('mobileCaptureContext.consistent')}</p>
            <p className="mt-1 text-muted-foreground">{t('mobileCaptureContext.consistentDescription')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {diagnostics.map((row) => (
              <div key={row.code} className={`rounded-2xl border px-4 py-3 text-sm ${toneClass(row.tone)}`}>
                <div className="flex items-start gap-3">
                  <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">{row.label}</p>
                    <p className="mt-1 text-muted-foreground">{row.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
