import { buildPlateCanonical, type PlateCanonicalResult } from '@parkly/gate-core'

import { ApiError } from '../http'

export type LaneFlowPreviewStatus = 'STRICT_VALID' | 'REVIEW' | 'INVALID'
export type LaneFlowAuthoritySource = 'PLATE_CONFIRMED' | 'PREVIEW_SNAPSHOT' | 'NO_PLATE'
export type LaneFlowDecisionPolicy = 'MANUAL_CONFIRMED' | 'PREVIEW_STRICT' | 'PREVIEW_AMBIGUOUS' | 'NO_PLATE'

export type LaneFlowPreviewSnapshotInput = {
  recognizedPlate?: string | null
  confidence?: number | null
  previewStatus?: LaneFlowPreviewStatus | string | null
  needsConfirm?: boolean | null
  candidates?: unknown
  winner?: unknown
  raw?: unknown
} | null | undefined

export type LaneFlowAuthorityInput = {
  surface: string
  plateConfirmed?: string | null
  previewSnapshot?: LaneFlowPreviewSnapshotInput
}

export type LaneFlowAuthorityResult = {
  authoritativeSource: LaneFlowAuthoritySource
  decisionPolicy: LaneFlowDecisionPolicy
  authoritativePlateRaw: string | null
  authoritativePlate: PlateCanonicalResult | null
  decisionPlateRaw: string | null
  decisionPreviewStatus: LaneFlowPreviewStatus | null
  originalPreviewStatus: LaneFlowPreviewStatus | null
  ocrConfidence: number | null
  needsManualReview: boolean
  auditSnapshot: {
    authoritativeSource: LaneFlowAuthoritySource
    decisionPolicy: LaneFlowDecisionPolicy
    authoritativePlateRaw: string | null
    decisionPlateRaw: string | null
    originalPreviewStatus: LaneFlowPreviewStatus | null
    appliedPreviewStatus: LaneFlowPreviewStatus | null
    softenedFrom: LaneFlowPreviewStatus | null
    confidence: number | null
    recognizedPlate: string | null
    needsConfirm: boolean
  }
}

function trimOrNull(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function normalizePreviewStatus(value: unknown): LaneFlowPreviewStatus | null {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'STRICT_VALID') return 'STRICT_VALID'
  if (normalized === 'REVIEW') return 'REVIEW'
  if (normalized === 'INVALID') return 'INVALID'
  return null
}

function normalizeConfidence(value: unknown): number | null {
  if (value == null || value === '') return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return Math.max(0, Math.min(1, Number(numeric.toFixed(4))))
}

