import { Bug, RefreshCcw, ShieldAlert, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DefaultContextPrefs } from '@/lib/api'

export function DeveloperDebugTab({
  apiBase,
  tokenPreview,
  buildInfo,
  prefs,
  cacheKeys,
  message,
  onClearCache,
  onResetPrefs,
}: {
  apiBase: string
  tokenPreview: string
  buildInfo: {
    mode: string
    dev: boolean
    prod: boolean
    baseUrl: string
  }
  prefs: DefaultContextPrefs
  cacheKeys: string[]
  message: string
  onClearCache: () => void
  onResetPrefs: () => void
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">developer</Badge>
            <Badge variant="outline">debug</Badge>
          </div>
          <CardTitle>Environment & build info</CardTitle>
          <CardDescription>
            Surface này dành cho dev/debug. Operator bình thường không cần vào đây nhiều.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-sm">
          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">API base</p>
            <p className="mt-2 break-all font-mono-data text-xs text-foreground">{apiBase}</p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Token preview</p>
            <p className="mt-2 break-all font-mono-data text-xs text-foreground">{tokenPreview || '—'}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Mode</p>
              <p className="mt-2 text-sm text-foreground">{buildInfo.mode}</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Base URL</p>
              <p className="mt-2 break-all text-sm text-foreground">{buildInfo.baseUrl}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={buildInfo.dev ? 'entry' : 'outline'}>dev={String(buildInfo.dev)}</Badge>
            <Badge variant={buildInfo.prod ? 'secondary' : 'outline'}>prod={String(buildInfo.prod)}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">cleanup</Badge>
            <Badge variant="outline">cache</Badge>
          </div>
          <CardTitle>Local cache & prefs</CardTitle>
          <CardDescription>
            Dùng khi cần dọn state browser trước regression hoặc trước cutover.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Default context prefs</p>
            <p className="mt-2 break-all font-mono-data text-xs text-foreground">
              {JSON.stringify(prefs)}
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Known local cache keys</p>
            {cacheKeys.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Không có key nào đang tồn tại.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {cacheKeys.map((key) => (
                  <Badge key={key} variant="muted">{key}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onClearCache}>
              <Trash2 className="h-4 w-4" />
              Clear local cache
            </Button>

            <Button type="button" variant="ghost" onClick={onResetPrefs}>
              <RefreshCcw className="h-4 w-4" />
              Reset default prefs
            </Button>
          </div>

          {message ? (
            <div className="flex items-start gap-2 rounded-2xl border border-border/80 bg-background/40 px-4 py-4 text-sm text-foreground">
              <Bug className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="break-all">{message}</span>
            </div>
          ) : null}

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <span className="font-medium">Regression note</span>
            </div>
            Dọn local cache trước regression sẽ giúp bóc tách lỗi runtime với lỗi stale browser state.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
