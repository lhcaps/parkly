import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertCircle,
  Bug,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  ExternalLink,
  FileImage,
  Loader2,
  ScanSearch,
  Wifi,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ValidationSummary } from '@/components/forms/validation-summary'
import { alprPreview } from '@/lib/api/alpr'
import {
  createLocalImagePreviewUrl,
  readMobileCaptureContextFromLocation,
  sendCaptureAlpr,
  sendDeviceHeartbeat,
  validateEffectiveDeviceContext,
  type EffectiveDeviceContext,
} from '@/lib/api/mobile'
import { extractValidationFieldErrors, toAppErrorDisplay } from '@/lib/http/errors'
import { buildRoutePath } from '@/lib/router/url-state'
import { cn } from '@/lib/utils'
import type { Direction } from '@/lib/contracts/common'
import type { AlprRecognizeRes } from '@/lib/contracts/alpr'
import type { CaptureReadRes } from '@/lib/contracts/mobile'

const IS_DEV = import.meta.env.DEV

function rid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

type OperationStatus =
  | { kind: 'idle' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; title: string; message: string; requestId?: string; hint?: string }

function StatusBlock({ status }: { status: OperationStatus }) {
  if (status.kind === 'idle') return null
  if (status.kind === 'ok') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {status.message}
      </div>
    )
  }
  return (
    <div className="space-y-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{status.title}</p>
          <p className="mt-1 break-all text-destructive/85">{status.message}</p>
        </div>
      </div>
      {status.requestId ? (
        <p className="font-mono-data text-[11px] text-destructive/70">requestId: {status.requestId}</p>
      ) : null}
      {status.hint ? <p className="text-xs text-destructive/70">{status.hint}</p> : null}
    </div>
  )
}

function errorToStatus(error: unknown, surface: 'heartbeat' | 'capture' | 'preview'): OperationStatus {
  const display = toAppErrorDisplay(error, `${surface} failed`)
  if (display.kind === 'unauthorized') {
    return {
      kind: 'error',
      title: `Device authentication failed`,
      message: `The deviceCode / deviceSecret used for ${surface} was rejected. Check that both match the registered device.`,
      requestId: display.requestId,
      hint: 'Verify deviceCode and deviceSecret in the form above match the device registered on this lane.',
    }
  }
  return {
    kind: 'error',
    title: display.title,
    message: display.message + (display.nextAction ? ` ${display.nextAction}` : ''),
    requestId: display.requestId,
  }
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground/70">
      {children}
    </p>
  )
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate text-right text-xs font-medium text-foreground">{value}</span>
    </div>
  )
}

