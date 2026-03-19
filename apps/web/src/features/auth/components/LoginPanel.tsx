import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, LockKeyhole } from 'lucide-react'
import { InlineMessage } from '@/components/ops/console'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, type SelectOption } from '@/components/ui/select'
import { useAuth } from '@/features/auth/auth-context'
import { describeResolvedDestination, readRequestedRoute, resolvePostLoginRoute, type AuthRedirectState } from '@/features/auth/auth-redirect'
import { getApiBasePreview } from '@/lib/http/client'
import { getRoleHome } from '@/lib/auth/role-policy'
import { getSafeLoginErrorMessage } from '@/lib/http/errors'
import type { AuthRole } from '@/lib/contracts/auth'

function isAuthRole(value: string): value is AuthRole {
  return value === 'ADMIN' || value === 'OPS' || value === 'GUARD' || value === 'CASHIER' || value === 'WORKER'
}

export function LoginPanel() {
  const { t } = useTranslation()
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [compatibilityRole, setCompatibilityRole] = useState('AUTO')
  const [errorMessage, setErrorMessage] = useState('')

  const compatibilityOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'AUTO', label: t('login.roleAuto'), description: t('login.roleAutoDesc'), badge: 'default', badgeVariant: 'neutral' },
      { value: 'ADMIN', label: 'ADMIN', description: t('login.compatDemoDesc', { role: 'ADMIN' }), badge: 'compat', badgeVariant: 'warning' },
      { value: 'OPS', label: 'OPS', description: t('login.compatDemoDesc', { role: 'OPS' }), badge: 'compat', badgeVariant: 'success' },
      { value: 'GUARD', label: 'GUARD', description: t('login.compatDemoDesc', { role: 'GUARD' }), badge: 'compat', badgeVariant: 'success' },
      { value: 'CASHIER', label: 'CASHIER', description: t('login.compatDemoDesc', { role: 'CASHIER' }), badge: 'compat', badgeVariant: 'warning' },
      { value: 'WORKER', label: 'WORKER', description: t('login.compatDemoDesc', { role: 'WORKER' }), badge: 'compat', badgeVariant: 'neutral' },
    ],
    [t],
  )

  const redirectState = location.state as AuthRedirectState | null
  const requestedRoute = useMemo(() => readRequestedRoute(redirectState), [redirectState])
  const compatibilityRoleValue = isAuthRole(compatibilityRole) ? compatibilityRole : null
  const compatibilityLanding = compatibilityRoleValue ? getRoleHome(compatibilityRoleValue) : null

  const destinationLabel = useMemo(() => {
    if (auth.principal?.role) {
      return describeResolvedDestination({ role: auth.principal.role, state: redirectState })
    }
    if (requestedRoute) {
      return t('login.destIfAllowed', { href: requestedRoute.href })
    }
    if (compatibilityLanding) {
      return t('login.destCompatPath', { path: compatibilityLanding })
    }
    return t('login.destRoleHome')
  }, [auth.principal?.role, compatibilityLanding, redirectState, requestedRoute, t])

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

  const showBootstrapHint = auth.sessionNotice?.code === 'bootstrap-failure'

  return (
    <div className="w-full">
      <Card className="login-card-main relative overflow-hidden rounded-3xl border border-border/40 bg-card/85 shadow-[0_32px_100px_rgba(0,0,0,0.12)] ring-1 ring-border/30 backdrop-blur-xl dark:shadow-[0_32px_100px_rgba(0,0,0,0.42)]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-primary/[0.06] blur-3xl"
          aria-hidden
        />

        <CardHeader className="relative space-y-5 pb-2 pt-8 text-center sm:px-8 sm:pt-9">
          {auth.sessionNotice ? (
            <InlineMessage tone={auth.sessionNotice.tone}>
              <div className="text-left">
                <p className="font-medium">{auth.sessionNotice.title}</p>
                <p className="mt-1 text-sm leading-relaxed">{auth.sessionNotice.message}</p>
                {showBootstrapHint ? (
                  <p className="mt-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2 font-mono-data text-[10px] leading-snug text-muted-foreground">
                    <span className="text-muted-foreground/90">{t('login.bootstrapApiUsing')} </span>
                    <span className="break-all text-foreground/90">{getApiBasePreview()}</span>
                    <span className="mt-1 block text-muted-foreground/80">
                      {t('login.bootstrapTimeoutBody')}
                    </span>
                  </p>
                ) : null}
              </div>
            </InlineMessage>
          ) : null}

          <div className="space-y-3">
            <div className="flex justify-center">
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-mono-data text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
                {t('login.authBadge')}
              </span>
            </div>
            <CardTitle className="text-balance text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
              {t('login.title')}
            </CardTitle>
            <p className="mx-auto max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
              {t('login.subtitleLong')}
            </p>
          </div>
        </CardHeader>

        <CardContent className="relative space-y-6 px-6 pb-8 pt-2 sm:px-8">
          {errorMessage ? (
            <InlineMessage tone="error">{errorMessage}</InlineMessage>
          ) : null}

          <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
            <div className="login-input-wrap space-y-2">
              <Label htmlFor="login-username" className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {t('login.username')}
              </Label>
              <Input
                id="login-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="ops"
                autoComplete="username"
                className="h-12 rounded-xl border-border/50 bg-background/70 text-sm shadow-inner shadow-black/5 transition-[border-color,box-shadow] placeholder:text-muted-foreground/50 focus-visible:border-primary/40 focus-visible:ring-primary/20"
              />
            </div>

            <div className="login-input-wrap space-y-2">
              <Label htmlFor="login-password" className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {t('login.password')}
              </Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••••"
                autoComplete="current-password"
                className="h-12 rounded-xl border-border/50 bg-background/70 text-sm shadow-inner shadow-black/5 transition-[border-color,box-shadow] placeholder:text-muted-foreground/50 focus-visible:border-primary/40 focus-visible:ring-primary/20"
              />
            </div>

            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 px-4 py-3.5 text-left text-sm text-muted-foreground">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{t('login.sessionDest')}</p>
              <p className="mt-1.5 leading-relaxed">{destinationLabel}</p>
              {requestedRoute ? (
                <p className="mt-2 border-t border-border/40 pt-2 text-xs text-muted-foreground/85">
                  {t('login.requestedRouteLabel')}
                  {': '}
                  <span className="font-mono-data text-foreground/80">{requestedRoute.href}</span>
                </p>
              ) : null}
            </div>

            <details className="group rounded-2xl border border-border/50 bg-muted/10 transition-colors open:bg-muted/20">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                <span>{t('login.advancedOptions')}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90" aria-hidden />
              </summary>
              <div className="space-y-2 border-t border-border/40 px-4 pb-4 pt-3">
                <Label htmlFor="login-role" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {t('login.demoRoleOverride')}
                </Label>
                <Select value={compatibilityRole} onChange={setCompatibilityRole} options={compatibilityOptions} />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t('login.demoRoleHint')}
                </p>
              </div>
            </details>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="submit"
                disabled={auth.isBusy || !username.trim() || !password}
                className="h-12 w-full gap-2 rounded-xl text-base font-semibold shadow-lg sm:w-auto sm:min-w-[148px]"
                style={{
                  background: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  boxShadow: '0 8px 32px hsl(38 96% 56% / 0.22)',
                }}
              >
                <LockKeyhole className="h-4 w-4" />
                {auth.isBusy ? t('login.signingIn') : t('login.signIn')}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="h-12 w-full text-muted-foreground hover:bg-muted/30 hover:text-foreground sm:w-auto"
                onClick={() => navigate('/mobile-capture')}
              >
                {t('login.mobileCapture')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
