import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightLeft, Camera, ClipboardList, Smartphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PreviewDebugPanel } from '@/features/capture-debug/components/PreviewDebugPanel'
import { CaptureFeedTable } from '@/features/capture-debug/components/CaptureFeedTable'
import type { GateEventStreamItem } from '@/lib/contracts/mobile'

export function CaptureDebugPage() {
  const [selected, setSelected] = useState<GateEventStreamItem | null>(null)

  const summary = useMemo(() => {
    if (!selected) return null
    return {
      siteCode: selected.siteCode || '—',
      laneCode: selected.laneCode || '—',
      deviceCode: selected.deviceCode || '—',
      eventId: selected.eventId,
      outboxId: selected.outboxId,
      direction: selected.direction || '—',
      plate: selected.plateDisplay || selected.plateCompact || selected.licensePlateRaw || '—',
      reviewRequired: selected.reviewRequired ? 'Yes' : 'No',
    }
  }, [selected])

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">capture surfaces</Badge>
              <Badge variant="outline">debug split</Badge>
              <Badge variant="outline">no run-lane coupling</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Capture Debug</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Page này chỉ lo debug capture: raw OCR, candidates, crop/psm/provider, capture feed và event mapping summary. Nó đã tách khỏi GateEventsMonitor monolith và không ảnh hưởng state của Run Lane.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/40 p-4 text-sm text-muted-foreground">
            Pair QR dành cho desktop nằm ở route <span className="font-mono-data">/mobile-camera-pair</span>.
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/mobile-camera-pair">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <Smartphone className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Mobile Camera Pair</p>
                <p className="mt-1 text-sm text-muted-foreground">Tạo QR/link pair cho điện thoại trên desktop.</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/mobile-capture">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <Camera className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Mobile Capture</p>
                <p className="mt-1 text-sm text-muted-foreground">Standalone mobile surface để preview nhẹ, send capture và heartbeat.</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/run-lane">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <ArrowRightLeft className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Run Lane</p>
                <p className="mt-1 text-sm text-muted-foreground">Xử lý lane flow chính. Debug page này không chia sẻ store với Run Lane.</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <PreviewDebugPanel />

        <div className="space-y-5">
          <CaptureFeedTable
            selectedEventId={selected?.eventId || ''}
            onSelect={setSelected}
          />

          <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Event mapping summary</p>
            </div>

            {!summary ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
                Chọn một row trong capture feed để xem summary mapping.
              </div>
            ) : (
              <div className="space-y-2 rounded-2xl border border-border/80 bg-background/40 p-4">
                {Object.entries(summary).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-b-0">
                    <p className="text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">{key}</p>
                    <p className="max-w-[68%] break-all text-right text-sm text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
