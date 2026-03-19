import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import type { SessionDetail } from '@/lib/contracts/sessions'

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function pickString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : ''
}

function formatPayload(kind: string, payload: unknown) {
  const row = asRecord(payload)
  if (kind === 'READ') return [pickString(row?.readType), pickString(row?.plateCompact) || pickString(row?.plateRaw), pickString(row?.rfidUid), pickString(row?.sensorState)].filter(Boolean).join('  ') || 'Read event'
  if (kind === 'DECISION') return [pickString(row?.decisionCode), pickString(row?.recommendedAction) || pickString(row?.finalAction), pickString(row?.reasonDetail) || pickString(row?.reasonCode)].filter(Boolean).join('  ') || 'Decision event'
  if (kind === 'BARRIER') return [pickString(row?.commandType), pickString(row?.status), pickString(row?.reasonCode)].filter(Boolean).join('  ') || 'Barrier event'
  if (kind === 'REVIEW') return [pickString(row?.status), pickString(row?.queueReasonCode), pickString(row?.note)].filter(Boolean).join('  ') || 'Review event'
  if (kind === 'INCIDENT') return [pickString(row?.incidentType), pickString(row?.title), pickString(row?.severity)].filter(Boolean).join('  ') || 'Incident event'
  if (kind === 'SESSION') return [pickString(row?.status), pickString(row?.reasonDetail) || pickString(row?.reasonCode)].filter(Boolean).join('  ') || 'Session event'
  const summary = row ? Object.entries(row).slice(0, 4).map(([k, v]) => `${k}=${typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : '[object]'}`).join('  ') : ''
  return summary || 'Timeline item'
}

function variantForKind(kind: string): 'secondary' | 'outline' | 'amber' | 'destructive' | 'muted' {
  if (kind === 'DECISION') return 'amber'
  if (kind === 'BARRIER') return 'secondary'
  if (kind === 'INCIDENT') return 'destructive'
  if (kind === 'REVIEW') return 'muted'
  return 'outline'
}

function TimelineItem({ item }: { item: SessionDetail['timeline'][0] }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-border/40 last:border-b-0 last:pb-0">
      <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
        <Badge variant={variantForKind(item.kind)} className="text-[10px] shrink-0">{item.kind}</Badge>
        <div className="w-px flex-1 min-h-[12px] bg-border/40" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono-data text-muted-foreground">
            {new Date(item.at).toLocaleTimeString('vi-VN')}
          </span>
        </div>
        <p className="mt-0.5 break-all text-xs text-foreground/80 leading-relaxed">{formatPayload(item.kind, item.payload)}</p>
      </div>
    </div>
  )
}

export function SessionTimeline({ detail }: { detail: SessionDetail }) {
  const [allOpen, setAllOpen] = useState(false)

  if (detail.timeline.length === 0) {
    return (
      <CollapsibleSection title="Session timeline" description="0 events" count={0} countVariant="neutral" defaultOpen={false} className="mt-3">
        <p className="text-xs text-muted-foreground py-1">No timeline events.</p>
      </CollapsibleSection>
    )
  }

  const eventTypes = [...new Set(detail.timeline.map((i) => i.kind))]
  const counts = eventTypes.reduce<Record<string, number>>((acc, kind) => {
    acc[kind] = detail.timeline.filter((i) => i.kind === kind).length
    return acc
  }, {})

  return (
    <CollapsibleSection
      title="Session timeline"
      description={`${detail.timeline.length} events`}
      defaultOpen={false}
      className="mt-3"
      headerAction={
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); setAllOpen((v) => !v) }}
        >
          {allOpen ? 'collapse' : 'expand'} all
        </Button>
      }
    >
      {/* Type summary chips */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {eventTypes.map((kind) => (
          <Badge key={kind} variant={variantForKind(kind)} className="text-[10px]">
            {kind} {counts[kind]}
          </Badge>
        ))}
      </div>
      {/* Compact timeline list */}
      <div className="max-h-[360px] overflow-y-auto pr-1 -mr-1">
        {detail.timeline.map((item, index) => (
          <TimelineItem key={`${item.kind}:${item.at}:${index}`} item={item} />
        ))}
      </div>
    </CollapsibleSection>
  )
}
