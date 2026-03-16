import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getMetricsDebugSummary,
  observeSecretMissingAuthHeader,
  observeSecretReject,
  observeSecretReplaySuspicion,
  observeSecretRotationEvent,
  resetMetricsDebugState,
} from '../server/metrics'
import { buildHealthBreakdown } from '../server/health'
import { getDefaultZonePresenceIntakeDeps } from '../modules/presence/application/ingest-zone-presence-event'
import { verifyDeviceSignature } from '../modules/gate/application/verify-device-signature'
import { buildSecretRotationAuditEntries } from '../lib/security/secret-rotation-audit'

const INTERNAL_ACTIVE = '529dc1cb7dcf797fee2e076917cd6b0b872aa43af1fc0811fcecdc1c3f8e435b'
const INTERNAL_NEXT = '83af2f15d71e9a20cb7f4be0860b28bd29c4435b71562c0a0be3f1db4674c001'
const DEVICE_ACTIVE = 'c5fec4789c275edcfcb95307ac97c40b9f3a70ad0fa0d1f534b6672dc90b8d44'
const DEVICE_NEXT = '7bd8c5143d1f3226c9f0cc8698cf9d31a83fef5f4c4be968cc499f7d5b0f3812'
const PRESENCE_KEY = 'presence-api-key-012345678901234567890123'
const PRESENCE_HMAC = 'presence-hmac-0123456789012345678901234567'

function withEnv(patch: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(patch)) {
    previous.set(key, process.env[key])
    if (value == null) delete process.env[key]
    else process.env[key] = value
  }

  const done = () => {
    for (const [key, value] of previous.entries()) {
      if (value == null) delete process.env[key]
      else process.env[key] = value
    }
  }

  try {
    const result = fn()
    if (result && typeof (result as Promise<void>).then === 'function') {
      return (result as Promise<void>).finally(done)
    }
    done()
    return result
  } catch (error) {
    done()
    throw error
  }
}

test.afterEach(() => {
  resetMetricsDebugState()
})

test('secret safety metrics summary gom reject, missing header, replay suspicion và rotation events kèm spike hints', () => {
  observeSecretReject({ channel: 'INTERNAL_PRESENCE', reason: 'INVALID_SIGNATURE', count: 5 })
  observeSecretMissingAuthHeader({ channel: 'ACCESS_TOKEN', count: 2 })
  observeSecretReplaySuspicion({ channel: 'DEVICE_CAPTURE', reason: 'IDEMPOTENCY_REPLAY', count: 6 })
  observeSecretRotationEvent({ field: 'API_INTERNAL_SERVICE_TOKEN', action: 'STARTED', count: 1 })
  observeSecretRotationEvent({ field: 'API_INTERNAL_SERVICE_TOKEN', action: 'ROLLBACK', count: 1 })

  const summary = getMetricsDebugSummary().secretSafety
  assert.equal(summary.totals.rejects, 5)
  assert.equal(summary.totals.missingAuthHeaders, 2)
  assert.equal(summary.totals.replaySuspicions, 6)
  assert.equal(summary.totals.rotationEvents, 2)
  assert.equal(summary.rejects.find((row) => row.channel === 'INTERNAL_PRESENCE' && row.reason === 'INVALID_SIGNATURE')?.count, 5)
  assert.equal(summary.missingAuthHeaders.find((row) => row.channel === 'ACCESS_TOKEN')?.count, 2)
  assert.equal(summary.rotationEvents.find((row) => row.field === 'API_INTERNAL_SERVICE_TOKEN' && row.action === 'ROLLBACK')?.count, 1)
  assert.ok(summary.hints.some((item) => /Spike secret reject/i.test(item)))
  assert.ok(summary.hints.some((item) => /Replay suspicion/i.test(item)))
})

