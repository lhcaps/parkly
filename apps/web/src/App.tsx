import React, { Suspense, useEffect } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AlertCircle, RefreshCcw, Settings } from 'lucide-react'
import { AppShell } from '@/app/AppShell'
import {
  getDefaultRouteForRole,
  LEGACY_ROUTE_REDIRECTS,
  preloadRoutesForPath,
  preloadRoutesForRole,
  SHELL_ROUTES,
  STANDALONE_ROUTES,
} from '@/app/routes'
import { SurfaceState } from '@/components/ops/console'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RequireAuthenticated, RequireRouteRole } from '@/features/auth/auth-guards'
import { useAuth } from '@/features/auth/auth-context'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { LoginPage } from '@/pages/LoginPage'

type ErrorBoundaryState = {
  hasError: boolean
  message: string
}

class RouteErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    }
  }

  componentDidCatch(error: unknown) {
    console.error('RouteErrorBoundary', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Unable to load this screen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                An error was caught at the route level. Return to the home screen or open settings. màn hình chính hoặc mở phần cài đặt để kiểm tra session và API.
              </p>

              <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
                {this.state.message || 'Unknown route error'}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/overview">Back to Overview</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/settings">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </Button>
                <Button type="button" variant="ghost" onClick={() => window.location.reload()}>
                  <RefreshCcw className="h-4 w-4" />
                  Reload app
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
}

function RouteLoadingState({ label }: { label: string }) {
  return (
    <div className="animate-fade-in">
      <SurfaceState
        title={`Loading ${label}`}
        description="Loading screen…"
        tone="loading"
        className="min-h-[340px] border-border/80 bg-card/95"
      />
    </div>
  )
}

function renderRouteElement(label: string, element: React.ReactNode) {
  return <Suspense fallback={<RouteLoadingState label={label} />}>{element}</Suspense>
}

function RoutePreloader() {
  const auth = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (auth.status !== 'authenticated') return
    const schedule = typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? window.requestIdleCallback.bind(window)
      : (cb: IdleRequestCallback) => window.setTimeout(() => cb({
          didTimeout: false,
          timeRemaining: () => 1,
        } as IdleDeadline), 180)

    const handle = schedule(() => {
      void preloadRoutesForRole(auth.principal?.role)
      void preloadRoutesForPath(location.pathname)
    })

    return () => {
      if (typeof handle === 'number') window.clearTimeout(handle)
      else if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) window.cancelIdleCallback(handle)
    }
  }, [auth.principal?.role, auth.status, location.pathname])

  return null
}

export function App() {
  const auth = useAuth()
  const homePath = getDefaultRouteForRole(auth.principal?.role)

  return (
    <RouteErrorBoundary>
      <RoutePreloader />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />

        {STANDALONE_ROUTES.map((route) => (
          <Route key={route.path} path={route.path} element={renderRouteElement(route.shortLabel, route.element)} />
        ))}

        <Route element={<RequireAuthenticated><AppShell /></RequireAuthenticated>}>
          <Route path="/" element={<Navigate to={homePath} replace />} />

          {SHELL_ROUTES.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={(
                <RequireRouteRole allowedRoles={route.allowedRoles}>
                  {renderRouteElement(route.shortLabel, route.element)}
                </RequireRouteRole>
              )}
            />
          ))}

          {LEGACY_ROUTE_REDIRECTS.map((route) => (
            <Route key={route.from} path={route.from} element={<Navigate to={route.to} replace />} />
          ))}

          <Route path="*" element={<Navigate to={homePath} replace />} />
        </Route>
      </Routes>
    </RouteErrorBoundary>
  )
}
