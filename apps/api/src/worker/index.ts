import 'dotenv/config'

import { Queue, Worker } from 'bullmq'
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

const GHOST_PURGE_QUEUE_NAME = 'parkly:ghost-presence-purge'
const GHOST_PURGE_JOB_NAME = 'ghost-presence-purge'
const GHOST_PURGE_CRON = '0 2 * * *' // 02:00 AM every day
const GHOST_PURGE_TZ = 'Asia/Ho_Chi_Minh'
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

  // ── Ghost Presence Purge repeatable job ────────────────────────
  const ghostPurgeQueue = new Queue(GHOST_PURGE_QUEUE_NAME, {
    connection,
    defaultJobOptions: { removeOnComplete: true, removeOnFail: false },
  })

  // Remove stale repeatable definitions to avoid duplicates
  for (const job of await ghostPurgeQueue.getRepeatableJobs()) {
    if (job.name === GHOST_PURGE_JOB_NAME) {
      await ghostPurgeQueue.removeRepeatableByKey(job.key)
    }
  }

  // Register repeatable cron: 02:00 AM daily
  await ghostPurgeQueue.add(
    GHOST_PURGE_JOB_NAME,
    {},
    {
      jobId: `${GHOST_PURGE_JOB_NAME}-daily`,
      repeat: { pattern: GHOST_PURGE_CRON, tz: GHOST_PURGE_TZ },
      removeOnComplete: true,
      removeOnFail: false,
    },
  )

  console.log('[worker] ghost-presence-purge cron registered', {
    queue: GHOST_PURGE_QUEUE_NAME,
    cron: GHOST_PURGE_CRON,
    tz: GHOST_PURGE_TZ,
  })

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

  // ── Ghost Presence Purge polling loop ──────────────────────────
  const { prisma: prismaForGhost } = await import('../lib/prisma.js')
  const { getRedisClient: getRedisForGhost } = await import('../lib/redis.js')

  const ghostPurgePollLoop = async () => {
    const GHOST_TIMEOUT_HOURS = 24
    const BATCH_SIZE = 200
    const POLL_INTERVAL_MS = Math.max(1_000, Number(process.env.GHOST_PURGE_POLL_INTERVAL_MS ?? 5_000))

    while (!stopping) {
      try {
        await sleep(POLL_INTERVAL_MS)

        const redis = await getRedisForGhost({ connect: true })
        if (!redis) continue

        // Atomic dequeue
        const raw = await redis.lpop(GHOST_PURGE_QUEUE_NAME)
        if (!raw) continue

        const payload = JSON.parse(String(raw))
        console.log('[worker] ghost-presence-purge job dequeued', payload)

        const cutoff = new Date(Date.now() - GHOST_TIMEOUT_HOURS * 60 * 60 * 1000)
        console.log('[worker] ghost-presence-purge cutoff', cutoff.toISOString())

        const candidates = await prismaForGhost.$queryRawUnsafe<
          Array<{ presence_id: bigint; site_id: bigint; plate_compact: string | null; entry_lane_code: string; entered_at: Date }>
        >(
          `
          SELECT presence_id, site_id, plate_compact, entry_lane_code, entered_at
          FROM gate_active_presence
          WHERE status = 'ACTIVE' AND entered_at < ?
          LIMIT 10000
          `,
          cutoff.toISOString().slice(0, 19).replace('T', ' '),
        )

        console.log(`[worker] ghost-presence-purge candidates: ${candidates.length}`)

        let totalCleared = 0
        let totalAudited = 0

        for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
          const batch = candidates.slice(i, i + BATCH_SIZE)

          try {
            await prismaForGhost.$transaction(async (tx) => {
              const ids = batch.map((r) => r.presence_id.toString())
              await tx.$executeRawUnsafe(
                `UPDATE gate_active_presence SET status = 'CLEARED', cleared_at = NOW(3), updated_at = NOW(3) WHERE presence_id IN (${ids.map(() => '?').join(',')}) AND status = 'ACTIVE'`,
                ...ids,
              )
              for (const record of batch) {
                await tx.$executeRawUnsafe(
                  `INSERT INTO audit_logs (site_id, actor_user_id, action, entity_table, entity_id, before_json, after_json, request_id, occurred_at) VALUES (?, NULL, 'SYSTEM_AUTO_PURGE_GHOST_PRESENCE', 'gate_active_presence', ?, ?, ?, NULL, NOW(3))`,
                  record.site_id.toString(),
                  record.presence_id.toString(),
                  JSON.stringify({ status: 'ACTIVE' }),
                  JSON.stringify({ status: 'CLEARED', reason: 'auto_reconciled_timeout', cleared_at: new Date().toISOString() }),
                )
              }
            })
            totalCleared += batch.length
            totalAudited += batch.length
          } catch (err) {
            console.error('[worker] ghost-presence-purge batch failed', { offset: i, error: (err as Error)?.message })
          }
        }

        console.log(`[worker] ghost-presence-purge completed: cleared=${totalCleared} audited=${totalAudited}`)
      } catch (err) {
        console.error('[worker] ghost-presence-purge poll error', (err as Error)?.message)
      }
    }
  }

  const stop = async () => {
    if (stopping) return
    stopping = true

    console.log('[worker] stopping...')

  await outboxWorker.close().catch(() => void 0)
    await dlqWorker.close().catch(() => void 0)
    await ghostPurgeQueue.close().catch(() => void 0)
    await runtime.close().catch(() => void 0)
    await prisma.$disconnect().catch(() => void 0)
    await closeMongo().catch(() => void 0)
    await closeRedis().catch(() => void 0)
    process.exit(0)
  }

  process.on('SIGINT', () => void stop())
  process.on('SIGTERM', () => void stop())

  await Promise.all([producerLoop(), metricsLoop(), ghostPurgePollLoop()])
}

main().catch((e) => {
  console.error('[worker] fatal', e)
  process.exitCode = 1
})