import * as React from 'react'
import { cn } from '@/lib/utils'
export function Progress({ value = 0, className, barClassName }: { value?: number; className?: string; barClassName?: string }) {
  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div className={cn('h-full rounded-full bg-primary transition-all duration-500 ease-out', barClassName)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}
