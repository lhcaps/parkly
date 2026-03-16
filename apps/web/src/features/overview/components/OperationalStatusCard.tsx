import type { ReactNode } from 'react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type OperationalStatus = 'ready' | 'attention' | 'degraded' | 'unavailable'

const STATUS_META: Record<OperationalStatus, { label: string; badgeVariant: BadgeProps['variant']; cardClass: string }> = {
  ready: {
    label: 'READY',
    badgeVariant: 'secondary',
    cardClass: 'border-success/20 bg-success/5',
  },
  attention: {
    label: 'ATTENTION',
    badgeVariant: 'amber',
    cardClass: 'border-primary/20 bg-primary/5',
  },
  degraded: {
    label: 'DEGRADED',
    badgeVariant: 'outline',
    cardClass: 'border-border/80 bg-card/95',
  },
  unavailable: {
    label: 'UNAVAILABLE',
    badgeVariant: 'destructive',
    cardClass: 'border-destructive/20 bg-destructive/5',
  },
}

export function OperationalStatusCard({
  title,
  value,
  helper,
  icon: Icon,
  status,
  chips = [],
  footer,
}: {
  title: string
  value: string
  helper: string
  icon: (props: { className?: string }) => JSX.Element
  status: OperationalStatus
  chips?: Array<{ label: string; variant?: BadgeProps['variant'] }>
  footer?: ReactNode
}) {
  const meta = STATUS_META[status]

  return (
    <Card className={cn('shadow-[0_18px_60px_rgba(0,0,0,0.12)]', meta.cardClass)}>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            </div>
          </div>
          <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
        </div>

        <p className="text-sm text-muted-foreground">{helper}</p>

        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-2 text-[11px] font-mono-data text-muted-foreground">
            {chips.map((chip) => (
              <Badge key={`${chip.label}:${chip.variant ?? 'outline'}`} variant={chip.variant ?? 'outline'}>
                {chip.label}
              </Badge>
            ))}
          </div>
        ) : null}

        {footer ? <div className="border-t border-border/60 pt-3">{footer}</div> : null}
      </CardContent>
    </Card>
  )
}
