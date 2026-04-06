import { useState } from 'react'
import { AlertCircle, Camera, ChevronDown, ChevronRight, ClipboardCheck, RadioTower, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { MobileCaptureJournalEntry } from '@/features/mobile-capture/mobile-capture-storage'
import { formatDateTimeValue } from '@/i18n/format'

const DETAIL_TRUNCATE = 120

function entryIcon(type: MobileCaptureJournalEntry['type']) {
  if (type === 'preview') return Camera
  if (type === 'heartbeat') return RadioTower
  if (type === 'capture') return ClipboardCheck
  return AlertCircle
}

function entryTone(type: MobileCaptureJournalEntry['type']) {
  if (type === 'capture') return 'border-success/25 bg-success/8'
  if (type === 'heartbeat') return 'border-primary/20 bg-primary/8'
  if (type === 'error') return 'border-destructive/25 bg-destructive/10'
  return 'border-border/80 bg-background/40'
}

function JournalRow({ row }: { row: MobileCaptureJournalEntry }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const Icon = entryIcon(row.type)
  const hasLongDetail = (row.detail?.length ?? 0) > DETAIL_TRUNCATE
  const detailPreview = hasLongDetail && !expanded
    ? (row.detail ?? '').slice(0, DETAIL_TRUNCATE).trim() + '...'
    : row.detail
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${entryTone(row.type)}`}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 rounded-lg border border-current/10 bg-current/5 p-1.5">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-foreground">{row.summary}</p>
            <span className="shrink-0 text-[10px] font-mono-data text-muted-foreground">
              {formatDateTimeValue(row.ts, { timeStyle: 'short', dateStyle: 'short' })}
            </span>
          </div>
          {detailPreview ? (
            <div className="mt-0.5">
              <p className="text-[11px] text-muted-foreground break-words">{detailPreview}</p>
              {hasLongDetail && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 flex items-center gap-0.5 text-[10px] text-muted-foreground underline underline-offset-1 hover:text-foreground"
                >
                  {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {expanded ? t('mobileCaptureJournal.collapse') : t('mobileCaptureJournal.showMore')}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function MobileCaptureJournal({ rows, onClear }: { rows: MobileCaptureJournalEntry[]; onClear: () => void }) {
  const { t } = useTranslation()
  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t('mobileCaptureJournal.title')}</CardTitle>
            <CardDescription className="text-xs">{t('mobileCaptureJournal.description')}</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={rows.length === 0}>
            <Trash2 className="h-3.5 w-3.5" />
            {t('mobileCaptureJournal.clear')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/40 px-3 py-6 text-center text-xs text-muted-foreground">
            {t('mobileCaptureJournal.empty')}
          </div>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {rows.map((row) => (
              <JournalRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
