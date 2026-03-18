import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LockKeyhole, ShieldCheck, Zap } from 'lucide-react'
import { InlineMessage } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, type SelectOption } from '@/components/ui/select'
import { useAuth } from '@/features/auth/auth-context'
import { describeResolvedDestination, readRequestedRoute, resolvePostLoginRoute, type AuthRedirectState } from '@/features/auth/auth-redirect'
import { getAuthPasswordPolicy } from '@/lib/api/auth'
import { getRoleHome } from '@/lib/auth/role-policy'
import { getSafeLoginErrorMessage } from '@/lib/http/errors'
import type { AuthRole, PasswordPolicyDescriptor } from '@/lib/contracts/auth'

const COMPATIBILITY_ROLE_OPTIONS: SelectOption[] = [
  { value: 'AUTO', label: 'Use backend-assigned role', description: 'Default flow. The authenticated session decides the workspace.', badge: 'default', badgeVariant: 'neutral' },
  { value: 'ADMIN', label: 'ADMIN', description: 'Compatibility override for admin demo accounts only.', badge: 'compat', badgeVariant: 'warning' },
  { value: 'OPS', label: 'OPS', description: 'Compatibility override for operations demo accounts only.', badge: 'compat', badgeVariant: 'success' },
  { value: 'GUARD', label: 'GUARD', description: 'Compatibility override for guard demo accounts only.', badge: 'compat', badgeVariant: 'success' },
  { value: 'CASHIER', label: 'CASHIER', description: 'Compatibility override for cashier demo accounts only.', badge: 'compat', badgeVariant: 'warning' },
  { value: 'WORKER', label: 'WORKER', description: 'Compatibility override for worker demo accounts only.', badge: 'compat', badgeVariant: 'neutral' },
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
  const [compatibilityRole, setCompatibilityRole] = useState('AUTO')
  const [errorMessage, setErrorMessage] = useState('')
  const [policy, setPolicy] = useState<PasswordPolicyDescriptor | null>(null)

  const redirectState = location.state as AuthRedirectState | null
  const requestedRoute = useMemo(() => readRequestedRoute(redirectState), [redirectState])
  const compatibilityRoleValue = isAuthRole(compatibilityRole) ? compatibilityRole : null
  const compatibilityLanding = compatibilityRoleValue ? getRoleHome(compatibilityRoleValue) : null

  const destinationLabel = useMemo(() => {
    if (auth.principal?.role) {
      return describeResolvedDestination({ role: auth.principal.role, state: redirectState })
    }
    if (requestedRoute) {
      return `${requestedRoute.href} if the authenticated role is allowed; otherwise the role home workspace.`
    }
    if (compatibilityLanding) {
      return compatibilityLanding
    }
    return 'Role home from the authenticated session.'
  }, [auth.principal?.role, compatibilityLanding, redirectState, requestedRoute])

  useEffect(() => {
    let active = true
    getAuthPasswordPolicy().then((value) => {
      if (active) setPolicy(value)
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.principal) return
    navigate(resolvePostLoginRoute({ role: auth.principal.role, state: redirectState }), { replace: true })
  }, [auth.isAuthenticated, auth.principal, navigate, redirectState])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    try {
      const principal = await auth.login({
        username: username.trim(),
        password,
        role: compatibilityRoleValue,
      })
      navigate(resolvePostLoginRoute({ role: principal.role, state: redirectState }), { replace: true })
    } catch (error) {
      setErrorMessage(getSafeLoginErrorMessage(error))
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Card className="login-card-main border-border/60 bg-card/80 backdrop-blur-sm shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <CardHeader className="space-y-4 pb-6">
          {auth.sessionNotice ? (
            <InlineMessage tone={auth.sessionNotice.tone}>
              <div>
                <p className="font-medium">{auth.sessionNotice.title}</p>
                <p className="mt-1 text-sm">{auth.sessionNotice.message}</p>
              </div>
            </InlineMessage>
          ) : null}

          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <span className="font-mono-data text-[10px] uppercase tracking-[0.22em] text-primary/70">Auth</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Sign in to Parkly Console
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Role access comes from the authenticated backend principal. The login form does not grant permissions on its own.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {errorMessage ? (
            <div className="mb-5">
              <InlineMessage tone="error">{errorMessage}</InlineMessage>
            </div>
          ) : null}

          <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
            <div className="login-input-wrap space-y-1.5">
              <Label htmlFor="login-username" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Username
              </Label>
              <Input
                id="login-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="ops"
                autoComplete="username"
                className="h-11 border-border/60 bg-background/60 text-sm"
              />
            </div>

            <div className="login-input-wrap space-y-1.5">
              <Label htmlFor="login-password" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Password
              </Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••••"
                autoComplete="current-password"
                className="h-11 border-border/60 bg-background/60 text-sm"
              />
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Session destination</p>
              <p className="mt-1">{destinationLabel}</p>
              {requestedRoute ? (
                <p className="mt-2 text-xs text-muted-foreground/80">
                  Requested route: <span className="font-mono-data text-foreground/80">{requestedRoute.href}</span>
                </p>
              ) : null}
            </div>

            <details className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
                Advanced compatibility options
              </summary>
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="login-role" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Demo role override
                </Label>
                <Select value={compatibilityRole} onChange={setCompatibilityRole} options={COMPATIBILITY_ROLE_OPTIONS} />
                <p className="text-xs text-muted-foreground">
                  Use this only when the backend login API is still running in demo compatibility mode. Default production-style flow should stay on backend-assigned role.
                </p>
              </div>
            </details>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                type="submit"
                disabled={auth.isBusy || !username.trim() || !password}
                className="min-w-[120px] gap-2"
                style={{
                  background: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  boxShadow: '0 0 28px hsl(38 96% 56% / 0.25)',
                }}
              >
                <LockKeyhole className="h-4 w-4" />
                {auth.isBusy ? 'Signing in…' : 'Sign in'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/mobile-capture')}
              >
                Mobile capture
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-[0_16px_48px_rgba(0,0,0,0.22)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Session policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p>
              Shell bootstrap runs through <code className="rounded bg-muted/60 px-1 py-0.5 font-mono-data text-[10px] text-foreground/70">/api/auth/me</code>. Route guards, redirects, and realtime session handling all read the same authenticated principal.
            </p>

            {policy ? (
              <div className="space-y-2 rounded-xl border border-border/50 bg-muted/30 p-3">
                <p className="font-mono-data text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">
                  Password policy
                </p>
                <p className="text-foreground/80">{policy.description || 'No description returned.'}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="outline" className="text-[10px]">min {policy.policy.minLength}</Badge>
                  {policy.policy.requireUppercase && <Badge variant="outline" className="text-[10px]">uppercase</Badge>}
                  {policy.policy.requireLowercase && <Badge variant="outline" className="text-[10px]">lowercase</Badge>}
                  {policy.policy.requireDigit && <Badge variant="outline" className="text-[10px]">digit</Badge>}
                  {policy.policy.requireSpecial && <Badge variant="outline" className="text-[10px]">special</Badge>}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-[0_16px_48px_rgba(0,0,0,0.22)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4 text-primary" />
              Access notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p>
              Redirects after sign-in, logout, and session expiry use the same role-policy registry as the shell navigation.
            </p>
            <div className="space-y-2 rounded-xl border border-border/50 bg-muted/30 p-3">
              <p className="font-mono-data text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">Destination rules</p>
              <ul className="space-y-1.5">
                <li>• Return to the requested route only when the authenticated role is allowed to open it.</li>
                <li>• Otherwise redirect to the role home workspace.</li>
                <li>• Compatibility overrides are demo-only and should not be treated as the source of truth.</li>
              </ul>
            </div>
            <p>
              Need the mobile-only capture surface instead of the shell? Open{' '}
              <Link to="/mobile-capture" className="font-medium text-primary underline-offset-4 hover:underline">
                Mobile Capture
              </Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
