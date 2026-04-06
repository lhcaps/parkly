import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { ParkingSquare, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { APP_SHELL_NAV_GROUPS, getNavItemsByGroup } from '@/app/routes'
import { translateRoleLabels } from '@/lib/auth/role-labels'
import { useAuth } from '@/features/auth/auth-context'
import type { AppNavGroupKey } from '@/lib/auth/role-policy'

type AppSidebarProps = {
  open: boolean
  onClose: () => void
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const { t } = useTranslation()
  const auth = useAuth()
  const role = auth.principal?.role
  const roleLabels = translateRoleLabels(role, t)

  return (
      <aside
        className={cn(
          // Mobile: full-viewport overlay; desktop: sticky column
          'fixed inset-0 z-50 flex flex-col bg-card/97 shadow-[0_0_0_1px_rgba(15,23,42,0.06)] backdrop-blur-md dark:bg-[hsl(var(--card)/0.96)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]',
          'lg:relative lg:inset-auto lg:z-auto lg:max-h-none lg:w-[268px] lg:max-w-none lg:bg-transparent lg:shadow-none lg:backdrop-blur-none',
          'transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        aria-label={t('sidebar.mainNavAria')}
      >
        {/* Mobile-only header: brand + close */}
        <div className="flex items-center justify-between border-b border-border/75 bg-[linear-gradient(180deg,hsl(var(--primary)/0.16),transparent_88%)] px-4 py-3 lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_14px_30px_hsl(var(--primary)/0.28)]">
              <ParkingSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">{t('sidebar.brandTitle')}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
                {role
                  ? t('sidebar.brandSubtitleRole', { role: roleLabels.focusLabel })
                  : t('sidebar.brandSubtitleOps')}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="bg-background/60" onClick={onClose} aria-label={t('sidebar.closeNav')}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Desktop-only header: compact */}
        <div className="hidden items-center gap-2 border-b border-border/75 bg-[linear-gradient(180deg,hsl(var(--primary)/0.16),transparent_88%)] px-3 py-3 lg:flex">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_14px_30px_hsl(var(--primary)/0.28)]">
            <ParkingSquare className="h-4 w-4" />
          </div>
          <p className="truncate text-sm font-semibold tracking-tight">{t('sidebar.brandTitle')}</p>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-3 py-3">
          {APP_SHELL_NAV_GROUPS.map((group) => {
            const items = getNavItemsByGroup(group, role)
            if (items.length === 0) return null

            return (
              <section key={group} className="mb-4 last:mb-0">
                <div className="mb-1.5 px-2">
                  <p className="text-[10px] font-mono-data uppercase tracking-[0.22em] text-primary/55">
                    {t(`navGroup.${group as AppNavGroupKey}`)}
                  </p>
                </div>
                <div className="space-y-1">
                  {items.map(({ path, label, description, icon: Icon }) => (
                    <NavLink
                      key={path}
                      to={path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'border-primary/30 bg-[linear-gradient(135deg,hsl(var(--primary)/0.18),hsl(var(--accent)/0.48))] text-foreground shadow-[0_14px_30px_rgba(35,94,138,0.12)]'
                            : 'border-transparent text-muted-foreground hover:border-border/80 hover:bg-card/92 hover:text-foreground',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors',
                              isActive ? 'border-primary/25 bg-primary/15 text-primary' : 'border-border/60 bg-background/70 text-muted-foreground',
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">{t(label)}</p>
                              {isActive ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" /> : null}
                            </div>
                            {isActive ? (
                              <p className="truncate text-[11px] leading-4 text-muted-foreground/80">{t(description)}</p>
                            ) : null}
                          </div>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </aside>
  )
}
