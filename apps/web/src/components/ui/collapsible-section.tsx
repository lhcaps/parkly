import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  title: string
  description?: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
  count?: number
  countVariant?: 'neutral' | 'amber' | 'success' | 'error' | 'destructive'
  headerAction?: React.ReactNode
}

function countBadgeVariant(
  variant: 'neutral' | 'amber' | 'success' | 'error' | 'destructive',
): 'muted' | 'amber' | 'entry' | 'secondary' | 'destructive' {
  switch (variant) {
    case 'amber': return 'amber'
    case 'success': return 'entry'
    case 'error': return 'destructive'
    case 'destructive': return 'destructive'
    default: return 'muted'
  }
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = true,
  children,
  className,
  count,
  countVariant = 'neutral',
  headerAction,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={cn('rounded-2xl border border-border/70 bg-card/80', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/25"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{title}</span>
          {count !== undefined ? (
            <Badge variant={countBadgeVariant(countVariant)} className="shrink-0 text-[10px]">
              {count}
            </Badge>
          ) : null}
          {description ? (
            <span className="hidden text-[11px] text-muted-foreground lg:block truncate">{description}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerAction}
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3">
          {children}
        </div>
      )}
    </div>
  )
}
