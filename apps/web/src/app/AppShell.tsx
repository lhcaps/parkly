import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppSidebar } from '@/app/AppSidebar'
import { AppTopbar } from '@/app/AppTopbar'

export function AppShell() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="app-shell-height flex bg-background text-foreground">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-0">
        <AppTopbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
