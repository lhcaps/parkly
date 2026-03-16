export type PlateFamily = 'DOMESTIC' | 'SPECIAL' | 'DIPLOMATIC' | 'FOREIGN' | 'UNKNOWN'
export type PlateValidity = 'STRICT_VALID' | 'REVIEW' | 'INVALID'

export type PlateFamilyRule = {
  family: PlateFamily
  pattern: RegExp
  description: string
}

export const MIN_RAW_LENGTH = 5
export const MAX_RAW_LENGTH = 32

export const OCR_TO_ALPHA_MAP: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '2': 'Z',
  '4': 'A',
  '5': 'S',
  '6': 'G',
  '8': 'B',
}

export const OCR_TO_DIGIT_MAP: Record<string, string> = {
  O: '0',
  Q: '0',
  D: '0',
  I: '1',
  L: '1',
  Z: '2',
  S: '5',
  G: '6',
  B: '8',
}

export const RESERVED_SERIES = ['NG', 'QT', 'NN', 'CD', 'LD', 'KT']

export const PLATE_FAMILY_RULES: PlateFamilyRule[] = [
  {
    family: 'DIPLOMATIC',
    pattern: /^\d{2}(NG|QT|NN)\d{3,5}$/,
    description: 'Biển ngoại giao / cơ quan nước ngoài',
  },
  {
    family: 'SPECIAL',
    pattern: /^\d{2}(CD|LD|KT)\d{3,5}$/,
    description: 'Biển chuyên biệt / đặc thù',
  },
  {
    family: 'DOMESTIC',
    pattern: /^\d{2}[A-Z]{1,2}\d{4,5}$/,
    description: 'Biển dân sự nội địa',
  },
  {
    family: 'FOREIGN',
    pattern: /^\d{2}[A-Z]{1,3}\d{3,6}$/,
    description: 'Biển quốc tế / không chuẩn demo',
  },
]

export function classifyPlateFamily(compact: string | null | undefined): PlateFamily {
  const value = String(compact ?? '').trim().toUpperCase()
  if (!value) return 'UNKNOWN'

  for (const rule of PLATE_FAMILY_RULES) {
    if (rule.pattern.test(value)) return rule.family
  }

  return 'UNKNOWN'
}
