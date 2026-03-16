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
  return ch >= '0' && ch <= '9'
}

function isAlpha(ch: string) {
  return ch >= 'A' && ch <= 'Z'
}

function normalizeDomestic(candidate: string) {
  const substitutions: string[] = []
  const chars = candidate.split('')

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i]
    if (i < 2) {
      if (isAlpha(ch) && OCR_TO_DIGIT_MAP[ch]) {
        substitutions.push(`${ch}→${OCR_TO_DIGIT_MAP[ch]}@province`)
        chars[i] = OCR_TO_DIGIT_MAP[ch]
      }
      continue
    }

    if (i < 4) {
      if (isDigit(ch) && OCR_TO_ALPHA_MAP[ch]) {
        substitutions.push(`${ch}→${OCR_TO_ALPHA_MAP[ch]}@series`)
        chars[i] = OCR_TO_ALPHA_MAP[ch]
      }
      continue
    }

    if (isAlpha(ch) && OCR_TO_DIGIT_MAP[ch]) {
      substitutions.push(`${ch}→${OCR_TO_DIGIT_MAP[ch]}@serial`)
      chars[i] = OCR_TO_DIGIT_MAP[ch]
    }
  }

  return { compact: chars.join(''), substitutions }
}

function splitDomestic(compact: string) {
  const m = compact.match(/^(\d{2})([A-Z]{1,2})(\d{4,5})$/)
  if (!m) return null
  return { provinceCode: m[1], series: m[2], serial: m[3] }
}

export function formatPlateDisplay(compactInput: string | null | undefined): string | null {
  const compact = String(compactInput ?? '').trim().toUpperCase()
  if (!compact) return null

  const domestic = splitDomestic(compact)
  if (domestic) {
    const serialFormatted = domestic.serial.length === 5
      ? `${domestic.serial.slice(0, 3)}.${domestic.serial.slice(3)}`
      : `${domestic.serial.slice(0, 2)}.${domestic.serial.slice(2)}`
    return `${domestic.provinceCode}-${domestic.series} ${serialFormatted}`
  }

  const special = compact.match(/^(\d{2})(NG|QT|NN|CD|LD|KT)(\d{3,5})$/)
  if (special) return `${special[1]}-${special[2]} ${special[3]}`

  if (compact.length > 4) return `${compact.slice(0, 2)}-${compact.slice(2)}`
  return compact
}

export function normalizePlate(rawInput: string | null | undefined): PlateNormalizationResult {
  const raw = String(rawInput ?? '').trim().slice(0, MAX_RAW_LENGTH)
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
  const normalized = stripNoise(raw)
  const flags: string[] = []

  if (!raw) return flags
  if (raw.length < MIN_RAW_LENGTH) flags.push('TOO_SHORT')
  if (raw.length > MAX_RAW_LENGTH) flags.push('TOO_LONG')
  if (/[^A-Za-z0-9\s._-]/.test(raw)) flags.push('NON_STANDARD_SYMBOLS')
  if (/([A-Z0-9])\1{4,}/.test(normalized)) flags.push('REPEATED_SEQUENCE')
  if (!/^\d{2}/.test(normalized)) flags.push('MISSING_PROVINCE_PREFIX')

  const domestic = splitDomestic(normalized)
  if (domestic && RESERVED_SERIES.includes(domestic.series)) flags.push('RESERVED_SERIES_STYLE')

  return Array.from(new Set(flags))
}

export function validatePlateStrict(rawInput: string | null | undefined): PlateParseResult {
  const { raw, compact, normalized, substitutions } = normalizePlate(rawInput)
  const suspiciousFlags = detectSuspiciousPlate(raw)
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
  }

  if (substitutions.length > 0) reasons.push('Có OCR substitution; backend sẽ quyết định authoritative.')
  if (suspiciousFlags.length > 0) reasons.push(`Suspicious flags: ${suspiciousFlags.join(', ')}`)

  let validity: PlateValidity = 'STRICT_VALID'
  if (!compact || family === 'UNKNOWN' || reasons.some((reason) => reason.includes('không khớp') || reason.includes('quá ngắn') || reason.includes('vượt quá'))) {
    validity = 'INVALID'
  } else if (substitutions.length > 0 || suspiciousFlags.length > 0) {
    validity = 'REVIEW'
  }

  return {
    input: raw,
    normalized,
    compact,
    display: formatPlateDisplay(compact),
    family,
    validity,
    suspicious: suspiciousFlags.length > 0 || substitutions.length > 0,
    substitutions,
    reasons,
    provinceCode: domestic?.provinceCode ?? null,
    series: domestic?.series ?? null,
    serial: domestic?.serial ?? null,
  }
}

export function parsePlate(rawInput: string | null | undefined) {
  return validatePlateStrict(rawInput)
}

export function buildPlateCanonical(rawInput: string | null | undefined): PlateCanonicalResult {
  const parsed = validatePlateStrict(rawInput)
  const suspiciousFlags = detectSuspiciousPlate(rawInput)
  return {
    plateRaw: parsed.input.trim() ? parsed.input.trim() : null,
    plateCompact: parsed.compact,
    plateDisplay: parsed.display,
    plateFamily: parsed.family,
    plateValidity: parsed.validity,
    ocrSubstitutions: parsed.substitutions,
    suspiciousFlags,
    validationNotes: parsed.reasons,
    reviewRequired: parsed.validity !== 'STRICT_VALID' || suspiciousFlags.length > 0,
  }
}
