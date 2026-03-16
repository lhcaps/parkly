import type { ComponentType, ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Inbox, Loader2, RefreshCcw } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LiveStateBadge } from '@/components/ui/live-state-badge'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  badges?: Array<{ label: string; variant?: BadgeProps['variant'] }>
  actions?: ReactNode
}

export function PageHeader({
  eyebrow,
  title,
  description,
  badges = [],
  actions,
}: PageHeaderProps) {
  return (
    <section className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p> : null}

          {badges.length > 0 ? (
            <div className={cn('flex flex-wrap gap-2', eyebrow ? 'mt-2' : '')}>
              {badges.map((badge) => (
                <Badge key={`${badge.variant ?? 'outline'}:${badge.label}`} variant={badge.variant ?? 'outline'}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          ) : null}

          <h1 className={cn('text-3xl font-semibold tracking-tight', eyebrow || badges.length > 0 ? 'mt-3' : 'mt-0')}>
            {title}
          </h1>

          {description ? <p className="mt-2 text-sm text-muted-foreground sm:text-base">{description}</p> : null}
        </div>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </section>
  )
}

type SurfaceStateTone = 'neutral' | 'warning' | 'error' | 'loading' | 'empty'

type SurfaceStateProps = {
  title: string
  description?: string
  icon?: ComponentType<{ className?: string }>
  tone?: SurfaceStateTone
  className?: string
  action?: { label: string; onClick: () => void }
  busy?: boolean
}

export function SurfaceState({
  title,
  description,
  icon: Icon,
  tone = 'empty',
  className,
  action,
  busy = false,
}: SurfaceStateProps) {
  const resolvedTone: SurfaceStateTone = busy ? 'loading' : tone
  const ResolvedIcon = Icon ?? (resolvedTone === 'loading' ? Loader2 : resolvedTone === 'error' ? AlertCircle : Inbox)

  return (
    <div
      className={cn(
        'flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center',
        resolvedTone === 'error'
          ? 'border-destructive/25 bg-destructive/10 text-destructive'
          : resolvedTone === 'warning'
            ? 'border-primary/25 bg-primary/10 text-primary'
            : 'border-border/80 bg-background/40 text-muted-foreground',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-current/15 bg-current/5">
        <ResolvedIcon className={cn('h-5 w-5', resolvedTone === 'loading' && 'animate-spin')} />
      </div>

      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p> : null}

      {action ? (
        <Button type="button" variant="outline" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}

export function InlineMessage({
  message,
  children,
  tone = 'default',
  className,
}: {
  message?: string
  children?: ReactNode
  tone?: 'default' | 'error' | 'success' | 'info' | 'warning'
  className?: string
}) {
  const content = message ?? children

  const Icon =
    tone === 'error'
      ? AlertCircle
      : tone === 'success'
        ? CheckCircle2
        : tone === 'warning'
          ? AlertTriangle
          : RefreshCcw

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm',
        tone === 'error'
          ? 'border-destructive/25 bg-destructive/10 text-destructive'
          : tone === 'success'
            ? 'border-success/25 bg-success/10 text-success'
            : tone === 'warning'
              ? 'border-primary/25 bg-primary/10 text-primary'
              : 'border-border/80 bg-card/95 text-foreground',
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{content}</div>
    </div>
  )
}

export function FilterCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={cn('border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]', className)}>
      <CardHeader className="space-y-1 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}

export function ConnectionBadge({
  connected,
  label,
  status,
}: {
  connected: boolean
  label?: string
  status?: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'stale' | 'unauthorized' | 'failed'
}) {
  const resolvedStatus = status ?? (connected ? 'connected' : 'idle')
  return <LiveStateBadge state={resolvedStatus} prefix={label} />
}
