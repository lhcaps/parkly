import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { LaneFlowSubmitRes } from '@/lib/contracts/laneFlow'

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="max-w-[70%] break-all text-right text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function GateEventSummaryCard({
  event,
}: {
  event: LaneFlowSubmitRes['event'] | null
}) {
  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">gate event summary</Badge>
          {event ? <Badge variant={event.changed ? 'entry' : 'outline'}>{event.changed ? 'event changed' : 'no event change'}</Badge> : null}
        </div>
        <CardTitle className="text-sm sm:text-base">Gate Event Summary</CardTitle>
        <CardDescription>
          Sau submit phải thấy ngay eventId, outboxId, lane/device nào vừa ghi, và event có thực sự thay đổi hay không.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {event ? (
          <div className="rounded-3xl border border-border/80 bg-muted/25 p-4">
            <SummaryRow label="Changed" value={event.changed ? 'Yes' : 'No'} />
            <SummaryRow label="Event id" value={String(event.eventId)} />
            <SummaryRow label="Event time" value={event.eventTime ? new Date(event.eventTime).toLocaleString('vi-VN') : '—'} />
            <SummaryRow label="Outbox id" value={String(event.outboxId)} />
            <SummaryRow label="Site" value={event.siteCode || '—'} />
            <SummaryRow label="Lane" value={event.laneCode || '—'} />
            <SummaryRow label="Device" value={event.deviceCode || '—'} />
          </div>
        ) : (
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-background/40 px-6 py-8 text-center">
            <p className="text-sm font-medium">Chưa có gate event result</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Gate event summary sẽ xuất hiện sau submit lane flow thành công.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
