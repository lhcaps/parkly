import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConsoleCard, RetryActionBar } from '@/components/ops/console'
import { PageStateBlock } from '@/components/state/page-state'
import { useAuth } from '@/features/auth/auth-context'
import { getForbiddenFallbackPath, getRoutePolicy, getRoleHome } from '@/lib/auth/role-policy'
import { getRoleLabels } from '@/lib/auth/role-labels'

export function RequireAuthenticated({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'booting') {
    return <FullscreenState variant="loading" title="Loading secure workspace" description="Validating the current session, active principal, and the correct landing route for this console." />
  }

  if (auth.bootstrapError) {
    return (
      <FullscreenState
        variant="error"
        title="Session bootstrap failed"
        description={auth.bootstrapError || 'The shell could not verify the user context required to open this workspace.'}
        actions={(
          <RetryActionBar
            onRetry={() => void auth.reloadSession()}
            retryLabel="Retry bootstrap"
            secondaryAction={(
              <Button asChild variant="outline">
                <Link to="/login" state={{ from: location }}>
                  Back to sign in
                </Link>
              </Button>
            )}
          />
        )}
      />
    )
  }

  if (auth.status === 'forbidden') {
    return <Navigate to="/forbidden" replace state={{ from: location, requestedPath: location.pathname }} />
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}

export function RequireRouteRole({ routePath, children }: { routePath: string; children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  const requestedPath = routePath || location.pathname
  const fallbackPath = getForbiddenFallbackPath(auth.principal?.role, requestedPath)
  const routePolicy = getRoutePolicy(requestedPath)

  if (auth.status === 'forbidden') {
    return <Navigate to="/forbidden" replace state={{ from: location, requestedPath, fallbackPath, requiredRoles: routePolicy?.allowedRoles ?? [] }} />
  }

  if (auth.status !== 'authenticated' || !auth.principal) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!routePolicy) {
    return <>{children}</>
  }

  if (!routePolicy.allowedRoles?.includes(auth.principal.role)) {
    return <Navigate to="/forbidden" replace state={{ from: location, requestedPath, fallbackPath, requiredRoles: routePolicy.allowedRoles ?? [] }} />
  }

  return <>{children}</>
}

function FullscreenState({
  variant,
  title,
  description,
  actions,
}: {
  variant: 'loading' | 'error' | 'forbidden'
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <ConsoleCard>
          <PageStateBlock
            variant={variant}
            title={title}
            description={description}
            minHeightClassName="min-h-[320px]"
            hint={variant === 'error' ? 'Retry bootstrap first. If the problem repeats, sign in again and inspect auth/runtime connectivity.' : undefined}
          />
        </ConsoleCard>
        {actions}
      </div>
    </div>
  )
}

export function ForbiddenState() {
  const auth = useAuth()
  const location = useLocation()
  const state = location.state as {
    from?: { pathname?: string; search?: string }
    requestedPath?: string
    fallbackPath?: string
    requiredRoles?: string[]
  } | null

  const requestedPath = state?.requestedPath || state?.from?.pathname || location.pathname
  const requestedRoute = getRoutePolicy(requestedPath)
  const fallbackPath = state?.fallbackPath || getForbiddenFallbackPath(auth.principal?.role, requestedPath)
  const fallbackRoute = getRoutePolicy(fallbackPath)
  const homePath = getRoleHome(auth.principal?.role)
  const principalLabel = auth.principal?.principalType === 'USER' ? auth.principal.username : auth.principal?.actorLabel
  const siteScopeLabel = auth.principal?.principalType === 'USER' && auth.principal.siteScopes.length > 0
    ? auth.principal.siteScopes.map((scope) => scope.siteCode).join(', ')
    : 'All accessible sites'
  const roleLabels = getRoleLabels(auth.principal?.role)
  const requiredRoles = state?.requiredRoles ?? requestedRoute?.allowedRoles ?? []

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <ConsoleCard>
          <PageStateBlock
            variant="forbidden"
            title="Route blocked"
            description={roleLabels.forbiddenCopy}
            minHeightClassName="min-h-[220px]"
          />
        </ConsoleCard>

        <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Access context
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <div><span className="font-medium text-foreground">Session state:</span> {auth.status}</div>
              <div><span className="font-medium text-foreground">Actor:</span> {principalLabel || 'anonymous'}</div>
              <div><span className="font-medium text-foreground">Role:</span> {roleLabels.badgeLabel}</div>
              <div><span className="font-medium text-foreground">Site scope:</span> {siteScopeLabel}</div>
              <div><span className="font-medium text-foreground">Requested route:</span> {requestedRoute?.label ?? requestedPath}</div>
              <div><span className="font-medium text-foreground">Allowed roles:</span> {requiredRoles.length > 0 ? requiredRoles.join(', ') : 'Unrestricted'}</div>
              <div><span className="font-medium text-foreground">Suggested fallback:</span> {fallbackRoute?.label ?? fallbackPath}</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to={fallbackPath}>Go to allowed route</Link>
              </Button>
              {fallbackPath !== homePath ? (
                <Button asChild variant="outline">
                  <Link to={homePath}>Go to role home</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link to="/settings">Settings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
