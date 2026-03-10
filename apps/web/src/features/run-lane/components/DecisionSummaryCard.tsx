import { AlertTriangle, CheckCircle2, ClipboardList, Info, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ResolveSessionRes } from '@/lib/contracts/sessions'

function variantByDecision(decisionCode: string | null | undefined) {
  if (!decisionCode) return 'outline' as const
  if (decisionCode.includes('APPROVE') || decisionCode.includes('PASS')) return 'entry' as const
  if (decisionCode.includes('REVIEW')) return 'amber' as const
  if (decisionCode.includes('DENY') || decisionCode.includes('BLOCK') || decisionCode.includes('ERROR')) return 'destructive' as const
  return 'secondary' as const
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="max-w-[70%] break-all text-right text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function DecisionSummaryCard({
  decision,
}: {
  decision: ResolveSessionRes['decision']
}) {
  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">decision summary</Badge>
          <Badge variant={variantByDecision(decision?.decisionCode)}>{decision?.decisionCode || 'NO_DECISION'}</Badge>
          {decision?.reviewRequired ? <Badge variant="amber">review required</Badge> : null}
        </div>
        <CardTitle className="text-sm sm:text-base">Decision Summary</CardTitle>
        <CardDescription>
          Operator phải nhìn ra ngay final action, reason code, reason detail và việc có cần review hay không.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {decision ? (
          <div className="rounded-3xl border border-border/80 bg-muted/25 p-4">
            <SummaryRow label="Decision code" value={decision.decisionCode} />
            <SummaryRow label="Recommended action" value={decision.recommendedAction} />
            <SummaryRow label="Final action" value={decision.finalAction} />
            <SummaryRow label="Reason code" value={decision.reasonCode || '—'} />
            <SummaryRow label="Reason detail" value={decision.reasonDetail || '—'} />
            <SummaryRow label="Review required" value={decision.reviewRequired ? 'Yes' : 'No'} />
            <SummaryRow label="Explanation" value={decision.explanation || '—'} />
          </div>
        ) : (
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-background/40 px-6 py-8 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-border/80 bg-muted/25 text-muted-foreground">
              <ClipboardList className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium">Chưa có decision result</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Decision summary sẽ xuất hiện sau khi submit lane flow thành công.
            </p>
          </div>
        )}

        {decision?.reviewRequired ? (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <span className="font-medium">Review flag đang bật</span>
            </div>
            UI đã đóng đinh reviewRequired ở result surface để operator không bỏ sót trường hợp cần hàng đợi review.
          </div>
        ) : decision ? (
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="font-medium">Decision đã rõ</span>
            </div>
            Decision hiện tại không yêu cầu review bổ sung.
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
