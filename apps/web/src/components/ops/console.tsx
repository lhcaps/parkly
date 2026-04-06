import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
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
    <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-[0_24px_70px_rgba(35,94,138,0.14)] sm:p-6">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
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
  meta?: ReactNode
}

export function SurfaceState({
  title,
  description,
  icon: Icon,
  tone = 'empty',
  className,
  action,
  busy = false,
  meta,
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
            : 'border-border/70 bg-background/50 text-muted-foreground',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-current/15 bg-current/5">
        <ResolvedIcon className={cn('h-5 w-5', resolvedTone === 'loading' && 'animate-spin')} />
      </div>

      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p> : null}
      {meta ? <div className="mt-3 w-full max-w-xl">{meta}</div> : null}

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

export function ConsoleCard({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={cn('border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.12)]', className)}>
      <CardContent className={cn('pt-6', contentClassName)}>{children}</CardContent>
    </Card>
  )
}

function StateMeta({ requestId, hint }: { requestId?: string; hint?: string }) {
  const { t } = useTranslation()
  if (!requestId && !hint) return null

  return (
    <div className="space-y-1 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-left text-xs text-muted-foreground">
      {requestId ? <div><span className="font-medium text-foreground">{t('common.requestId')}:</span> <span className="font-mono-data">{requestId}</span></div> : null}
      {hint ? <div><span className="font-medium text-foreground">{t('common.hint')}:</span> {hint}</div> : null}
    </div>
  )
}

export function RetryActionBar({
  onRetry,
  retryLabel,
  secondaryAction,
  className,
}: {
  onRetry?: () => void
  retryLabel?: string
  secondaryAction?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  if (!onRetry && !secondaryAction) return null

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2', className)}>
      {secondaryAction}
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          <RefreshCcw className="h-4 w-4" />
          {retryLabel ?? t('common.retry')}
        </Button>
      ) : null}
    </div>
  )
}

export function EmptySelectionCard({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}) {
  return (
    <ConsoleCard className={className}>
      <SurfaceState title={title} description={description} tone="empty" action={action} className="min-h-[220px]" />
    </ConsoleCard>
  )
}

export function DependencyDownCard({
  title,
  description,
  requestId,
  hint,
  onRetry,
  className,
}: {
  title: string
  description: string
  requestId?: string
  hint?: string
  onRetry?: () => void
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <ConsoleCard className={className}>
      <SurfaceState
        title={title}
        description={description}
        tone="error"
        meta={<StateMeta requestId={requestId} hint={hint} />}
        action={onRetry ? { label: t('common.retry'), onClick: onRetry } : undefined}
        className="min-h-[220px]"
      />
    </ConsoleCard>
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
