import { ArrowRightLeft, ExternalLink, Image as ImageIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { CaptureReadRes } from '@/lib/contracts/mobile'

export function MobileCaptureReceiptCard({ value }: { value: CaptureReadRes }) {
  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <CardTitle>Capture receipt</CardTitle>
        <CardDescription>Authoritative response from the backend after a signed ALPR capture is accepted.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{value.deviceCode}</Badge>
          <Badge variant="outline">{value.laneCode}</Badge>
          <Badge variant={value.direction === 'ENTRY' ? 'entry' : 'exit'}>{value.direction}</Badge>
          <Badge variant="secondary">{value.sessionStatus}</Badge>
          {value.changed ? <Badge variant="outline">changed</Badge> : <Badge variant="muted">idempotent</Badge>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Session</p>
            <p className="mt-2 font-mono-data text-sm text-foreground">{value.sessionId || '—'}</p>
            <p className="mt-1 text-xs text-muted-foreground">readEvent={String(value.readEventId || '—')}</p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
            <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Plate</p>
            <p className="mt-2 text-sm font-medium text-foreground">{value.plateDisplay || value.plateCompact || value.plateRaw || '—'}</p>
            <p className="mt-1 text-xs text-muted-foreground">confidence={value.ocrConfidence ?? '—'} · occurred={value.occurredAt || '—'}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {value.imageUrl ? (
            <Button type="button" variant="outline" size="sm" onClick={() => window.open(value.imageUrl || '', '_blank', 'noopener,noreferrer')}>
              <ImageIcon className="h-4 w-4" />
              Open evidence
            </Button>
          ) : null}
          {value.sessionId ? (
            <Button type="button" variant="outline" size="sm" onClick={() => window.open(`/session-history?sessionId=${encodeURIComponent(value.sessionId)}`, '_blank', 'noopener,noreferrer')}>
              <ArrowRightLeft className="h-4 w-4" />
              Open session history
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => window.open('/run-lane', '_blank', 'noopener,noreferrer')}>
            <ExternalLink className="h-4 w-4" />
            Open run lane
          </Button>
        </div>

        {value.imageUrl ? <img src={value.imageUrl} alt="capture evidence" className="max-h-80 w-full rounded-2xl border border-border object-contain" /> : null}
      </CardContent>
    </Card>
  )
}
