import test from 'node:test'
import assert from 'node:assert/strict'

import { CaptureAlprBody, DeviceHeartbeatBody } from '@parkly/contracts'

import { ApiError } from '../server/http'
import {
  assertCaptureTimestampWithinSkew,
  buildDeviceSignature,
  verifyDeviceSignature,
} from '../modules/gate/application/verify-device-signature'

test('capture contract now requires deviceCode timestamp and signature', () => {
  const parsed = CaptureAlprBody.safeParse({
    requestId: 'req-1',
    idempotencyKey: 'idem-12345678',
    siteCode: 'SITE_HCM_01',
    laneCode: 'GATE_01_ENTRY',
    direction: 'ENTRY',
    plateRaw: '51AB12345',
  })

  assert.equal(parsed.success, false)
})

test('valid device signature is accepted', () => {
  process.env.DEVICE_CAPTURE_AUTH_MODE = 'ON'
  process.env.DEVICE_CAPTURE_DEFAULT_SECRET = 'unit-secret'
  process.env.DEVICE_CAPTURE_MAX_SKEW_SECONDS = '300'

  const timestamp = new Date().toISOString()
  const signature = buildDeviceSignature({
    secret: 'unit-secret',
    surface: 'POST /api/gate-reads/alpr',
    readType: 'ALPR',
    siteCode: 'SITE_HCM_01',
    deviceCode: 'GATE_01_ENTRY_CAMERA',
    laneCode: 'GATE_01_ENTRY',
    direction: 'ENTRY',
    requestId: 'req-1',
    idempotencyKey: 'idem-12345678',
    timestamp,
    eventTime: timestamp,
    plateRaw: '51AB12345',
  })

  const result = verifyDeviceSignature({
    surface: 'POST /api/gate-reads/alpr',
    readType: 'ALPR',
    siteCode: 'SITE_HCM_01',
    deviceCode: 'GATE_01_ENTRY_CAMERA',
    laneCode: 'GATE_01_ENTRY',
    direction: 'ENTRY',
    requestId: 'req-1',
    idempotencyKey: 'idem-12345678',
    timestamp,
    eventTime: timestamp,
    plateRaw: '51AB12345',
    signature,
  })

  assert.equal(result.verified, true)
  assert.equal(result.secretSource, 'DEVICE_CAPTURE_DEFAULT_SECRET')
})

test('bad signature is rejected clearly', () => {
  process.env.DEVICE_CAPTURE_AUTH_MODE = 'ON'
  process.env.DEVICE_CAPTURE_DEFAULT_SECRET = 'unit-secret'
  process.env.DEVICE_CAPTURE_MAX_SKEW_SECONDS = '300'

  assert.throws(
    () => verifyDeviceSignature({
      surface: 'POST /api/gate-reads/rfid',
      readType: 'RFID',
      siteCode: 'SITE_HCM_01',
      deviceCode: 'GATE_01_ENTRY_RFID',
      laneCode: 'GATE_01_ENTRY',
      direction: 'ENTRY',
      requestId: 'req-2',
      idempotencyKey: 'idem-87654321',
      timestamp: new Date().toISOString(),
      eventTime: new Date().toISOString(),
      rfidUid: 'ABCD1234',
      signature: 'a'.repeat(64),
    }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.code, 'UNAUTHENTICATED')
      assert.match(error.message, /chữ ký/i)
      return true
    },
  )
})

test('expired timestamp is rejected with explicit reason', () => {
  process.env.DEVICE_CAPTURE_MAX_SKEW_SECONDS = '60'

  assert.throws(
    () => assertCaptureTimestampWithinSkew({
      surface: 'POST /api/gate-reads/sensor',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.code, 'BAD_REQUEST')
      assert.match(error.message, /quá cũ/i)
      assert.equal((error.details as any)?.reason, 'DEVICE_TIMESTAMP_EXPIRED')
      return true
    },
  )
})

test('heartbeat contract also requires signed capture fields and rejects maintenance status', () => {
  const missingSignature = DeviceHeartbeatBody.safeParse({
    requestId: 'hb-1',
    idempotencyKey: 'idem-heartbeat-123',
    siteCode: 'SITE_HCM_01',
    deviceCode: 'GATE_01_ENTRY_CAMERA',
    status: 'ONLINE',
  })

  assert.equal(missingSignature.success, false)

  const invalidStatus = DeviceHeartbeatBody.safeParse({
    requestId: 'hb-1',
    idempotencyKey: 'idem-heartbeat-123',
    siteCode: 'SITE_HCM_01',
    deviceCode: 'GATE_01_ENTRY_CAMERA',
    status: 'MAINTENANCE',
    timestamp: new Date().toISOString(),
    signature: 'b'.repeat(64),
  })

  assert.equal(invalidStatus.success, false)
})
