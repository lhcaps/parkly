import { useMemo, useState, type ChangeEvent } from 'react'
import { Camera, ClipboardCopy, Loader2, ScanSearch, Smartphone, Wifi } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { alprPreview, previewImageFile } from '@/lib/api/alpr'
import { readMobileCaptureContextFromLocation, sendCaptureAlpr, sendDeviceHeartbeat } from '@/lib/api/mobile'
import type { Direction } from '@/lib/contracts/common'
import type { AlprRecognizeRes } from '@/lib/contracts/alpr'
import type { CaptureReadRes } from '@/lib/contracts/mobile'

function rid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

export function MobileCapturePage() {
  const initial = useMemo(() => readMobileCaptureContextFromLocation(), [])
  const [siteCode, setSiteCode] = useState(initial.siteCode)
  const [laneCode, setLaneCode] = useState(initial.laneCode)
  const [direction, setDirection] = useState<Direction>(initial.direction)
  const [deviceCode, setDeviceCode] = useState(initial.deviceCode)
  const [deviceSecret, setDeviceSecret] = useState(initial.deviceSecret)
  const [pairToken] = useState(initial.token)

  const [file, setFile] = useState<File | null>(null)
  const [plateHint, setPlateHint] = useState('')
  const [overridePlate, setOverridePlate] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [preview, setPreview] = useState<AlprRecognizeRes | null>(null)
  const [lastCapture, setLastCapture] = useState<CaptureReadRes | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const canSend = Boolean(siteCode && laneCode && deviceCode && deviceSecret)

  function applyBackendPlate(value: string) {
    setOverridePlate(String(value || '').toUpperCase())
  }

  async function runPreview() {
    if (!file) {
      setMessage('Chọn ảnh trước.')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const result = await previewImageFile(file, plateHint || undefined)
      setImageUrl(result.uploaded.imageUrl)
      setPreview(result.preview)
      if (!overridePlate.trim()) {
        applyBackendPlate(result.preview.plateDisplay || result.preview.recognizedPlate)
      }
      setMessage(`Preview ${result.preview.previewStatus} đã sẵn sàng.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function sendHeartbeat() {
    if (!canSend) {
      setMessage('Thiếu siteCode / laneCode / deviceCode / deviceSecret.')
      return
    }

    const now = new Date().toISOString()
    setBusy(true)
    setMessage('')
    try {
      await sendDeviceHeartbeat({
        secret: deviceSecret,
        requestId: rid('mobile_hb'),
        idempotencyKey: rid('mobile_hb_idem'),
        siteCode,
        deviceCode,
        laneCode,
        direction,
        timestamp: now,
        reportedAt: now,
        status: 'ONLINE',
        latencyMs: 40,
        firmwareVersion: 'mobile-capture-surface',
        rawPayload: {
          source: 'MOBILE_CAPTURE_PAGE',
          pairToken,
        },
      })
      setMessage('Heartbeat ONLINE đã gửi.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function sendCapture() {
    if (!canSend) {
      setMessage('Thiếu siteCode / laneCode / deviceCode / deviceSecret.')
      return
    }

    if (!file && !imageUrl && !plateHint.trim() && !overridePlate.trim()) {
      setMessage('Cần ít nhất ảnh hoặc plate hint.')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      let uploadedUrl = imageUrl
      let previewResult = preview

      if (file && !uploadedUrl) {
        const uploadedPreview = await previewImageFile(file, plateHint || undefined)
        uploadedUrl = uploadedPreview.uploaded.imageUrl
        previewResult = uploadedPreview.preview
        setImageUrl(uploadedUrl)
        setPreview(previewResult)
      } else if (!previewResult && uploadedUrl) {
        previewResult = await alprPreview(uploadedUrl, plateHint || undefined)
        setPreview(previewResult)
      }

      const now = new Date().toISOString()
      const effectivePlate = overridePlate.trim() || previewResult?.plateDisplay || previewResult?.recognizedPlate || plateHint.trim()

      const data = await sendCaptureAlpr({
        secret: deviceSecret,
        requestId: rid('mobile_alpr'),
        idempotencyKey: rid('mobile_alpr_idem'),
        siteCode,
        laneCode,
        deviceCode,
        direction,
        timestamp: now,
        eventTime: now,
        plateRaw: effectivePlate || undefined,
        imageUrl: uploadedUrl || undefined,
        ocrConfidence: previewResult?.confidence ?? null,
        rawPayload: {
          source: 'MOBILE_CAPTURE_PAGE',
          previewStatus: previewResult?.previewStatus ?? null,
          pairToken,
        },
      })

      setLastCapture(data)
      setMessage(`Capture OK · session=${data.sessionId} · status=${data.sessionStatus}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-5 text-foreground">
      <div className="mx-auto max-w-lg space-y-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">mobile surface</Badge>
            {pairToken ? <Badge variant="outline">pair token active</Badge> : null}
          </div>
          <p className="mt-2 text-xs font-mono-data uppercase tracking-[0.18em] text-muted-foreground">Parkly Mobile Edge Camera</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Mobile Capture</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Surface này chỉ dành cho mobile: preview nhẹ, override nhẹ, send capture và heartbeat. Pair QR đã tách ra desktop page riêng.
          </p>
        </div>

        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle>Device context</CardTitle>
            <CardDescription>Context có thể được bơm sẵn từ pair link desktop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={siteCode} onChange={(e) => setSiteCode(e.target.value)} placeholder="siteCode" />
            <Input value={laneCode} onChange={(e) => setLaneCode(e.target.value)} placeholder="laneCode" />
            <Input value={direction} onChange={(e) => setDirection(e.target.value.toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY')} placeholder="ENTRY / EXIT" />
            <Input value={deviceCode} onChange={(e) => setDeviceCode(e.target.value)} placeholder="deviceCode" />
            <Input value={deviceSecret} onChange={(e) => setDeviceSecret(e.target.value)} placeholder="deviceSecret" />
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle>Capture surface</CardTitle>
            <CardDescription>Preview nhẹ trước khi gửi signed ALPR capture.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setFile(e.target.files?.[0] ?? null)
                setPreview(null)
                setImageUrl('')
                setLastCapture(null)
              }}
            />
            <Input value={plateHint} onChange={(e) => setPlateHint(e.target.value)} placeholder="plate hint (optional)" />
            <Input value={overridePlate} onChange={(e) => setOverridePlate(e.target.value.toUpperCase())} placeholder="plate confirm / override" />

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => void runPreview()} disabled={busy || !file}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                Preview
              </Button>
              <Button type="button" onClick={() => void sendCapture()} disabled={busy || !canSend}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCopy className="h-4 w-4" />}
                Send capture
              </Button>
            </div>

            <Button type="button" variant="outline" onClick={() => void sendHeartbeat()} disabled={busy || !canSend}>
              <Wifi className="h-4 w-4" />
              Heartbeat ONLINE
            </Button>
          </CardContent>
        </Card>

        {message ? (
          <div className="rounded-lg border border-border bg-card/80 px-4 py-3 text-sm text-foreground">
            {message}
          </div>
        ) : null}

        {preview ? (
          <Card className="border-border/80 bg-card/95">
            <CardHeader>
              <CardTitle>Preview result</CardTitle>
              <CardDescription>Mobile chỉ cần thấy preview gọn, không cần debug nặng.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={preview.previewStatus === 'STRICT_VALID' ? 'entry' : preview.previewStatus === 'REVIEW' ? 'amber' : 'destructive'}>
                  {preview.previewStatus}
                </Badge>
                <Badge variant="outline">confidence {preview.confidence.toFixed(2)}</Badge>
                {preview.needsConfirm ? <Badge variant="amber">needs confirm</Badge> : <Badge variant="secondary">ready</Badge>}
              </div>

              <p className="text-sm text-foreground">plate={preview.plateDisplay || preview.recognizedPlate || '—'}</p>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => applyBackendPlate(preview.plateDisplay || preview.recognizedPlate)}>
                  Dùng backend preview
                </Button>
                {preview.candidates.slice(0, 3).map((candidate) => (
                  <Button key={`${candidate.plate}:${candidate.score}`} type="button" variant="outline" size="sm" onClick={() => applyBackendPlate(candidate.plate)}>
                    {candidate.plate}
                  </Button>
                ))}
              </div>

              {imageUrl ? <img src={imageUrl} alt="mobile preview" className="max-h-72 w-full rounded-lg border border-border object-contain" /> : null}
            </CardContent>
          </Card>
        ) : null}

        {lastCapture ? (
          <Card className="border-border/80 bg-card/95">
            <CardHeader>
              <CardTitle>Last capture</CardTitle>
              <CardDescription>Kết quả trả về trực tiếp từ capture API.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{lastCapture.deviceCode}</Badge>
                <Badge variant="outline">{lastCapture.laneCode}</Badge>
                <Badge variant="entry">{lastCapture.sessionStatus}</Badge>
              </div>
              <p className="text-sm text-foreground">session={lastCapture.sessionId}</p>
              <p className="text-sm text-foreground">plate={lastCapture.plateDisplay || lastCapture.plateCompact || lastCapture.plateRaw || '—'}</p>
              {lastCapture.imageUrl ? <img src={lastCapture.imageUrl} alt="capture" className="max-h-72 w-full rounded-lg border border-border object-contain" /> : null}
            </CardContent>
          </Card>
        ) : null}

        <div className="rounded-lg border border-border bg-card/70 px-4 py-3 text-xs text-muted-foreground">
          Điện thoại này đang hoạt động như một edge camera device: có deviceCode, có deviceSecret, có heartbeat và có signed ALPR capture.
        </div>
      </div>
    </div>
  )
}
