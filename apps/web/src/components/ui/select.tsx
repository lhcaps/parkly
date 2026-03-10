import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  description?: string
  badge?: string
  badgeVariant?: 'success' | 'warning' | 'error' | 'neutral'
  disabled?: boolean
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  size?: 'sm' | 'md'
  accentColor?: string
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className,
  size = 'md',
  accentColor,
}: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const badgeColor = {
    success: 'bg-success/15 text-success border-success/25',
    warning: 'bg-primary/15 text-primary border-primary/25',
    error: 'bg-destructive/15 text-destructive border-destructive/25',
    neutral: 'bg-muted text-muted-foreground border-border',
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'group flex w-full items-center justify-between gap-2 rounded-lg border bg-card/80 text-left backdrop-blur-sm transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          open
            ? 'border-primary/50 bg-card shadow-[0_0_0_1px_hsl(var(--primary)/0.15),0_4px_16px_hsl(var(--background)/0.8)]'
            : 'border-border hover:border-border/80 hover:bg-card',
          size === 'sm' ? 'h-8 px-2.5 py-1.5 text-xs' : 'h-10 px-3 py-2 text-sm',
        )}
        style={open && accentColor ? { borderColor: accentColor, boxShadow: `0 0 0 1px ${accentColor}30, 0 4px 16px hsl(var(--background)/0.8)` } : undefined}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected ? (
            <>
              <span className="truncate font-mono-data font-medium text-foreground">{selected.label}</span>
              {selected.description && (
                <span className="truncate text-[11px] text-muted-foreground">{selected.description}</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180 text-primary',
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            'absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-border/80',
            'bg-card/95 shadow-[0_8px_32px_hsl(var(--background)/0.9),0_2px_8px_hsl(var(--background)/0.6)] backdrop-blur-xl',
            'animate-in fade-in-0 zoom-in-95 duration-100',
          )}
        >
          <div className="max-h-56 overflow-y-auto p-1">
            {options.map((opt) => {
              const isActive = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors duration-100',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-accent',
                    opt.disabled && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className={cn('truncate font-mono-data text-sm font-medium', isActive && 'text-primary')}>
                      {opt.label}
                    </span>
                    {opt.description && (
                      <span className="mt-0.5 truncate text-[11px] text-muted-foreground">{opt.description}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {opt.badge && (
                      <span
                        className={cn(
                          'rounded-full border px-1.5 py-0.5 text-[10px] font-mono-data font-semibold uppercase tracking-wide',
                          badgeColor[opt.badgeVariant ?? 'neutral'],
                        )}
                      >
                        {opt.badge}
                      </span>
                    )}
                    {isActive && <Check className="h-3 w-3 text-primary" />}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** Thin wrapper matching the simple string-based interface in GateEventsMonitorPage */
export function SelectBox({
  value,
  onChange,
  children,
  className,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  // parse children (option elements) into SelectOption[]
  const options: SelectOption[] = React.Children.toArray(children)
    .filter((child): child is React.ReactElement<{ value: string; children?: React.ReactNode; disabled?: boolean }> =>
      React.isValidElement(child),
    )
    .map((child) => ({
      value: child.props.value ?? '',
      label: String(child.props.children ?? child.props.value ?? ''),
      disabled: child.props.disabled,
    }))

  return <Select value={value} onChange={onChange} options={options} className={className} />
}
