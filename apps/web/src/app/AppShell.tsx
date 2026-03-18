import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { AppSidebar } from '@/app/AppSidebar'
import { AppTopbar } from '@/app/AppTopbar'
import { Button } from '@/components/ui/button'
import { StateBanner } from '@/components/state/page-state'
import { useAuth } from '@/features/auth/auth-context'

export function AppShell() {
  const location = useLocation()
  const auth = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="app-shell-height flex bg-background text-foreground">
      <a href="#app-main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[120] focus:rounded-xl focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg">
        Skip to main content
      </a>
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-0">
        <AppTopbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main id="app-main-content" className="min-w-0 flex-1 overflow-y-auto" tabIndex={-1}>
          <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
            {auth.sessionNotice ? (
              <div className="mb-5">
                <div role="status" aria-live="polite">
                <StateBanner className="mb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{auth.sessionNotice.title}</p>
                      <p className="mt-1">{auth.sessionNotice.message}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="-mr-1 -mt-1 h-8 w-8" onClick={auth.clearSessionNotice} aria-label="Dismiss auth notice">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </StateBanner>
              </div>
              </div>
            ) : null}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
