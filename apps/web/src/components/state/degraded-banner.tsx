import type { ReactNode } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCcw, ShieldAlert, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'

type BannerTone = 'info' | 'warning' | 'error' | 'success'

function toneClasses(tone: BannerTone) {
  if (tone === 'success') return 'border-success/25 bg-success/10'
  if (tone === 'warning') return 'border-primary/25 bg-primary/10'
  if (tone === 'error') return 'border-destructive/25 bg-destructive/10'
  return 'border-border/80 bg-card/95'
}

function toneIcon(tone: BannerTone) {
  if (tone === 'success') return CheckCircle2
  if (tone === 'warning') return AlertTriangle
  if (tone === 'error') return WifiOff
  return ShieldAlert
}

export function DegradedBanner({
  title,
  description,
  tone = 'warning',
  meta,
  actionLabel,
  onAction,
  className,
  children,
}: {
  title: string
  description: string
  tone?: BannerTone
  meta?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
  children?: ReactNode
}) {
  const Icon = toneIcon(tone)

  return (
    <div className={cn('rounded-2xl border px-4 py-4', toneClasses(tone), className)} role={tone === 'error' ? 'alert' : 'status'}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-current/10 bg-background/55">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <StatusBadge tone={tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : tone === 'error' ? 'error' : 'info'} label={tone === 'success' ? 'Healthy' : tone === 'warning' ? 'Degraded' : tone === 'error' ? 'Action needed' : 'Info'} icon={false} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            {meta ? <p className="mt-2 text-xs font-mono-data text-muted-foreground/80">{meta}</p> : null}
            {children ? <div className="mt-3">{children}</div> : null}
          </div>
        </div>

        {actionLabel && onAction ? (
          <Button type="button" size="sm" variant="outline" onClick={onAction} className="shrink-0">
            {tone === 'success' ? <ArrowRight className="h-4 w-4" /> : <RefreshCcw className="h-4 w-4" />}
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
