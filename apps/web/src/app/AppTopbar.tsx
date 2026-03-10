import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getRouteMeta } from '@/app/routes'

type AppTopbarProps = {
  onOpenSidebar: () => void
}

export function AppTopbar({ onOpenSidebar }: AppTopbarProps) {
  const location = useLocation()
  const current = getRouteMeta(location.pathname)

  return (
    <header className="sticky top-0 z-10 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-mono-data uppercase tracking-[0.16em] text-muted-foreground/70">
          <Button variant="ghost" size="icon" className="-ml-1 h-8 w-8 lg:hidden" onClick={onOpenSidebar} aria-label="Open navigation">
            <Menu className="h-4 w-4" />
          </Button>
          <Link to="/overview" className="hidden sm:inline-flex text-muted-foreground hover:text-foreground">
            Parkly
          </Link>
          <ChevronRight className="hidden h-3.5 w-3.5 sm:block" />
          <span>{current?.group ?? 'Console'}</span>
          {current ? (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="truncate text-foreground">{current.shortLabel}</span>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}
