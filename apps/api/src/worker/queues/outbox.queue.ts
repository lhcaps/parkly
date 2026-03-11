import { Queue, type ConnectionOptions } from 'bullmq'
import { config } from '../../server/config'
import { previewOutboxBatch } from '../../server/services/outbox.service'

export type OutboxSyncJobData = {
  outboxId: string
  source: 'producer-scan' | 'manual-requeue'
  enqueuedAt: string
}

export type OutboxDeadLetterJobData = {
  outboxId: string
  attempts: number
  lastError: string | null
  failedAt: string
  queueAttempt: number
}

export type OutboxQueueRuntime = {
  queue: Queue<any, any, string>
  dlq: Queue<any, any, string>
  close: () => Promise<void>
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name]
  if (v == null || v.trim() === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function envString(name: string, fallback: string): string {
  const v = String(process.env[name] ?? '').trim()
  return v || fallback
}

function sanitizeQueueName(value: string, fallback: string): string {
  const normalized = String(value ?? '').trim() || fallback
  const sanitized = normalized.replace(/[:\s]+/g, '-').replace(/[^A-Za-z0-9._-]/g, '-')
  return sanitized || fallback
}

function sanitizeJobIdSegment(value: string | bigint): string {
  return String(value)
    .trim()
    .replace(/[:\s]+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
}

export function getOutboxQueueNames() {
  return {
    queueName: sanitizeQueueName(envString('OUTBOX_QUEUE_NAME', 'parkly-outbox-sync'), 'parkly-outbox-sync'),
    dlqName: sanitizeQueueName(envString('OUTBOX_DLQ_NAME', 'parkly-outbox-dlq'), 'parkly-outbox-dlq'),
  }
}

export function createBullmqConnectionOptions(): ConnectionOptions {
  const rawUrl = String(config.redis.url ?? '').trim()
  if (!rawUrl) {
    throw new Error('Redis client is not configured; BullMQ cannot start')
  }

  const parsed = new URL(rawUrl)

  const options: ConnectionOptions = {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: config.redis.db,
    maxRetriesPerRequest: null,
  }

  if (config.redis.tls || parsed.protocol === 'rediss:') {
    ;(options as Record<string, unknown>).tls = {}
  }

  return options
}

export async function createOutboxQueueRuntime(opts?: {
  queueName?: string
  dlqName?: string
}): Promise<OutboxQueueRuntime> {
  const names = getOutboxQueueNames()
  const connection = createBullmqConnectionOptions()

  const queueName = sanitizeQueueName(opts?.queueName ?? names.queueName, names.queueName)
  const dlqName = sanitizeQueueName(opts?.dlqName ?? names.dlqName, names.dlqName)

  const queue = new Queue<any, any, string>(queueName, {
    connection,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: true,
    },
  })

  const dlq = new Queue<any, any, string>(dlqName, {
    connection,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: true,
    },
  })

  return {
    queue,
    dlq,
    close: async () => {
      await queue.close().catch(() => void 0)
      await dlq.close().catch(() => void 0)
    },
  }
}

export function toOutboxJobId(outboxId: bigint | string) {
  return `outbox-${sanitizeJobIdSegment(outboxId)}`
}

export function toOutboxRetryJobId(outboxId: bigint | string, nextRetryAtIso: string | null | undefined) {
  const suffix = sanitizeJobIdSegment(nextRetryAtIso ?? new Date().toISOString())
  return `outbox-retry-${sanitizeJobIdSegment(outboxId)}-${suffix}`
}

export function toOutboxDeadLetterJobId(outboxId: bigint | string, failedAtIso: string) {
  return `outbox-dlq-${sanitizeJobIdSegment(outboxId)}-${sanitizeJobIdSegment(failedAtIso)}`
}

export async function enqueueOutboxSyncJob(
  queue: Queue<any, any, string>,
  outboxId: bigint | string,
  opts?: { source?: OutboxSyncJobData['source'] }
): Promise<{ enqueued: boolean; jobId: string }> {
  const jobId = toOutboxJobId(outboxId)
  const existing = await queue.getJob(jobId)
  if (existing) {
    return { enqueued: false, jobId }
  }

  await queue.add(
    'outbox-sync',
    {
      outboxId: String(outboxId),
      source: opts?.source ?? 'producer-scan',
      enqueuedAt: new Date().toISOString(),
    } satisfies OutboxSyncJobData,
    {
      jobId,
      removeOnComplete: true,
      removeOnFail: true,
    }
  )

  return { enqueued: true, jobId }
}

export async function enqueueOutboxRetryJob(
  queue: Queue<any, any, string>,
  payload: OutboxSyncJobData,
  nextRetryAtIso: string | null
): Promise<{ enqueued: boolean; jobId: string; delayMs: number }> {
  const nextAt = nextRetryAtIso ? new Date(nextRetryAtIso) : new Date()
  const delayMs = Math.max(0, nextAt.getTime() - Date.now())
  const jobId = toOutboxRetryJobId(payload.outboxId, nextRetryAtIso)

  const existing = await queue.getJob(jobId)
  if (existing) {
    return { enqueued: false, jobId, delayMs }
  }

  await queue.add(
    'outbox-sync',
    payload,
    {
      jobId,
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: true,
    }
  )

  return { enqueued: true, jobId, delayMs }
}

export async function enqueueOutboxDeadLetterJob(
  dlq: Queue<any, any, string>,
  payload: OutboxDeadLetterJobData
): Promise<{ enqueued: boolean; jobId: string }> {
  const jobId = toOutboxDeadLetterJobId(payload.outboxId, payload.failedAt)
  const existing = await dlq.getJob(jobId)
  if (existing) {
    return { enqueued: false, jobId }
  }

  await dlq.add('outbox-deadletter', payload, {
    jobId,
    removeOnComplete: true,
    removeOnFail: true,
  })

  return { enqueued: true, jobId }
}

export async function enqueueDueOutboxJobs(
  queue: Queue<any, any, string>,
  args?: { limit?: number }
): Promise<{ candidates: number; enqueued: number; skippedExisting: number; outboxIds: string[] }> {
  const limit = Math.min(500, Math.max(1, args?.limit ?? envInt('OUTBOX_ENQUEUE_BATCH_SIZE', 100)))
  const outboxIds = await previewOutboxBatch(limit)

  let enqueued = 0
  let skippedExisting = 0

  for (const outboxId of outboxIds) {
    const result = await enqueueOutboxSyncJob(queue, outboxId, { source: 'producer-scan' })
    if (result.enqueued) enqueued++
    else skippedExisting++
  }

  return {
    candidates: outboxIds.length,
    enqueued,
    skippedExisting,
    outboxIds: outboxIds.map((id) => id.toString()),
  }
}

export async function getOutboxQueueTelemetry(
  queue: Queue<any, any, string>,
  dlq: Queue<any, any, string>
): Promise<{
  main: Record<string, number>
  dlq: Record<string, number>
}> {
  const main = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused')
  const dead = await dlq.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused')
  return { main, dlq: dead }
}