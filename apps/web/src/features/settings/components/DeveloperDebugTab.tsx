import { HardDriveDownload, RefreshCcw, ShieldAlert, Trash2, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { InlineMessage } from '@/components/ops/console'
import type { DefaultContextPrefs } from '@/lib/api'

type DeveloperDebugTabProps = {
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
}

export function DeveloperDebugTab({
  apiBase,
  tokenPreview,
  buildInfo,
  prefs,
  cacheKeys,
  message,
  onClearCache,
  onResetPrefs,
}: DeveloperDebugTabProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
      <Card className="border-border/80 bg-card/95 shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Wrench className="h-4 w-4 text-primary" />
            Local environment
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="API base" value={apiBase || 'None'} />
            <Metric label="Token" value={tokenPreview || 'Not configured'} />
            <Metric label="Mode" value={buildInfo.mode || 'unknown'} />
            <Metric label="Base URL" value={buildInfo.baseUrl || '/'} />
          </div>

          <InlineMessage tone="info">
            <div>
              <p className="font-medium">Surface boundaries</p>
              <p className="mt-1 text-sm text-muted-foreground">
                User-auth shell routes use the browser access token. Mobile capture and device heartbeat use device-signed credentials only. A device 401 must be debugged on the mobile surface, not by logging the web operator out.
              </p>
            </div>
          </InlineMessage>

          <Separator />

          <div className="space-y-3">
            <p className="font-medium text-foreground">Current default context</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Site" value={prefs.siteCode || '—'} />
              <Metric label="Lane" value={prefs.laneCode || '—'} />
              <Metric label="Direction" value={prefs.direction} />
            </div>
          </div>

          {message ? <InlineMessage tone="warning">{message}</InlineMessage> : null}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-tight">Clear local cache</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onResetPrefs}>
              <RefreshCcw className="h-4 w-4" />
              Reset context
            </Button>
            <Button type="button" variant="destructive" onClick={onClearCache}>
              <Trash2 className="h-4 w-4" />
              Clear app cache
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <HardDriveDownload className="h-4 w-4 text-primary" />
              Local keys
            </div>
            <div className="flex flex-wrap gap-2">
              {cacheKeys.length ? (
                cacheKeys.map((key) => (
                  <Badge key={key} variant="secondary">
                    {key}
                  </Badge>
                ))
              ) : (
                <p className="text-muted-foreground">No app keys in localStorage.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Troubleshooting split
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Shell auth issues: /api/auth/*, route bootstrap, user role guards, realtime 401.</li>
              <li>Device-signed issues: /api/devices/heartbeat and /api/gate-reads/* signed by device secret.</li>
              <li>Do not treat device signature errors as proof that the browser user session is expired.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-all font-medium text-foreground">{value}</p>
    </div>
  )
}
