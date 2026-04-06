import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildPlateCanonical,
  classifyPlateFamily,
  detectSuspiciousPlate,
  formatPlateDisplay,
  normalizePlate,
  parsePlate,
  validatePlateStrict,
  MAX_RAW_LENGTH,
  MIN_RAW_LENGTH,
  OCR_TO_ALPHA_MAP,
  OCR_TO_DIGIT_MAP,
  RESERVED_SERIES,
} from '@parkly/gate-core'

import { ApiError } from '../server/http'
import { assertNoClientCanonicalPlateFields, deriveAuthoritativePlateResult } from '../server/plate-authority'

// ---------------------------------------------------------------------------
// Existing tests from original file (must continue passing)
// ---------------------------------------------------------------------------

test('valid plate returns STRICT_VALID canonical result', () => {
  const result = buildPlateCanonical('51AB12345')
  assert.equal(result.plateCompact, '51AB12345')
  assert.equal(result.plateDisplay, '51-AB 123.45')
  assert.equal(result.plateValidity, 'STRICT_VALID')
  assert.equal(result.reviewRequired, false)
})

test('invalid plate is marked INVALID', () => {
  const result = validatePlateStrict('12')
  assert.equal(result.validity, 'INVALID')
  assert.equal(result.compact, '12')
  assert.match(result.reasons.join(' | '), /quá ngắn|Không khớp/i)
})

test('ambiguous OCR substitution is REVIEW', () => {
  const result = parsePlate('51S-12B.45')
  assert.equal(result.validity, 'REVIEW')
  assert.ok(result.substitutions.length > 0)
})

test('nested canonical spoof inside raw payload is rejected', () => {
  assert.throws(
    () => assertNoClientCanonicalPlateFields({ rawPayload: { plateEngine: { plateDisplay: '51-AB 123.45' } } }, 'unit-test'),
    (error: unknown) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.code, 'BAD_REQUEST')
      const details = (error as ApiError & { details?: { forbiddenPaths?: unknown } }).details
      assert.match(String(details?.forbiddenPaths), /rawPayload\.plateEngine\.plateDisplay/)
      return true
    },
  )
})

test('mismatch between licensePlateRaw and alprPlate is rejected', () => {
  assert.throws(
    () => deriveAuthoritativePlateResult({
      surface: 'unit-test',
      licensePlateRaw: '51AB12345',
      alprPlate: '30AB12345',
    }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.code, 'BAD_REQUEST')
      assert.match(error.message, /không khớp/i)
      return true
    },
  )
})

test('invalid authoritative plate input is rejected for write surfaces', () => {
  assert.throws(
    () => deriveAuthoritativePlateResult({
      surface: 'unit-test',
      licensePlateRaw: '12',
    }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.code, 'BAD_REQUEST')
      assert.match(error.message, /strict validation/i)
      return true
    },
  )
})

// ---------------------------------------------------------------------------
// Null / undefined / empty input safety (hardening)
// ---------------------------------------------------------------------------

test('buildPlateCanonical handles null safely', () => {
  const result = buildPlateCanonical(null)
  assert.equal(result.plateRaw, null)
  assert.equal(result.plateCompact, null)
  assert.equal(result.plateDisplay, null)
  assert.equal(result.plateFamily, 'UNKNOWN')
  assert.equal(result.plateValidity, 'INVALID')
  assert.equal(result.ocrSubstitutions.length, 0)
})

test('buildPlateCanonical handles undefined safely', () => {
  const result = buildPlateCanonical(undefined)
  assert.equal(result.plateRaw, null)
  assert.equal(result.plateValidity, 'INVALID')
})

test('buildPlateCanonical handles empty string safely', () => {
  const result = buildPlateCanonical('')
  assert.equal(result.plateRaw, null)
  assert.equal(result.plateValidity, 'INVALID')
})

test('formatPlateDisplay handles null / undefined / empty safely', () => {
  assert.equal(formatPlateDisplay(null), null)
  assert.equal(formatPlateDisplay(undefined), null)
  assert.equal(formatPlateDisplay(''), null)
})

test('normalizePlate handles empty input safely', () => {
  const result = normalizePlate('')
  assert.equal(result.raw, '')
  assert.equal(result.normalized, '')
  assert.equal(result.compact, null)
  assert.equal(result.substitutions.length, 0)
})

test('detectSuspiciousPlate handles empty / null / undefined safely', () => {
  assert.deepEqual(detectSuspiciousPlate(''), [])
  assert.deepEqual(detectSuspiciousPlate(null), [])
  assert.deepEqual(detectSuspiciousPlate(undefined), [])
})

