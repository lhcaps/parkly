import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
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
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ValidationSummary } from '@/components/forms/validation-summary'
import { MobileCaptureJournal } from '@/features/mobile-capture/components/MobileCaptureJournal'
import {
  MobileContextSummaryCard,
  type MobileContextDiagnostic,
  type MobileContextReadiness,
} from '@/features/mobile-capture/components/MobileContextSummaryCard'
import {
  appendMobileCaptureJournal,
  buildJournalScopeKey,
  buildMobileCaptureContextSnapshot,
  clearMobileCaptureJournal,
  formatMobileCaptureContextSnapshot,
  readMobileCaptureJournal,
  type MobileCaptureJournalEntry,
} from '@/features/mobile-capture/mobile-capture-storage'
import { previewImageFile } from '@/lib/api/alpr'
import {
  createLocalImagePreviewUrl,
  hasEffectiveDeviceContextOverride,
  maskDeviceSecret,
  normalizeEffectiveDeviceContext,
  readMobileCaptureSeedFromLocation,
  sendCaptureAlpr,
  sendMobileCaptureAlpr,
  sendMobileCaptureHeartbeat,
  sendMobileCaptureUpload,
  sendDeviceHeartbeat,
  validateForMobileCapture,
  type EffectiveDeviceContext,
  type MobileCaptureUploadRes,
} from '@/lib/api/mobile'
import {
  extractValidationFieldErrors,
  normalizeApiError,
  toAppErrorDisplay,
} from '@/lib/http/errors'
import { buildRoutePath } from '@/lib/router/url-state'
import { cn } from '@/lib/utils'
import type { Direction } from '@/lib/contracts/common'
import type { AlprRecognizeRes } from '@/lib/contracts/alpr'
import type { CaptureReadRes } from '@/lib/contracts/mobile'
import type { PlateCanonicalDto } from '@parkly/contracts'

const IS_DEV = import.meta.env.DEV

function rid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

type OperationStatus =
  | { kind: 'idle' }
  | { kind: 'ok'; message: string; requestId?: string; hint?: string }
  |     {
      kind: 'error'
      title: string
      message: string
      /** Full technical message when we show a short user-facing message */
      technicalMessage?: string
      requestId?: string
      hint?: string
      code?: string
      fieldErrors?: Array<{ field: string; message: string }>
    }

type ErrorOperationStatus = Extract<OperationStatus, { kind: 'error' }>

const MAX_ERROR_PREVIEW = 100

