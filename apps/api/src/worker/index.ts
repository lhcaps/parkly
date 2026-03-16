import 'dotenv/config'

import { Worker } from 'bullmq'
import { prisma } from '../lib/prisma'
import { closeMongo } from '../lib/mongo'
import { closeRedis } from '../lib/redis'
import { config } from '../server/config'
import {
  createBullmqConnectionOptions,
  createOutboxQueueRuntime,
  enqueueDueOutboxJobs,
  enqueueOutboxDeadLetterJob,
  enqueueOutboxRetryJob,
  getOutboxQueueTelemetry,
} from './queues/outbox.queue'
import { createOutboxSyncProcessorWithDeadLetter } from './processors/outbox-sync.processor'
import { processOutboxDeadLetterJob } from './processors/outbox-deadletter.processor'

function envInt(name: string, fallback: number): number {
  const v = process.env[name]
  if (v == null || v.trim() === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const enqueueIntervalMs = Math.max(250, config.worker.outboxIntervalMs)
  const metricsIntervalMs = Math.max(1_000, envInt('OUTBOX_QUEUE_METRICS_INTERVAL_MS', 10_000))
  const enqueueBatchSize = Math.max(1, envInt('OUTBOX_ENQUEUE_BATCH_SIZE', 100))
  const concurrency = Math.max(1, envInt('OUTBOX_QUEUE_CONCURRENCY', 4))

  const runtime = await createOutboxQueueRuntime()
  const connection = createBullmqConnectionOptions()

  const outboxWorker = new Worker(
    runtime.queue.name,
    createOutboxSyncProcessorWithDeadLetter({
      enqueueDeadLetter: async (payload) => {
        await enqueueOutboxDeadLetterJob(runtime.dlq, payload)
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
    }),
    {
      connection,
      concurrency,
    }
  )

  const dlqWorker = new Worker(
    runtime.dlq.name,
    async (job) => await processOutboxDeadLetterJob(job),
    {
      connection,
      concurrency: 1,
    }
  )

  outboxWorker.on('completed', (job, result) => {
    console.log('[worker] outbox completed', {
      jobId: job?.id,
      name: job?.name,
      result,
    })
  })

  outboxWorker.on('failed', (job, err) => {
    console.error('[worker] outbox failed', {
      jobId: job?.id,
      name: job?.name,
      error: err?.message ?? String(err),
    })
  })

  dlqWorker.on('completed', (job, result) => {
    console.log('[worker] dlq completed', {
      jobId: job?.id,
      result,
    })
  })

  dlqWorker.on('failed', (job, err) => {
    console.error('[worker] dlq failed', {
      jobId: job?.id,
      error: err?.message ?? String(err),
    })
  })

  console.log('[worker] bullmq started', {
    enqueueIntervalMs,
    metricsIntervalMs,
    enqueueBatchSize,
    concurrency,
    queueName: runtime.queue.name,
    dlqName: runtime.dlq.name,
  })

  let stopping = false

  const producerLoop = async () => {
    while (!stopping) {
      try {
        const result = await enqueueDueOutboxJobs(runtime.queue, { limit: enqueueBatchSize })
        console.log('[worker] enqueue scan', result)
      } catch (error: any) {
        console.error('[worker] enqueue scan error', error?.message ?? error)
      }

      await sleep(enqueueIntervalMs)
    }
  }

  const metricsLoop = async () => {
    while (!stopping) {
      try {
        const telemetry = await getOutboxQueueTelemetry(runtime.queue, runtime.dlq)
        console.log('[worker] queue telemetry', telemetry)
      } catch (error: any) {
        console.error('[worker] queue telemetry error', error?.message ?? error)
      }

      await sleep(metricsIntervalMs)
    }
  }

  const stop = async () => {
    if (stopping) return
    stopping = true

    console.log('[worker] stopping...')

    await outboxWorker.close().catch(() => void 0)
    await dlqWorker.close().catch(() => void 0)
    await runtime.close().catch(() => void 0)
    await prisma.$disconnect().catch(() => void 0)
    await closeMongo().catch(() => void 0)
    await closeRedis().catch(() => void 0)
    process.exit(0)
  }

  process.on('SIGINT', () => void stop())
  process.on('SIGTERM', () => void stop())

  await Promise.all([producerLoop(), metricsLoop()])
}

main().catch((e) => {
  console.error('[worker] fatal', e)
  process.exitCode = 1
})