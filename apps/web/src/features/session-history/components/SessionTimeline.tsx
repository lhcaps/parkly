import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import type { SessionDetail } from '@/lib/contracts/sessions'
import { formatTimeValue } from '@/i18n/format'

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function pickString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : ''
}

function formatPayload(kind: string, payload: unknown, t: (key: string, options?: Record<string, unknown>) => string) {
  const row = asRecord(payload)
  if (kind === 'READ') {
    return [pickString(row?.readType), pickString(row?.plateCompact) || pickString(row?.plateRaw), pickString(row?.rfidUid), pickString(row?.sensorState)].filter(Boolean).join('  ') || t('sessionHistory.timeline.readEvent')
  }
  if (kind === 'DECISION') {
    return [pickString(row?.decisionCode), pickString(row?.recommendedAction) || pickString(row?.finalAction), pickString(row?.reasonDetail) || pickString(row?.reasonCode)].filter(Boolean).join('  ') || t('sessionHistory.timeline.decisionEvent')
  }
  if (kind === 'BARRIER') {
    return [pickString(row?.commandType), pickString(row?.status), pickString(row?.reasonCode)].filter(Boolean).join('  ') || t('sessionHistory.timeline.barrierEvent')
  }
  if (kind === 'REVIEW') {
    return [pickString(row?.status), pickString(row?.queueReasonCode), pickString(row?.note)].filter(Boolean).join('  ') || t('sessionHistory.timeline.reviewEvent')
  }
  if (kind === 'INCIDENT') {
    return [pickString(row?.incidentType), pickString(row?.title), pickString(row?.severity)].filter(Boolean).join('  ') || t('sessionHistory.timeline.incidentEvent')
  }
  if (kind === 'SESSION') {
    return [pickString(row?.status), pickString(row?.reasonDetail) || pickString(row?.reasonCode)].filter(Boolean).join('  ') || t('sessionHistory.timeline.sessionEvent')
  }
  const summary = row
    ? Object.entries(row)
        .slice(0, 4)
        .map(([key, value]) => `${key}=${typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '[object]'}`)
        .join('  ')
    : ''
  return summary || t('sessionHistory.timeline.item')
}

function variantForKind(kind: string): 'secondary' | 'outline' | 'amber' | 'destructive' | 'muted' {
  if (kind === 'DECISION') return 'amber'
  if (kind === 'BARRIER') return 'secondary'
  if (kind === 'INCIDENT') return 'destructive'
  if (kind === 'REVIEW') return 'muted'
  return 'outline'
}

function TimelineItem({ item }: { item: SessionDetail['timeline'][0] }) {
  const { t } = useTranslation()

  return (
    <div className="flex gap-3 border-b border-border/40 py-2.5 last:border-b-0 last:pb-0">
      <div className="mt-0.5 flex shrink-0 flex-col items-center gap-1">
        <Badge variant={variantForKind(item.kind)} className="shrink-0 text-[10px]">
          {item.kind}
        </Badge>
        <div className="min-h-[12px] w-px flex-1 bg-border/40" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono-data text-muted-foreground">
            {formatTimeValue(item.at)}
          </span>
        </div>
        <p className="mt-0.5 break-all text-xs leading-relaxed text-foreground/80">
          {formatPayload(item.kind, item.payload, t)}
        </p>
      </div>
    </div>
  )
}

export function SessionTimeline({ detail }: { detail: SessionDetail }) {
  const { t } = useTranslation()
  const [allOpen, setAllOpen] = useState(false)

  if (detail.timeline.length === 0) {
    return (
      <CollapsibleSection
        title={t('sessionHistory.timeline.title')}
        description={t('sessionHistory.timeline.events', { count: 0 })}
        count={0}
        countVariant="neutral"
        defaultOpen={false}
        className="mt-3"
      >
        <p className="py-1 text-xs text-muted-foreground">{t('sessionHistory.timeline.empty')}</p>
      </CollapsibleSection>
    )
  }

  const eventTypes = [...new Set(detail.timeline.map((item) => item.kind))]
  const counts = eventTypes.reduce<Record<string, number>>((accumulator, kind) => {
    accumulator[kind] = detail.timeline.filter((item) => item.kind === kind).length
    return accumulator
  }, {})

  return (
    <CollapsibleSection
      title={t('sessionHistory.timeline.title')}
      description={t('sessionHistory.timeline.events', { count: detail.timeline.length })}
      defaultOpen={false}
      className="mt-3"
      headerAction={
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation()
            setAllOpen((value) => !value)
          }}
        >
          {allOpen ? t('sessionHistory.timeline.collapseAll') : t('sessionHistory.timeline.expandAll')}
        </Button>
      }
    >
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {eventTypes.map((kind) => (
          <Badge key={kind} variant={variantForKind(kind)} className="text-[10px]">
            {kind} {counts[kind]}
          </Badge>
        ))}
      </div>
      <div className="-mr-1 max-h-[360px] overflow-y-auto pr-1">
        {detail.timeline.map((item, index) => (
          <TimelineItem key={`${item.kind}:${item.at}:${index}`} item={item} />
        ))}
      </div>
    </CollapsibleSection>
  )
}
