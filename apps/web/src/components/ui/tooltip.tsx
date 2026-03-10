import * as React from 'react'
import { cn } from '@/lib/utils'
export function Tooltip({ children, content, side = 'top' }: { children: React.ReactNode; content: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  const [visible, setVisible] = React.useState(false)
  return (
    <div className="relative inline-flex" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div className={cn('absolute z-50 whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-mono-data text-foreground shadow-lg pointer-events-none',
          side === 'top' && 'bottom-full mb-1.5 left-1/2 -translate-x-1/2',
          side === 'bottom' && 'top-full mt-1.5 left-1/2 -translate-x-1/2',
          side === 'left' && 'right-full mr-1.5 top-1/2 -translate-y-1/2',
          side === 'right' && 'left-full ml-1.5 top-1/2 -translate-y-1/2')}>
          {content}
        </div>
      )}
    </div>
  )
}
