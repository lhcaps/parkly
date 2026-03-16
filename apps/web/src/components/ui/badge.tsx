import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-mono-data font-semibold tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-primary/15 text-primary border border-primary/20',
        secondary:   'bg-secondary text-secondary-foreground border border-border',
        destructive: 'bg-destructive/12 text-destructive border border-destructive/20',
        outline:     'border border-border text-foreground',
        entry:       'bg-success/12 text-success border border-success/20',
        exit:        'bg-destructive/12 text-destructive border border-destructive/20',
        amber:       'bg-primary/12 text-primary border border-primary/20',
        muted:       'bg-muted text-muted-foreground border border-border',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
