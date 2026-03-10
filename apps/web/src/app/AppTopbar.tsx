import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Menu, Workflow } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
      <div className="mx-auto flex max-w-[1600px] items-start justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-mono-data uppercase tracking-[0.16em] text-muted-foreground/70">
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

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-[1.9rem]">{current?.label ?? 'Operations Console'}</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{current?.description ?? 'Shell v3 chuyển trọng tâm từ menu kỹ thuật sang luồng task của operator.'}</p>
            </div>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <Badge variant="secondary">route groups</Badge>
          <Badge variant="outline">legacy-safe</Badge>
          <Badge variant="outline" className="gap-1">
            <Workflow className="h-3 w-3" />
            IA v3
          </Badge>
        </div>
      </div>
    </header>
  )
}
