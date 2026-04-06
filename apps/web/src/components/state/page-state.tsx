import type { ReactNode } from 'react'
import { AlertCircle, ShieldAlert, WifiOff } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { DangerConfirmDialog } from '@/components/state/danger-confirm-dialog'
import { DegradedBanner } from '@/components/state/degraded-banner'
import { EmptyStateBlock } from '@/components/state/empty-state-block'
import { SurfaceState } from '@/components/ops/console'
import { toAppErrorDisplay, type AppErrorDisplay } from '@/lib/http/errors'
import { cn } from '@/lib/utils'

export type PageStateVariant = 'loading' | 'ready' | 'empty' | 'degraded' | 'forbidden' | 'error'

function StateMeta({ requestId, hint }: { requestId?: string; hint?: string }) {
  if (!requestId && !hint) return null

  return (
    <div className="space-y-1 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-left text-xs text-muted-foreground">
      {requestId ? <div><span className="font-medium text-foreground">requestId:</span> <span className="font-mono-data">{requestId}</span></div> : null}
      {hint ? <div><span className="font-medium text-foreground">hint:</span> {hint}</div> : null}
    </div>
  )
}

function resolveVariant(error: unknown, fallback: Exclude<PageStateVariant, 'ready' | 'loading' | 'empty'> = 'error') {
  const display = toAppErrorDisplay(error)
  if (display.kind === 'forbidden') return 'forbidden' as const
  if (display.kind === 'dependencyDown' || display.kind === 'realtimeStale') return 'degraded' as const
  return fallback
}

export function PageStateBlock({
  variant,
  title,
  description,
  error,
  requestId,
  hint,
  onRetry,
  retryLabel,
  className,
  minHeightClassName = 'min-h-[220px]',
}: {
  variant: Exclude<PageStateVariant, 'ready'>
  title: string
  description?: string
  error?: unknown
  requestId?: string
  hint?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
  minHeightClassName?: string
}) {
  const display = error ? toAppErrorDisplay(error, title) : null
  const resolvedTitle = display?.title ?? title
  const resolvedDescription = description ?? (display ? `${display.message}${display.nextAction ? ` ${display.nextAction}` : ''}`.trim() : '')
  const resolvedRequestId = requestId ?? display?.requestId

  if (variant === 'loading') {
    return <SurfaceState title={resolvedTitle} description={resolvedDescription} tone="loading" className={cn(minHeightClassName, className)} />
  }

  if (variant === 'empty') {
    return (
      <EmptyStateBlock
        title={resolvedTitle}
        description={resolvedDescription}
        actionLabel={onRetry ? retryLabel || 'Reload' : undefined}
        onAction={onRetry}
        className={cn(minHeightClassName, className)}
      />
    )
  }

  if (variant === 'degraded') {
    return (
      <DegradedBanner
        title={resolvedTitle}
        description={resolvedDescription}
        tone={display?.tone === 'warning' ? 'warning' : 'error'}
        requestId={resolvedRequestId}
        hint={hint}
        actionLabel={onRetry ? retryLabel || 'Retry' : undefined}
        onAction={onRetry}
        className={cn(className)}
      />
    )
  }

  const tone = variant === 'forbidden' ? 'warning' : 'error'
  const Icon = variant === 'forbidden' ? ShieldAlert : variant === 'error' ? AlertCircle : WifiOff

  return (
    <SurfaceState
      title={resolvedTitle}
      description={resolvedDescription}
      tone={tone}
      icon={Icon}
      meta={<StateMeta requestId={resolvedRequestId} hint={hint} />}
      action={onRetry ? { label: retryLabel || 'Retry', onClick: onRetry } : undefined}
      className={cn(minHeightClassName, className)}
    />
  )
}

export function StateBanner({
  error,
  title,
  onRetry,
  retryLabel,
  className,
  children,
}: {
  error?: unknown
  title?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
  children?: ReactNode
}) {
  if (!error && !children) return null
  const display = error ? toAppErrorDisplay(error, title) : null

  if (!display) {
    return <div className={className}>{children}</div>
  }

  const tone = display.tone === 'warning' ? 'warning' : display.tone === 'info' ? 'info' : 'error'

  return (
    <DegradedBanner
      title={display.title}
      description={`${display.message}${display.nextAction ? ` ${display.nextAction}` : ''}`.trim()}
      tone={tone === 'info' ? 'info' : tone}
      meta={formatBannerMeta(display)}
      requestId={display.requestId}
      actionLabel={onRetry ? retryLabel || 'Try again' : undefined}
      onAction={onRetry}
      className={className}
    >
      {children}
    </DegradedBanner>
  )
}

function formatBannerMeta(display: AppErrorDisplay) {
  return [display.status ? `status=${display.status}` : null, display.code ? `code=${display.code}` : null].filter(Boolean).join(' · ')
}

export function PageStateRenderer({
  loading,
  error,
  empty,
  loadingTitle = 'Loading data',
  loadingDescription,
  errorTitle = 'Unable to load screen data',
  emptyTitle = 'No data',
  emptyDescription,
  onRetry,
  minHeightClassName = 'min-h-[240px]',
  children,
}: {
  loading?: boolean
  error?: unknown
  empty?: boolean
  loadingTitle?: string
  loadingDescription?: string
  errorTitle?: string
  emptyTitle?: string
  emptyDescription?: string
  onRetry?: () => void
  minHeightClassName?: string
  children: ReactNode
}) {
  if (loading) {
    return <PageStateBlock variant="loading" title={loadingTitle} description={loadingDescription} minHeightClassName={minHeightClassName} />
  }

  if (error) {
    return (
      <PageStateBlock
        variant={resolveVariant(error)}
        title={errorTitle}
        error={error}
        onRetry={onRetry}
        minHeightClassName={cn('min-h-[220px]', minHeightClassName)}
      />
    )
  }

  if (empty) {
    return <PageStateBlock variant="empty" title={emptyTitle} description={emptyDescription} onRetry={onRetry} minHeightClassName={minHeightClassName} />
  }

  return <>{children}</>
}

export function ConfirmActionButton({
  confirmTitle,
  confirmDescription,
  onConfirm,
  children,
  ...props
}: ButtonProps & {
  confirmTitle: string
  confirmDescription?: string
  onConfirm: () => void | Promise<void>
}) {
  return (
    <DangerConfirmDialog
      title={confirmTitle}
      description={confirmDescription}
      confirmLabel={typeof children === 'string' ? children : 'Confirm'}
      onConfirm={onConfirm}
      disabled={props.disabled}
      trigger={(triggerProps) => (
        <Button type="button" {...props} {...triggerProps}>
          {children}
        </Button>
      )}
    />
  )
}
