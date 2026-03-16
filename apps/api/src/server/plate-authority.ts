import { buildPlateCanonical, type PlateCanonicalResult } from '@parkly/gate-core'

import { ApiError } from './http'

const FORBIDDEN_CLIENT_CANONICAL_KEYS = [
  'plateCompact',
  'plateDisplay',
  'plateFamily',
  'plateValidity',
  'ocrSubstitutions',
  'suspiciousFlags',
  'validationNotes',
  'reviewRequired',
] as const

type AuthorityPlateInput = {
  surface: string
  licensePlateRaw?: string | null
  alprPlate?: string | null
  rejectInvalid?: boolean
}

type AuthorityPlateResult = {
  effectivePlateRaw: string | null
  plate: PlateCanonicalResult
  compare: {
    licensePlateRaw: string | null
    alprPlate: string | null
    licenseCanonical: PlateCanonicalResult | null
    alprCanonical: PlateCanonicalResult | null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function trimOrNull(value: string | null | undefined) {
  const normalized = String(value ?? '').trim()
  return normalized ? normalized : null
}

function collectForbiddenCanonicalPaths(value: unknown, path = '$', out: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenCanonicalPaths(item, `${path}[${index}]`, out))
    return out
  }

  const record = asRecord(value)
  if (!record) return out

  for (const [key, nested] of Object.entries(record)) {
    const nextPath = `${path}.${key}`
    if ((FORBIDDEN_CLIENT_CANONICAL_KEYS as readonly string[]).includes(key)) out.push(nextPath)
    collectForbiddenCanonicalPaths(nested, nextPath, out)
  }

  return out
}

export function assertNoClientCanonicalPlateFields(value: unknown, surface: string) {
  const forbiddenPaths = Array.from(new Set(collectForbiddenCanonicalPaths(value)))
  if (forbiddenPaths.length === 0) return

  const forbiddenFields = Array.from(new Set(forbiddenPaths.map((item) => item.split('.').pop() ?? item))).sort()
  throw new ApiError({
    code: 'BAD_REQUEST',
    message: 'Client không được phép gửi canonical plate fields. Backend sẽ tự derive authoritative result từ plateRaw.',
    details: {
      surface,
      forbiddenFields,
      forbiddenPaths,
    },
  })
}

export function deriveAuthoritativePlateResult(args: AuthorityPlateInput): AuthorityPlateResult {
  const licensePlateRaw = trimOrNull(args.licensePlateRaw)
  const alprPlate = trimOrNull(args.alprPlate)
  const effectivePlateRaw = alprPlate ?? licensePlateRaw
  const plate = buildPlateCanonical(effectivePlateRaw)
  const licenseCanonical = licensePlateRaw ? buildPlateCanonical(licensePlateRaw) : null
  const alprCanonical = alprPlate ? buildPlateCanonical(alprPlate) : null

  if (licenseCanonical && alprCanonical) {
    const left = licenseCanonical.plateCompact
    const right = alprCanonical.plateCompact
    if (!left || !right || left !== right) {
      throw new ApiError({
        code: 'BAD_REQUEST',
        message: 'licensePlateRaw và alprResult.plate không khớp sau canonicalization',
        details: {
          surface: args.surface,
          licensePlateRaw,
          alprPlate,
          licenseCanonical,
          alprCanonical,
        },
      })
    }
  }

  if (effectivePlateRaw && args.rejectInvalid !== false && plate.plateValidity === 'INVALID') {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Plate không vượt qua strict validation ở backend',
      details: {
        surface: args.surface,
        ...plate,
      },
    })
  }

  return {
    effectivePlateRaw,
    plate,
    compare: {
      licensePlateRaw,
      alprPlate,
      licenseCanonical,
      alprCanonical,
    },
  }
}
