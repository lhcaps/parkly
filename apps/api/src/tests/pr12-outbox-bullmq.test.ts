import test from 'node:test'
import assert from 'node:assert/strict'
import { Worker, type Job } from 'bullmq'

import { closeRedis } from '../lib/redis'
import {
  createBullmqConnectionOptions,
  createOutboxQueueRuntime,
  enqueueOutboxSyncJob,
  enqueueOutboxRetryJob,
  toOutboxDeadLetterJobId,
} from '../worker/queues/outbox.queue'
import {
  processOutboxSyncJob,
  createOutboxSyncProcessorWithDeadLetter,
  type OutboxSyncProcessorDeps,
} from '../worker/processors/outbox-sync.processor'
import { processOutboxDeadLetterJob } from '../worker/processors/outbox-deadletter.processor'

type FakeStatus = 'PENDING' | 'SENT' | 'FAILED'

type FakeRow = {
  outboxId: bigint
  status: FakeStatus
  attempts: number
  lastError: string | null
  nextRetryAt: Date | null
}

function uniqueName(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitUntil(fn: () => Promise<boolean> | boolean, timeoutMs = 5_000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await fn()) return
    await sleep(intervalMs)
  }
  throw new Error(`waitUntil timeout after ${timeoutMs}ms`)
}

function createFakeDeps(opts?: {
  failuresBeforeSuccess?: number
}) {
  const state = {
    rows: new Map<string, FakeRow>(),
    syncCalls: 0,
    deadLetters: [] as Array<{ outboxId: string; attempts: number; lastError: string | null; failedAt: string; queueAttempt: number }>,
  }

  const failuresBeforeSuccess = Math.max(0, opts?.failuresBeforeSuccess ?? 0)

  function setRow(row: FakeRow) {
    state.rows.set(row.outboxId.toString(), row)
  }

  function getRow(outboxId: bigint) {
    return state.rows.get(outboxId.toString()) ?? null
  }

  const deps: OutboxSyncProcessorDeps = {
    claimOutboxRow: async ({ outboxId }) => {
      const row = getRow(outboxId)
      if (!row) return { claimed: false, row: null as any, leaseMs: 60_000 }

      if (row.status !== 'PENDING') {
        return {
          claimed: false,
          row: {
            status: row.status,
          } as any,
          leaseMs: 60_000,
        }
      }

      if (row.nextRetryAt && row.nextRetryAt > new Date()) {
        return {
          claimed: false,
          row: {
            status: 'PENDING',
          } as any,
          leaseMs: 60_000,
        }
      }

      row.nextRetryAt = new Date(Date.now() + 60_000)

      return {
        claimed: true,
        row: {
          status: 'PENDING',
          attempts: row.attempts,
          last_error: row.lastError,
          next_retry_at: row.nextRetryAt,
        } as any,
        leaseMs: 60_000,
      }
    },

    processOutboxIdempotent: async ({ outboxId }) => {
      const row = getRow(outboxId)
      if (!row) {
        return {
          outboxId,
          status: 'NOT_FOUND' as const,
          attempts: 0,
          nextRetryAt: null,
          row: null,
        }
      }

      if (row.status === 'SENT') {
        return {
          outboxId,
          status: 'ALREADY_SENT' as const,
          attempts: row.attempts,
          nextRetryAt: null,
          row: null,
          lastError: row.lastError,
        }
      }

      if (row.status === 'FAILED') {
        return {
          outboxId,
          status: 'TERMINAL_FAILED' as const,
          attempts: row.attempts,
          nextRetryAt: null,
          row: null,
          lastError: row.lastError,
        }
      }

      state.syncCalls += 1
      row.attempts += 1

      if (row.attempts <= failuresBeforeSuccess) {
        if (row.attempts >= 2) {
          row.status = 'FAILED'
          row.lastError = `terminal-failure-${row.attempts}`
          row.nextRetryAt = null

          return {
            outboxId,
            status: 'FAILED' as const,
            attempts: row.attempts,
            nextRetryAt: null,
            row: null,
            lastError: row.lastError,
          }
        }

        row.status = 'PENDING'
        row.lastError = `retry-failure-${row.attempts}`
        row.nextRetryAt = new Date(Date.now() + 150)

        return {
          outboxId,
          status: 'RETRY' as const,
          attempts: row.attempts,
          nextRetryAt: row.nextRetryAt.toISOString(),
          row: null,
          lastError: row.lastError,
        }
      }

      row.status = 'SENT'
      row.lastError = null
      row.nextRetryAt = null

      return {
        outboxId,
        status: 'SENT' as const,
        attempts: row.attempts,
        nextRetryAt: null,
        row: null,
      }
    },

    enqueueDeadLetter: async (payload) => {
      state.deadLetters.push(payload)
    },
  }

  return { state, deps, setRow, getRow }
}

