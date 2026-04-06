import {
  classifyPlateFamily,
  MAX_RAW_LENGTH,
  MIN_RAW_LENGTH,
  OCR_TO_ALPHA_MAP,
  OCR_TO_DIGIT_MAP,
  RESERVED_SERIES,
  type PlateFamily,
  type PlateValidity,
} from './plate-rules'

export type PlateParseResult = {
  input: string
  normalized: string
  compact: string | null
  display: string | null
  family: PlateFamily
  validity: PlateValidity
  suspicious: boolean
  reviewRequired: boolean
  substitutions: string[]
  reasons: string[]
  provinceCode: string | null
  series: string | null
  serial: string | null
}

export type PlateNormalizationResult = {
  raw: string
  normalized: string
  compact: string | null
  substitutions: string[]
}

export type PlateCanonicalResult = {
  plateRaw: string | null
  plateCompact: string | null
  plateDisplay: string | null
  plateFamily: PlateFamily
  plateValidity: PlateValidity
  ocrSubstitutions: string[]
  suspiciousFlags: string[]
  validationNotes: string[]
  reviewRequired: boolean
}

function stripNoise(raw: string) {
  return raw
    .normalize('NFKC')
    .toUpperCase()
    .replace(/Đ/g, 'D')
    .replace(/[^A-Z0-9]/g, '')
}

function isDigit(ch: string) {
  return ch.length === 1 && ch >= '0' && ch <= '9'
}

function isAlpha(ch: string) {
  return ch.length === 1 && ch >= 'A' && ch <= 'Z'
}

function normalizeDomestic(candidate: string): { compact: string; substitutions: string[] } {
  if (!candidate) return { compact: '', substitutions: [] }

  const substitutions: string[] = []
  const chars = candidate.split('')

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i]
    if (i < 2) {
      // Province (positions 0-1): alpha chars that OCR may misread as digit
      if (isAlpha(ch) && OCR_TO_DIGIT_MAP[ch]) {
        substitutions.push(`${ch}→${OCR_TO_DIGIT_MAP[ch]}@province`)
        chars[i] = OCR_TO_DIGIT_MAP[ch]
      }
      continue
    }

    if (i < 4) {
      // Series (positions 2-3): digit chars that OCR may misread as letter (e.g. 0→O, 1→I)
      if (isDigit(ch) && OCR_TO_ALPHA_MAP[ch]) {
        substitutions.push(`${ch}→${OCR_TO_ALPHA_MAP[ch]}@series`)
        chars[i] = OCR_TO_ALPHA_MAP[ch]
      }
      continue
    }

    // Serial (positions 4+): alpha chars that OCR may misread as digit
    if (isAlpha(ch) && OCR_TO_DIGIT_MAP[ch]) {
      substitutions.push(`${ch}→${OCR_TO_DIGIT_MAP[ch]}@serial`)
      chars[i] = OCR_TO_DIGIT_MAP[ch]
    }
  }

  return { compact: chars.join(''), substitutions }
}

function splitDomestic(compact: string): { provinceCode: string; series: string; serial: string } | null {
  if (!compact) return null
  const m = compact.match(/^(\d{2})([A-Z]{1,2})(\d{4,5})$/)
  if (!m) return null
  return { provinceCode: m[1], series: m[2], serial: m[3] }
}

export function formatPlateDisplay(compactInput: string | null | undefined): string | null {
  const compact = String(compactInput ?? '').trim().toUpperCase()
  if (!compact) return null

  // Check DIPLOMATIC first (NG/QT/NN series) so it doesn't get caught by DOMESTIC fallback
  const diplomatic = compact.match(/^(\d{2})(NG|QT|NN)(\d{3,5})$/)
  if (diplomatic) return `${diplomatic[1]}-${diplomatic[2]} ${diplomatic[3]}`

  // Check SPECIAL (CD/LD/KT series) next
  const special = compact.match(/^(\d{2})(CD|LD|KT)(\d{3,5})$/)
  if (special) return `${special[1]}-${special[2]} ${special[3]}`

  const domestic = splitDomestic(compact)
  if (domestic && domestic.serial) {
    const serialFormatted = domestic.serial.length === 5
      ? `${domestic.serial.slice(0, 3)}.${domestic.serial.slice(3)}`
      : `${domestic.serial.slice(0, 2)}.${domestic.serial.slice(2)}`
    return `${domestic.provinceCode}-${domestic.series} ${serialFormatted}`
  }

  if (compact.length > 4) return `${compact.slice(0, 2)}-${compact.slice(2)}`
  return compact || null
}

export function normalizePlate(rawInput: string | null | undefined): PlateNormalizationResult {
  const raw = String(rawInput ?? '').trim().slice(0, MAX_RAW_LENGTH)
  if (!raw) {
    return { raw, normalized: '', compact: null, substitutions: [] }
  }
  const stripped = stripNoise(raw)
  const domestic = normalizeDomestic(stripped)
  return {
    raw,
    normalized: stripped,
    compact: domestic.compact || null,
    substitutions: domestic.substitutions,
  }
}

