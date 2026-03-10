import { useMemo, useState } from 'react'
import { CheckCircle2, Link2, PlugZap, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getApiBasePreview } from '@/lib/http/client'
import { getHealth, getMe } from '@/lib/api/system'

export function ApiHealthCard() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [role, setRole] = useState('')
  const [healthTs, setHealthTs] = useState('')
  const apiBase = useMemo(() => getApiBasePreview(), [])

  async function verify() {
    try {
      setBusy(true)
      setStatus('idle')
      setMessage('')

      const [healthRes, meRes] = await Promise.all([getHealth(), getMe()])
      setRole(meRes.role)
      setHealthTs(new Date(healthRes.ts).toLocaleString('vi-VN'))
      setStatus('success')
      setMessage('Kết nối API và token hiện tại đều hợp lệ.')
    } catch (error) {
      setRole('')
      setHealthTs('')
      setStatus('error')
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">health</Badge>
          {status === 'success' ? <Badge variant="entry">verified</Badge> : null}
          {status === 'error' ? <Badge variant="destructive">failed</Badge> : null}
        </div>
        <CardTitle>API Health Card</CardTitle>
        <CardDescription>
          Verify token và API hiện tại bằng cách gọi <span className="font-mono-data">/api/health</span> và <span className="font-mono-data">/api/me</span>.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">API base</p>
          </div>
          <p className="break-all font-mono-data text-xs text-muted-foreground">{apiBase}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Detected role</p>
            <div className="mt-2">
              {role ? <Badge variant="outline">{role}</Badge> : <span className="text-sm text-muted-foreground">Chưa verify</span>}
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Last health ts</p>
            <p className="mt-2 text-sm text-foreground">{healthTs || '—'}</p>
          </div>
        </div>

        <Button type="button" variant="outline" onClick={() => void verify()} disabled={busy}>
          <PlugZap className="h-4 w-4" />
          {busy ? 'Đang verify...' : 'Verify token + API'}
        </Button>

        {message ? (
          <div
            className={
              status === 'error'
                ? 'flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive'
                : 'flex items-start gap-2 rounded-2xl border border-success/25 bg-success/10 px-4 py-4 text-sm text-success'
            }
          >
            {status === 'error' ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="break-all">{message}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