export function resolveLaneFlowAuthority(input: LaneFlowAuthorityInput): LaneFlowAuthorityResult {
  const manualPlateRaw = trimOrNull(input.plateConfirmed)
  const previewRecognizedPlate = trimOrNull(input.previewSnapshot?.recognizedPlate)
  const previewStatus = normalizePreviewStatus(input.previewSnapshot?.previewStatus)
  const confidence = normalizeConfidence(input.previewSnapshot?.confidence)
  const needsConfirm = Boolean(input.previewSnapshot?.needsConfirm)

  if (manualPlateRaw) {
    const canonical = buildPlateCanonical(manualPlateRaw)
    if (canonical.plateValidity === 'INVALID') {
      throw new ApiError({
        code: 'BAD_REQUEST',
        message: 'plateConfirmed không vượt qua strict validation ở backend',
        details: {
          surface: input.surface,
          plateConfirmed: manualPlateRaw,
          canonical,
        },
      })
    }

    return {
      authoritativeSource: 'PLATE_CONFIRMED',
      decisionPolicy: 'MANUAL_CONFIRMED',
      authoritativePlateRaw: canonical.plateRaw ?? manualPlateRaw,
      authoritativePlate: canonical,
      decisionPlateRaw: canonical.plateRaw ?? manualPlateRaw,
      decisionPreviewStatus: canonical.plateValidity,
      originalPreviewStatus: previewStatus,
      ocrConfidence: confidence,
      needsManualReview: canonical.plateValidity !== 'STRICT_VALID',
      auditSnapshot: {
        authoritativeSource: 'PLATE_CONFIRMED',
        decisionPolicy: 'MANUAL_CONFIRMED',
        authoritativePlateRaw: canonical.plateRaw ?? manualPlateRaw,
        decisionPlateRaw: canonical.plateRaw ?? manualPlateRaw,
        originalPreviewStatus: previewStatus,
        appliedPreviewStatus: canonical.plateValidity,
        softenedFrom: null,
        confidence,
        recognizedPlate: previewRecognizedPlate,
        needsConfirm,
      },
    }
  }

  if (previewRecognizedPlate) {
    const canonical = buildPlateCanonical(previewRecognizedPlate)
    const normalizedStatus = previewStatus ?? canonical.plateValidity

    if (normalizedStatus === 'STRICT_VALID') {
      return {
        authoritativeSource: 'PREVIEW_SNAPSHOT',
        decisionPolicy: 'PREVIEW_STRICT',
        authoritativePlateRaw: canonical.plateRaw ?? previewRecognizedPlate,
        authoritativePlate: canonical,
        decisionPlateRaw: canonical.plateRaw ?? previewRecognizedPlate,
        decisionPreviewStatus: 'STRICT_VALID',
        originalPreviewStatus: normalizedStatus,
        ocrConfidence: confidence,
        needsManualReview: false,
        auditSnapshot: {
          authoritativeSource: 'PREVIEW_SNAPSHOT',
          decisionPolicy: 'PREVIEW_STRICT',
          authoritativePlateRaw: canonical.plateRaw ?? previewRecognizedPlate,
          decisionPlateRaw: canonical.plateRaw ?? previewRecognizedPlate,
          originalPreviewStatus: normalizedStatus,
          appliedPreviewStatus: 'STRICT_VALID',
          softenedFrom: null,
          confidence,
          recognizedPlate: previewRecognizedPlate,
          needsConfirm,
        },
      }
    }

    return {
      authoritativeSource: 'PREVIEW_SNAPSHOT',
      decisionPolicy: 'PREVIEW_AMBIGUOUS',
      authoritativePlateRaw: canonical.plateRaw ?? previewRecognizedPlate,
      authoritativePlate: canonical,
      decisionPlateRaw: null,
      decisionPreviewStatus: 'REVIEW',
      originalPreviewStatus: normalizedStatus,
      ocrConfidence: confidence,
      needsManualReview: true,
      auditSnapshot: {
        authoritativeSource: 'PREVIEW_SNAPSHOT',
        decisionPolicy: 'PREVIEW_AMBIGUOUS',
        authoritativePlateRaw: canonical.plateRaw ?? previewRecognizedPlate,
        decisionPlateRaw: null,
        originalPreviewStatus: normalizedStatus,
        appliedPreviewStatus: 'REVIEW',
        softenedFrom: normalizedStatus === 'INVALID' ? 'INVALID' : null,
        confidence,
        recognizedPlate: previewRecognizedPlate,
        needsConfirm: true,
      },
    }
  }

  return {
    authoritativeSource: 'NO_PLATE',
    decisionPolicy: 'NO_PLATE',
    authoritativePlateRaw: null,
    authoritativePlate: null,
    decisionPlateRaw: null,
    decisionPreviewStatus: null,
    originalPreviewStatus: previewStatus,
    ocrConfidence: confidence,
    needsManualReview: true,
    auditSnapshot: {
      authoritativeSource: 'NO_PLATE',
      decisionPolicy: 'NO_PLATE',
      authoritativePlateRaw: null,
      decisionPlateRaw: null,
      originalPreviewStatus: previewStatus,
      appliedPreviewStatus: null,
      softenedFrom: null,
      confidence,
      recognizedPlate: null,
      needsConfirm,
    },
  }
}
