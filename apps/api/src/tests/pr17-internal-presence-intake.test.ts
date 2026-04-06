import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ZONE_PRESENCE_SCHEMA_VERSION,
  computeZonePresenceSignature,
  ingestZonePresenceEvent,
  type ZonePresenceEventInput,
} from '../modules/presence/application/ingest-zone-presence-event'

type MemoryRow = {
  presenceEventId: bigint
  intakeStatus: 'ACCEPTED' | 'REJECTED'
  rejectReasonCode: string | null
  schemaVersion: string
  idempotencyKey: string
  traceId: string | null
  siteId: bigint | null
  zoneId: bigint | null
  spotId: bigint | null
  redisStreamId: string | null
}

function buildBody(overrides: Partial<ZonePresenceEventInput> = {}): ZonePresenceEventInput {
  return {
    schemaVersion: ZONE_PRESENCE_SCHEMA_VERSION,
    cameraCode: 'CAM_ZONE_A_01',
    zoneCode: 'ZONE_A',
    spotCode: 'A-01',
    plateCompact: '51A12345',
    confidence: 0.98,
    capturedAt: '2026-03-12T10:00:00.000Z',
    snapshotObjectKey: 'zone-ai/2026/03/12/a-01.png',
    modelVersion: 'yolov9-plate-v1',
    traceId: 'trace-pr17-001',
    ...overrides,
  }
}

function createMemoryDeps() {
  const rows = new Map<string, MemoryRow>()
  const persisted: Array<{ idempotencyKey: string; intakeStatus: 'ACCEPTED' | 'REJECTED'; rejectReasonCode: string | null }> = []
  let seq = 1n

  return {
    state: { rows, persisted },
    deps: {
      now: () => new Date('2026-03-12T10:00:05.000Z'),
      maxSkewSeconds: 300,
      verifyRequest: () => undefined,
      resolveLocation: async () => ({ siteId: 1n, zoneId: 11n, spotId: 101n }),
      findByIdempotencyKey: async (idempotencyKey: string) => rows.get(idempotencyKey) ?? null,
      persistEvent: async (args: any) => {
        const row: MemoryRow = {
          presenceEventId: seq,
          intakeStatus: args.intakeStatus,
          rejectReasonCode: args.rejectReasonCode ?? null,
          schemaVersion: args.schemaVersion,
          idempotencyKey: args.idempotencyKey,
          traceId: args.traceId ?? null,
          siteId: args.siteId ?? null,
          zoneId: args.zoneId ?? null,
          spotId: args.spotId ?? null,
          redisStreamId: args.redisStreamId ?? null,
        }
        rows.set(args.idempotencyKey, row)
        persisted.push({
          idempotencyKey: args.idempotencyKey,
          intakeStatus: args.intakeStatus,
          rejectReasonCode: args.rejectReasonCode ?? null,
        })
        seq += 1n
        return { presenceEventId: row.presenceEventId }
      },
      publishToRedisStream: async () => '1741773600-0',
    },
  }
}

test('replay cùng event phải dedupe đúng', async () => {
  const { deps, state } = createMemoryDeps()
  const body = buildBody()

  const first = await ingestZonePresenceEvent({ body, deps })
  const second = await ingestZonePresenceEvent({ body, deps })

  assert.equal(first.status, 'ACCEPTED')
  assert.equal(second.status, 'DEDUPED')
  assert.equal(first.idempotencyKey, second.idempotencyKey)
  assert.equal(state.persisted.length, 1)
})

test('signature sai bị chặn', async () => {
  process.env.INTERNAL_PRESENCE_API_KEY = 'zone-intake-key'
  process.env.INTERNAL_PRESENCE_HMAC_SECRET = 'zone-intake-secret'
  process.env.INTERNAL_PRESENCE_MAX_SKEW_SECONDS = '300'

  const body = buildBody({ traceId: 'trace-pr17-signature' })

  await assert.rejects(
    () => ingestZonePresenceEvent({
      body,
      apiKey: 'zone-intake-key',
      timestamp: String(Math.floor(new Date('2026-03-12T10:00:00.000Z').getTime() / 1000)),
      signature: 'bad-signature',
      deps: {
        now: () => new Date('2026-03-12T10:00:05.000Z'),
        maxSkewSeconds: 300,
        resolveLocation: async () => ({ siteId: 1n, zoneId: 11n, spotId: 101n }),
        findByIdempotencyKey: async () => null,
        persistEvent: async () => ({ presenceEventId: 1n }),
        publishToRedisStream: async () => '1-0',
      },
    }),
    (error: any) => {
      assert.equal(error?.code, 'UNAUTHENTICATED')
      return true
    },
  )
})

test('append-only persistence và schema versioning hoạt động', async () => {
  const { deps, state } = createMemoryDeps()
  const body = buildBody({ schemaVersion: 'zone.presence.v999', traceId: 'trace-pr17-versioning' })

  const result = await ingestZonePresenceEvent({ body, deps })

  assert.equal(result.status, 'REJECTED')
  assert.equal(result.reasonCode, 'UNSUPPORTED_SCHEMA_VERSION')
  assert.equal(state.persisted.length, 1)
  assert.equal(state.persisted[0].intakeStatus, 'REJECTED')
  assert.equal(state.persisted[0].rejectReasonCode, 'UNSUPPORTED_SCHEMA_VERSION')
})

test('accepted event persist append-only raw path và stream metadata', async () => {
  const { deps, state } = createMemoryDeps()
  const body = buildBody({ traceId: 'trace-pr17-accepted' })

  const result = await ingestZonePresenceEvent({ body, deps })

  assert.equal(result.status, 'ACCEPTED')
  assert.equal(result.streamId, '1741773600-0')
  assert.equal(result.siteId, '1')
  assert.equal(result.zoneId, '11')
  assert.equal(result.spotId, '101')
  assert.equal(state.persisted.length, 1)
  assert.equal(state.persisted[0].intakeStatus, 'ACCEPTED')
})

test('helper signature tạo đúng deterministic digest', async () => {
  const body = buildBody({ traceId: 'trace-pr17-helper' })
  const signatureA = computeZonePresenceSignature({
    body,
    timestamp: '1710237600',
    secret: 'secret-a',
  })
  const signatureB = computeZonePresenceSignature({
    body,
    timestamp: '1710237600',
    secret: 'secret-a',
  })
  const signatureC = computeZonePresenceSignature({
    body: buildBody({ traceId: 'trace-pr17-helper-2' }),
    timestamp: '1710237600',
    secret: 'secret-a',
  })

  assert.equal(signatureA, signatureB)
  assert.notEqual(signatureA, signatureC)
})
