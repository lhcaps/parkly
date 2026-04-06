import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function OutboxHealthSummary({
  total,
  failed,
  pending,
  retrying,
  sent,
  streamTotal,
}: {
  total: number
  failed: number
  pending: number
  retrying: number
  sent: number
  streamTotal: number
}) {
  const cards = [
    { label: 'REST window', value: total, helper: 'Current triage list', variant: 'outline' as const },
    { label: 'Failures', value: failed, helper: 'Investigate or requeue', variant: failed > 0 ? 'destructive' as const : 'outline' as const },
    { label: 'Pending', value: pending, helper: 'Not yet sent', variant: pending > 0 ? 'amber' as const : 'outline' as const },
    { label: 'Retrying', value: retrying, helper: 'Has nextRetry or is retrying', variant: retrying > 0 ? 'amber' as const : 'outline' as const },
    { label: 'Sent', value: sent, helper: 'Successfully synced', variant: 'secondary' as const },
    { label: 'Realtime rows', value: streamTotal, helper: 'Snapshot SSE', variant: 'outline' as const },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.label} className="border-border/80 bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono-data text-3xl font-semibold text-foreground">{card.value}</p>
              <Badge variant={card.variant}>{card.label.toLowerCase()}</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{card.helper}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
