import { AlertTriangle, CheckCircle2, ShieldAlert, Smartphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PairDiagnostic, PairReadiness } from '@/features/mobile-pair/mobile-pair-model'

function readinessMeta(value: PairReadiness) {
  if (value === 'ready') {
    return { label: 'ready', icon: CheckCircle2, badge: 'secondary' as const }
  }
  if (value === 'attention') {
    return { label: 'attention', icon: AlertTriangle, badge: 'amber' as const }
  }
  return { label: 'blocked', icon: ShieldAlert, badge: 'destructive' as const }
}

export function MobileContextSummaryCard({
  siteCode,
  laneCode,
  direction,
  deviceCode,
  pairToken,
  readiness,
  diagnostics,
  autoHeartbeat,
  lastHeartbeatAt,
}: {
  siteCode: string
  laneCode: string
  direction: 'ENTRY' | 'EXIT'
  deviceCode: string
  pairToken: string
  readiness: PairReadiness
  diagnostics: PairDiagnostic[]
  autoHeartbeat: boolean
  lastHeartbeatAt: string
}) {
  const meta = readinessMeta(readiness)
  const Icon = meta.icon

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Ops context</CardTitle>
            <CardDescription>This mobile browser is operating as a signed edge capture surface.</CardDescription>
          </div>
          <Badge variant={meta.badge}>
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Routing</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">{siteCode || 'no-site'}</Badge>
              <Badge variant="outline">{laneCode || 'no-lane'}</Badge>
              <Badge variant={direction === 'ENTRY' ? 'entry' : 'exit'}>{direction}</Badge>
              <Badge variant="muted">{deviceCode || 'no-device'}</Badge>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Transport</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">pair={pairToken || 'local'}</Badge>
              <Badge variant={autoHeartbeat ? 'secondary' : 'outline'}>{autoHeartbeat ? 'heartbeat auto' : 'heartbeat manual'}</Badge>
              <Badge variant="outline">lastHB={lastHeartbeatAt || '—'}</Badge>
            </div>
          </div>
        </div>

        {diagnostics.length === 0 ? (
          <div className="rounded-2xl border border-success/20 bg-success/8 px-4 py-4 text-sm text-foreground">
            Context is ready for preview and capture submission. Monitor lane state from desktop if this is the primary entry point.nghẽn đang được điều phối.
          </div>
        ) : (
          <div className="space-y-2">
            {diagnostics.map((row) => (
              <div
                key={row.code}
                className={`rounded-2xl border px-4 py-3 text-sm ${row.tone === 'blocked' ? 'border-destructive/25 bg-destructive/10' : 'border-primary/20 bg-primary/8'}`}
              >
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
