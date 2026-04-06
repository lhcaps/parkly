import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Link2, PlugZap, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getApiBasePreview } from '@/lib/http/client'
import { getHealth } from '@/lib/api/system'
import { getAuthMe } from '@/lib/api/auth'

export function ApiHealthCard() {
  const { t } = useTranslation()
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

      const [healthRes, meRes] = await Promise.all([getHealth(), getAuthMe()])
      setRole(meRes.role)
      setHealthTs(new Date(healthRes.ts).toLocaleString('vi-VN'))
      setStatus('success')
      setMessage(t('apiHealth.successMsg'))
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
    <Card className="border-border/80 bg-card/95 overflow-hidden h-full">
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="secondary" className="text-xs px-2.5 py-1">{t('apiHealth.badge')}</Badge>
          {status === 'success' ? <Badge variant="entry" className="text-xs px-2.5 py-1">{t('apiHealth.verified')}</Badge> : null}
          {status === 'error' ? <Badge variant="destructive" className="text-xs px-2.5 py-1">{t('apiHealth.failed')}</Badge> : null}
        </div>
        <CardTitle className="text-lg font-bold tracking-tight">{t('apiHealth.title')}</CardTitle>
        <CardDescription className="text-sm mt-1">{t('apiHealth.description')}</CardDescription>
      </div>

      <CardContent className="p-6 space-y-5">
        {/* API Base Display */}
        <div className="rounded-2xl border border-border/80 bg-muted/40 p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <Link2 className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold">{t('apiHealth.apiBase')}</p>
          </div>
          <p className="break-all font-mono-data text-sm text-muted-foreground leading-relaxed bg-background/60 rounded-xl px-3 py-2">{apiBase || t('developer.none')}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-2xl border border-border/80 bg-muted/40 p-5">
            <p className="text-xs font-mono-data uppercase tracking-[0.15em] text-muted-foreground mb-3">{t('apiHealth.detectedRole')}</p>
            <div className="flex items-center gap-3">
              {role ? (
                <Badge variant="outline" className="text-sm px-3 py-1.5 font-semibold">{role}</Badge>
              ) : (
                <span className="text-sm text-muted-foreground">{t('apiHealth.notVerifiedYet')}</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-muted/40 p-5">
            <p className="text-xs font-mono-data uppercase tracking-[0.15em] text-muted-foreground mb-3">{t('apiHealth.lastHealthTs')}</p>
            <p className="text-base font-semibold text-foreground">{healthTs || t('common.dash')}</p>
          </div>
        </div>

        {/* Verify Button - Large */}
        <Button
          type="button"
          variant={status === 'success' ? 'secondary' : 'default'}
          size="lg"
          className="w-full gap-2 text-base h-12 px-6"
          onClick={() => void verify()}
          disabled={busy}
        >
          <PlugZap className="h-5 w-5" />
          {busy ? t('apiHealth.verifying') : t('apiHealth.verifySessionApi')}
        </Button>

        {/* Result Message */}
        {message ? (
          <div
            className={cn(
              'flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm',
              status === 'error'
                ? 'border-destructive/25 bg-destructive/10 text-destructive'
                : 'border-success/25 bg-success/10 text-success'
            )}
          >
            {status === 'error'
              ? <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              : <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
            }
            <span className="break-all leading-relaxed">{message}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
