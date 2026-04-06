import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { ApiHealthCard } from '@/features/settings/components/ApiHealthCard'
import type { DefaultContextPrefs } from '@/lib/api'
import type { AuthPrincipal } from '@/lib/contracts/auth'

export function OperatorSetupTab({
  principal,
  prefs,
  message,
  authBusy,
  onLogout,
  onPrefsChange,
  onSavePrefs,
  onResetPrefs,
}: {
  principal: AuthPrincipal | null
  prefs: DefaultContextPrefs
  message: string
  authBusy: boolean
  onLogout: () => void
  onPrefsChange: (patch: Partial<DefaultContextPrefs>) => void
  onSavePrefs: () => void
  onResetPrefs: () => void
}) {
  const { t } = useTranslation()

  const directionOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: 'ENTRY',
        label: t('operator.dirEntry'),
        description: t('operator.dirEntryDesc'),
        badge: 'in',
        badgeVariant: 'success',
      },
      {
        value: 'EXIT',
        label: t('operator.dirExit'),
        description: t('operator.dirExitDesc'),
        badge: 'out',
        badgeVariant: 'warning',
      },
    ],
    [t],
  )

  const siteScopeLabel = principal?.principalType === 'USER' && principal.siteScopes.length > 0
    ? principal.siteScopes.map((scope) => scope.siteCode).join(', ')
    : t('operator.allScopedSites')

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Session Card */}
        <Card className="border-border/80 bg-card/95 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-5">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs px-2.5 py-1">{t('operator.badgeAccess')}</Badge>
              <Badge variant="outline" className="text-xs px-2.5 py-1">{t('operator.badgeSession')}</Badge>
            </div>
            <CardTitle className="text-lg font-bold tracking-tight">{t('operator.currentSessionTitle')}</CardTitle>
            <CardDescription className="text-sm mt-1">{t('operator.currentSessionDesc')}</CardDescription>
          </div>

          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Metric icon={ShieldCheck} label={t('operator.role')} value={principal?.role || '—'} />
              <Metric
                icon={UserRound}
                label={t('operator.principal')}
                value={principal?.principalType === 'USER' ? principal.username : principal?.actorLabel || '—'}
              />
              <Metric icon={ShieldCheck} label={t('operator.siteScope')} value={siteScopeLabel} />
              <Metric
                icon={UserRound}
                label={t('operator.session')}
                value={principal?.principalType === 'USER' ? principal.sessionId || '—' : t('operator.sessionService')}
              />
            </div>

            <div className="mt-6 pt-5 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full sm:w-auto gap-2 text-base h-12 px-6"
                onClick={onLogout}
                disabled={authBusy}
              >
                <LogOut className="h-5 w-5" />
                {authBusy ? t('operator.signingOut') : t('operator.signOut')}
              </Button>
            </div>

            {message ? (
              <div className="mt-5 rounded-2xl border border-border/80 bg-background/60 px-5 py-4 text-sm text-foreground shadow-sm">
                {message}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Default Context Card */}
        <Card className="border-border/80 bg-card/95 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-5">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs px-2.5 py-1">{t('operator.badgeDefaultContext')}</Badge>
              <Badge variant="outline" className="text-xs px-2.5 py-1">{t('operator.badgeSiteLane')}</Badge>
            </div>
            <CardTitle className="text-lg font-bold tracking-tight">{t('operator.defaultContextTitle')}</CardTitle>
            <CardDescription className="text-sm mt-1">{t('operator.defaultContextDesc')}</CardDescription>
          </div>

          <CardContent className="p-6 space-y-5">
            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">{t('operator.placeholderSite')}</label>
                <Input
                  value={prefs.siteCode}
                  onChange={(e) => onPrefsChange({ siteCode: e.target.value })}
                  placeholder={t('operator.placeholderSite')}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">{t('operator.placeholderLane')}</label>
                <Input
                  value={prefs.laneCode}
                  onChange={(e) => onPrefsChange({ laneCode: e.target.value })}
                  placeholder={t('operator.placeholderLane')}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">{t('laneContext.direction')}</label>
                <Select
                  value={prefs.direction}
                  onChange={(value) => onPrefsChange({ direction: value === 'EXIT' ? 'EXIT' : 'ENTRY' })}
                  options={directionOptions}
                  size="md"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" variant="default" size="lg" className="gap-2 text-base h-12 px-6 min-w-[160px]" onClick={onSavePrefs}>
                <Save className="h-5 w-5" />
                {t('operator.saveDefaults')}
              </Button>
              <Button type="button" variant="secondary" size="lg" className="gap-2 text-base h-12 px-5" onClick={onResetPrefs}>
                <Trash2 className="h-5 w-5" />
                {t('operator.reset')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - API Health */}
      <ApiHealthCard />
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-5">
      <div className="flex items-center gap-2.5 text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <p className="break-all font-semibold text-base text-foreground leading-snug">{value}</p>
    </div>
  )
}
