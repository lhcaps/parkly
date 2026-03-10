import * as React from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { cn } from '@/lib/utils'

type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  decorative?: boolean
  orientation?: 'horizontal' | 'vertical'
}

const Root = SeparatorPrimitive.Root as unknown as React.ComponentType<any>

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
    <Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  ),
)
Separator.displayName = 'Separator'

export { Separator }
