import { KeyRound, Save, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { ApiHealthCard } from '@/features/settings/components/ApiHealthCard'
import type { DefaultContextPrefs } from '@/lib/api'

const PRESET_TOKENS = {
  ADMIN: 'admin_dev_token_change_me',
  OPS: 'ops_dev_token_change_me',
  GUARD: 'guard_dev_token_change_me',
  WORKER: 'worker_dev_token_change_me',
} as const

const DIRECTION_OPTIONS: SelectOption[] = [
  { value: 'ENTRY', label: 'ENTRY', description: 'Luồng xe vào mặc định', badge: 'in', badgeVariant: 'success' },
  { value: 'EXIT', label: 'EXIT', description: 'Luồng xe ra mặc định', badge: 'out', badgeVariant: 'warning' },
]

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
              <Badge variant="secondary">truy cập</Badge>
              <Badge variant="outline">token</Badge>
            </div>
            <CardTitle>Access token</CardTitle>
            <CardDescription>Token được lưu trong trình duyệt hiện tại để dùng cho các màn thao tác và tra cứu.</CardDescription>
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
                Xóa token
              </Button>
            </div>

            {message ? <div className="rounded-2xl border border-border/80 bg-background/40 px-4 py-3 text-sm text-foreground">{message}</div> : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">ngữ cảnh mặc định</Badge>
              <Badge variant="outline">site & lane</Badge>
            </div>
            <CardTitle>Default context</CardTitle>
            <CardDescription>Giữ site, lane và hướng mặc định để giảm thao tác lặp lại trong các ca trực thường xuyên.</CardDescription>
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
                Lưu mặc định
              </Button>
              <Button type="button" variant="ghost" onClick={onResetPrefs}>
                <Trash2 className="h-4 w-4" />
                Khôi phục
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ApiHealthCard />
    </div>
  )
}
