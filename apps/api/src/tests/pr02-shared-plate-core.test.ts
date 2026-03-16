import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPlateCanonical, parsePlate, validatePlateStrict } from '@parkly/gate-core'

import { ApiError } from '../server/http'
import { assertNoClientCanonicalPlateFields, deriveAuthoritativePlateResult } from '../server/plate-authority'

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
