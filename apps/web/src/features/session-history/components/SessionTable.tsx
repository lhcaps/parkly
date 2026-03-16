import { memo } from 'react'
import { AlertCircle, ArrowDownLeft, ArrowUpRight, ClipboardList, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { SessionSummary, SessionState } from '@/lib/contracts/sessions'
import { cn } from '@/lib/utils'

function sessionVariant(status: SessionState): 'secondary' | 'entry' | 'amber' | 'destructive' | 'muted' {
  if (status === 'APPROVED' || status === 'PASSED') return 'entry'
  if (status === 'WAITING_READ' || status === 'WAITING_DECISION' || status === 'WAITING_PAYMENT' || status === 'OPEN') return 'amber'
  if (status === 'DENIED' || status === 'ERROR') return 'destructive'
  return 'muted'
}

export const SessionTable = memo(function SessionTable({
  rows,
  selectedId,
  loading,
  error,
  onSelect,
}: {
  rows: SessionSummary[]
  selectedId: string
  loading: boolean
  error: string
  onSelect: (sessionId: string) => void
}) {
  return (
    <div className="rounded-3xl border border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <div className="border-b border-border/80 px-4 py-4">
        <p className="text-sm font-medium">Session list</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? 'session' : 'sessions'} matching current filters.
        </p>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading sessions…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-12 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No sessions match current filters</p>
            <p className="mt-1 text-xs text-muted-foreground">Try adjusting filters or widening the time range.</p>
          </div>
        ) : (
          <ScrollArea className="h-[720px] pr-3">
            <div className="space-y-3">
              {rows.map((row) => (
                <button
                  key={String(row.sessionId)}
                  onClick={() => onSelect(String(row.sessionId))}
                  className={cn(
                    'perf-list-item w-full rounded-2xl border px-4 py-4 text-left transition',
                    String(row.sessionId) === selectedId ? 'border-primary/35 bg-primary/8' : 'border-border bg-background/40 hover:bg-muted/40',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={row.direction === 'ENTRY' ? 'entry' : 'exit'}>
                          {row.direction === 'ENTRY' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                          {row.direction}
                        </Badge>
                        <Badge variant={sessionVariant(row.status)}>{row.status}</Badge>
                        {row.reviewRequired ? <Badge variant="amber">Review required</Badge> : null}
                      </div>

                      <p className="mt-2 break-all font-mono-data text-sm font-semibold">
                        {row.siteCode} / {row.gateCode} / {row.laneCode}
                      </p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {String(row.sessionId)}
                        {row.plateCompact ? ` · ${row.plateCompact}` : ''}
                      </p>
                    </div>

                    <div className="text-right text-[11px] font-mono-data text-muted-foreground">
                      <p>{new Date(row.openedAt).toLocaleString('en-GB')}</p>
                      <p className="mt-1">{row.readCount} reads &middot; {row.decisionCount} decisions</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
})
