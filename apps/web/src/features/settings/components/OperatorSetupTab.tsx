import { KeyRound, Save, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiHealthCard } from '@/features/settings/components/ApiHealthCard'
import type { DefaultContextPrefs } from '@/lib/api'

const PRESET_TOKENS = {
  ADMIN: 'admin_dev_token_change_me',
  OPS: 'ops_dev_token_change_me',
  GUARD: 'guard_dev_token_change_me',
  WORKER: 'worker_dev_token_change_me',
} as const

export function OperatorSetupTab({
  token,
  prefs,
  message,
  onTokenChange,
  onApplyPreset,
  onSaveToken,
  onClearToken,
  onPrefsChange,
  onSavePrefs,
  onResetPrefs,
}: {
  token: string
  prefs: DefaultContextPrefs
  message: string
  onTokenChange: (value: string) => void
  onApplyPreset: (value: string) => void
  onSaveToken: () => void
  onClearToken: () => void
  onPrefsChange: (patch: Partial<DefaultContextPrefs>) => void
  onSavePrefs: () => void
  onResetPrefs: () => void
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-5">
        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">operator setup</Badge>
              <Badge variant="outline">token</Badge>
            </div>
            <CardTitle>Access token</CardTitle>
            <CardDescription>
              Token được lưu vào browser hiện tại. Đây là phần operator dùng nhiều nhất trước khi vào Run Lane, Review Queue hay Session History.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Input value={token} onChange={(e) => onTokenChange(e.target.value)} placeholder="Bearer token" />

            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESET_TOKENS).map(([role, preset]) => (
                <Button key={role} type="button" variant="outline" size="sm" onClick={() => onApplyPreset(preset)}>
                  <KeyRound className="h-4 w-4" />
                  {role}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={onSaveToken}>
                <Save className="h-4 w-4" />
                Lưu token
              </Button>

              <Button type="button" variant="ghost" onClick={onClearToken}>
                <Trash2 className="h-4 w-4" />
                Xoá token
              </Button>
            </div>

            {message ? (
              <div className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3 text-sm text-foreground">
                {message}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">operator setup</Badge>
              <Badge variant="outline">default context</Badge>
            </div>
            <CardTitle>Default context prefs</CardTitle>
            <CardDescription>
              Context mặc định giúp operator đỡ phải nhập lại site/lane/direction trong các flow thường dùng.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3 md:grid-cols-2">
            <Input
              value={prefs.siteCode}
              onChange={(e) => onPrefsChange({ siteCode: e.target.value })}
              placeholder="Default siteCode"
            />
            <Input
              value={prefs.laneCode}
              onChange={(e) => onPrefsChange({ laneCode: e.target.value })}
              placeholder="Default laneCode"
            />

            <select
              value={prefs.direction}
              onChange={(e) => onPrefsChange({ direction: e.target.value === 'EXIT' ? 'EXIT' : 'ENTRY' })}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="ENTRY">ENTRY</option>
              <option value="EXIT">EXIT</option>
            </select>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onSavePrefs}>
                <Save className="h-4 w-4" />
                Lưu prefs
              </Button>
              <Button type="button" variant="ghost" onClick={onResetPrefs}>
                <Trash2 className="h-4 w-4" />
                Reset prefs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ApiHealthCard />
    </div>
  )
}
