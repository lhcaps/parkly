import { NavLink } from 'react-router-dom'
import { ParkingSquare, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { APP_SHELL_NAV_GROUPS, getNavItemsByGroup } from '@/app/routes'
import { getRoleLabels } from '@/lib/auth/role-labels'
import { useAuth } from '@/features/auth/auth-context'

type AppSidebarProps = {
  open: boolean
  onClose: () => void
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const auth = useAuth()
  const role = auth.principal?.role
  const roleLabels = getRoleLabels(role)

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-background/75 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[292px] max-w-[86vw] flex-col border-r border-border/80 bg-card/95 shadow-2xl transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-20 lg:h-[100dvh] lg:w-[280px] lg:max-w-none lg:translate-x-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/90 text-primary-foreground shadow-[0_0_22px_hsl(var(--primary)/0.22)]">
              <ParkingSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Parkly Console</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{role ? `${roleLabels.focusLabel} · canonical workspace` : 'Operations · Review · Sync · Audit'}</p>
            </div>
          </div>

          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose} aria-label="Close navigation">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
          {APP_SHELL_NAV_GROUPS.map((group) => {
            const items = getNavItemsByGroup(group, role)
            if (items.length === 0) return null

            return (
              <section key={group} className="mb-5 last:mb-0">
                <div className="mb-2 px-3">
                  <p className="text-[10px] font-mono-data uppercase tracking-[0.2em] text-muted-foreground/70">{group}</p>
                </div>
                <div className="space-y-1">
                  {items.map(({ path, label, description, icon: Icon }) => (
                    <NavLink
                      key={path}
                      to={path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'group block rounded-2xl border px-3 py-3 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'border-primary/30 bg-primary/10 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.08)]'
                            : 'border-transparent text-muted-foreground hover:border-border/80 hover:bg-accent/70 hover:text-foreground',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <div className="flex gap-3">
                          <div
                            className={cn(
                              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
                              isActive ? 'border-primary/30 bg-primary/15 text-primary' : 'border-border/60 bg-background/60 text-muted-foreground',
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{label}</p>
                            <p className="mt-1 text-[11px] leading-4 text-muted-foreground/80">{description}</p>
                          </div>
                        </div>
                      )}
                    </NavLink>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </aside>
    </>
  )
}
