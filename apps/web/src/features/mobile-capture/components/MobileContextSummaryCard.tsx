import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Edit3, ShieldAlert, Smartphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { maskDeviceSecret, type EffectiveDeviceContext, type MobileCaptureSeedContext } from '@/lib/api/mobile'

export type MobileContextReadiness = 'ready' | 'attention' | 'blocked'

export type MobileContextDiagnostic = {
  tone: MobileContextReadiness
  code: string
  label: string
  detail: string
}

function readinessMeta(value: MobileContextReadiness) {
  if (value === 'ready') {
    return { label: 'ready', icon: CheckCircle2, badge: 'secondary' as const }
  }
  if (value === 'attention') {
    return { label: 'attention', icon: AlertTriangle, badge: 'amber' as const }
  }
  return { label: 'blocked', icon: ShieldAlert, badge: 'destructive' as const }
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN')
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
  const meta = readinessMeta(readiness)
  const Icon = meta.icon

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Effective device context</CardTitle>
            <CardDescription>
              Every signed heartbeat and capture request uses the live form state shown here, not stale query params.
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
          <ContextChipRow label="Effective signing context">
            <Badge variant="outline">{effectiveCtx.siteCode || 'no-site'}</Badge>
            <Badge variant="outline">{effectiveCtx.laneCode || 'no-lane'}</Badge>
            <Badge variant={effectiveCtx.direction === 'ENTRY' ? 'entry' : 'exit'}>{effectiveCtx.direction}</Badge>
            <Badge variant="muted">{effectiveCtx.deviceCode || 'no-device'}</Badge>
            {pairToken ? (
              <Badge variant="secondary">pair token</Badge>
            ) : (
              <Badge variant={effectiveCtx.deviceSecret ? 'secondary' : 'destructive'}>
                secret {maskDeviceSecret(effectiveCtx.deviceSecret)}
              </Badge>
            )}
            {hasManualOverrides ? (
              <Badge variant="amber">
                <Edit3 className="h-3 w-3" />
                manual override active
              </Badge>
            ) : null}
          </ContextChipRow>

          <ContextChipRow label="Initial seed / pair prefill">
            <Badge variant="outline">seed={seedCtx.source}</Badge>
            <Badge variant="outline">{seedCtx.siteCode || 'no-site'}</Badge>
            <Badge variant="outline">{seedCtx.laneCode || 'no-lane'}</Badge>
            <Badge variant={seedCtx.direction === 'ENTRY' ? 'entry' : 'exit'}>{seedCtx.direction}</Badge>
            <Badge variant="muted">{seedCtx.deviceCode || 'no-device'}</Badge>
            {pairToken ? (
              <Badge variant="outline">pair token</Badge>
            ) : (
              <Badge variant={seedCtx.deviceSecret ? 'secondary' : 'outline'}>
                secret {maskDeviceSecret(seedCtx.deviceSecret)}
              </Badge>
            )}
            <Badge variant="outline">prefill={formatDateTime(seedCtx.prefilledAt)}</Badge>
          </ContextChipRow>
        </div>

        <ContextChipRow label="Transport / traceability">
          <Badge variant="outline">pair={pairToken || 'local-only'}</Badge>
          <Badge variant="outline">lastHB={lastHeartbeatAt ? formatDateTime(lastHeartbeatAt) : '—'}</Badge>
          {lastHeartbeatRequestId ? <Badge variant="outline">hbReq={lastHeartbeatRequestId}</Badge> : null}
          {lastCaptureRequestId ? <Badge variant="outline">captureReq={lastCaptureRequestId}</Badge> : null}
        </ContextChipRow>

        {diagnostics.length === 0 ? (
          <div className="rounded-2xl border border-success/20 bg-success/8 px-4 py-4 text-sm text-foreground">
            Current live context is internally consistent. Heartbeat and capture will sign with the same device scope.
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
