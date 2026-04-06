import { useState, useEffect, useRef, type ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Count-up Hook ───────────────────────────────────────
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  const prevTarget = useRef(target)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (target === prevTarget.current && value === target) return
    const start = prevTarget.current
    prevTarget.current = target
    const startTime = performance.now()

    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - (1 - progress) ** 3
      const current = Math.round(start + (target - start) * eased)
      setValue(current)
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return value
}

// ─── KpiCard ─────────────────────────────────────────────

export function KpiCard({
  title,
  value,
  helper,
  badge,
  icon: Icon,
  tone = 'default',
  loading = false,
}: {
  title: string
  value: string
  helper: string
  badge?: string
  icon: ComponentType<{ className?: string }>
  tone?: 'default' | 'success' | 'warning' | 'danger'
  loading?: boolean
}) {
  const toneClass =
    tone === 'success'
      ? 'border-success/20 bg-success/5'
      : tone === 'warning'
        ? 'border-primary/20 bg-primary/5'
        : tone === 'danger'
          ? 'border-destructive/20 bg-destructive/5'
          : 'border-border/80 bg-card/90'

  const iconBgClass =
    tone === 'success'
      ? 'border-success/20 bg-success/10 text-success'
      : tone === 'warning'
        ? 'border-primary/20 bg-primary/10 text-primary'
        : tone === 'danger'
          ? 'border-destructive/20 bg-destructive/10 text-destructive'
          : 'border-primary/20 bg-primary/10 text-primary'

  // Count-up for numeric values
  const numericValue = Number.parseFloat(value)
  const isNumeric = !loading && !Number.isNaN(numericValue) && Number.isFinite(numericValue)
  const animatedValue = useCountUp(isNumeric ? numericValue : 0)

  // Format: preserve suffix (%, etc.)
  const displayValue = loading
    ? null
    : isNumeric
      ? value.includes('%')
        ? `${animatedValue.toFixed(1)}%`
        : value.includes('.')
          ? animatedValue.toFixed(1)
          : String(animatedValue)
      : value

  if (loading) {
    return (
      <Card className={cn('h-full shadow-[0_18px_56px_rgba(35,94,138,0.1)]', toneClass)}>
        <CardContent className="flex h-full items-start gap-4 pt-5">
          <div className={cn('mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', iconBgClass)}>
            <Icon className="h-5 w-5 opacity-40" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-40" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('group h-full shadow-[0_18px_56px_rgba(35,94,138,0.1)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_72px_rgba(35,94,138,0.16)]', toneClass)}>
      <CardContent className="flex h-full items-start gap-4 pt-5">
        <div className={cn('mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-white/45 transition-transform duration-300 group-hover:scale-105 dark:bg-transparent', iconBgClass)}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
            {badge ? <Badge variant="outline">{badge}</Badge> : null}
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{displayValue}</p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{helper}</p>
        </div>
      </CardContent>
    </Card>
  )
}
