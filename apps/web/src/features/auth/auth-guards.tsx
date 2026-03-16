import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AlertCircle, ShieldAlert } from 'lucide-react'
import { getDefaultRouteForRole } from '@/app/routes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SurfaceState } from '@/components/ops/console'
import { useAuth } from '@/features/auth/auth-context'
import type { AuthRole } from '@/lib/contracts/auth'

export function RequireAuthenticated({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'booting') {
    return <FullscreenState title="Initialising session" description="Shell is validating the access tokenrefresh token, principal hiện tại và route landing phù hợp." loading />
  }

  if (auth.bootstrapError) {
    return (
      <FullscreenCard
        title="Session initialisation failed"
        description={auth.bootstrapError || 'The app could not verify the user context to open the console.'}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void auth.reloadSession()}>
              Retry
            </Button>
            <Button asChild variant="outline">
              <Link to="/login" state={{ from: location }}>
                Back to sign in
              </Link>
            </Button>
          </div>
        )}
      />
    )
  }

  if (auth.status === 'forbidden') {
    return <Navigate to="/forbidden" replace state={{ from: location }} />
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}

export function RequireRouteRole({ allowedRoles, children }: { allowedRoles?: AuthRole[]; children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  if (!allowedRoles || allowedRoles.length === 0) {
    return <>{children}</>
  }

  if (auth.status === 'forbidden') {
    return <Navigate to="/forbidden" replace state={{ from: location, allowedRoles }} />
  }

  if (auth.status !== 'authenticated' || !auth.principal) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!allowedRoles.includes(auth.principal.role)) {
    return <Navigate to="/forbidden" replace state={{ from: location, allowedRoles }} />
  }

  return <>{children}</>
}

function FullscreenState({ title, description, loading = false }: { title: string; description: string; loading?: boolean }) {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <SurfaceState title={title} description={description} tone={loading ? 'loading' : 'warning'} className="min-h-[320px] border-border/80 bg-card/95" />
      </div>
    </div>
  )
}

function FullscreenCard({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{description}</p>
            {actions}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function ForbiddenState() {
  const auth = useAuth()
  const homePath = getDefaultRouteForRole(auth.principal?.role)
  const principalLabel = auth.principal?.principalType === 'USER' ? auth.principal.username : auth.principal?.actorLabel
  const siteScopeLabel = auth.principal?.principalType === 'USER' && auth.principal.siteScopes.length > 0
    ? auth.principal.siteScopes.map((scope) => scope.siteCode).join(', ')
    : 'all sites'

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Route blocked
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Navigation hides this screen per RBAC. Direct URL access is also blocked to prevent inconsistent state.ạng thái nửa render rồi mới văng 403.
            </p>
            <div className="rounded-2xl border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <div><span className="font-medium text-foreground">Session state:</span> {auth.status}</div>
              <div><span className="font-medium text-foreground">Actor:</span> {principalLabel || 'anonymous'}</div>
              <div><span className="font-medium text-foreground">Site scope:</span> {siteScopeLabel}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to={homePath}>Go to home screen</Link>
              </Button>
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
