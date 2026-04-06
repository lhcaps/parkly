import type { ComponentType } from 'react'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function EmptyStateBlock({
  title,
  description,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className,
}: {
  title: string
  description?: string
  icon?: ComponentType<{ className?: string }>
  actionLabel?: string
  onAction?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/45 px-6 py-10 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-card/95 text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button type="button" variant="outline" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
