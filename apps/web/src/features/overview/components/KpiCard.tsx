import type { ComponentType } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export function KpiCard({
  title,
  value,
  helper,
  badge,
  icon: Icon,
  tone = 'default',
}: {
  title: string
  value: string
  helper: string
  badge?: string
  icon: ComponentType<{ className?: string }>
  tone?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const toneClass =
    tone === 'success'
      ? 'border-success/20 bg-success/5'
      : tone === 'warning'
        ? 'border-primary/20 bg-primary/5'
        : tone === 'danger'
          ? 'border-destructive/20 bg-destructive/5'
          : 'border-border/80 bg-card/90'

  return (
    <Card className={`h-full ${toneClass} shadow-[0_18px_60px_rgba(0,0,0,0.12)]`}>
      <CardContent className="flex h-full items-start gap-4 pt-5">
        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
            {badge ? <Badge variant="outline">{badge}</Badge> : null}
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  )
}
