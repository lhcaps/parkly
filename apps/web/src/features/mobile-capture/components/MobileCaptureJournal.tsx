import { AlertCircle, Camera, ClipboardCheck, RadioTower, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { MobileCaptureJournalEntry } from '@/features/mobile-capture/mobile-capture-storage'

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

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN')
}

export function MobileCaptureJournal({ rows, onClear }: { rows: MobileCaptureJournalEntry[]; onClear: () => void }) {
  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Ops journal</CardTitle>
            <CardDescription>Local browser log for the most recent preview, heartbeat, and capture.</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={rows.length === 0}>
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
            No activity recorded in this browser.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const Icon = entryIcon(row.type)
              return (
                <div key={row.id} className={`rounded-2xl border p-4 ${entryTone(row.type)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <div className="mt-0.5 rounded-xl border border-current/10 bg-current/5 p-2">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{row.summary}</p>
                        {row.detail ? <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p> : null}
                      </div>
                    </div>
                    <p className="shrink-0 text-[11px] font-mono-data text-muted-foreground">{formatDateTime(row.ts)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