test('classifyPlateFamily handles null / empty safely', () => {
  assert.equal(classifyPlateFamily(null), 'UNKNOWN')
  assert.equal(classifyPlateFamily(''), 'UNKNOWN')
  assert.equal(classifyPlateFamily(undefined), 'UNKNOWN')
})

// ---------------------------------------------------------------------------
// OCR substitution detection
// ---------------------------------------------------------------------------

test('OCR digit substituted in series (0→O) marked REVIEW', () => {
  const result = parsePlate('51S01234')
  // Position 3: digit '0' → OCR alpha correction via OCR_TO_ALPHA_MAP
  assert.equal(result.validity, 'REVIEW')
  assert.ok(result.substitutions.some((s) => s.includes('0→O')))
  assert.equal(result.reviewRequired, true)
})

test('OCR alpha substituted in province (O→0) marked REVIEW', () => {
  const result = parsePlate('O1AB12345')
  assert.equal(result.validity, 'REVIEW')
  assert.ok(result.substitutions.some((s) => s.includes('O→0')))
})

test('OCR alpha substituted in serial (B→8) marked REVIEW', () => {
  const result = parsePlate('51AB12B45')
  assert.equal(result.validity, 'REVIEW')
  assert.ok(result.substitutions.some((s) => s.includes('B→8')))
})

test('Multiple OCR substitutions still get REVIEW', () => {
  const result = parsePlate('O1S01234')
  assert.ok(result.substitutions.length >= 2)
  assert.equal(result.validity, 'REVIEW')
})

test('normalizeDomestic applies OCR corrections at correct positions', () => {
  // '51AB12345' → A at position 2, B at position 3
  // OCR_TO_ALPHA_MAP: 2→Z, 4→A, 5→S, 6→G, 8→B
  // A is NOT in the map, B is NOT in the map for SERIES
  const result = normalizePlate('51AB12345')
  // A at pos2: not a digit, skip. B at pos3: not a digit, skip.
  assert.equal(result.compact, '51AB12345')
  assert.equal(result.substitutions.length, 0)
})

test('OCR_TO_ALPHA_MAP key entries', () => {
  assert.equal(OCR_TO_ALPHA_MAP['0'], 'O')
  assert.equal(OCR_TO_ALPHA_MAP['1'], 'I')
  assert.equal(OCR_TO_ALPHA_MAP['2'], 'Z')
  assert.equal(OCR_TO_ALPHA_MAP['4'], 'A')
  assert.equal(OCR_TO_ALPHA_MAP['5'], 'S')
  assert.equal(OCR_TO_ALPHA_MAP['6'], 'G')
  assert.equal(OCR_TO_ALPHA_MAP['8'], 'B')
})

test('OCR_TO_DIGIT_MAP key entries', () => {
  assert.equal(OCR_TO_DIGIT_MAP['O'], '0')
  assert.equal(OCR_TO_DIGIT_MAP['Q'], '0')
  assert.equal(OCR_TO_DIGIT_MAP['I'], '1')
  assert.equal(OCR_TO_DIGIT_MAP['L'], '1')
  assert.equal(OCR_TO_DIGIT_MAP['Z'], '2')
  assert.equal(OCR_TO_DIGIT_MAP['S'], '5')
  assert.equal(OCR_TO_DIGIT_MAP['G'], '6')
  assert.equal(OCR_TO_DIGIT_MAP['B'], '8')
})

// ---------------------------------------------------------------------------
// Suspicious flag detection
// ---------------------------------------------------------------------------

test('TOO_SHORT flagged for short input', () => {
  const flags = detectSuspiciousPlate('51AB')
  assert.ok(flags.includes('TOO_SHORT'))
})

test('TOO_LONG flagged for over-length input', () => {
  const input = '51' + 'A'.repeat(50)
  const flags = detectSuspiciousPlate(input)
  assert.ok(flags.includes('TOO_LONG'))
})

test('NON_STANDARD_SYMBOLS flagged', () => {
  const flags = detectSuspiciousPlate('51AB!@#$1234')
  assert.ok(flags.includes('NON_STANDARD_SYMBOLS'))
})

test('REPEATED_SEQUENCE flagged', () => {
  const flags = detectSuspiciousPlate('51AAAAA1234')
  assert.ok(flags.includes('REPEATED_SEQUENCE'))
})

test('MISSING_PROVINCE_PREFIX flagged', () => {
  const flags = detectSuspiciousPlate('AB12345')
  assert.ok(flags.includes('MISSING_PROVINCE_PREFIX'))
})

// ---------------------------------------------------------------------------
// Plate display formatting
// ---------------------------------------------------------------------------

