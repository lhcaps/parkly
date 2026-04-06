import test from 'node:test'
import assert from 'node:assert/strict'

import { ApiError } from '../server/http'
import { buildDeviceSignature, verifyDeviceSignature, type VerifyDeviceSignatureInput } from '../modules/gate/application/verify-device-signature'

const activeCapture = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
const nextCapture = '9999aaaabbbbccccddddeeeeffff000011112222333344445555666677778888'

function withEnv(patch: Record<string, string | undefined>, fn: () => void) {
  const snapshot = new Map<string, string | undefined>()
  for (const key of Object.keys(patch)) {
    snapshot.set(key, process.env[key])
    const next = patch[key]
    if (next == null) delete process.env[key]
    else process.env[key] = next
  }

  try {
    fn()
  } finally {
    for (const [key, value] of snapshot.entries()) {
      if (value == null) delete process.env[key]
      else process.env[key] = value
    }
  }
}

function buildInput(signature?: string): VerifyDeviceSignatureInput {
  const baseTs = Date.now() - 1000
  const captureTs = new Date(baseTs).toISOString()
  const reportedAt = new Date(baseTs + 500).toISOString()

  return {
    surface: 'gate-capture',
    readType: 'ALPR',
    siteCode: 'SITE_HCM_01',
    deviceCode: 'gate-01-entry-camera',
    requestId: 'req-rotation-1',
    idempotencyKey: 'idem-rotation-1',
    timestamp: captureTs,
    signature,
    laneCode: 'GATE_01_ENTRY',
    direction: 'ENTRY',
    eventTime: captureTs,
    reportedAt,
    plateRaw: '51A12345',
  }
}

test('verify-device-signature accept ACTIVE và NEXT trong rotation window', () => {
  withEnv(
    {
      DEVICE_CAPTURE_AUTH_MODE: 'ON',
      DEVICE_CAPTURE_MAX_SKEW_SECONDS: '600',
      DEVICE_CAPTURE_SECRET_ACTIVE: activeCapture,
      DEVICE_CAPTURE_SECRET_NEXT: nextCapture,
      DEVICE_CAPTURE_DEFAULT_SECRET: '',
      DEVICE_CAPTURE_SECRET_GATE_01_ENTRY_CAMERA: undefined,
      DEVICE_CAPTURE_SECRETS_JSON: '',
    },
    () => {
      const activeInput = buildInput()
      const activeSignature = buildDeviceSignature({ ...activeInput, secret: activeCapture })
      const activeResult = verifyDeviceSignature({ ...activeInput, signature: activeSignature })
      assert.equal(activeResult.verified, true)
      assert.equal(activeResult.secretSource, 'DEVICE_CAPTURE_SECRET_ACTIVE')

      const nextInput = buildInput()
      const nextSignature = buildDeviceSignature({ ...nextInput, secret: nextCapture })
      const nextResult = verifyDeviceSignature({ ...nextInput, signature: nextSignature })
      assert.equal(nextResult.verified, true)
      assert.equal(nextResult.secretSource, 'DEVICE_CAPTURE_SECRET_NEXT')
    },
  )
})

test('verify-device-signature accept NEXT_ONLY cutover và reject secret sai', () => {
  withEnv(
    {
      DEVICE_CAPTURE_AUTH_MODE: 'ON',
      DEVICE_CAPTURE_MAX_SKEW_SECONDS: '600',
      DEVICE_CAPTURE_SECRET_ACTIVE: '',
      DEVICE_CAPTURE_SECRET_NEXT: nextCapture,
      DEVICE_CAPTURE_DEFAULT_SECRET: '',
      DEVICE_CAPTURE_SECRET_GATE_01_ENTRY_CAMERA: undefined,
      DEVICE_CAPTURE_SECRETS_JSON: '',
    },
    () => {
      const input = buildInput()
      const signature = buildDeviceSignature({ ...input, secret: nextCapture })
      const result = verifyDeviceSignature({ ...input, signature })
      assert.equal(result.verified, true)
      assert.equal(result.secretSource, 'DEVICE_CAPTURE_SECRET_NEXT')

      assert.throws(
        () => verifyDeviceSignature({ ...input, signature: buildDeviceSignature({ ...input, secret: activeCapture }) }),
        (error: unknown) => {
          assert.ok(error instanceof ApiError)
          assert.match((error as ApiError).message, /không hợp lệ/i)
          return true
        },
      )
    },
  )
})