test('queue dedupe keeps a single BullMQ job per outbox_id', async () => {
  process.env.REDIS_REQUIRED = 'ON'

  const runtime = await createOutboxQueueRuntime({
    queueName: uniqueName('pr12-queue'),
    dlqName: uniqueName('pr12-dlq'),
  })

  try {
    const first = await enqueueOutboxSyncJob(runtime.queue, 101n)
    const second = await enqueueOutboxSyncJob(runtime.queue, 101n)

    const waitingCount = await runtime.queue.count()

    assert.equal(first.enqueued, true)
    assert.equal(second.enqueued, false)
    assert.equal(waitingCount, 1)
  } finally {
    await runtime.queue.drain(true).catch(() => void 0)
    await runtime.dlq.drain(true).catch(() => void 0)
    await runtime.close().catch(() => void 0)
    await closeRedis().catch(() => void 0)
  }
})

test('two workers do not sync the same outbox_id twice', async () => {
  process.env.REDIS_REQUIRED = 'ON'

  const runtime = await createOutboxQueueRuntime({
    queueName: uniqueName('pr12-queue'),
    dlqName: uniqueName('pr12-dlq'),
  })

  const connection = createBullmqConnectionOptions()

  const fake = createFakeDeps({ failuresBeforeSuccess: 0 })
  fake.setRow({
    outboxId: 202n,
    status: 'PENDING',
    attempts: 0,
    lastError: null,
    nextRetryAt: null,
  })

  const processor = createOutboxSyncProcessorWithDeadLetter(fake.deps)

  const worker1 = new Worker(runtime.queue.name, processor, {
    connection,
    concurrency: 1,
  })

  const worker2 = new Worker(runtime.queue.name, processor, {
    connection,
    concurrency: 1,
  })

  try {
    await enqueueOutboxSyncJob(runtime.queue, 202n)

    await waitUntil(async () => {
      const counts = await runtime.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')
      return counts.waiting === 0 && counts.active === 0
    })

    assert.equal(fake.state.syncCalls, 1)
    assert.equal(fake.getRow(202n)?.status, 'SENT')
  } finally {
    await worker1.close(true).catch(() => void 0)
    await worker2.close(true).catch(() => void 0)
    await runtime.queue.drain(true).catch(() => void 0)
    await runtime.dlq.drain(true).catch(() => void 0)
    await runtime.close().catch(() => void 0)
    await closeRedis().catch(() => void 0)
  }
})

test('retry then terminal fail goes to DLQ and manual requeue can recover', async () => {
  process.env.REDIS_REQUIRED = 'ON'

  const runtime = await createOutboxQueueRuntime({
    queueName: uniqueName('pr12-queue'),
    dlqName: uniqueName('pr12-dlq'),
  })

  const connection = createBullmqConnectionOptions()

  const fake = createFakeDeps({ failuresBeforeSuccess: 2 })
  fake.setRow({
    outboxId: 303n,
    status: 'PENDING',
    attempts: 0,
    lastError: null,
    nextRetryAt: null,
  })

  const worker = new Worker(runtime.queue.name, createOutboxSyncProcessorWithDeadLetter({
    enqueueDeadLetter: async (payload) => {
      await runtime.dlq.add('outbox-deadletter', payload, {
        jobId: toOutboxDeadLetterJobId(payload.outboxId, payload.failedAt),
        removeOnComplete: true,
        removeOnFail: true,
      })
    },
    scheduleRetry: async (payload) => {
      await enqueueOutboxRetryJob(
        runtime.queue,
        {
          outboxId: payload.outboxId,
          source: payload.source,
          enqueuedAt: new Date().toISOString(),
        },
        payload.nextRetryAt,
      )
    },
    claimOutboxRow: fake.deps.claimOutboxRow,
    processOutboxIdempotent: fake.deps.processOutboxIdempotent,
  }), {
    connection,
    concurrency: 1,
  })

  const dlqAcks: string[] = []
  const dlqWorker = new Worker(runtime.dlq.name, async (job) => {
    const result = await processOutboxDeadLetterJob(job as Job<any>, {
      persistDlqRecord: async () => undefined,
    })
    dlqAcks.push(result.outboxId)
    return result
  }, {
    connection,
    concurrency: 1,
  })

  try {
    await enqueueOutboxSyncJob(runtime.queue, 303n)

    await waitUntil(() => fake.getRow(303n)?.status === 'FAILED', 5_000, 100)
    await waitUntil(() => dlqAcks.includes('303'), 5_000, 100)

    assert.equal(fake.getRow(303n)?.status, 'FAILED')

    const recoverFake = createFakeDeps({ failuresBeforeSuccess: 0 })
    recoverFake.setRow({
      outboxId: 303n,
      status: 'PENDING',
      attempts: 2,
      lastError: null,
      nextRetryAt: null,
    })

    const recoverResult = await processOutboxSyncJob({
      data: { outboxId: '303', source: 'manual-requeue', enqueuedAt: new Date().toISOString() },
      attemptsMade: 0,
    } as Job<any>, recoverFake.deps)

    assert.equal(recoverResult.status, 'SENT')
    assert.equal(recoverFake.getRow(303n)?.status, 'SENT')
  } finally {
    await worker.close(true).catch(() => void 0)
    await dlqWorker.close(true).catch(() => void 0)
    await runtime.queue.drain(true).catch(() => void 0)
    await runtime.dlq.drain(true).catch(() => void 0)
    await runtime.close().catch(() => void 0)
    await closeRedis().catch(() => void 0)
  }
})
