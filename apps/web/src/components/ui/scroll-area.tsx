import * as React from 'react'
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import { cn } from '@/lib/utils'

type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode
}

type ScrollBarProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: 'vertical' | 'horizontal'
}

const Root = ScrollAreaPrimitive.Root as unknown as React.ComponentType<any>
const Viewport = ScrollAreaPrimitive.Viewport as unknown as React.ComponentType<any>
const Corner = ScrollAreaPrimitive.Corner as unknown as React.ComponentType<any>
const Scrollbar = ScrollAreaPrimitive.ScrollAreaScrollbar as unknown as React.ComponentType<any>
const Thumb = ScrollAreaPrimitive.ScrollAreaThumb as unknown as React.ComponentType<any>

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(({ className, children, ...props }, ref) => (
  <Root ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
    <Viewport className="h-full w-full rounded-[inherit]">{children}</Viewport>
    <ScrollBar />
    <Corner />
  </Root>
))
ScrollArea.displayName = 'ScrollArea'

const ScrollBar = React.forwardRef<HTMLDivElement, ScrollBarProps>(({ className, orientation = 'vertical', ...props }, ref) => (
  <Scrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' && 'h-full w-1.5 border-l border-l-transparent p-px',
      orientation === 'horizontal' && 'h-1.5 flex-col border-t border-t-transparent p-px',
      className,
    )}
    {...props}
  >
    <Thumb className="relative flex-1 rounded-full bg-border" />
  </Scrollbar>
))
ScrollBar.displayName = 'ScrollBar'

export { ScrollArea, ScrollBar }
