import { AlertCircle, AlertTriangle, CheckCircle2, Dot, Info, Radio, WifiOff } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'live' | 'stale'

const STATUS_VARIANT: Record<StatusTone, NonNullable<BadgeProps['variant']>> = {
  neutral: 'outline',
  info: 'secondary',
  success: 'entry',
  warning: 'amber',
  error: 'destructive',
  live: 'entry',
  stale: 'amber',
}

const STATUS_ICON = {
  neutral: Dot,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  live: Radio,
  stale: WifiOff,
} satisfies Record<StatusTone, typeof Dot>

export function StatusBadge({
  tone = 'neutral',
  label,
  className,
  icon = true,
}: {
  tone?: StatusTone
  label: string
  className?: string
  icon?: boolean
}) {
  const Icon = STATUS_ICON[tone]

  return (
    <Badge variant={STATUS_VARIANT[tone]} className={cn('gap-1.5', className)}>
      {icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      <span>{label}</span>
    </Badge>
  )
}