test('internal presence + device capture wiring đẩy metrics vào health secretSafety component', async () => {
  await withEnv({
    PARKLY_DEPLOYMENT_PROFILE: 'RELEASE_CANDIDATE',
    MEDIA_STORAGE_DRIVER: 'LOCAL',
    API_INTERNAL_SERVICE_TOKEN: INTERNAL_ACTIVE,
    API_INTERNAL_SERVICE_TOKEN_ACTIVE: INTERNAL_ACTIVE,
    API_INTERNAL_SERVICE_TOKEN_NEXT: INTERNAL_NEXT,
    DEVICE_CAPTURE_DEFAULT_SECRET: DEVICE_ACTIVE,
    DEVICE_CAPTURE_SECRET_ACTIVE: DEVICE_ACTIVE,
    DEVICE_CAPTURE_SECRET_NEXT: DEVICE_NEXT,
    DEVICE_CAPTURE_AUTH_MODE: 'ON',
    DEVICE_CAPTURE_MAX_SKEW_SECONDS: '300',
    INTERNAL_PRESENCE_API_KEY: PRESENCE_KEY,
    INTERNAL_PRESENCE_HMAC_SECRET: PRESENCE_HMAC,
    OBS_SECRET_REJECT_SPIKE_THRESHOLD: '1',
  }, async () => {
    const deps = getDefaultZonePresenceIntakeDeps()
    const nowSeconds = String(Math.floor(Date.now() / 1000))

    assert.throws(() => deps.verifyRequest({
      body: {
        schemaVersion: 'zone.presence.v1',
        cameraCode: 'CAM_01',
        zoneCode: 'VIP_A',
        spotCode: 'HCM-VIP-01',
        plateCompact: '51B67890',
        confidence: 0.95,
        capturedAt: new Date().toISOString(),
        snapshotObjectKey: null,
        modelVersion: 'v1',
        traceId: 'trace-1',
      },
      apiKey: null,
      timestamp: nowSeconds,
      signature: null,
    }))

    assert.throws(() => verifyDeviceSignature({
      surface: 'gate-capture',
      readType: 'ALPR',
      siteCode: 'SITE_HCM_01',
      deviceCode: 'GATE_01_ENTRY_CAMERA',
      requestId: 'req-secret-1',
      idempotencyKey: 'idem-secret-1',
      timestamp: new Date().toISOString(),
      signature: 'a'.repeat(64),
      plateRaw: '51B67890',
    }))

    const health = await buildHealthBreakdown({
      probeDb: async () => ({ available: true, latencyMs: 10, error: null }),
      getRedisHealth: async () => ({
        configured: true,
        required: false,
        keyPrefix: 'parkly:test',
        db: 0,
        url: 'redis://127.0.0.1:6379/0',
        connected: true,
        ready: true,
        available: true,
        degraded: false,
        latencyMs: 1,
        lastCheckAt: new Date().toISOString(),
        lastError: null,
      }),
      getObjectStorageHealth: async () => ({
        configured: true,
        available: true,
        degraded: false,
        endpoint: 'http://127.0.0.1:9000',
        region: 'us-east-1',
        bucket: 'parkly-media',
        forcePathStyle: true,
        useSsl: false,
        lastCheckAt: new Date().toISOString(),
        lastError: null,
      }),
      readCleanupMarker: async () => ({ updatedAt: new Date().toISOString(), outcome: 'OK' } as any),
      now: () => new Date(),
    })

    assert.equal(health.components.secretSafety.status, 'READY')
    assert.equal(health.components.secretSafety.internalServiceRotation.mode, 'ACTIVE_AND_NEXT')
    assert.equal(health.components.secretSafety.deviceCaptureRotation.mode, 'ACTIVE_AND_NEXT')
    assert.equal(health.components.secretSafety.observed.totals.rejects >= 2, true)
    assert.equal(health.components.secretSafety.observed.totals.missingAuthHeaders >= 1, true)
    assert.ok(health.components.secretSafety.mismatchSpikeHint)
    assert.equal(health.ready, true)
  })
})

test('secret rotation audit entries chỉ chứa masked/fingerprint và map đúng event action', () => {
  const entries = buildSecretRotationAuditEntries({
    action: 'ROLLBACK',
    field: 'ALL',
    correlationId: 'corr-secret-rollback',
    requestId: 'req-secret-rollback',
    env: {
      PARKLY_DEPLOYMENT_PROFILE: 'RELEASE_CANDIDATE',
      API_INTERNAL_SERVICE_TOKEN_ACTIVE: INTERNAL_ACTIVE,
      API_INTERNAL_SERVICE_TOKEN_NEXT: INTERNAL_NEXT,
      DEVICE_CAPTURE_SECRET_ACTIVE: DEVICE_ACTIVE,
      DEVICE_CAPTURE_SECRET_NEXT: DEVICE_NEXT,
    } as NodeJS.ProcessEnv,
  })

  assert.equal(entries.length, 2)
  assert.equal(entries[0].action, 'SECRET_ROTATION_ROLLBACK')
  const payload = JSON.stringify(entries)
  assert.doesNotMatch(payload, new RegExp(INTERNAL_ACTIVE))
  assert.doesNotMatch(payload, new RegExp(DEVICE_ACTIVE))
  assert.match(payload, /fingerprint/)
  assert.match(payload, /masked/)
})
