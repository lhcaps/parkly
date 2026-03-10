import React from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { AlertCircle, RefreshCcw, Settings } from 'lucide-react'
import { AppShell } from '@/app/AppShell'
import { LEGACY_ROUTE_REDIRECTS, SHELL_ROUTES, STANDALONE_ROUTES } from '@/app/routes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
                Không thể mở màn hình này
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Giao diện đã chặn lỗi ở cấp route để tránh trắng toàn bộ console. Bạn có thể quay về màn hình chính hoặc mở phần cài đặt để kiểm tra token và API.
              </p>

              <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
                {this.state.message || 'Unknown route error'}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/overview">Về overview</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/settings">
                    <Settings className="h-4 w-4" />
                    Mở settings
                  </Link>
                </Button>
                <Button type="button" variant="ghost" onClick={() => window.location.reload()}>
                  <RefreshCcw className="h-4 w-4" />
                  Tải lại ứng dụng
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
}

export function App() {
  return (
    <RouteErrorBoundary>
      <Routes>
        {STANDALONE_ROUTES.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}

        <Route element={<AppShell />}>
          {SHELL_ROUTES.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}

          {LEGACY_ROUTE_REDIRECTS.map((route) => (
            <Route key={route.from} path={route.from} element={<Navigate to={route.to} replace />} />
          ))}

          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Routes>
    </RouteErrorBoundary>
  )
}