test('formatPlateDisplay domestic 4-digit serial', () => {
  assert.equal(formatPlateDisplay('51AB1234'), '51-AB 12.34')
})

test('formatPlateDisplay domestic 5-digit serial', () => {
  assert.equal(formatPlateDisplay('51AB12345'), '51-AB 123.45')
})

test('formatPlateDisplay special (CD/LD/KT) formats correctly', () => {
  assert.equal(formatPlateDisplay('51CD123'), '51-CD 123')
})

test('formatPlateDisplay diplomatic (NG) formats correctly', () => {
  assert.equal(formatPlateDisplay('51NG4567'), '51-NG 4567')
})

test('formatPlateDisplay short fallback when < 5 chars', () => {
  assert.equal(formatPlateDisplay('ABCD'), 'ABCD')
})

// ---------------------------------------------------------------------------
// Validity cascading: INVALID > REVIEW > STRICT_VALID
// ---------------------------------------------------------------------------

test('INVALID plate with suspicious pattern', () => {
  const result = parsePlate('AB1')
  assert.equal(result.validity, 'INVALID')
  assert.ok(result.reasons.length > 0)
})

test('Plate too short is INVALID', () => {
  const result = parsePlate('51A')
  assert.equal(result.validity, 'INVALID')
  assert.ok(result.reasons.some((r) => r.includes('quá ngắn')))
})

test('STRICT_VALID plate has no suspicious flags', () => {
  const result = parsePlate('51AB12345')
  assert.equal(result.validity, 'STRICT_VALID')
  assert.equal(result.reviewRequired, false)
})

// ---------------------------------------------------------------------------
// buildPlateCanonical consistency with validatePlateStrict
// ---------------------------------------------------------------------------

test('buildPlateCanonical matches validatePlateStrict for valid DOMESTIC', () => {
  const canonical = buildPlateCanonical('51AB12345')
  const parsed = validatePlateStrict('51AB12345')
  assert.equal(canonical.plateFamily, parsed.family)
  assert.equal(canonical.plateValidity, parsed.validity)
  assert.equal(canonical.plateCompact, parsed.compact)
  assert.equal(canonical.plateDisplay, parsed.display)
})

test('buildPlateCanonical matches validatePlateStrict for invalid plate', () => {
  const canonical = buildPlateCanonical('zz')
  const parsed = validatePlateStrict('zz')
  assert.equal(canonical.plateFamily, parsed.family)
  assert.equal(canonical.plateValidity, parsed.validity)
})

test('buildPlateCanonical marks REVIEW plates as reviewRequired', () => {
  const canonical = buildPlateCanonical('51S01234')
  assert.equal(canonical.reviewRequired, true)
  assert.equal(canonical.plateValidity, 'REVIEW')
})

test('buildPlateCanonical marks INVALID plates as reviewRequired', () => {
  const canonical = buildPlateCanonical('zz')
  assert.equal(canonical.reviewRequired, true)
  assert.equal(canonical.plateValidity, 'INVALID')
})

test('buildPlateCanonical marks STRICT_VALID plates as not reviewRequired', () => {
  const canonical = buildPlateCanonical('51AB12345')
  assert.equal(canonical.reviewRequired, false)
  assert.equal(canonical.plateValidity, 'STRICT_VALID')
})

// ---------------------------------------------------------------------------
// Province code extraction for DOMESTIC plates
// ---------------------------------------------------------------------------

test('province code extracted for DOMESTIC 4-digit serial', () => {
  const result = validatePlateStrict('51AB1234')
  assert.equal(result.provinceCode, '51')
  assert.equal(result.series, 'AB')
  assert.equal(result.serial, '1234')
})

test('province code extracted for DOMESTIC 5-digit serial', () => {
  const result = validatePlateStrict('29D12345')
  // normalizeDomestic: digit '1' at position 2 → 'I' (OCR correction)
  // splitDomestic sees '29DI2345': series=DI, serial=2345
  assert.equal(result.provinceCode, '29')
  assert.equal(result.series, 'DI')
  assert.equal(result.serial, '2345')
})

// ---------------------------------------------------------------------------
// Unicode normalization and whitespace stripping
// ---------------------------------------------------------------------------

test('Vietnamese Đ normalized and OCR cascade applied', () => {
  const result = buildPlateCanonical('51Đ12345')
  // NFKC: Đ→D. Then OCR cascade: digit '1' at position 2 → 'I'.
  // So compact = '51DI2345', not '51D12345'.
  assert.equal(result.plateCompact, '51DI2345')
  assert.equal(result.plateFamily, 'DOMESTIC')
  assert.equal(result.plateValidity, 'REVIEW')
  assert.equal(result.reviewRequired, true)
})

