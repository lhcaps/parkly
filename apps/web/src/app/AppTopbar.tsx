import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDefaultRouteForRole, getRouteMeta } from '@/app/routes'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

type AppTopbarProps = {
  onOpenSidebar: () => void
}

const ROLE_FOCUS_LABEL: Record<string, string> = {
  ADMIN: 'System oversight',
  OPS: 'Operations control',
  GUARD: 'Lane decisions',
  CASHIER: 'Payment follow-up',
  WORKER: 'Monitoring watch',
}

// Tone → small dot color
const SESSION_DOT: Record<string, string> = {
  booting:       'bg-primary/60',
  authenticated: 'bg-success',
  expired:       'bg-amber-400',
  forbidden:     'bg-destructive',
  anonymous:     'bg-muted-foreground/40',
}

export function AppTopbar({ onOpenSidebar }: AppTopbarProps) {
  const location = useLocation()
  const current = getRouteMeta(location.pathname)
  const auth = useAuth()
  const principal = auth.principal
  const homePath = getDefaultRouteForRole(principal?.role)

  const siteScopeLabel =
    principal?.principalType === 'USER' && principal.siteScopes.length > 0
      ? principal.siteScopes.map((s) => s.siteCode).join(', ')
      : 'All accessible sites'

  const dotClass = SESSION_DOT[auth.status] ?? SESSION_DOT.anonymous
  const displayName =
    principal
      ? principal.principalType === 'USER'
        ? principal.username
        : principal.actorLabel
      : null

  return (
    <header className="sticky top-0 z-10 border-b border-border/80 bg-background/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-0 sm:px-6 lg:px-8" style={{ height: '52px' }}>

        {/* ── Left: breadcrumb + context line ── */}
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-1 h-8 w-8 shrink-0 lg:hidden"
            onClick={onOpenSidebar}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="min-w-0">
            {/* breadcrumb */}
            <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-mono-data uppercase tracking-[0.16em] text-muted-foreground/60">
              <Link
                to={homePath}
                className="hidden shrink-0 transition-colors hover:text-foreground sm:block"
              >
                Parkly
              </Link>
              <ChevronRight className="hidden h-3 w-3 shrink-0 sm:block" />
              <span className="shrink-0">{current?.group ?? 'Console'}</span>
              {current ? (
                <>
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <span className="truncate font-semibold text-foreground/80">{current.shortLabel}</span>
                </>
              ) : null}
            </div>

            {/* context line */}
            {principal ? (
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {ROLE_FOCUS_LABEL[principal.role] ?? 'Console'}&ensp;·&ensp;{siteScopeLabel}
              </p>
            ) : null}
          </div>
        </div>

        {/* ── Right: session dot · user · sign out ── */}
        <div className="flex shrink-0 items-center gap-3">
          {/* session status dot + user pill */}
          {displayName ? (
            <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-3 py-1.5">
              <span
                className={cn('h-1.5 w-1.5 rounded-full', dotClass)}
                aria-hidden="true"
              />
              <span className="text-[12px] font-medium text-foreground leading-none">
                {displayName}
              </span>
              <span className="text-[10px] font-mono-data text-muted-foreground/70 leading-none">
                {principal?.role}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} aria-hidden="true" />
              <span className="text-[11px] text-muted-foreground">
                {auth.status === 'booting' ? 'Initialising…' : 'Signed out'}
              </span>
            </div>
          )}

          {/* sign out */}
          {principal ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => void auth.logout()}
              disabled={auth.isBusy || auth.isLoggingOut}
              aria-label="Sign out of current session"
            >
              <LogOut className="h-3.5 w-3.5" />
              {auth.isLoggingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          ) : null}
        </div>

      </div>
    </header>
  )
}
