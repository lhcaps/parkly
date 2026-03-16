import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LockKeyhole, ShieldCheck, Zap } from 'lucide-react'
import { InlineMessage } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    return () => { active = false }
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
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">

      {/* ── Main login card ── */}
      <Card className="login-card-main border-border/60 bg-card/80 backdrop-blur-sm shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <CardHeader className="space-y-4 pb-6">
          {/* Session notice above form */}
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
              One session authenticates all routes, guards, and realtime connections.
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

            <div className="space-y-1.5">
              <Label htmlFor="login-role" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Login role
              </Label>
              <Select value={role} onChange={setRole} options={ROLE_OPTIONS} />
            </div>

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

      {/* ── Right column: compact info ── */}
      <div className="flex flex-col gap-4">

        {/* Session policy card */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-[0_16px_48px_rgba(0,0,0,0.22)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Session policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p>
              Shell bootstraps via <code className="font-mono-data text-[10px] text-foreground/70 bg-muted/60 px-1 py-0.5 rounded">/api/auth/me</code>. Token refresh, route guards, and realtime all share the same session runtime.
            </p>

            {policy ? (
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-2">
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

        {/* Access notes card */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-[0_16px_48px_rgba(0,0,0,0.22)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4 text-primary" />
              Access notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p>Settings only exposes diagnostics and default context. Manual token entry is not part of the normal login flow.</p>
            <p>Device-signed mobile requests are isolated from the user auth shell and must be debugged separately.</p>
            <Button
              asChild
              variant="ghost"
              className="h-auto p-0 text-xs text-primary hover:bg-transparent hover:text-primary/80"
            >
              <Link to="/settings">View diagnostics →</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Subtle status indicator */}
        <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          <span className="font-mono-data text-[10px] text-muted-foreground/60 uppercase tracking-[0.14em]">
            System operational
          </span>
        </div>
      </div>
    </div>
  )
}
