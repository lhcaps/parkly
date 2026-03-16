import test from 'node:test'
import assert from 'node:assert/strict'

import { parseSecretsRotationCheckArgs, runSecretsRotationCheck } from '../scripts/secrets-rotation-check'

const activeInternal = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const nextInternal = '111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000'
const activeCapture = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
const nextCapture = '9999aaaabbbbccccddddeeeeffff000011112222333344445555666677778888'

test('secrets:rotation:check pass cho active-only, active+next, next-only và không leak raw secret', () => {
  const activeOnly = runSecretsRotationCheck(parseSecretsRotationCheckArgs([]), {
    API_INTERNAL_SERVICE_TOKEN_ACTIVE: activeInternal,
    DEVICE_CAPTURE_SECRET_ACTIVE: activeCapture,
  })
  assert.equal(activeOnly.exitCode, 0)
  assert.match(activeOnly.output, /ACTIVE_ONLY/)
  assert.doesNotMatch(activeOnly.output, new RegExp(activeInternal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  const rotationWindow = runSecretsRotationCheck(parseSecretsRotationCheckArgs(['--format', 'json']), {
    API_INTERNAL_SERVICE_TOKEN_ACTIVE: activeInternal,
    API_INTERNAL_SERVICE_TOKEN_NEXT: nextInternal,
    DEVICE_CAPTURE_SECRET_ACTIVE: activeCapture,
    DEVICE_CAPTURE_SECRET_NEXT: nextCapture,
  })
  assert.equal(rotationWindow.exitCode, 0)
  const payload = JSON.parse(rotationWindow.output)
  assert.equal(payload.fields.API_INTERNAL_SERVICE_TOKEN.mode, 'ACTIVE_AND_NEXT')
  assert.equal(payload.fields.DEVICE_CAPTURE_DEFAULT_SECRET.mode, 'ACTIVE_AND_NEXT')

  const nextOnly = runSecretsRotationCheck(parseSecretsRotationCheckArgs([]), {
    API_INTERNAL_SERVICE_TOKEN_NEXT: nextInternal,
    DEVICE_CAPTURE_SECRET_NEXT: nextCapture,
  })
  assert.equal(nextOnly.exitCode, 0)
  assert.match(nextOnly.output, /NEXT_ONLY/)
})

test('secrets:rotation:check reject duplicate và invalid flag', () => {
  const duplicate = runSecretsRotationCheck(parseSecretsRotationCheckArgs([]), {
    API_INTERNAL_SERVICE_TOKEN_ACTIVE: activeInternal,
    API_INTERNAL_SERVICE_TOKEN_NEXT: activeInternal,
    DEVICE_CAPTURE_SECRET_ACTIVE: activeCapture,
  })
  assert.equal(duplicate.exitCode, 1)
  assert.match(duplicate.output, /active-next-duplicate/i)

  assert.throws(
    () => parseSecretsRotationCheckArgs(['--bad-flag']),
    (error: unknown) => {
      assert.match(String((error as Error).message), /flag không hợp lệ/i)
      assert.equal(Number((error as Error & { exitCode?: number }).exitCode), 2)
      return true
    },
  )
})
