import { Check, ClipboardCopy, ExternalLink, Smartphone } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function qrImageUrl(value: string) {
  if (!value) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(value)}`
}

export function MobileQrCard({
  pairUrl,
  copied,
  onCopy,
  onOpen,
}: {
  pairUrl: string
  copied: boolean
  onCopy: () => void
  onOpen: () => void
}) {
  const qrUrl = useMemo(() => qrImageUrl(pairUrl), [pairUrl])

  return (
    <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">desktop pair</Badge>
        <Badge variant="outline">QR</Badge>
        <Badge variant="outline">copy link</Badge>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium">Pair QR</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Snapshot hiện tại không có thư viện QR riêng, nên card này render QR bằng image service. Nếu mạng chặn QR image, nút copy/open link vẫn dùng được.
        </p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-border/80 bg-background/40 p-4">
          {pairUrl ? (
            <img src={qrUrl} alt="Mobile pair QR" className="h-[280px] w-[280px] rounded-2xl border border-border/80 bg-white p-2" />
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              <Smartphone className="mx-auto h-10 w-10" />
              <p className="mt-3">Chưa đủ context để tạo QR.</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
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
            QR chỉ là bề mặt pair. Điện thoại sau đó vẫn chạy surface riêng: preview nhẹ, override nhẹ, send capture và heartbeat.
          </div>
        </div>
      </div>
    </div>
  )
}
