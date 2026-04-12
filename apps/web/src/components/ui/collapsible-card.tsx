import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type CountVariant = 'neutral' | 'amber' | 'success' | 'error' | 'destructive'

interface CollapsibleCardProps {
  title: string
  description?: string
  defaultOpen?: boolean
  className?: string
  contentClassName?: string
  icon?: ReactNode
  count?: number | string
  countVariant?: CountVariant
  headerBadge?: ReactNode
  headerAction?: ReactNode
  children?: ReactNode
  renderContent?: () => ReactNode
}

function countBadgeVariant(variant: CountVariant): 'muted' | 'amber' | 'entry' | 'destructive' {
  switch (variant) {
    case 'amber':
      return 'amber'
    case 'success':
      return 'entry'
    case 'error':
      return 'destructive'
    case 'destructive':
      return 'destructive'
    default:
      return 'muted'
  }
}

export function CollapsibleCard({
  title,
  description,
  defaultOpen = true,
  className,
  contentClassName,
  icon,
  count,
  countVariant = 'neutral',
  headerBadge,
  headerAction,
  children,
  renderContent,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex min-w-0 flex-1 items-start gap-3 rounded-xl p-1 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            {icon ? (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                {icon}
              </span>
            ) : null}

            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">{title}</CardTitle>
              {description ? <CardDescription className="mt-1 leading-relaxed">{description}</CardDescription> : null}
            </div>

            <span className="pt-1 text-muted-foreground">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          </button>

          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end" onClick={(event) => event.stopPropagation()}>
            {count !== undefined ? (
              <Badge variant={countBadgeVariant(countVariant)} className="text-[10px] font-mono-data">
                {count}
              </Badge>
            ) : null}
            {headerBadge}
            {headerAction}
          </div>
        </div>
      </CardHeader>

      {open ? (
        <CardContent className={cn('pt-0', contentClassName)}>
          {renderContent ? renderContent() : children}
        </CardContent>
      ) : null}
    </Card>
  )
}
