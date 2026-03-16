import type { ReactNode } from 'react'
import { AlertCircle, RefreshCcw, ShieldAlert, WifiOff } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { DangerConfirmDialog } from '@/components/state/danger-confirm-dialog'
import { DegradedBanner } from '@/components/state/degraded-banner'
import { EmptyStateBlock } from '@/components/state/empty-state-block'
import { SurfaceState } from '@/components/ops/console'
import { toAppErrorDisplay, type AppErrorDisplay } from '@/lib/http/errors'
import { cn } from '@/lib/utils'

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
      actionLabel={onRetry ? retryLabel || 'Try again' : undefined}
      onAction={onRetry}
      className={className}
    >
      {children}
    </DegradedBanner>
  )
}

function formatBannerMeta(display: AppErrorDisplay) {
  return [display.status ? `status=${display.status}` : null, display.code ? `code=${display.code}` : null, display.requestId ? `requestId=${display.requestId}` : null]
    .filter(Boolean)
    .join(' · ')
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
    return <SurfaceState tone="loading" title={loadingTitle} description={loadingDescription} className={minHeightClassName} />
  }

  if (error) {
    const display = toAppErrorDisplay(error, errorTitle)
    const Icon = display.kind === 'forbidden' ? ShieldAlert : display.kind === 'dependencyDown' || display.kind === 'realtimeStale' ? WifiOff : AlertCircle
    return (
      <SurfaceState
        tone={display.tone === 'warning' ? 'warning' : 'error'}
        icon={Icon}
        title={display.title}
        description={`${display.message}${display.nextAction ? ` ${display.nextAction}` : ''}`.trim()}
        action={onRetry ? { label: 'Retry', onClick: onRetry } : undefined}
        className={cn('min-h-[220px]', minHeightClassName)}
      />
    )
  }

  if (empty) {
    return <EmptyStateBlock title={emptyTitle} description={emptyDescription} actionLabel={onRetry ? 'Reload' : undefined} onAction={onRetry} className={minHeightClassName} />
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
