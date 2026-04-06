import test from 'node:test'
import assert from 'node:assert/strict'

import { closeRedis } from '../lib/redis'
import {
  getSseReplaySince,
  parseLastEventSequence,
  publishSseEnvelope,
  resetSseReplayMemory,
  writeSseEnvelope,
} from '../server/sse-contract'

test.after(async () => {
  await closeRedis().catch(() => void 0)
})

function uniqueChannel(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

test('SSE envelope có đủ field contract bắt buộc', async () => {
  const channel = uniqueChannel('pr14-envelope')
  resetSseReplayMemory(channel)

  const envelope = await publishSseEnvelope(channel, {
    eventType: 'lane.status.upsert',
    siteCode: 'SITE_HCM_01',
    laneCode: 'GATE_01_ENTRY',
    correlationId: 'corr-pr14',
    payload: {
      status: 'HEALTHY',
    },
  })

  assert.equal(envelope.eventType, 'lane.status.upsert')
  assert.equal(typeof envelope.sequence, 'number')
  assert.equal(envelope.siteCode, 'SITE_HCM_01')
  assert.equal(envelope.laneCode, 'GATE_01_ENTRY')
  assert.equal(envelope.correlationId, 'corr-pr14')
  assert.equal(typeof envelope.occurredAt, 'string')
  assert.deepEqual(envelope.payload, { status: 'HEALTHY' })
})

test('replay theo lastEventId không bị lạc event', async () => {
  const channel = uniqueChannel('pr14-replay')
  resetSseReplayMemory(channel)

  const first = await publishSseEnvelope(channel, {
    eventType: 'device.health.upsert',
    siteCode: 'SITE_A',
    laneCode: 'ENTRY',
    payload: { deviceCode: 'CAM_01', derivedHealth: 'ONLINE' },
  })

  const second = await publishSseEnvelope(channel, {
    eventType: 'device.health.upsert',
    siteCode: 'SITE_A',
    laneCode: 'ENTRY',
    payload: { deviceCode: 'CAM_01', derivedHealth: 'DEGRADED' },
  })

  const third = await publishSseEnvelope(channel, {
    eventType: 'device.health.upsert',
    siteCode: 'SITE_A',
    laneCode: 'ENTRY',
    payload: { deviceCode: 'CAM_01', derivedHealth: 'OFFLINE' },
  })

  const replay = await getSseReplaySince(channel, first.sequence)

  assert.equal(replay.length >= 2, true)
  assert.equal(replay[0].sequence, second.sequence)
  assert.equal(replay[1].sequence, third.sequence)
})

test('wire format SSE ghi đúng id + event + data', async () => {
  const channel = uniqueChannel('pr14-wire')
  resetSseReplayMemory(channel)

  const envelope = await publishSseEnvelope(channel, {
    eventType: 'outbox.item.upsert',
    siteCode: 'SITE_B',
    payload: { outboxId: '9', status: 'PENDING' },
  })

  let written = ''
  const res = {
    write(chunk: string) {
      written += chunk
    },
  } as any

  writeSseEnvelope(res, channel, envelope)

  assert.match(written, new RegExp(`id: ${channel}:${envelope.sequence}`))
  assert.match(written, /event: parkly_event/)
  assert.match(written, /"eventType":"outbox.item.upsert"/)
  assert.equal(parseLastEventSequence(`${channel}:${envelope.sequence}`, channel), envelope.sequence)
})
