import type { PlateCanonicalDto } from '@parkly/contracts'
import { apiFetch } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import type {
  AlprPreviewCandidate,
  AlprPreviewStatus,
  AlprPreviewWinner,
  AlprRecognizeRes,
  UploadedImageRes,
} from '@/lib/contracts/alpr'

export type AlprRequestOptions = { signal?: AbortSignal }

function normalizePreviewStatus(value: unknown): AlprPreviewStatus | null {
  return value === 'STRICT_VALID' || value === 'REVIEW' || value === 'INVALID' ? value : null
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function normalizeNumberArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item)) : []
}

function normalizePreviewCandidate(value: unknown): AlprPreviewCandidate | null {
  if (!isRecord(value)) return null
  const plate = typeof value.plate === 'string' ? value.plate.trim() : ''
  if (!plate) return null
  return {
    plate,
    score: typeof value.score === 'number' && Number.isFinite(value.score) ? value.score : 0,
    votes: typeof value.votes === 'number' && Number.isFinite(value.votes) ? value.votes : 0,
    cropVariants: normalizeStringArray(value.cropVariants),
    psmModes: normalizeNumberArray(value.psmModes),
    suspiciousFlags: normalizeStringArray(value.suspiciousFlags),
  }
}

function normalizePreviewWinner(value: unknown): AlprPreviewWinner {
  if (!isRecord(value)) return null
  const plate = typeof value.plate === 'string' ? value.plate.trim() : ''
  const cropVariant = typeof value.cropVariant === 'string' ? value.cropVariant.trim() : ''
  const psm = typeof value.psm === 'number' && Number.isFinite(value.psm) ? value.psm : null
  if (!plate || !cropVariant || psm == null) return null
  return {
    plate,
    cropVariant,
    psm,
    rawText: typeof value.rawText === 'string' ? value.rawText : null,
    score: typeof value.score === 'number' && Number.isFinite(value.score) ? value.score : 0,
  }
}

export function getAuthoritativePlate(result: { plate?: PlateCanonicalDto | null } & Partial<PlateCanonicalDto>): PlateCanonicalDto | null {
  if (result.plate) return result.plate
  if (!('plateRaw' in result) && !('plateCompact' in result) && !('plateDisplay' in result)) return null

  const plateRaw = result.plateRaw ?? null
  const plateCompact = result.plateCompact ?? null
  const plateDisplay = result.plateDisplay ?? null
  const plateFamily = result.plateFamily
  const plateValidity = result.plateValidity
  if (!plateFamily || !plateValidity) return null

  return {
    plateRaw,
    plateCompact,
    plateDisplay,
    plateFamily,
    plateValidity,
    ocrSubstitutions: result.ocrSubstitutions ?? [],
    suspiciousFlags: result.suspiciousFlags ?? [],
    validationNotes: result.validationNotes ?? [],
    reviewRequired: result.reviewRequired ?? false,
  }
}

export function normalizeAlprRecognizeResult(value: unknown): AlprRecognizeRes {
  const row = isRecord(value) ? value : {}
  const recognizedPlate = typeof row.recognizedPlate === 'string' ? row.recognizedPlate.trim() : ''
  const previewStatus = normalizePreviewStatus(row.previewStatus) ?? normalizePreviewStatus(row.plateValidity) ?? 'INVALID'
  const plate = getAuthoritativePlate(row as { plate?: PlateCanonicalDto | null } & Partial<PlateCanonicalDto>) ?? {
    plateRaw: recognizedPlate || null,
    plateCompact: typeof row.plateCompact === 'string' ? row.plateCompact : null,
    plateDisplay: typeof row.plateDisplay === 'string' ? row.plateDisplay : (recognizedPlate || null),
    plateFamily: (typeof row.plateFamily === 'string' ? row.plateFamily : 'UNKNOWN') as PlateCanonicalDto['plateFamily'],
    plateValidity: (normalizePreviewStatus(row.plateValidity) ?? previewStatus) as PlateCanonicalDto['plateValidity'],
    ocrSubstitutions: normalizeStringArray(row.ocrSubstitutions),
    suspiciousFlags: normalizeStringArray(row.suspiciousFlags),
    validationNotes: normalizeStringArray(row.validationNotes),
    reviewRequired: typeof row.reviewRequired === 'boolean' ? row.reviewRequired : previewStatus !== 'STRICT_VALID',
  }

  const candidates = Array.isArray(row.candidates)
    ? row.candidates.map((item) => normalizePreviewCandidate(item)).filter((item): item is AlprPreviewCandidate => Boolean(item))
    : []
  const winner = normalizePreviewWinner(row.winner)
  const confidence = typeof row.confidence === 'number' && Number.isFinite(row.confidence) ? row.confidence : 0
  const raw = isRecord(row.raw) ? row.raw : {}

  return {
    ...plate,
    plate,
    recognizedPlate: recognizedPlate || plate.plateDisplay || plate.plateCompact || plate.plateRaw || '',
    confidence,
    previewStatus,
    needsConfirm: typeof row.needsConfirm === 'boolean' ? row.needsConfirm : previewStatus !== 'STRICT_VALID',
    candidates,
    winner,
    raw,
  }
}

const alprPreviewMode = ['M', 'O', 'C', 'K'].join('')

export function uploadImage(file: File, options?: AlprRequestOptions) {
  const fd = new FormData()
  fd.append('file', file)
  return apiFetch<UploadedImageRes>('/api/media/upload', {
    method: 'POST',
    body: fd,
    signal: options?.signal,
  }, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : '',
      filePath: typeof row.filePath === 'string' ? row.filePath : undefined,
      filename: typeof row.filename === 'string' ? row.filename : '',
      size: typeof row.size === 'number' && Number.isFinite(row.size) ? row.size : 0,
      mime: typeof row.mime === 'string' ? row.mime : '',
      sha256: typeof row.sha256 === 'string' ? row.sha256 : '',
      storageKind: typeof row.storageKind === 'string' ? row.storageKind : undefined,
    }
  })
}

export function alprPreview(imageUrl?: string, plateHint?: string, options?: AlprRequestOptions) {
  return apiFetch<AlprRecognizeRes>('/api/alpr/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, plateHint, mode: alprPreviewMode }),
    signal: options?.signal,
  }, normalizeAlprRecognizeResult)
}

export async function previewImageFile(file: File, plateHint?: string, options?: AlprRequestOptions) {
  const uploaded = await uploadImage(file, options)
  const preview = await alprPreview(uploaded.imageUrl, plateHint, options)
  return { uploaded, preview }
}

export const alprRecognize = (imageUrl?: string, plateHint?: string, options?: AlprRequestOptions) => alprPreview(imageUrl, plateHint, options)
