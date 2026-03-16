import test from 'node:test'
import assert from 'node:assert/strict'

import {
  constantTimeSecretEquals,
  evaluateSecretRotation,
  getNextRotationSecretValue,
  getPrimaryRotationSecretValue,
  matchRotationSecret,
  resolveDeviceCaptureDefaultRotation,
  resolveInternalServiceTokenRotation,
} from '../lib/security/secret-rotation'

const activeInternal = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const nextInternal = '111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000'
const activeCapture = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
const nextCapture = '9999aaaabbbbccccddddeeeeffff000011112222333344445555666677778888'

test('rotation resolver pass cho active-only, active+next và next-only', () => {
  const activeOnly = evaluateSecretRotation({
    API_INTERNAL_SERVICE_TOKEN_ACTIVE: activeInternal,
    DEVICE_CAPTURE_SECRET_ACTIVE: activeCapture,
  })
  assert.equal(activeOnly.ok, true)
  assert.equal(activeOnly.fields.API_INTERNAL_SERVICE_TOKEN.mode, 'ACTIVE_ONLY')
  assert.equal(getPrimaryRotationSecretValue(activeOnly.fields.API_INTERNAL_SERVICE_TOKEN), activeInternal)
  assert.equal(getNextRotationSecretValue(activeOnly.fields.API_INTERNAL_SERVICE_TOKEN), null)

  const rotationWindow = evaluateSecretRotation({
    API_INTERNAL_SERVICE_TOKEN_ACTIVE: activeInternal,
    API_INTERNAL_SERVICE_TOKEN_NEXT: nextInternal,
    DEVICE_CAPTURE_SECRET_ACTIVE: activeCapture,
    DEVICE_CAPTURE_SECRET_NEXT: nextCapture,
  })
  assert.equal(rotationWindow.ok, true)
  assert.equal(rotationWindow.fields.API_INTERNAL_SERVICE_TOKEN.mode, 'ACTIVE_AND_NEXT')
  assert.equal(rotationWindow.fields.DEVICE_CAPTURE_DEFAULT_SECRET.mode, 'ACTIVE_AND_NEXT')
  assert.equal(matchRotationSecret(rotationWindow.fields.API_INTERNAL_SERVICE_TOKEN, nextInternal)?.slot, 'NEXT')
  assert.equal(matchRotationSecret(rotationWindow.fields.DEVICE_CAPTURE_DEFAULT_SECRET, activeCapture)?.slot, 'ACTIVE')

  const nextOnly = evaluateSecretRotation({
    API_INTERNAL_SERVICE_TOKEN_NEXT: nextInternal,
    DEVICE_CAPTURE_SECRET_NEXT: nextCapture,
  })
  assert.equal(nextOnly.ok, true)
  assert.equal(nextOnly.fields.API_INTERNAL_SERVICE_TOKEN.mode, 'NEXT_ONLY')
  assert.equal(getPrimaryRotationSecretValue(nextOnly.fields.API_INTERNAL_SERVICE_TOKEN), nextInternal)
  assert.equal(getPrimaryRotationSecretValue(nextOnly.fields.DEVICE_CAPTURE_DEFAULT_SECRET), nextCapture)
})

test('rotation resolver reject duplicate active/next và legacy-active mismatch', () => {
  const duplicate = evaluateSecretRotation({
    API_INTERNAL_SERVICE_TOKEN_ACTIVE: activeInternal,
    API_INTERNAL_SERVICE_TOKEN_NEXT: activeInternal,
    DEVICE_CAPTURE_SECRET_ACTIVE: activeCapture,
    DEVICE_CAPTURE_SECRET_NEXT: nextCapture,
  })
  assert.equal(duplicate.ok, false)
  assert.match(JSON.stringify(duplicate.findings), /active-next-duplicate/)

  const mismatch = evaluateSecretRotation({
    API_INTERNAL_SERVICE_TOKEN: activeInternal,
    API_INTERNAL_SERVICE_TOKEN_ACTIVE: nextInternal,
    DEVICE_CAPTURE_DEFAULT_SECRET: activeCapture,
    DEVICE_CAPTURE_SECRET_ACTIVE: nextCapture,
  })
  assert.equal(mismatch.ok, false)
  assert.match(JSON.stringify(mismatch.findings), /legacy-active-mismatch/)
})

test('resolver chuyên biệt và constant-time compare hoạt động đúng', () => {
  const internal = resolveInternalServiceTokenRotation({
    API_INTERNAL_SERVICE_TOKEN_ACTIVE: activeInternal,
    API_INTERNAL_SERVICE_TOKEN_NEXT: nextInternal,
  })
  const capture = resolveDeviceCaptureDefaultRotation({
    DEVICE_CAPTURE_SECRET_ACTIVE: activeCapture,
    DEVICE_CAPTURE_SECRET_NEXT: nextCapture,
  })

  assert.equal(internal.accepted.length, 2)
  assert.equal(capture.accepted.length, 2)
  assert.equal(constantTimeSecretEquals(activeInternal, activeInternal), true)
  assert.equal(constantTimeSecretEquals(activeInternal, nextInternal), false)
})