/** Dev-only debug panel showing exactly what context will be used for signing */
function DevContextDebug({ ctx }: { ctx: EffectiveDeviceContext & { pairToken: string } }) {
  const [open, setOpen] = useState(false)
  if (!IS_DEV) return null
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground"
      >
        <Bug className="h-3.5 w-3.5" />
        <span className="font-mono-data">dev: effective signing context</span>
        {open ? <ChevronDown className="ml-auto h-3.5 w-3.5" /> : <ChevronRight className="ml-auto h-3.5 w-3.5" />}
      </button>
      {open ? (
        <pre className="overflow-x-auto border-t border-border/50 px-3 py-2 font-mono-data text-[11px] text-foreground">
          {JSON.stringify({ ...ctx, deviceSecret: ctx.deviceSecret ? `${ctx.deviceSecret.slice(0, 4)}…[${ctx.deviceSecret.length}]` : '(empty)' }, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}

export function MobileCapturePage() {
  // Read URL/query context once at mount — for initial prefill only.
  // After mount, all operations use live form state (never stale URL values).
  const initial = useMemo(() => readMobileCaptureContextFromLocation(), [])

  const [siteCode, setSiteCode] = useState(initial.siteCode)
  const [laneCode, setLaneCode] = useState(initial.laneCode)
  const [direction, setDirection] = useState<Direction>(initial.direction)
  const [deviceCode, setDeviceCode] = useState(initial.deviceCode)
  const [deviceSecret, setDeviceSecret] = useState(initial.deviceSecret)
  const [pairToken] = useState(initial.token)

  const [file, setFile] = useState<File | null>(null)
  const [localImageUrl, setLocalImageUrl] = useState<string>('')  // object URL for display only
  const [plateHint, setPlateHint] = useState('')
  const [overridePlate, setOverridePlate] = useState('')
  const [preview, setPreview] = useState<AlprRecognizeRes | null>(null)
  const [lastCapture, setLastCapture] = useState<CaptureReadRes | null>(null)

  // Separate pending state per operation — no shared busy flag
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isSendingCapture, setIsSendingCapture] = useState(false)
  const [isSendingHeartbeat, setIsSendingHeartbeat] = useState(false)

  // Separate status surfaces per operation
  const [previewStatus, setPreviewStatus] = useState<OperationStatus>({ kind: 'idle' })
  const [captureStatus, setCaptureStatus] = useState<OperationStatus>({ kind: 'idle' })
  const [heartbeatStatus, setHeartbeatStatus] = useState<OperationStatus>({ kind: 'idle' })

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Revoke object URL on unmount or when file changes to avoid memory leaks
  useEffect(() => {
    return () => {
      if (localImageUrl) URL.revokeObjectURL(localImageUrl)
    }
  }, [localImageUrl])

  /**
   * Single source of truth for the device context used to sign ALL requests.
   * Always derived from live form state — never from URL params after mount.
   */
  const effectiveCtx: EffectiveDeviceContext = {
    siteCode: siteCode.trim(),
    laneCode: laneCode.trim(),
    direction,
    deviceCode: deviceCode.trim(),
    deviceSecret: deviceSecret.trim(),
  }

  const ctxValidation = validateEffectiveDeviceContext(effectiveCtx)
  const canSend = ctxValidation.valid

  const contextErrorItems = useMemo(
    () =>
      ctxValidation.valid
        ? []
        : ctxValidation.missing.map((field) => ({
            field,
            message: `${field} is required for device requests.`,
          })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [siteCode, laneCode, deviceCode, deviceSecret],
  )

  const captureValidationItems = useMemo(
    () =>
      extractValidationFieldErrors(
        captureStatus.kind === 'error'
          ? (captureStatus as unknown as { details?: unknown }).details
          : undefined,
      ),
    [captureStatus],
  )

  function clearFile() {
    if (localImageUrl) URL.revokeObjectURL(localImageUrl)
    setFile(null)
    setLocalImageUrl('')
    setPreview(null)
    setLastCapture(null)
    setPreviewStatus({ kind: 'idle' })
    setCaptureStatus({ kind: 'idle' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function applyPlate(value: string) {
    setOverridePlate(String(value || '').toUpperCase())
  }

  async function runPreview() {
    if (!file) {
      setPreviewStatus({ kind: 'error', title: 'No image selected', message: 'Select an image before previewing.' })
      return
    }

    setIsPreviewing(true)
    setPreviewStatus({ kind: 'idle' })

    try {
      // Step 1: local object URL for display — no server upload needed
      const objUrl = createLocalImagePreviewUrl(file)
      if (localImageUrl) URL.revokeObjectURL(localImageUrl)
      setLocalImageUrl(objUrl)

      // Step 2: run server ALPR preview with plate hint only (no image upload from device surface)
      // We pass no imageUrl here since /api/media/upload is user-auth. Backend will run
      // text-only preview if imageUrl is absent, or skip OCR entirely.
      // The plate override / hint is still applied.
      const result = await alprPreview(undefined, plateHint || undefined)
      setPreview(result)
      if (!overridePlate.trim()) applyPlate(result.plateDisplay || result.recognizedPlate)
      setPreviewStatus({ kind: 'ok', message: `Preview ready — ${result.previewStatus}` })
    } catch (err) {
      // Do NOT clear file/context — preserve for retry
      setPreviewStatus(errorToStatus(err, 'preview'))
    } finally {
      setIsPreviewing(false)
    }
  }

  async function sendHeartbeat() {
    if (!canSend) {
      setHeartbeatStatus({
        kind: 'error',
        title: 'Context incomplete',
        message: `Missing: ${(ctxValidation as { missing: string[] }).missing.join(', ')}`,
      })
      return
    }

    setIsSendingHeartbeat(true)
    setHeartbeatStatus({ kind: 'idle' })
    const now = new Date().toISOString()

    try {
      // Always use effectiveCtx — never stale URL params
      await sendDeviceHeartbeat({
        secret: effectiveCtx.deviceSecret,
        requestId: rid('mobile_hb'),
        idempotencyKey: rid('mobile_hb_idem'),
        siteCode: effectiveCtx.siteCode,
        deviceCode: effectiveCtx.deviceCode,
        laneCode: effectiveCtx.laneCode,
        direction: effectiveCtx.direction,
        timestamp: now,
        reportedAt: now,
        status: 'ONLINE',
        latencyMs: 40,
        firmwareVersion: 'mobile-capture-surface',
        rawPayload: { source: 'MOBILE_CAPTURE_PAGE', pairToken },
      })
      setHeartbeatStatus({ kind: 'ok', message: 'Heartbeat sent — ONLINE' })
    } catch (err) {
      setHeartbeatStatus(errorToStatus(err, 'heartbeat'))
    } finally {
      setIsSendingHeartbeat(false)
    }
  }

  async function sendCapture() {
    if (!canSend) {
      setCaptureStatus({
        kind: 'error',
        title: 'Context incomplete',
        message: `Missing: ${(ctxValidation as { missing: string[] }).missing.join(', ')}`,
      })
      return
    }
    if (!file && !plateHint.trim() && !overridePlate.trim()) {
      setCaptureStatus({
        kind: 'error',
        title: 'Nothing to send',
        message: 'At least one image or plate hint is required.',
      })
      return
    }

    setIsSendingCapture(true)
    setCaptureStatus({ kind: 'idle' })

    try {
      const now = new Date().toISOString()
      const effectivePlate = overridePlate.trim() || preview?.plateDisplay || preview?.recognizedPlate || plateHint.trim()

      // Note: We do NOT upload the image via /api/media/upload — that route requires
      // user authentication and is not available from a device-signed surface.
      // The capture is sent with plate data only. imageUrl is omitted.
      const data = await sendCaptureAlpr({
        secret: effectiveCtx.deviceSecret,
        requestId: rid('mobile_alpr'),
        idempotencyKey: rid('mobile_alpr_idem'),
        siteCode: effectiveCtx.siteCode,
        laneCode: effectiveCtx.laneCode,
        deviceCode: effectiveCtx.deviceCode,
        direction: effectiveCtx.direction,
        timestamp: now,
        eventTime: now,
        plateRaw: effectivePlate || undefined,
        imageUrl: null,  // device surface cannot use /api/media/upload (user-auth)
        ocrConfidence: preview?.confidence ?? null,
        rawPayload: {
          source: 'MOBILE_CAPTURE_PAGE',
          previewStatus: preview?.previewStatus ?? null,
          pairToken,
        },
      })

      setLastCapture(data)
      setCaptureStatus({ kind: 'ok', message: `Capture accepted · ${data.sessionStatus}` })
    } catch (err) {
      // Do NOT clear file/preview/context — preserve for retry
      setCaptureStatus(errorToStatus(err, 'capture'))
    } finally {
      setIsSendingCapture(false)
    }
  }

  const allValidation = [...contextErrorItems, ...captureValidationItems]

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto max-w-md space-y-5">

        {/* ── Header ── */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">mobile surface</Badge>
            {pairToken ? <Badge variant="outline">pair token active</Badge> : null}
            <Badge variant={canSend ? 'entry' : 'amber'}>
              {canSend ? 'ready' : 'context incomplete'}
            </Badge>
          </div>
          <p className="text-[10px] font-mono-data uppercase tracking-[0.2em] text-muted-foreground/60">
            Parkly Mobile Edge Camera
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Mobile Capture</h1>
          <p className="text-sm text-muted-foreground">
            Lightweight capture surface — preview, plate override, and signed ALPR submission.
          </p>
        </div>

        <ValidationSummary items={allValidation} />

        {/* Dev debug — shows exactly what context is used for signing */}
        <DevContextDebug ctx={{ ...effectiveCtx, pairToken }} />

        {/* ── Device context ── */}
        <Card className="border-border/80 bg-card/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Device context</CardTitle>
            <CardDescription>
              Pre-loaded from pair link. Editing any field here overrides the pair/query values for all requests.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="space-y-1">
              <SectionLabel>Site</SectionLabel>
              <Input value={siteCode} onChange={(e) => setSiteCode(e.target.value)} placeholder="siteCode" />
            </div>
            <div className="space-y-1">
              <SectionLabel>Lane</SectionLabel>
              <Input value={laneCode} onChange={(e) => setLaneCode(e.target.value)} placeholder="laneCode" />
            </div>
            <div className="space-y-1">
              <SectionLabel>Direction</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {(['ENTRY', 'EXIT'] as Direction[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    className={cn(
                      'rounded-2xl border px-4 py-2.5 text-sm font-medium transition',
                      direction === d
                        ? d === 'ENTRY'
                          ? 'border-success/40 bg-success/15 text-success'
                          : 'border-destructive/40 bg-destructive/15 text-destructive'
                        : 'border-border/70 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <SectionLabel>Device code</SectionLabel>
              <Input value={deviceCode} onChange={(e) => setDeviceCode(e.target.value)} placeholder="deviceCode" />
            </div>
            <div className="space-y-1">
              <SectionLabel>Device secret</SectionLabel>
              <Input
                value={deviceSecret}
                onChange={(e) => setDeviceSecret(e.target.value)}
                placeholder="deviceSecret"
                type="password"
                autoComplete="off"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Capture surface ── */}
        <Card className="border-border/80 bg-card/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Capture surface</CardTitle>
            <CardDescription>
              Image preview is local only. Capture is submitted with plate data — no server image upload required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null
                if (localImageUrl) URL.revokeObjectURL(localImageUrl)
                setFile(picked)
                setLocalImageUrl('')
                setPreview(null)
                setLastCapture(null)
                setPreviewStatus({ kind: 'idle' })
                setCaptureStatus({ kind: 'idle' })
              }}
            />

            {/* Styled file picker */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex h-10 w-full items-center gap-2.5 rounded-2xl border px-3 text-left text-sm transition-colors',
                'border-border/80 bg-input hover:border-primary/40 hover:bg-accent/50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <Camera className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className={cn('flex-1 truncate', file ? 'text-foreground' : 'text-muted-foreground')}>
                {file ? file.name : 'Choose image or take photo…'}
              </span>
              {file ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Clear selected file"
                  onClick={(e) => { e.stopPropagation(); clearFile() }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); clearFile() } }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </span>
              ) : (
                <FileImage className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              )}
            </button>

            <Input
              value={plateHint}
              onChange={(e) => setPlateHint(e.target.value)}
              placeholder="Plate hint (optional)"
            />
            <Input
              value={overridePlate}
              onChange={(e) => setOverridePlate(e.target.value.toUpperCase())}
              placeholder="Plate confirm / override"
              className="font-mono-data"
            />

            {/* Local image preview (object URL, no upload) */}
            {localImageUrl ? (
              <img
                src={localImageUrl}
                alt="Local preview"
                className="max-h-52 w-full rounded-2xl border border-border object-contain"
              />
            ) : null}

            {/* Preview status */}
            <StatusBlock status={previewStatus} />

            {/* Primary actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void runPreview()}
                disabled={isPreviewing || !file}
                className="w-full"
              >
                {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                {isPreviewing ? 'Previewing…' : 'Preview'}
              </Button>
              <Button
                type="button"
                onClick={() => void sendCapture()}
                disabled={isSendingCapture || !canSend}
                className="w-full"
              >
                {isSendingCapture ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCopy className="h-4 w-4" />}
                {isSendingCapture ? 'Sending…' : 'Send capture'}
              </Button>
            </div>

            {/* Capture status */}
            <StatusBlock status={captureStatus} />

            {/* Heartbeat — secondary */}
            <div className="space-y-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void sendHeartbeat()}
                disabled={isSendingHeartbeat || !canSend}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                {isSendingHeartbeat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                {isSendingHeartbeat ? 'Sending heartbeat…' : 'Heartbeat ONLINE'}
              </Button>
              <StatusBlock status={heartbeatStatus} />
            </div>
          </CardContent>
        </Card>

        {/* ── ALPR preview result (from server) ── */}
        {preview ? (
          <Card className="border-border/80 bg-card/95">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Preview</CardTitle>
                <Badge variant={preview.previewStatus === 'STRICT_VALID' ? 'entry' : preview.previewStatus === 'REVIEW' ? 'amber' : 'destructive'}>
                  {preview.previewStatus}
                </Badge>
                {preview.needsConfirm
                  ? <Badge variant="amber">confirm needed</Badge>
                  : <Badge variant="secondary">ready</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border/80 bg-background/40 p-3">
                <DataRow label="Plate" value={preview.plateDisplay || preview.recognizedPlate || '—'} />
                <DataRow label="Confidence" value={preview.confidence.toFixed(2)} />
                {preview.winner ? (
                  <DataRow label="Winner" value={`${preview.winner.cropVariant} · psm ${preview.winner.psm}`} />
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPlate(preview.plateDisplay || preview.recognizedPlate)}
                >
                  Apply top result
                </Button>
                {preview.candidates.slice(0, 3).map((c) => (
                  <Button
                    key={`${c.plate}:${c.score}`}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPlate(c.plate)}
                    className="font-mono-data"
                  >
                    {c.plate}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* ── Last capture result ── */}
        {lastCapture ? (
          <Card className="border-border/80 bg-card/95">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Capture accepted</CardTitle>
                <Badge variant="entry">{lastCapture.sessionStatus}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border/80 bg-background/40 p-3">
                <DataRow label="Session" value={String(lastCapture.sessionId)} />
                <DataRow label="Plate" value={lastCapture.plateDisplay || lastCapture.plateCompact || lastCapture.plateRaw || '—'} />
                <DataRow label="Lane" value={lastCapture.laneCode} />
                <DataRow label="Direction" value={lastCapture.direction} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(
                      buildRoutePath('/session-history', {
                        siteCode,
                        sessionId: lastCapture.sessionId,
                        q: lastCapture.plateDisplay || lastCapture.plateCompact || lastCapture.plateRaw || undefined,
                      }),
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                >
                  <ExternalLink className="h-4 w-4" />
                  Session history
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    window.open(
                      buildRoutePath('/run-lane', { siteCode, laneCode }),
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                >
                  <ExternalLink className="h-4 w-4" />
                  Run lane
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <p className="text-center text-xs text-muted-foreground/60">
          Edge camera surface — device code, secret, heartbeat, and signed ALPR capture.
        </p>

      </div>
    </div>
  )
}
