import { LogOut, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { ApiHealthCard } from '@/features/settings/components/ApiHealthCard'
import type { DefaultContextPrefs } from '@/lib/api'
import type { AuthPrincipal } from '@/lib/contracts/auth'

const DIRECTION_OPTIONS: SelectOption[] = [
  { value: 'ENTRY', label: 'ENTRY', description: 'Default inbound direction', badge: 'in', badgeVariant: 'success' },
  { value: 'EXIT', label: 'EXIT', description: 'Default outbound direction', badge: 'out', badgeVariant: 'warning' },
]

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
  const siteScopeLabel = principal?.principalType === 'USER' && principal.siteScopes.length > 0
    ? principal.siteScopes.map((scope) => scope.siteCode).join(', ')
    : 'All scoped sites'

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-5">
        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">access</Badge>
              <Badge variant="outline">session shell</Badge>
            </div>
            <CardTitle>Current session</CardTitle>
            <CardDescription>Current user context is loaded from backend auth. Route guard, topbar, and navigation are all driven by this principal.tion đều bám principal này.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Metric label="Role" value={principal?.role || '—'} />
              <Metric label="Principal" value={principal?.principalType === 'USER' ? principal.username : principal?.actorLabel || '—'} />
              <Metric label="Site scope" value={siteScopeLabel} />
              <Metric label="Session" value={principal?.principalType === 'USER' ? principal.sessionId || '—' : 'service'} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onLogout} disabled={authBusy}>
                <LogOut className="h-4 w-4" />
                {authBusy ? 'Signing out…' : 'Sign out'}
              </Button>
            </div>

            {message ? <div className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3 text-sm text-foreground">{message}</div> : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">default context</Badge>
              <Badge variant="outline">site & lane</Badge>
            </div>
            <CardTitle>Default context</CardTitle>
            <CardDescription>Save default site, lane, and direction to reduce repeated setup during shifts.xuyên.</CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3 md:grid-cols-2">
            <Input value={prefs.siteCode} onChange={(e) => onPrefsChange({ siteCode: e.target.value })} placeholder="Site mặc định" />
            <Input value={prefs.laneCode} onChange={(e) => onPrefsChange({ laneCode: e.target.value })} placeholder="Lane mặc định" />

            <Select
              value={prefs.direction}
              onChange={(value) => onPrefsChange({ direction: value === 'EXIT' ? 'EXIT' : 'ENTRY' })}
              options={DIRECTION_OPTIONS}
              className="md:col-span-2"
            />

            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="button" variant="outline" onClick={onSavePrefs}>
                <Save className="h-4 w-4" />
                Save defaults
              </Button>
              <Button type="button" variant="ghost" onClick={onResetPrefs}>
                <Trash2 className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ApiHealthCard />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  const Icon = label === 'Role' ? ShieldCheck : UserRound
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-2 break-all font-medium text-foreground">{value}</p>
    </div>
  )
}
