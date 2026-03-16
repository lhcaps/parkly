import { AlertTriangle, Check, ClipboardCopy, ExternalLink, Smartphone } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MobilePairOriginInfo } from '@/lib/api/mobile'

function qrImageUrl(value: string) {
  if (!value) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(value)}`
}

export function MobileQrCard({
  pairUrl,
  copied,
  originInfo,
  onCopy,
  onOpen,
}: {
  pairUrl: string
  copied: boolean
  originInfo: MobilePairOriginInfo
  onCopy: () => void
  onOpen: () => void
}) {
  const qrUrl = useMemo(() => qrImageUrl(pairUrl), [pairUrl])
  const originStatusVariant = originInfo.isLoopback
    ? 'destructive'
    : originInfo.hasSubnetMismatch
      ? 'amber'
      : 'secondary'

  return (
    <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">desktop pair</Badge>
        <Badge variant="outline">QR</Badge>
        <Badge variant="outline">copy link</Badge>
        <Badge variant={originStatusVariant}>
          origin {originInfo.isLoopback ? 'loopback' : originInfo.hasSubnetMismatch ? 'subnet-check' : 'lan-ready'}
        </Badge>
        <Badge variant={originInfo.source === 'window' ? 'outline' : 'secondary'}>source {originInfo.source}</Badge>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium">Pair QR</p>
        <p className="mt-1 text-xs text-muted-foreground">
          QR is rendered via an image service. If it fails to load, copy the link directly.
        </p>
      </div>

      {originInfo.invalidRequestedOrigin ? (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Ignored configured origin <span className="font-mono">{originInfo.invalidRequestedOrigin}</span> because{' '}
              {originInfo.invalidReason?.toLowerCase() || 'it is invalid'}. Fallback is now using{' '}
              <span className="font-mono">{originInfo.effectiveOrigin || 'window.location.origin'}</span>.
            </div>
          </div>
        </div>
      ) : null}

      {originInfo.isLoopback ? (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Pair origin is using loopback: <span className="font-mono">{originInfo.effectiveOrigin || 'localhost'}</span>.
              QR opened on phone will fail. Set <span className="font-mono">VITE_PUBLIC_WEB_ORIGIN</span> to your LAN URL,
              for example <span className="font-mono">http://192.168.1.84:5173</span>, then restart Vite.
            </div>
          </div>
        </div>
      ) : null}

      {originInfo.hasSubnetMismatch ? (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Effective origin <span className="font-mono">{originInfo.effectiveOrigin}</span> is not on the same detected IPv4 subnet as this tab{' '}
              <span className="font-mono">{originInfo.expectedWindowOrigin || 'window origin unavailable'}</span>. Verify that the QR points to the desktop LAN IP, not another machine.
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-border/80 bg-background/40 p-4">
          {pairUrl ? (
            <img
              src={qrUrl}
              alt="Mobile pair QR"
              className="h-[280px] w-[280px] rounded-2xl border border-border/80 bg-white p-2"
            />
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              <Smartphone className="mx-auto h-10 w-10" />
              <p className="mt-3">Insufficient context to generate QR.</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Effective origin</p>
            <p className="mt-2 break-all font-mono-data text-xs text-foreground">{originInfo.effectiveOrigin || '—'}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">source: {originInfo.source}</p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Current tab origin</p>
            <p className="mt-2 break-all font-mono-data text-xs text-foreground">{originInfo.expectedWindowOrigin || '—'}</p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Pair URL</p>
            <p className="mt-2 break-all font-mono-data text-xs text-foreground">{pairUrl || '—'}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onCopy} disabled={!pairUrl}>
              {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>

            <Button type="button" onClick={onOpen} disabled={!pairUrl}>
              <ExternalLink className="h-4 w-4" />
              Open mobile surface
            </Button>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            The pair QR only sets the mobile context. Preview, capture, and heartbeat still go through the API.
          </div>
        </div>
      </div>
    </div>
  )
}
