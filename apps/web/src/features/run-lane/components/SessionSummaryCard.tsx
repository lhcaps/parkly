import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SessionSummary } from '@/lib/contracts/sessions'

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="max-w-[70%] break-all text-right text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function sessionVariant(status: string | null | undefined) {
  if (!status) return 'outline' as const
  if (status === 'APPROVED' || status === 'PASSED') return 'entry' as const
  if (status === 'WAITING_DECISION' || status === 'WAITING_PAYMENT') return 'amber' as const
  if (status === 'DENIED' || status === 'CANCELLED' || status === 'ERROR' || status === 'TIMEOUT') return 'destructive' as const
  return 'secondary' as const
}

export function SessionSummaryCard({
  session,
}: {
  session: SessionSummary | null
}) {
  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">session summary</Badge>
          <Badge variant={sessionVariant(session?.status)}>{session?.status || 'NO_SESSION'}</Badge>
          {session?.allowedActions?.length ? <Badge variant="muted">actions {session.allowedActions.length}</Badge> : null}
        </div>
        <CardTitle className="text-sm sm:text-base">Session Summary</CardTitle>
        <CardDescription>
          Session state, lane identity và allowed actions phải hiện ngay tại panel phải, không bắt operator nhảy sang màn khác.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {session ? (
          <div className="rounded-3xl border border-border/80 bg-muted/25 p-4">
            <SummaryRow label="Session" value={String(session.sessionId)} />
            <SummaryRow label="Status" value={session.status} />
            <SummaryRow label="Site / Gate / Lane" value={`${session.siteCode} / ${session.gateCode} / ${session.laneCode}`} />
            <SummaryRow label="Direction" value={session.direction} />
            <SummaryRow label="Plate" value={session.plateCompact || '—'} />
            <SummaryRow label="Opened at" value={session.openedAt ? new Date(session.openedAt).toLocaleString('vi-VN') : '—'} />
            <SummaryRow label="Reads / Decisions" value={`${session.readCount} / ${session.decisionCount}`} />
            <SummaryRow label="Allowed actions" value={session.allowedActions?.join(', ') || '—'} />
          </div>
        ) : (
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-background/40 px-6 py-8 text-center">
            <p className="text-sm font-medium">Chưa có session result</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sau submit thành công, card này sẽ hiển thị session authoritative mới nhất.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
