import * as React from 'react'
import { cn } from '@/lib/utils'

type TabsContextValue = { active: string; setActive: (v: string) => void }
const TabsContext = React.createContext<TabsContextValue>({ active: '', setActive: () => {} })

export function Tabs({ defaultValue, value, onValueChange, children, className }: {
  defaultValue?: string; value?: string; onValueChange?: (v: string) => void
  children: React.ReactNode; className?: string
}) {
  const [internal, setInternal] = React.useState(defaultValue || '')
  const active = value ?? internal
  const setActive = (v: string) => { setInternal(v); onValueChange?.(v) }
  return <TabsContext.Provider value={{ active, setActive }}><div className={className}>{children}</div></TabsContext.Provider>
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div role="tablist" className={cn('flex items-center gap-0.5 rounded-lg bg-muted p-1 border border-border', className)}>{children}</div>
}

export function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const { active, setActive } = React.useContext(TabsContext)
  const isActive = active === value
  return (
    <button role="tab" aria-selected={isActive} onClick={() => setActive(value)}
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground hover:bg-accent', className)}>
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const { active } = React.useContext(TabsContext)
  if (active !== value) return null
  return <div role="tabpanel" className={cn('animate-fade-in', className)}>{children}</div>
}