function StatusBlock({ status }: { status: OperationStatus }) {
  const { t } = useTranslation()
  const [showDetails, setShowDetails] = useState(false)
  if (status.kind === 'idle') return null
  if (status.kind === 'ok') {
    return (
      <div className="space-y-2 rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{status.message}</span>
        </div>
        {status.requestId ? (
          <p className="font-mono-data text-[11px] text-success/80">{t('common.requestId')}: {status.requestId}</p>
        ) : null}
        {status.hint ? <p className="text-xs text-success/80">{status.hint}</p> : null}
      </div>
    )
  }
  const shortMessage =
    status.message.length <= MAX_ERROR_PREVIEW
      ? status.message
      : status.message.slice(0, MAX_ERROR_PREVIEW).trim() + '...'
  const hasDetails =
    status.technicalMessage ||
    status.message.length > MAX_ERROR_PREVIEW ||
    status.requestId ||
    status.code ||
    status.hint
  return (
    <div className="space-y-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{status.title}</p>
          <p className="mt-1 break-words text-destructive/90">{shortMessage}</p>
        </div>
      </div>
      {hasDetails && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-1 text-xs text-destructive/80 underline underline-offset-2 hover:text-destructive"
          >
            {showDetails ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {showDetails ? t('mobileCapturePage.detailsHide') : t('mobileCapturePage.detailsShow')}
          </button>
          {showDetails && (
            <div className="mt-2 space-y-1 rounded-lg bg-destructive/10 px-3 py-2 font-mono-data text-[11px] text-destructive/90">
              {status.technicalMessage && <p className="break-all">{status.technicalMessage}</p>}
              {!status.technicalMessage && status.message.length > MAX_ERROR_PREVIEW && (
                <p className="break-all">{status.message}</p>
              )}
              {status.requestId && <p>{t('common.requestId')}: {status.requestId}</p>}
              {status.code && <p>{t('mobileCapturePage.codeLabel')}: {status.code}</p>}
              {status.hint && <p className="mt-1">{status.hint}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function errorToStatus(
  t: TFunction,
  error: unknown,
  surface: 'heartbeat' | 'capture' | 'preview',
  fallbackRequestId?: string,
): ErrorOperationStatus {
  const normalized = normalizeApiError(error)
  const display = toAppErrorDisplay(normalized, t(`mobileCapturePage.errors.${surface}Failed`))
  const requestId = normalized.requestId || fallbackRequestId
  const fieldErrors = extractValidationFieldErrors(normalized.details)
  const isDeviceSignatureInvalid = normalized.code === 'DEVICE_SIGNATURE_INVALID'
  const isDeviceUnauthorized = surface !== 'preview' && (isDeviceSignatureInvalid || display.kind === 'unauthorized')

  if (isDeviceUnauthorized) {
    return {
      kind: 'error',
      title: isDeviceSignatureInvalid
        ? t('mobileCapturePage.errors.deviceSignatureInvalidTitle')
        : t('mobileCapturePage.errors.deviceAuthenticationFailedTitle'),
      message: isDeviceSignatureInvalid
        ? t('mobileCapturePage.errors.deviceSignatureInvalidMessage')
        : t('mobileCapturePage.errors.deviceAuthenticationFailedMessage'),
      requestId,
      code: normalized.code,
      hint: t('mobileCapturePage.errors.deviceAuthHint'),
      fieldErrors,
    }
  }

  if (normalized.code === 'DEP_UNAVAILABLE') {
    const details = normalized.details as Record<string, unknown> | undefined
    const dependency = details?.dependency as string | undefined
    const hint = details?.hint as string | undefined
    return {
      kind: 'error',
      title: t('mobileCapturePage.errors.serviceUnavailableTitle', { dependency: dependency ?? 'Service' }),
      message: hint
        ? t('mobileCapturePage.errors.serviceUnavailableMessageWithHint', { message: display.message, hint })
        : t('mobileCapturePage.errors.serviceUnavailableMessageFallback', {
            message: display.message,
            dependency: dependency ?? 'Redis',
          }),
      requestId,
      code: normalized.code,
      hint: hint ?? t('mobileCapturePage.errors.serviceUnavailableHint', { dependency: dependency ?? 'Redis' }),
      fieldErrors,
    }
  }

  // Strict plate validation failures - show a friendly summary plus backend detail.
  if (normalized.code === 'BAD_REQUEST' && /strict validation|plate.*(validation|format)/i.test(display.message)) {
    const details = normalized.details as Record<string, unknown> | undefined
    const reasons = details?.reasons as string | undefined
    const plateRaw = details?.plateRaw as string | undefined
    const suggestion = details?.suggestion as string | undefined
    return {
      kind: 'error',
      title: display.title,
      message: t('mobileCapturePage.errors.strictPlateMessage'),
      technicalMessage: display.message + (plateRaw ? ` (plateRaw="${plateRaw}")` : ''),
      requestId,
      hint: [
        reasons ? t('mobileCapturePage.errors.strictPlateReason', { reason: reasons }) : null,
        suggestion ?? t('mobileCapturePage.errors.strictPlateSuggestion'),
      ].filter(Boolean).join(' | '),
      code: normalized.code,
      fieldErrors,
    }
  }

  const fullMessage = display.message + (display.nextAction ? ` ${display.nextAction}` : '')
  const friendlyShort =
    normalized.code === 'BAD_REQUEST' && /imageUrl|plateHint|OCR|image|plate/i.test(display.message)
      ? t('mobileCapturePage.errors.imageHintMessage')
      : normalized.code === 'NOT_FOUND' && /pair|token|expired|invalid|valid/i.test(display.message)
        ? t('mobileCapturePage.errors.pairTokenInvalidMessage')
        : null
  return {
    kind: 'error',
    title: display.title,
    message: friendlyShort ?? fullMessage,
    technicalMessage: friendlyShort ? fullMessage : undefined,
    requestId,
    hint: normalized.code && normalized.code !== 'UNKNOWN_ERROR' ? `errorCode: ${normalized.code}` : undefined,
    code: normalized.code,
    fieldErrors,
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

function DevContextDebug({
  seed,
  effective,
  pairToken,
  hasManualOverrides,
}: {
  seed: ReturnType<typeof readMobileCaptureSeedFromLocation>
  effective: EffectiveDeviceContext
  pairToken: string
  hasManualOverrides: boolean
}) {
  const { t } = useTranslation()
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
        <span className="font-mono-data">{t('mobileCapturePage.devContext')}</span>
        {open ? <ChevronDown className="ml-auto h-3.5 w-3.5" /> : <ChevronRight className="ml-auto h-3.5 w-3.5" />}
      </button>
      {open ? (
        <pre className="overflow-x-auto border-t border-border/50 px-3 py-2 font-mono-data text-[11px] text-foreground">
          {JSON.stringify({
            pairToken,
            hasManualOverrides,
            seed: {
              ...seed,
              deviceSecret: maskDeviceSecret(seed.deviceSecret),
            },
            effective: {
              ...effective,
              deviceSecret: maskDeviceSecret(effective.deviceSecret),
            },
          }, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}

export function MobileCapturePage() {
  const { t } = useTranslation()
  const initialSeed = useMemo(() => readMobileCaptureSeedFromLocation(), [])
  const [editableCtx, setEditableCtx] = useState<EffectiveDeviceContext>(() => normalizeEffectiveDeviceContext(initialSeed))
  const pairToken = initialSeed.token
  const dash = t('common.dash')

  const [file, setFile] = useState<File | null>(null)
  const [localImageUrl, setLocalImageUrl] = useState('')
  const [plateHint, setPlateHint] = useState('')
  const [overridePlate, setOverridePlate] = useState('')
  const [preview, setPreview] = useState<AlprRecognizeRes | null>(null)
  const [lastCapture, setLastCapture] = useState<CaptureReadRes | null>(null)
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState('')
  const [lastHeartbeatRequestId, setLastHeartbeatRequestId] = useState('')
  const [lastCaptureRequestId, setLastCaptureRequestId] = useState('')

  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isSendingCapture, setIsSendingCapture] = useState(false)
  const [isSendingHeartbeat, setIsSendingHeartbeat] = useState(false)

  const [previewStatus, setPreviewStatus] = useState<OperationStatus>({ kind: 'idle' })
  const [captureStatus, setCaptureStatus] = useState<OperationStatus>({ kind: 'idle' })
  const [heartbeatStatus, setHeartbeatStatus] = useState<OperationStatus>({ kind: 'idle' })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const journalScopeKey = useMemo(
    () => buildJournalScopeKey({
      pairToken: initialSeed.token,
      siteCode: initialSeed.siteCode,
      laneCode: initialSeed.laneCode,
      deviceCode: initialSeed.deviceCode,
    }),
    [initialSeed],
  )
  const [journalRows, setJournalRows] = useState<MobileCaptureJournalEntry[]>(() => readMobileCaptureJournal(journalScopeKey))

  useEffect(() => {
    setJournalRows(readMobileCaptureJournal(journalScopeKey))
  }, [journalScopeKey])

  useEffect(() => {
    return () => {
      if (localImageUrl) URL.revokeObjectURL(localImageUrl)
    }
  }, [localImageUrl])

  const effectiveCtx = useMemo(() => normalizeEffectiveDeviceContext(editableCtx), [editableCtx])
  const mobileCaptureValidation = useMemo(
    () => validateForMobileCapture(effectiveCtx, { pairToken }),
    [effectiveCtx, pairToken],
  )
  const canSend = mobileCaptureValidation.valid
  const blockingMissingFields = mobileCaptureValidation.valid ? [] : mobileCaptureValidation.missing
  const hasManualOverrides = useMemo(
    () => hasEffectiveDeviceContextOverride(initialSeed, effectiveCtx),
    [effectiveCtx, initialSeed],
  )

  const contextSnapshot = useMemo(
    () => buildMobileCaptureContextSnapshot({
      seed: initialSeed,
      effective: effectiveCtx,
      hasManualOverrides,
    }),
    [effectiveCtx, hasManualOverrides, initialSeed],
  )

  const resolveFieldLabel = useCallback((field: string) => {
    switch (field) {
      case 'siteCode':
        return t('mobileCapturePage.fields.site')
      case 'laneCode':
        return t('mobileCapturePage.fields.lane')
      case 'deviceCode':
        return t('mobileCapturePage.fields.deviceCode')
      case 'deviceSecret':
        return t('mobileCapturePage.fields.deviceSecret')
      default:
        return field
    }
  }, [t])

  const contextDiagnostics = useMemo<MobileContextDiagnostic[]>(() => {
    const rows: MobileContextDiagnostic[] = []
    if (blockingMissingFields.length > 0) {
      for (const field of blockingMissingFields) {
        const fieldLabel = resolveFieldLabel(field)
        rows.push({
          tone: 'blocked',
          code: `missing-${field}`,
          label: t('mobileCapturePage.diagnostics.missingLabel', { field: fieldLabel }),
          detail:
            field === 'deviceSecret'
              ? t('mobileCapturePage.diagnostics.missingSecretDetail')
              : t('mobileCapturePage.diagnostics.missingFieldDetail', { field: fieldLabel }),
        })
      }
    }

    if (hasManualOverrides) {
      rows.push({
        tone: 'attention',
        code: 'manual-override',
        label: t('mobileCapturePage.diagnostics.manualOverrideLabel'),
        detail: t('mobileCapturePage.diagnostics.manualOverrideDetail'),
      })
    }

    if (!pairToken) {
      rows.push({
        tone: 'attention',
        code: 'missing-pair-token',
        label: t('mobileCapturePage.diagnostics.pairTokenMissingLabel'),
        detail: t('mobileCapturePage.diagnostics.pairTokenMissingDetail'),
      })
    }

    if (initialSeed.source === 'query') {
      rows.push({
        tone: 'ready',
        code: 'prefill-query',
        label: t('mobileCapturePage.diagnostics.queryPrefillLabel'),
        detail: t('mobileCapturePage.diagnostics.queryPrefillDetail'),
      })
    }

    return rows
  }, [blockingMissingFields, hasManualOverrides, initialSeed.source, pairToken, resolveFieldLabel, t])

  const contextReadiness = useMemo<MobileContextReadiness>(() => {
    if (contextDiagnostics.some((item) => item.tone === 'blocked')) return 'blocked'
    if (contextDiagnostics.some((item) => item.tone === 'attention')) return 'attention'
    return 'ready'
  }, [contextDiagnostics])

  const contextErrorItems = useMemo(
    () =>
      mobileCaptureValidation.valid
        ? []
        : mobileCaptureValidation.missing.map((field) => ({
            field: resolveFieldLabel(field),
            message:
              field === 'deviceSecret'
                ? t('mobileCapturePage.validation.missingSecret')
                : t('mobileCapturePage.validation.missingField', { field: resolveFieldLabel(field) }),
          })),
    [mobileCaptureValidation, resolveFieldLabel, t],
  )

  const captureValidationItems = useMemo(
    () => (captureStatus.kind === 'error' ? captureStatus.fieldErrors || [] : []),
    [captureStatus],
  )

  const allValidation = [...contextErrorItems, ...captureValidationItems]

  function pushJournal(entry: Omit<MobileCaptureJournalEntry, 'id' | 'ts'> & { ts?: string }) {
    setJournalRows(appendMobileCaptureJournal(journalScopeKey, entry))
  }

  function setCtxField<K extends keyof EffectiveDeviceContext>(field: K, value: EffectiveDeviceContext[K]) {
    setEditableCtx((current) => ({ ...current, [field]: value }))
  }

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
      setPreviewStatus({
        kind: 'error',
        title: t('mobileCapturePage.errors.noImageTitle'),
        message: t('mobileCapturePage.errors.noImageMessage'),
      })
      return
    }

    setIsPreviewing(true)
    setPreviewStatus({ kind: 'idle' })

    try {
      const objUrl = createLocalImagePreviewUrl(file)
      if (localImageUrl) URL.revokeObjectURL(localImageUrl)
      setLocalImageUrl(objUrl)

      // Use mobile capture API if pairToken is available
      let result: AlprRecognizeRes
      if (pairToken) {
        // Upload then ALPR via mobile capture endpoints
        const uploadRes: MobileCaptureUploadRes = await sendMobileCaptureUpload({ pairToken, file })
        const imageUrlForAlpr = uploadRes.imageUrl ?? uploadRes.viewUrl ?? undefined
        const alprRes = await sendMobileCaptureAlpr({
          pairToken,
          mediaId: uploadRes.mediaId,
          imageUrl: imageUrlForAlpr,
          plateHint: plateHint || undefined,
        })
        // Transform to AlprRecognizeRes format
        // NOTE: recognition.recognizedPlate is the OCR result; recognition.plate (if set) is the canonical form.
        // Backend (local-alpr.service.ts) returns recognizedPlate + optionally plate.
        const rec = alprRes.recognition
        const canonicalPlate = rec.plate || rec.recognizedPlate || null
        result = {
          plate: {
            plateRaw: rec.plate || rec.recognizedPlate || null,
            plateCompact: null,
            plateDisplay: canonicalPlate,
            plateFamily: (rec.plateFamily as AlprRecognizeRes['plateFamily']) || 'UNKNOWN',
            plateValidity: (rec.previewStatus as AlprRecognizeRes['plateValidity']) || 'INVALID',
            ocrSubstitutions: rec.ocrSubstitutions || [],
            suspiciousFlags: rec.suspiciousFlags || [],
            validationNotes: rec.validationNotes || [],
            reviewRequired: rec.needsConfirm ?? rec.previewStatus !== 'STRICT_VALID',
          },
          recognizedPlate: rec.recognizedPlate || '',
          confidence: rec.confidence ?? 0,
          previewStatus: rec.previewStatus || 'INVALID',
          needsConfirm: rec.needsConfirm ?? rec.previewStatus !== 'STRICT_VALID',
          candidates: (rec.candidates || []).map((c) => ({
            plate: c.plate,
            score: c.score,
            votes: c.votes,
            cropVariants: c.cropVariants,
            psmModes: c.psmModes,
            suspiciousFlags: c.suspiciousFlags,
          })),
          winner: rec.winner
            ? {
                plate: rec.winner.rawText || rec.recognizedPlate,
                cropVariant: rec.winner.cropVariant,
                psm: rec.winner.psm,
                rawText: rec.winner.rawText,
                score: rec.winner.score,
              }
            : null,
          plateRaw: alprRes.capture?.plateRaw || null,
          plateCompact: null,
          plateDisplay: canonicalPlate,
          plateFamily: (rec.plateFamily as AlprRecognizeRes['plateFamily']) || 'UNKNOWN',
          plateValidity: (rec.previewStatus as AlprRecognizeRes['plateValidity']) || 'INVALID',
          ocrSubstitutions: rec.ocrSubstitutions || [],
          suspiciousFlags: rec.suspiciousFlags || [],
          validationNotes: rec.validationNotes || [],
          reviewRequired: rec.needsConfirm ?? rec.previewStatus !== 'STRICT_VALID',
          raw: rec.raw || {},
        }
      } else {
        // Fallback to regular ALPR API (requires user auth).
        // Upload first so preview can still run against the selected image.
        const previewResult = await previewImageFile(file, plateHint || undefined)
        result = previewResult.preview
      }
      setPreview(result)
      if (!overridePlate.trim()) applyPlate(result.plateDisplay || result.recognizedPlate)
      setPreviewStatus({ kind: 'ok', message: t('mobileCapturePage.status.previewReady', { status: result.previewStatus }) })
      pushJournal({
        type: 'preview',
        summary: t('mobileCapturePage.journal.previewReadySummary', { status: result.previewStatus }),
        detail: [
          `plate=${result.plateDisplay || result.recognizedPlate || dash}`,
          `confidence=${result.confidence.toFixed(2)}`,
          formatMobileCaptureContextSnapshot(contextSnapshot),
        ].join(' | '),
      })
    } catch (err) {
      const status = errorToStatus(t, err, 'preview')
      setPreviewStatus(status)
      pushJournal({
        type: 'error',
        summary: t('mobileCapturePage.journal.previewFailedSummary', { title: status.title }),
        detail: [status.message, status.requestId ? `requestId=${status.requestId}` : ''].filter(Boolean).join(' · '),
      })
    } finally {
      setIsPreviewing(false)
    }
  }

  async function sendHeartbeat() {
    if (!canSend) {
      setHeartbeatStatus({
        kind: 'error',
        title: t('mobileCapturePage.errors.contextIncompleteTitle'),
        message: t('mobileCapturePage.errors.contextIncompleteMessage', {
          fields: blockingMissingFields.map((field) => resolveFieldLabel(field)).join(', '),
        }),
      })
      return
    }

    setIsSendingHeartbeat(true)
    setHeartbeatStatus({ kind: 'idle' })

    const requestId = rid('mobile_hb')
    try {
      const now = new Date().toISOString()
      
      // Use mobile capture heartbeat if pairToken is available
      if (pairToken) {
        await sendMobileCaptureHeartbeat({
          pairToken,
          status: 'ONLINE',
          latencyMs: 40,
          firmwareVersion: 'mobile-capture-surface',
          ipAddress: null,
        })
      } else {
        // Fallback to regular heartbeat API (requires user auth)
        await sendDeviceHeartbeat({
          secret: effectiveCtx.deviceSecret,
          requestId,
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
          rawPayload: {
            source: 'MOBILE_CAPTURE_PAGE',
            effectiveContextKey: contextSnapshot.effectiveKey,
          },
        })
      }
      setLastHeartbeatAt(now)
      setLastHeartbeatRequestId(requestId)
      setHeartbeatStatus({
        kind: 'ok',
        message: t('mobileCapturePage.status.heartbeatSent'),
        requestId,
        hint: pairToken
          ? t('mobileCapturePage.status.heartbeatHintPair')
          : t('mobileCapturePage.status.heartbeatHintLocal'),
      })
      pushJournal({
        type: 'heartbeat',
        summary: t('mobileCapturePage.journal.heartbeatSentSummary'),
        detail: [
          `requestId=${requestId}`,
          formatMobileCaptureContextSnapshot(contextSnapshot),
        ].join(' | '),
      })
    } catch (err) {
      const status = errorToStatus(t, err, 'heartbeat', requestId)
      setHeartbeatStatus(status)
      pushJournal({
        type: 'error',
        summary: t('mobileCapturePage.journal.heartbeatFailedSummary', { title: status.title }),
        detail: [status.message, status.requestId ? `requestId=${status.requestId}` : ''].filter(Boolean).join(' · '),
      })
    } finally {
      setIsSendingHeartbeat(false)
    }
  }

  async function sendCapture() {
    if (!canSend) {
      setCaptureStatus({
        kind: 'error',
        title: t('mobileCapturePage.errors.contextIncompleteTitle'),
        message: t('mobileCapturePage.errors.contextIncompleteMessage', {
          fields: blockingMissingFields.map((field) => resolveFieldLabel(field)).join(', '),
        }),
      })
      return
    }
    if (!file && !plateHint.trim() && !overridePlate.trim()) {
      setCaptureStatus({
        kind: 'error',
        title: t('mobileCapturePage.errors.nothingToSendTitle'),
        message: t('mobileCapturePage.errors.nothingToSendMessage'),
      })
      return
    }

    setIsSendingCapture(true)
    setCaptureStatus({ kind: 'idle' })

    const requestId = rid('mobile_alpr')
    try {
      const now = new Date().toISOString()
      const effectivePlate = overridePlate.trim() || preview?.plateDisplay || preview?.recognizedPlate || plateHint.trim()
      
      // Use mobile capture ALPR if pairToken is available
      let data: CaptureReadRes
      if (pairToken) {
        // Upload file if present
        let mediaId: string | undefined
        let imageUrlForAlpr: string | undefined
        if (file) {
          const uploadRes = await sendMobileCaptureUpload({ pairToken, file })
          mediaId = uploadRes.mediaId
          imageUrlForAlpr = uploadRes.imageUrl ?? uploadRes.viewUrl
        }
        
        // Send ALPR via mobile capture endpoint
        const alprRes = await sendMobileCaptureAlpr({
          pairToken,
          mediaId: mediaId ?? null,
          imageUrl: imageUrlForAlpr ?? undefined,
          plateHint: plateHint || undefined,
        })
        
        // Transform to CaptureReadRes format
        // capture.plate holds the authoritative PlateCanonical from ingest-alpr-read.ts
        const captureData = alprRes.capture
        const recData = alprRes.recognition
        const capturePlate = captureData?.plate
        const recPreviewStatus = recData?.previewStatus ?? capturePlate?.plateValidity ?? 'INVALID'
        const rawPlate: PlateCanonicalDto = {
          plateRaw: captureData?.plateRaw || effectivePlate || '',
          plateCompact: captureData?.plateCompact || null,
          plateDisplay: capturePlate?.plateDisplay || recData?.plate || captureData?.plateRaw || effectivePlate || '',
          plateFamily: (capturePlate?.plateFamily || 'UNKNOWN') as PlateCanonicalDto['plateFamily'],
          plateValidity: (capturePlate?.plateValidity || 'INVALID') as PlateCanonicalDto['plateValidity'],
          ocrSubstitutions: recData?.ocrSubstitutions || [],
          suspiciousFlags: recData?.suspiciousFlags || [],
          validationNotes: recData?.validationNotes || [],
          reviewRequired: recPreviewStatus !== 'STRICT_VALID',
        }
        data = {
          siteCode: captureData?.siteCode || effectiveCtx.siteCode,
          laneCode: captureData?.laneCode || effectiveCtx.laneCode,
          deviceCode: captureData?.deviceCode || effectiveCtx.deviceCode,
          direction: (captureData?.direction as 'ENTRY' | 'EXIT') || effectiveCtx.direction,
          plateRaw: captureData?.plateRaw || effectivePlate || '',
          plateCompact: captureData?.plateCompact || null,
          plateDisplay: capturePlate?.plateDisplay || recData?.plate || captureData?.plateRaw || effectivePlate || '',
          plateFamily: rawPlate.plateFamily,
          plateValidity: rawPlate.plateValidity,
          plate: rawPlate,
          ocrSubstitutions: recData?.ocrSubstitutions || [],
          suspiciousFlags: recData?.suspiciousFlags || [],
          validationNotes: recData?.validationNotes || [],
          reviewRequired: recPreviewStatus !== 'STRICT_VALID',
          readType: 'ALPR' as const,
          readEventId: captureData?.readEventId ?? Date.now(),
          occurredAt: captureData?.occurredAt || now,
          sessionId: String(captureData?.sessionId || 0),
          sessionStatus: captureData?.sessionStatus || 'OPEN',
          changed: captureData?.changed ?? false,
          alreadyExists: captureData?.alreadyExists ?? false,
          imageUrl: alprRes.viewUrl || null,
          ocrConfidence: recData?.confidence ?? captureData?.ocrConfidence ?? null,
          rfidUid: captureData?.rfidUid || null,
          sensorState: (captureData?.sensorState as CaptureReadRes['sensorState']) || null,
        } as unknown as CaptureReadRes
      } else {
        // Fallback to regular capture API (requires user auth and device signature)
        data = await sendCaptureAlpr({
          secret: effectiveCtx.deviceSecret,
          requestId,
          idempotencyKey: rid('mobile_alpr_idem'),
          siteCode: effectiveCtx.siteCode,
          laneCode: effectiveCtx.laneCode,
          deviceCode: effectiveCtx.deviceCode,
          direction: effectiveCtx.direction,
          timestamp: now,
          eventTime: now,
          plateRaw: effectivePlate || undefined,
          imageUrl: null,
          ocrConfidence: preview?.confidence ?? null,
          rawPayload: {
            source: 'MOBILE_CAPTURE_PAGE',
            previewStatus: preview?.previewStatus ?? null,
            effectiveContextKey: contextSnapshot.effectiveKey,
          },
        })
      }

      setLastCapture(data)
      setLastCaptureRequestId(requestId)
      setCaptureStatus({
        kind: 'ok',
        message: t('mobileCapturePage.status.captureAccepted', { status: data.sessionStatus }),
        requestId,
        hint: pairToken
          ? t('mobileCapturePage.status.captureHintPair')
          : t('mobileCapturePage.status.captureHintLocal'),
      })
      pushJournal({
        type: 'capture',
        summary: t('mobileCapturePage.journal.captureAcceptedSummary', { status: data.sessionStatus }),
        detail: [
          `requestId=${requestId}`,
          `sessionId=${data.sessionId}`,
          `plate=${data.plateDisplay || data.plateCompact || data.plateRaw || '-'}`,
          formatMobileCaptureContextSnapshot(contextSnapshot),
        ].join(' | '),
      })
    } catch (err) {
      const status = errorToStatus(t, err, 'capture', requestId)
      setCaptureStatus(status)
      pushJournal({
        type: 'error',
        summary: t('mobileCapturePage.journal.captureFailedSummary', { title: status.title }),
        detail: [status.message, status.requestId ? `requestId=${status.requestId}` : ''].filter(Boolean).join(' | '),
      })
    } finally {
      setIsSendingCapture(false)
    }
  }

  const [contextSectionOpen, setContextSectionOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background px-4 py-4 text-foreground">
      <div className="mx-auto max-w-md space-y-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t('mobileCapturePage.badges.mobileSurface')}</Badge>
            {pairToken ? <Badge variant="outline">{t('mobileCapturePage.badges.pairTokenActive')}</Badge> : null}
            <Badge variant={canSend ? 'entry' : 'amber'}>
              {canSend ? t('mobileCapturePage.badges.ready') : t('mobileCapturePage.badges.contextIncomplete')}
            </Badge>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{t('mobileCapturePage.title')}</h1>
          <p className="text-xs text-muted-foreground">
            {pairToken
              ? t('mobileCapturePage.descriptionPairToken')
              : t('mobileCapturePage.descriptionNoPairToken')}
          </p>
        </div>

        {allValidation.length > 0 ? <ValidationSummary items={allValidation} title={t('mobileCapturePage.validationTitle')} /> : null}

        {/* Capture surface first so user doesn't have to scroll */}
        <Card className="border-border/80 bg-card/95">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-base">{t('mobileCapturePage.captureCardTitle')}</CardTitle>
            <CardDescription className="text-xs">
              {t('mobileCapturePage.captureCardDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex h-10 w-full items-center gap-2.5 rounded-xl border px-3 text-left text-sm transition-colors',
                'border-border/80 bg-input hover:border-primary/40 hover:bg-accent/50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <Camera className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className={cn('flex-1 truncate', file ? 'text-foreground' : 'text-muted-foreground')}>
                {file ? file.name : t('mobileCapturePage.chooseImage')}
              </span>
              {file ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={t('mobileCapturePage.clearSelectedFile')}
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

            <div className="space-y-1">
              <SectionLabel>{t('mobileCapturePage.plateHintLabel')}</SectionLabel>
              <Input
                value={plateHint}
                onChange={(e) => setPlateHint(e.target.value)}
                placeholder={t('mobileCapturePage.plateHintPlaceholder')}
              />
            </div>
            <div className="space-y-1">
              <SectionLabel>{t('mobileCapturePage.plateOverrideLabel')}</SectionLabel>
              <Input
                value={overridePlate}
                onChange={(e) => setOverridePlate(e.target.value.toUpperCase())}
                placeholder={t('mobileCapturePage.plateOverridePlaceholder')}
                className="font-mono-data"
              />
            </div>

            {localImageUrl ? (
              <img
                src={localImageUrl}
                alt={t('mobileCapturePage.localPreviewAlt')}
                width={640}
                height={360}
                className="max-h-40 w-full rounded-xl border border-border object-contain"
              />
            ) : null}

            <StatusBlock status={previewStatus} />

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void runPreview()}
                disabled={isPreviewing || !file}
                className="w-full"
              >
                {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                {isPreviewing ? t('mobileCapturePage.processing') : t('mobileCapturePage.preview')}
              </Button>
              <Button
                type="button"
                onClick={() => void sendCapture()}
                disabled={isSendingCapture || !canSend}
                className="w-full"
              >
                {isSendingCapture ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCopy className="h-4 w-4" />}
                {isSendingCapture ? t('mobileCapturePage.sending') : t('mobileCapturePage.sendCapture')}
              </Button>
            </div>

            <StatusBlock status={captureStatus} />

            <div className="space-y-1 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void sendHeartbeat()}
                disabled={isSendingHeartbeat || !canSend}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                {isSendingHeartbeat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                {isSendingHeartbeat ? t('mobileCapturePage.sendingHeartbeat') : t('mobileCapturePage.heartbeatOnline')}
              </Button>
              <StatusBlock status={heartbeatStatus} />
            </div>
          </CardContent>
        </Card>

        {/* Ops journal near capture so logs are visible without scrolling past context */}
        <MobileCaptureJournal
          rows={journalRows}
          onClear={() => {
            clearMobileCaptureJournal(journalScopeKey)
            setJournalRows([])
          }}
        />

        {/* Collapsible: Device & effective context */}
        <div className="rounded-xl border border-border/80 bg-card/95">
          <button
            type="button"
            onClick={() => setContextSectionOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-medium">{t('mobileCapturePage.contextSectionTitle')}</span>
            {contextSectionOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
          {contextSectionOpen && (
            <div className="space-y-4 border-t border-border/80 px-4 pb-4 pt-3">
              <MobileContextSummaryCard
                seedCtx={initialSeed}
                effectiveCtx={effectiveCtx}
                pairToken={pairToken}
                readiness={contextReadiness}
                diagnostics={contextDiagnostics}
                hasManualOverrides={hasManualOverrides}
                lastHeartbeatAt={lastHeartbeatAt}
                lastHeartbeatRequestId={lastHeartbeatRequestId}
                lastCaptureRequestId={lastCaptureRequestId}
              />
              <DevContextDebug
                seed={initialSeed}
                effective={effectiveCtx}
                pairToken={pairToken}
                hasManualOverrides={hasManualOverrides}
              />
              <Card className="border-border/80 bg-card/95">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t('mobileCapturePage.deviceContextTitle')}</CardTitle>
                  <CardDescription className="text-xs">
                    {t('mobileCapturePage.deviceContextDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
            <div className="space-y-1">
              <SectionLabel>{t('mobileCapturePage.fields.site')}</SectionLabel>
              <Input value={editableCtx.siteCode} onChange={(e) => setCtxField('siteCode', e.target.value)} placeholder={t('mobileCapturePage.placeholders.siteCode')} />
            </div>
            <div className="space-y-1">
              <SectionLabel>{t('mobileCapturePage.fields.lane')}</SectionLabel>
              <Input value={editableCtx.laneCode} onChange={(e) => setCtxField('laneCode', e.target.value)} placeholder={t('mobileCapturePage.placeholders.laneCode')} />
            </div>
            <div className="space-y-1">
              <SectionLabel>{t('mobileCapturePage.fields.direction')}</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {(['ENTRY', 'EXIT'] as Direction[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCtxField('direction', d)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-sm font-medium transition',
                      editableCtx.direction === d
                        ? d === 'ENTRY'
                          ? 'border-success/40 bg-success/15 text-success'
                          : 'border-destructive/40 bg-destructive/15 text-destructive'
                        : 'border-border/70 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground',
                    )}
                  >
                    {d === 'ENTRY' ? t('mobileCapturePage.fields.entry') : t('mobileCapturePage.fields.exit')}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <SectionLabel>{t('mobileCapturePage.fields.deviceCode')}</SectionLabel>
              <Input value={editableCtx.deviceCode} onChange={(e) => setCtxField('deviceCode', e.target.value)} placeholder={t('mobileCapturePage.placeholders.deviceCode')} />
            </div>
            <div className="space-y-1">
              <SectionLabel>{t('mobileCapturePage.fields.deviceSecret')}</SectionLabel>
              <Input
                value={editableCtx.deviceSecret}
                onChange={(e) => setCtxField('deviceSecret', e.target.value)}
                placeholder={pairToken ? t('mobileCapturePage.placeholders.deviceSecretPair') : t('mobileCapturePage.placeholders.deviceSecret')}
                type="password"
                autoComplete="off"
              />
              {pairToken ? (
                <p className="text-[11px] text-muted-foreground">
                  {t('mobileCapturePage.deviceSecretHintPair')}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {t('mobileCapturePage.deviceSecretHintLocal')}
                </p>
              )}
            </div>
              </CardContent>
            </Card>
            </div>
          )}
        </div>

        {preview ? (
          <Card className="border-border/80 bg-card/95">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{t('mobileCapturePage.previewCardTitle')}</CardTitle>
                <Badge variant={preview.previewStatus === 'STRICT_VALID' ? 'entry' : preview.previewStatus === 'REVIEW' ? 'amber' : 'destructive'}>
                  {preview.previewStatus}
                </Badge>
                {preview.needsConfirm
                  ? <Badge variant="amber">{t('mobileCapturePage.previewConfirmNeeded')}</Badge>
                  : <Badge variant="secondary">{t('mobileCapturePage.previewReady')}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border/80 bg-background/40 p-3">
                <DataRow label={t('mobileCapturePage.previewPlate')} value={preview.plateDisplay || preview.recognizedPlate || dash} />
                <DataRow label={t('mobileCapturePage.previewConfidence')} value={preview.confidence.toFixed(2)} />
                {preview.winner ? (
                  <DataRow label={t('mobileCapturePage.previewWinner')} value={`${preview.winner.cropVariant} · psm ${preview.winner.psm}`} />
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPlate(preview.plateDisplay || preview.recognizedPlate)}
                >
                  {t('mobileCapturePage.applyTopResult')}
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

        {lastCapture ? (
          <Card className="border-border/80 bg-card/95">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{t('mobileCapturePage.captureAcceptedTitle')}</CardTitle>
                <Badge variant="entry">{lastCapture.sessionStatus}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border/80 bg-background/40 p-3">
                <DataRow label={t('mobileCapturePage.captureSession')} value={String(lastCapture.sessionId)} />
                <DataRow label={t('mobileCapturePage.capturePlate')} value={lastCapture.plateDisplay || lastCapture.plateCompact || lastCapture.plateRaw || dash} />
                <DataRow label={t('mobileCapturePage.captureLane')} value={lastCapture.laneCode} />
                <DataRow label={t('mobileCapturePage.captureDirection')} value={t(`direction.${lastCapture.direction}`)} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(
                      buildRoutePath('/session-history', {
                        siteCode: effectiveCtx.siteCode,
                        sessionId: lastCapture.sessionId,
                        q: lastCapture.plateDisplay || lastCapture.plateCompact || lastCapture.plateRaw || undefined,
                      }),
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('mobileCapturePage.openSessionHistory')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    window.open(
                      buildRoutePath('/run-lane', { siteCode: effectiveCtx.siteCode, laneCode: effectiveCtx.laneCode }),
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('mobileCapturePage.openRunLane')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <p className="text-center text-xs text-muted-foreground/60">
          {t('mobileCapturePage.footnote')}
        </p>
      </div>
    </div>
  )
}
