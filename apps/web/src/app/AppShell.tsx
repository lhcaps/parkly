import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { AppSidebar } from '@/app/AppSidebar'
import { AppTopbar } from '@/app/AppTopbar'
import { Button } from '@/components/ui/button'
import { StateBanner } from '@/components/state/page-state'
import { useAuth } from '@/features/auth/auth-context'

export function AppShell() {
  const { t } = useTranslation()
  const location = useLocation()
  const auth = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="app-shell-height app-shell-backdrop relative flex overflow-hidden bg-background text-foreground">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-background/72 backdrop-blur-sm transition-opacity duration-200 lg:hidden"
          aria-label={t('sidebar.closeNav')}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[-5rem] top-20 h-80 w-80 rounded-full bg-sky-200/35 blur-3xl dark:bg-primary/10" />
        <div className="absolute bottom-[-5rem] left-[22%] h-72 w-72 rounded-full bg-cyan-100/60 blur-3xl" />
        <div className="absolute inset-0 bg-grid opacity-[0.14]" />
      </div>
      <a href="#app-main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[120] focus:rounded-xl focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg">
        {t('common.skipToMainContent')}
      </a>
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col lg:pl-0">
        <AppTopbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main id="app-main-content" className="min-w-0 flex-1 overflow-y-auto" tabIndex={-1}>
          <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            {auth.sessionNotice ? (
              <div className="mb-5" role="status" aria-live="polite">
                <StateBanner className="mb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{auth.sessionNotice.title}</p>
                      <p className="mt-1">{auth.sessionNotice.message}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="-mr-1 -mt-1 h-8 w-8" onClick={auth.clearSessionNotice} aria-label={t('common.dismissNotice')}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </StateBanner>
              </div>
            ) : null}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
