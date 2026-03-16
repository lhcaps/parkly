import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { InlineMessage } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, type SelectOption } from '@/components/ui/select'
import { getDefaultRouteForRole } from '@/app/routes'
import { useAuth } from '@/features/auth/auth-context'
import { getAuthPasswordPolicy } from '@/lib/api/auth'
import { getSafeLoginErrorMessage } from '@/lib/http/errors'
import type { AuthRole, PasswordPolicyDescriptor } from '@/lib/contracts/auth'

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'AUTO', label: 'Default role from backend', description: 'Uses the first role assigned to this account.', badge: 'auto', badgeVariant: 'neutral' },
  { value: 'ADMIN', label: 'ADMIN', description: 'System administration and high-level configuration.', badge: 'rbac', badgeVariant: 'warning' },
  { value: 'OPS', label: 'OPS', description: 'General operations, coordination, and monitoring.', badge: 'rbac', badgeVariant: 'success' },
  { value: 'GUARD', label: 'GUARD', description: 'Lane management and vehicle processing at the gate.', badge: 'rbac', badgeVariant: 'success' },
  { value: 'CASHIER', label: 'CASHIER', description: 'Fee collection and cashier tasks.', badge: 'rbac', badgeVariant: 'warning' },
  { value: 'WORKER', label: 'WORKER', description: 'Background tasks, sync, and system processing.', badge: 'rbac', badgeVariant: 'neutral' },
]

function isAuthRole(value: string): value is AuthRole {
  return value === 'ADMIN' || value === 'OPS' || value === 'GUARD' || value === 'CASHIER' || value === 'WORKER'
}

export function LoginPanel() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('AUTO')
  const [errorMessage, setErrorMessage] = useState('')
  const [policy, setPolicy] = useState<PasswordPolicyDescriptor | null>(null)

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: { pathname?: string; search?: string } } | null
    if (state?.from?.pathname) {
      return `${state.from.pathname}${state.from.search ?? ''}`
    }
    return getDefaultRouteForRole(auth.principal?.role)
  }, [auth.principal?.role, location.state])

  useEffect(() => {
    let active = true
    getAuthPasswordPolicy().then((value) => {
      if (active) setPolicy(value)
    }).catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate(redirectTo, { replace: true })
    }
  }, [auth.isAuthenticated, navigate, redirectTo])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    try {
      const principal = await auth.login({
        username: username.trim(),
        password,
        role: isAuthRole(role) ? role : null,
      })
      navigate(location.state ? redirectTo : getDefaultRouteForRole(principal.role), { replace: true })
    } catch (error) {
      setErrorMessage(getSafeLoginErrorMessage(error))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_380px]">
      <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Auth shell</Badge>
            <Badge variant="outline">session bootstrap</Badge>
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">Sign in to Parkly Console</CardTitle>
          <CardDescription>
            Web console uses one runtime source of truth for access token, refresh token, principal, route guards, and realtime shell state.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {auth.sessionNotice ? (
            <InlineMessage tone={auth.sessionNotice.tone}>
              <div>
                <p className="font-medium">{auth.sessionNotice.title}</p>
                <p className="mt-1">{auth.sessionNotice.message}</p>
              </div>
            </InlineMessage>
          ) : null}
          {errorMessage ? <InlineMessage tone="error">{errorMessage}</InlineMessage> : null}

          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="login-username">Username</Label>
              <Input id="login-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ops" autoComplete="username" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-role">Login role</Label>
              <Select value={role} onChange={setRole} options={ROLE_OPTIONS} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={auth.isBusy || !username.trim() || !password}>
                <LockKeyhole className="h-4 w-4" />
                {auth.isBusy ? 'Signing in…' : 'Sign in'}
              </Button>

              <Button type="button" variant="outline" onClick={() => navigate('/mobile-capture')}>
                Mobile capture
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Session policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The shell bootstraps through <code>/api/auth/me</code>. Access token refresh, route guards, and realtime all read from the same user session runtime.
            </p>
            {policy ? (
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Password policy</p>
                <p className="mt-2 text-foreground">{policy.description || 'No policy description returned from backend.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">min {policy.policy.minLength}</Badge>
                  {policy.policy.requireUppercase ? <Badge variant="outline">uppercase</Badge> : null}
                  {policy.policy.requireLowercase ? <Badge variant="outline">lowercase</Badge> : null}
                  {policy.policy.requireDigit ? <Badge variant="outline">digit</Badge> : null}
                  {policy.policy.requireSpecial ? <Badge variant="outline">special</Badge> : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <AlertCircle className="h-4 w-4 text-primary" />
              Access notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Settings only exposes diagnostics and default context. Manual token entry is not part of the normal login flow.</p>
            <p>Device-signed mobile requests are isolated from the user auth shell and must be debugged separately.</p>
            <Button asChild variant="ghost" className="px-0 text-primary hover:bg-transparent">
              <Link to="/settings">View diagnostics</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
