import { ExternalLink, ImageOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SessionDetail } from '@/lib/contracts/sessions'
import { collectSessionMedia, formatDateTime, formatNumber } from '@/features/session-history/session-history-model'

function isImageMedia(mimeType: string | null, url: string | null) {
  if (mimeType?.startsWith('image/')) return true
  const value = String(url ?? '').toLowerCase()
  return /\.(png|jpg|jpeg|webp|gif)(\?|$)/.test(value)
}

export function SessionMediaStrip({ detail }: { detail: SessionDetail }) {
  const mediaRows = collectSessionMedia(detail)

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <CardTitle>Media strip</CardTitle>
        <CardDescription>
          Groups image evidence by read event. Sessions without media render normally without breaking the panel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mediaRows.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-background/40 px-5 py-8 text-center">
            <ImageOff className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No media evidence</p>
            <p className="mt-1 text-xs text-muted-foreground">RFID-only sessions or missing upstream images are expected.vẫn được hiển thị gọn gàng ở đây.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {mediaRows.map((item) => (
              <div key={item.key} className="overflow-hidden rounded-3xl border border-border/80 bg-background/35">
                {item.url && isImageMedia(item.mimeType, item.url) ? (
                  <a href={item.url} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden bg-muted/30">
                    <img src={item.url} alt={`session media ${item.readEventId}`} className="h-full w-full object-cover transition hover:scale-[1.02]" loading="lazy" />
                  </a>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-muted/25 text-muted-foreground">
                    <ImageOff className="h-8 w-8" />
                  </div>
                )}

                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{item.readType}</Badge>
                    {item.sourceDeviceCode ? <Badge variant="muted">{item.sourceDeviceCode}</Badge> : null}
                    {typeof item.ocrConfidence === 'number' ? <Badge variant="amber">ocr {formatNumber(item.ocrConfidence, 2)}</Badge> : null}
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="font-mono-data font-semibold text-foreground">read={item.readEventId}</p>
                    <p className="text-muted-foreground">captured {formatDateTime(item.capturedAt || item.occurredAt)}</p>
                    <p className="text-muted-foreground">plate={item.plateCompact || '—'} · media={item.mediaId || '—'}</p>
                    <p className="text-muted-foreground">source {item.sourceLabel} · size={item.widthPx && item.heightPx ? `${item.widthPx}×${item.heightPx}` : '—'}</p>
                  </div>

                  {item.url ? (
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <a href={item.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Open media
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
