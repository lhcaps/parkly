import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SessionDetail } from '@/lib/contracts/sessions'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function pickString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : ''
}

function formatPayload(kind: string, payload: unknown) {
  const row = asRecord(payload)

  if (kind === 'READ') {
    return [
      pickString(row?.readType),
      pickString(row?.plateCompact) || pickString(row?.plateRaw),
      pickString(row?.rfidUid),
      pickString(row?.sensorState),
    ].filter(Boolean).join('  ') || 'Read event'
  }

  if (kind === 'DECISION') {
    return [
      pickString(row?.decisionCode),
      pickString(row?.recommendedAction) || pickString(row?.finalAction),
      pickString(row?.reasonDetail) || pickString(row?.reasonCode),
    ].filter(Boolean).join('  ') || 'Decision event'
  }

  if (kind === 'BARRIER') {
    return [
      pickString(row?.commandType),
      pickString(row?.status),
      pickString(row?.reasonCode),
    ].filter(Boolean).join('  ') || 'Barrier event'
  }

  if (kind === 'REVIEW') {
    return [
      pickString(row?.status),
      pickString(row?.queueReasonCode),
      pickString(row?.note),
    ].filter(Boolean).join('  ') || 'Review event'
  }

  if (kind === 'INCIDENT') {
    return [
      pickString(row?.incidentType),
      pickString(row?.title),
      pickString(row?.severity),
    ].filter(Boolean).join('  ') || 'Incident event'
  }

  if (kind === 'SESSION') {
    return [
      pickString(row?.status),
      pickString(row?.reasonDetail) || pickString(row?.reasonCode),
    ].filter(Boolean).join('  ') || 'Session event'
  }

  const summary = row
    ? Object.entries(row)
        .slice(0, 4)
        .map(([key, value]) => `${key}=${typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '[object]'}`)
        .join('  ')
    : ''

  return summary || 'Timeline item'
}

function variantForKind(kind: string): 'secondary' | 'outline' | 'amber' | 'destructive' | 'muted' {
  if (kind === 'DECISION') return 'amber'
  if (kind === 'BARRIER') return 'secondary'
  if (kind === 'INCIDENT') return 'destructive'
  if (kind === 'REVIEW') return 'muted'
  return 'outline'
}

export function SessionTimeline({
  detail,
}: {
  detail: SessionDetail
}) {
  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <CardTitle>Session Timeline</CardTitle>
        <CardDescription>
          Timeline summarised by event semantics — raw JSON is not surfaced to operators.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {detail.timeline.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-8 text-sm text-muted-foreground">
            — timeline item.
          </div>
        ) : (
          <div className="space-y-3">
            {detail.timeline.map((item, index) => (
              <div key={`${item.kind}:${item.at}:${index}`} className="rounded-2xl border border-border/80 bg-background/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={variantForKind(item.kind)}>{item.kind}</Badge>
                  <p className="text-[11px] font-mono-data text-muted-foreground">
                    {new Date(item.at).toLocaleString('vi-VN')}
                  </p>
                </div>
                <p className="mt-3 break-all text-sm text-foreground/90">{formatPayload(item.kind, item.payload)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
