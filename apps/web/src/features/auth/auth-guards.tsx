import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConsoleCard, RetryActionBar } from '@/components/ops/console'
import { PageStateBlock } from '@/components/state/page-state'
import { useAuth } from '@/features/auth/auth-context'
import { getForbiddenFallbackPath, getRoutePolicy, getRoleHome } from '@/lib/auth/role-policy'
import { translateRoleLabels } from '@/lib/auth/role-labels'

export function RequireAuthenticated({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'booting') {
    return (
      <FullscreenState
        variant="loading"
        title={t('auth.bootingTitle')}
        description={t('auth.bootingDesc')}
      />
    )
  }

  if (auth.bootstrapError) {
    return (
      <FullscreenState
        variant="error"
        title={t('auth.bootstrapFailedTitle')}
        description={auth.bootstrapError || t('auth.bootstrapFallbackDesc')}
        hint={t('auth.forbiddenHint')}
        actions={(
          <RetryActionBar
            onRetry={() => void auth.reloadSession()}
            retryLabel={t('auth.bootstrapRetry')}
            secondaryAction={(
              <Button asChild variant="outline">
                <Link to="/login" state={{ from: location }}>
                  {t('auth.backSignIn')}
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
  hint,
  actions,
}: {
  variant: 'loading' | 'error' | 'forbidden'
  title: string
  description: string
  hint?: string
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
            hint={hint}
          />
        </ConsoleCard>
        {actions}
      </div>
    </div>
  )
}

export function ForbiddenState() {
  const { t } = useTranslation()
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
    : t('auth.allSites')
  const roleLabels = translateRoleLabels(auth.principal?.role, t)
  const requiredRoles = state?.requiredRoles ?? requestedRoute?.allowedRoles ?? []

  const requestedRouteLabel = requestedRoute ? t(requestedRoute.label) : requestedPath
  const fallbackRouteLabel = fallbackRoute ? t(fallbackRoute.label) : fallbackPath

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <ConsoleCard>
          <PageStateBlock
            variant="forbidden"
            title={t('auth.routeBlockedTitle')}
            description={roleLabels.forbiddenCopy}
            minHeightClassName="min-h-[220px]"
          />
        </ConsoleCard>

        <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <ShieldAlert className="h-5 w-5 text-primary" />
              {t('auth.accessContext')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">{t('auth.sessionState')}</span>
                {' '}
                {auth.status}
              </div>
              <div>
                <span className="font-medium text-foreground">{t('auth.actor')}</span>
                {' '}
                {principalLabel || t('auth.anonymousActor')}
              </div>
              <div>
                <span className="font-medium text-foreground">{t('operator.role')}</span>
                {' '}
                {roleLabels.badgeLabel}
              </div>
              <div>
                <span className="font-medium text-foreground">{t('auth.siteScope')}</span>
                {' '}
                {siteScopeLabel}
              </div>
              <div>
                <span className="font-medium text-foreground">{t('auth.requestedRoute')}</span>
                {' '}
                {requestedRouteLabel}
              </div>
              <div>
                <span className="font-medium text-foreground">{t('auth.allowedRolesLabel')}</span>
                {' '}
                {requiredRoles.length > 0 ? requiredRoles.join(', ') : t('auth.unrestrictedRoles')}
              </div>
              <div>
                <span className="font-medium text-foreground">{t('auth.suggestedFallback')}</span>
                {' '}
                {fallbackRouteLabel}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to={fallbackPath}>{t('auth.goAllowedRoute')}</Link>
              </Button>
              {fallbackPath !== homePath ? (
                <Button asChild variant="outline">
                  <Link to={homePath}>{t('auth.goRoleHome')}</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link to="/settings">{t('auth.openSettings')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