export function detectSuspiciousPlate(rawInput: string | null | undefined): string[] {
  const raw = String(rawInput ?? '').trim()
  const flags: string[] = []

  if (!raw) return flags
  if (raw.length < MIN_RAW_LENGTH) flags.push('TOO_SHORT')
  if (raw.length > MAX_RAW_LENGTH) flags.push('TOO_LONG')
  if (/[^A-Za-z0-9\s._-]/.test(raw)) flags.push('NON_STANDARD_SYMBOLS')

  const normalized = stripNoise(raw)
  if (normalized && /([A-Z0-9])\1{4,}/.test(normalized)) flags.push('REPEATED_SEQUENCE')
  if (normalized && !/^\d{2}/.test(normalized)) flags.push('MISSING_PROVINCE_PREFIX')
  // Note: RESERVED_SERIES_STYLE is checked in validatePlateStrict (where family is known)
  // to avoid false positives on DIPLOMATIC plates.

  return Array.from(new Set(flags))
}

export function validatePlateStrict(rawInput: string | null | undefined): PlateParseResult {
  const { raw, compact, normalized, substitutions } = normalizePlate(rawInput)
  const suspiciousFlags = detectSuspiciousPlate(rawInput)
  const reasons: string[] = []

  if (!raw.trim()) {
    return {
      input: raw,
      normalized,
      compact: null,
      display: null,
      family: 'UNKNOWN',
      validity: 'INVALID',
      suspicious: false,
      reviewRequired: true,
      substitutions,
      reasons: ['Chưa có biển số đầu vào.'],
      provinceCode: null,
      series: null,
      serial: null,
    }
  }

  if (normalized.length < MIN_RAW_LENGTH) reasons.push('Biển số quá ngắn so với rule demo.')
  if (normalized.length > MAX_RAW_LENGTH) reasons.push('Biển số vượt quá độ dài tối đa.')

  const family = classifyPlateFamily(compact)
  const domestic = compact ? splitDomestic(compact) : null

  if (family === 'UNKNOWN') {
    reasons.push('Không khớp pattern biển số đang hỗ trợ trên shared core.')
  }

  if (domestic) {
    if (!/^\d{2}$/.test(domestic.provinceCode)) reasons.push('Mã tỉnh phải gồm 2 chữ số.')
    if (!/^[A-Z]{1,2}$/.test(domestic.series)) reasons.push('Series phải gồm 1–2 ký tự chữ cái.')
    if (!/^\d{4,5}$/.test(domestic.serial)) reasons.push('Serial phải gồm 4–5 chữ số.')
    // Only flag reserved series for DOMESTIC plates — DIPLOMATIC plates use NG/QT/NN legitimately.
    if (family === 'DOMESTIC' && RESERVED_SERIES.includes(domestic.series)) {
      reasons.push('Suspicious flags: RESERVED_SERIES_STYLE')
    }
  }

  if (substitutions.length > 0) reasons.push('Có OCR substitution; backend sẽ quyết định authoritative.')
  if (suspiciousFlags.length > 0) reasons.push(`Suspicious flags: ${suspiciousFlags.join(', ')}`)

  // Cascading validity: INVALID wins over REVIEW, REVIEW wins over STRICT_VALID
  const suspicious = suspiciousFlags.length > 0 || substitutions.length > 0
  let validity: PlateValidity = 'STRICT_VALID'
  if (!compact || family === 'UNKNOWN' || reasons.some((reason) =>
    reason.includes('không khớp') ||
    reason.includes('quá ngắn') ||
    reason.includes('vượt quá'),
  )) {
    validity = 'INVALID'
  } else if (suspicious) {
    validity = 'REVIEW'
  }

  return {
    input: raw,
    normalized,
    compact,
    display: formatPlateDisplay(compact),
    family,
    validity,
    suspicious,
    reviewRequired: validity !== 'STRICT_VALID' || suspicious,
    substitutions,
    reasons,
    provinceCode: domestic?.provinceCode ?? null,
    series: domestic?.series ?? null,
    serial: domestic?.serial ?? null,
  }
}

export function parsePlate(rawInput: string | null | undefined): PlateParseResult {
  return validatePlateStrict(rawInput)
}

export function buildPlateCanonical(rawInput: string | null | undefined): PlateCanonicalResult {
  const parsed = validatePlateStrict(rawInput)
  const suspiciousFlags = detectSuspiciousPlate(rawInput)
  // RESERVED_SERIES_STYLE is family-dependent (only relevant for DOMESTIC) and
  // not detected by detectSuspiciousPlate alone. Include it for completeness.
  const allFlags = [...suspiciousFlags]
  if (
    parsed.family === 'DOMESTIC' &&
    parsed.series &&
    RESERVED_SERIES.includes(parsed.series)
  ) {
    allFlags.push('RESERVED_SERIES_STYLE')
  }
  return {
    plateRaw: parsed.input.trim() ? parsed.input.trim() : null,
    plateCompact: parsed.compact,
    plateDisplay: parsed.display,
    plateFamily: parsed.family,
    plateValidity: parsed.validity,
    ocrSubstitutions: parsed.substitutions,
    suspiciousFlags: Array.from(new Set(allFlags)),
    validationNotes: parsed.reasons,
    reviewRequired: parsed.reviewRequired,
  }
}
