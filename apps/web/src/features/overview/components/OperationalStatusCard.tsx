import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export type OperationalStatus = 'ready' | 'attention' | 'degraded' | 'unavailable'

const STATUS_META: Record<OperationalStatus, { labelKey: string; badgeVariant: BadgeProps['variant']; cardClass: string; iconClass: string }> = {
  ready: {
    labelKey: 'overview.pageStatus.ready',
    badgeVariant: 'secondary',
    cardClass: 'border-success/20 bg-success/5',
    iconClass: 'border-success/20 bg-success/10 text-success',
  },
  attention: {
    labelKey: 'overview.pageStatus.attention',
    badgeVariant: 'amber',
    cardClass: 'border-primary/20 bg-primary/5',
    iconClass: 'border-primary/20 bg-primary/10 text-primary',
  },
  degraded: {
    labelKey: 'overview.pageStatus.degraded',
    badgeVariant: 'outline',
    cardClass: 'border-border/80 bg-card/95',
    iconClass: 'border-border/60 bg-muted/50 text-muted-foreground',
  },
  unavailable: {
    labelKey: 'overview.pageStatus.unavailable',
    badgeVariant: 'destructive',
    cardClass: 'border-destructive/20 bg-destructive/5',
    iconClass: 'border-destructive/20 bg-destructive/10 text-destructive',
  },
}

export const OperationalStatusCard = memo(function OperationalStatusCard({
  title,
  value,
  helper,
  icon: Icon,
  status,
  chips = [],
  footer,
  loading = false,
}: {
  title: string
  value: string
  helper: string
  icon: (props: { className?: string }) => JSX.Element
  status: OperationalStatus
  chips?: Array<{ label: string; variant?: BadgeProps['variant'] }>
  footer?: ReactNode
  loading?: boolean
}) {
  const { t } = useTranslation()
  const meta = STATUS_META[status]

  if (loading) {
    return (
      <Card className={cn('shadow-[0_18px_60px_rgba(0,0,0,0.12)]', meta.cardClass)}>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border', meta.iconClass)}>
                <Icon className="h-5 w-5 opacity-40" />
              </div>
              <div className="space-y-3">
                <div className="h-3 w-20 animate-pulse rounded-md bg-muted" />
                <div className="h-7 w-14 animate-pulse rounded-md bg-muted" />
              </div>
            </div>
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="h-3 w-full animate-pulse rounded-md bg-muted" />
          <div className="flex gap-2">
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('shadow-[0_8px_24px_rgba(35,94,138,0.08)] transition-colors duration-150', meta.cardClass)}>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-white/45 dark:bg-transparent', meta.iconClass)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
            </div>
          </div>
          <Badge variant={meta.badgeVariant} className="shrink-0 text-[10px]">{t(meta.labelKey)}</Badge>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{helper}</p>

        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-2 text-[11px] font-mono-data text-muted-foreground">
            {chips.map((chip) => (
              <Badge key={`${chip.label}:${chip.variant ?? 'outline'}`} variant={chip.variant ?? 'outline'} className="transition-colors duration-200">
                {chip.label}
              </Badge>
            ))}
          </div>
        ) : null}

        {footer ? <div className="border-t border-border/60 pt-3">{footer}</div> : null}
      </CardContent>
    </Card>
  )
})
