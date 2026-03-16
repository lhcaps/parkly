import test from 'node:test'
import assert from 'node:assert/strict'

import { ApiError } from '../server/http'
import { normalizeAlprError } from '../server/services/alpr-error-normalizer'

test('normalizeAlprError maps missing tesseract binary to service unavailable', () => {
  const normalized = normalizeAlprError({
    code: 'ENOENT',
    message: 'spawn tesseract ENOENT',
  }, {
    surface: 'POST /api/alpr/preview',
  })

  assert.equal(normalized.code, 'SERVICE_UNAVAILABLE')
  assert.equal(normalized.statusCode, 503)
  assert.equal((normalized.details as any).failureReason, 'TESSERACT_BINARY_NOT_FOUND')
})

test('normalizeAlprError preserves structured ALPR failureReason from business errors', () => {
  const normalized = normalizeAlprError(new ApiError({
    code: 'UNPROCESSABLE_ENTITY',
    message: 'OCR không đọc ra text đủ tin cậy từ ảnh hiện tại.',
    details: {
      reason: 'OCR_NO_TEXT',
      attempts: 12,
    },
  }), {
    surface: 'POST /api/alpr/preview',
  })

  assert.equal(normalized.code, 'UNPROCESSABLE_ENTITY')
  assert.equal(normalized.statusCode, 422)
  assert.equal((normalized.details as any).reason, 'OCR_NO_TEXT')
  assert.equal((normalized.details as any).failureReason, 'OCR_NO_TEXT')
  assert.equal((normalized.details as any).attempts, 12)
})
