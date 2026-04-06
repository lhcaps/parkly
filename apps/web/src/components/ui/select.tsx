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
  disabled?: boolean
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className,
  size = 'md',
  accentColor,
  disabled = false,
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
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev)
        }}
        className={cn(
          'group flex w-full items-center justify-between gap-3 rounded-xl border text-left backdrop-blur-sm transition-[background-color,border-color,color,box-shadow] duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          open
            ? 'border-primary/50 bg-card shadow-[0_0_0_1px_hsl(var(--primary)/0.14),0_10px_28px_hsl(var(--background)/0.85)]'
            : 'border-border/80 bg-card/80 hover:border-primary/25 hover:bg-card/95',
          size === 'sm' ? 'min-h-9 px-3 py-2 text-xs' : 'min-h-10 px-3.5 py-2.5 text-sm',
          disabled && 'cursor-not-allowed opacity-60',
        )}
        style={
          open && accentColor
            ? {
                borderColor: accentColor,
                boxShadow: `0 0 0 1px ${accentColor}30, 0 10px 28px hsl(var(--background)/0.85)`,
              }
            : undefined
        }
      >
        <span className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <span className="truncate font-mono-data text-sm font-semibold text-foreground">{selected.label}</span>
              {selected.description ? (
                <span className="mt-0.5 truncate text-[11px] text-muted-foreground">{selected.description}</span>
              ) : null}
            </>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {selected?.badge ? (
            <span
              className={cn(
                'rounded-full border px-1.5 py-0.5 text-[10px] font-mono-data font-semibold uppercase tracking-wide',
                badgeColor[selected.badgeVariant ?? 'neutral'],
              )}
            >
              {selected.badge}
            </span>
          ) : null}

          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180 text-primary',
            )}
          />
        </span>
      </button>

      {open ? (
        <div
          className={cn(
            'absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-2xl border border-border/80',
            'bg-card/95 shadow-[0_16px_40px_hsl(var(--background)/0.95),0_4px_12px_hsl(var(--background)/0.65)] backdrop-blur-xl',
            'animate-in fade-in-0 zoom-in-95 duration-100',
          )}
        >
          <div className="max-h-64 overflow-y-auto p-1.5">
            {options.map((opt) => {
              const isActive = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => {
                    if (opt.disabled) return
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-100',
                    isActive
                      ? 'bg-primary/14 text-primary'
                      : 'text-foreground hover:bg-accent/80',
                    opt.disabled && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className={cn('truncate font-mono-data text-sm font-semibold', isActive ? 'text-primary' : 'text-foreground')}>
                      {opt.label}
                    </span>
                    {opt.description ? (
                      <span className="mt-0.5 truncate text-[11px] text-muted-foreground">{opt.description}</span>
                    ) : null}
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    {opt.badge ? (
                      <span
                        className={cn(
                          'rounded-full border px-1.5 py-0.5 text-[10px] font-mono-data font-semibold uppercase tracking-wide',
                          badgeColor[opt.badgeVariant ?? 'neutral'],
                        )}
                      >
                        {opt.badge}
                      </span>
                    ) : null}
                    {isActive ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

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
