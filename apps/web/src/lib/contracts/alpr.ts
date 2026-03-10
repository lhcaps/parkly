import type { PlateCanonicalDto } from '@parkly/contracts'

export type AlprPreviewStatus = 'STRICT_VALID' | 'REVIEW' | 'INVALID'

export type AlprPreviewCandidate = {
  plate: string
  score: number
  votes: number
  cropVariants: string[]
  psmModes: number[]
  suspiciousFlags: string[]
}

export type AlprPreviewWinner = {
  plate: string
  cropVariant: string
  psm: number
  rawText: string | null
  score: number
} | null

export type UploadedImageRes = {
  imageUrl: string
  filePath?: string
  filename: string
  size: number
  mime: string
  sha256: string
  storageKind?: string
}

export type AlprRecognizeRes = PlateCanonicalDto & {
  plate: PlateCanonicalDto
  recognizedPlate: string
  confidence: number
  previewStatus: AlprPreviewStatus
  needsConfirm: boolean
  candidates: AlprPreviewCandidate[]
  winner: AlprPreviewWinner
  raw: Record<string, unknown>
}
