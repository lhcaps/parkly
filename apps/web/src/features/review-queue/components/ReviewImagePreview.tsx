import { memo, useState } from 'react'
import { ImageOff, ZoomIn, ZoomOut, RotateCw, Download, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { SessionRead } from '@/lib/contracts/sessions'

interface ReviewImagePreviewProps {
  reads: SessionRead[]
  className?: string
}

export const ReviewImagePreview = memo(function ReviewImagePreview({ reads, className }: ReviewImagePreviewProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  // Find all reads with media images
  const readsWithMedia = reads.filter((read) => read.evidence?.media?.mediaUrl)

  if (readsWithMedia.length === 0) {
    return (
      <Card className={cn('border-border/60 bg-card/95', className)}>
        <CardContent className="flex min-h-[200px] flex-col items-center justify-center p-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-border/50 bg-muted/20 text-muted-foreground">
            <ImageOff className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No captured images available</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Session reads did not include media attachments</p>
        </CardContent>
      </Card>
    )
  }

  const currentRead = readsWithMedia[selectedIndex]
  const currentMedia = currentRead.evidence?.media
  const imageUrl = currentMedia?.mediaUrl

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5))
  const handleResetZoom = () => {
    setZoom(1)
    setRotation(0)
  }
  const handleRotate = () => setRotation((r) => (r + 90) % 360)
  const handleDownload = () => {
    if (imageUrl) {
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = `review-image-${currentRead.readEventId}.jpg`
      link.target = '_blank'
      link.click()
    }
  }
  const handleOpenInNewTab = () => {
    if (imageUrl) window.open(imageUrl, '_blank')
  }

  return (
    <Card className={cn('border-border/60 bg-card/95', className)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {readsWithMedia.length} {readsWithMedia.length === 1 ? 'image' : 'images'}
            </Badge>
            {currentMedia?.mimeType && (
              <Badge variant="outline" className="text-[10px]">
                {currentMedia.mimeType.split('/')[1]?.toUpperCase() || 'IMAGE'}
              </Badge>
            )}
            {currentMedia?.widthPx && currentMedia?.heightPx && (
              <Badge variant="outline" className="text-[10px] font-mono-data">
                {currentMedia.widthPx}×{currentMedia.heightPx}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} title="Zoom out" aria-label="Zoom out preview image">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} title="Zoom in" aria-label="Zoom in preview image">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRotate} title="Rotate 90°" aria-label="Rotate preview image 90 degrees">
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleResetZoom} title="Reset view" aria-label="Reset preview zoom and rotation">
              <span className="text-[10px]">1:1</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload} title="Download image" aria-label="Download preview image">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleOpenInNewTab} title="Open in new tab" aria-label="Open preview image in a new tab">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Image display area */}
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-black/60">
          {imageUrl ? (
            <div className="flex items-center justify-center" style={{ minHeight: '280px', maxHeight: '480px' }}>
              <img
                src={imageUrl}
                alt={`License plate capture from ${currentRead.readEventId}`}
                className="max-h-full max-w-full object-contain transition-transform duration-200"
                width={currentMedia?.widthPx ?? 1120}
                height={currentMedia?.heightPx ?? 840}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                }}
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
            </div>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center p-6 text-center">
              <ImageOff className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Image URL not available</p>
            </div>
          )}

          {/* Zoom indicator */}
          {zoom !== 1 && (
            <div className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-1 text-xs text-white">
              {Math.round(zoom * 100)}%
            </div>
          )}
        </div>

        {/* Image selector (if multiple images) */}
        {readsWithMedia.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {readsWithMedia.map((read, index) => {
              const media = read.evidence?.media
              const thumbUrl = media?.mediaUrl
              return (
                <button
                  key={read.readEventId}
                  type="button"
                  onClick={() => {
                    setSelectedIndex(index)
                    setZoom(1)
                    setRotation(0)
                  }}
                  className={cn(
                    'relative h-16 w-16 overflow-hidden rounded-lg border-2 transition-[border-color,box-shadow,transform]',
                    index === selectedIndex
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border/50 hover:border-border/80',
                  )}
                  aria-label={`Open review image ${index + 1}`}
                  title={`Image ${index + 1} from ${read.readType} read`}
                >
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={`Thumbnail ${index + 1}`}
                      className="h-full w-full object-cover"
                      width={media?.widthPx ?? 64}
                      height={media?.heightPx ?? 64}
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted/20">
                      <ImageOff className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  {index === selectedIndex && (
                    <div className="absolute inset-0 bg-primary/10 ring-1 ring-primary/30" />
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Metadata */}
        {currentMedia && (
          <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Read:</span>{' '}
                <span className="font-mono-data">{currentRead.readEventId.slice(0, 8)}…</span>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span> <span>{currentRead.readType}</span>
              </div>
              {currentMedia.capturedAt && (
                <div>
                  <span className="text-muted-foreground">Captured:</span>{' '}
                  <span>{new Date(currentMedia.capturedAt).toLocaleString('vi-VN')}</span>
                </div>
              )}
              {currentMedia.sha256 && (
                <div>
                  <span className="text-muted-foreground">SHA256:</span>{' '}
                  <span className="font-mono-data text-[10px]">{currentMedia.sha256.slice(0, 16)}…</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
