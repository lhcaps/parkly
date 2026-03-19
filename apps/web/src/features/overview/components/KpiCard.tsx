import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export function KpiCard({
  title,
  value,
  helper,
  badge,
  icon: Icon,
  tone = 'default',
  loading = false,
}: {
  title: string
  value: string
  helper: string
  badge?: string
  icon: ComponentType<{ className?: string }>
  tone?: 'default' | 'success' | 'warning' | 'danger'
  loading?: boolean
}) {
  const toneClass =
    tone === 'success'
      ? 'border-success/20 bg-success/5'
      : tone === 'warning'
        ? 'border-primary/20 bg-primary/5'
        : tone === 'danger'
          ? 'border-destructive/20 bg-destructive/5'
          : 'border-border/80 bg-card/90'

  const iconBgClass =
    tone === 'success'
      ? 'border-success/20 bg-success/10 text-success'
      : tone === 'warning'
        ? 'border-primary/20 bg-primary/10 text-primary'
        : tone === 'danger'
          ? 'border-destructive/20 bg-destructive/10 text-destructive'
          : 'border-primary/20 bg-primary/10 text-primary'

  if (loading) {
    return (
      <Card className={cn('h-full shadow-[0_18px_60px_rgba(0,0,0,0.12)]', toneClass)}>
        <CardContent className="flex h-full items-start gap-4 pt-5">
          <div className={cn('mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', iconBgClass)}>
            <Icon className="h-5 w-5 opacity-40" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-3 w-24 animate-pulse rounded-md bg-muted" />
            <div className="h-7 w-16 animate-pulse rounded-md bg-muted" />
            <div className="h-3 w-40 animate-pulse rounded-md bg-muted" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('h-full shadow-[0_18px_60px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(0,0,0,0.18)]', toneClass)}>
      <CardContent className="flex h-full items-start gap-4 pt-5">
        <div className={cn('mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-300 group-hover:scale-105', iconBgClass)}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
            {badge ? <Badge variant="outline">{badge}</Badge> : null}
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{helper}</p>
        </div>
      </CardContent>
    </Card>
  )
}