test('Unicode NFKC normalization of full-width characters', () => {
  const result = normalizePlate('51ＡＢ12345')
  assert.equal(result.compact, '51AB12345')
})

test('Whitespace stripped during normalization', () => {
  const result = normalizePlate('  51  AB  12345  ')
  assert.equal(result.compact, '51AB12345')
})

// ---------------------------------------------------------------------------
// Constants validation
// ---------------------------------------------------------------------------

test('MAX_RAW_LENGTH is 32', () => {
  assert.equal(MAX_RAW_LENGTH, 32)
})

test('MIN_RAW_LENGTH is 5', () => {
  assert.equal(MIN_RAW_LENGTH, 5)
})

test('RESERVED_SERIES includes expected values', () => {
  assert.deepEqual(RESERVED_SERIES.sort(), ['CD', 'KT', 'LD', 'NG', 'NN', 'QT'].sort())
})

// ---------------------------------------------------------------------------
// parsePlate alias consistency
// ---------------------------------------------------------------------------

test('parsePlate returns same as validatePlateStrict', () => {
  const input = '51AB12345'
  assert.equal(parsePlate(input).validity, validatePlateStrict(input).validity)
  assert.equal(parsePlate(input).compact, validatePlateStrict(input).compact)
})

test('parsePlate handles null safely', () => {
  const result = parsePlate(null)
  assert.equal(result.validity, 'INVALID')
})

// ---------------------------------------------------------------------------
// Plate family classification
// ---------------------------------------------------------------------------

test('classifyPlateFamily: DOMESTIC pattern recognized', () => {
  assert.equal(classifyPlateFamily('51AB12345'), 'DOMESTIC')
  assert.equal(classifyPlateFamily('51AB1234'), 'DOMESTIC')
  assert.equal(classifyPlateFamily('29D12345'), 'DOMESTIC')
})

test('classifyPlateFamily: DIPLOMATIC pattern recognized', () => {
  assert.equal(classifyPlateFamily('51NG123'), 'DIPLOMATIC')
  assert.equal(classifyPlateFamily('29QT4567'), 'DIPLOMATIC')
  assert.equal(classifyPlateFamily('43NN12345'), 'DIPLOMATIC')
})

test('classifyPlateFamily: SPECIAL pattern recognized', () => {
  assert.equal(classifyPlateFamily('51CD123'), 'SPECIAL')
  assert.equal(classifyPlateFamily('29LD4567'), 'SPECIAL')
  assert.equal(classifyPlateFamily('43KT12345'), 'SPECIAL')
})

test('classifyPlateFamily: FOREIGN pattern recognized', () => {
  assert.equal(classifyPlateFamily('51ABC123'), 'FOREIGN')
  assert.equal(classifyPlateFamily('51AB123456'), 'FOREIGN')
})

test('classifyPlateFamily: invalid pattern returns UNKNOWN', () => {
  assert.equal(classifyPlateFamily('AB12345'), 'UNKNOWN')
  assert.equal(classifyPlateFamily('ZZZZZZZZZZ'), 'UNKNOWN')
  assert.equal(classifyPlateFamily('!!INVALID!!'), 'UNKNOWN')
})

// ---------------------------------------------------------------------------
// buildPlateCanonical: all plate families produce valid results
// ---------------------------------------------------------------------------

test('buildPlateCanonical: DOMESTIC produces STRICT_VALID', () => {
  const result = buildPlateCanonical('51AB12345')
  assert.equal(result.plateValidity, 'STRICT_VALID')
  assert.equal(result.plateFamily, 'DOMESTIC')
  assert.equal(result.plateDisplay, '51-AB 123.45')
})

test('buildPlateCanonical: DIPLOMATIC produces STRICT_VALID', () => {
  const result = buildPlateCanonical('51NG123')
  assert.equal(result.plateValidity, 'STRICT_VALID')
  assert.equal(result.plateFamily, 'DIPLOMATIC')
})

test('buildPlateCanonical: SPECIAL produces STRICT_VALID', () => {
  const result = buildPlateCanonical('51CD123')
  assert.equal(result.plateValidity, 'STRICT_VALID')
  assert.equal(result.plateFamily, 'SPECIAL')
})

test('buildPlateCanonical: FOREIGN produces STRICT_VALID', () => {
  const result = buildPlateCanonical('51ABC123')
  assert.equal(result.plateValidity, 'STRICT_VALID')
  assert.equal(result.plateFamily, 'FOREIGN')
})
