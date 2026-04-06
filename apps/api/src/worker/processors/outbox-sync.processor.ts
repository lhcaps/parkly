import type { Job } from 'bullmq'
import { gate_event_outbox_status } from '@prisma/client'
import {
  claimOutboxRow,
  processOutboxIdempotent,
  type ClaimOutboxRowResult,
  type ProcessOutboxIdempotentResult,
} from '../../server/services/outbox.service'
import {
  type OutboxDeadLetterJobData,
  type OutboxSyncJobData,
} from '../queues/outbox.queue'
import { deliverWebhooksForOutboxEvent } from '../../server/services/webhook-outbox.service'

export type OutboxSyncProcessorResult =
  | { outboxId: string; status: 'SKIPPED_NOT_FOUND' | 'SKIPPED_ALREADY_SENT' | 'SKIPPED_TERMINAL' | 'SKIPPED_NOT_DUE'; queueAttempt: number }
  | { outboxId: string; status: 'SENT'; attempts: number; queueAttempt: number }
  | { outboxId: string; status: 'RETRY'; attempts: number; nextRetryAt: string | null; lastError: string | null; queueAttempt: number }
  | { outboxId: string; status: 'FAILED'; attempts: number; lastError: string | null; queueAttempt: number }

export type OutboxRetrySchedulePayload = {
  outboxId: string
  attempts: number
  nextRetryAt: string | null
  lastError: string | null
  queueAttempt: number
  source: OutboxSyncJobData['source']
}

export type OutboxSyncProcessorDeps = {
  claimOutboxRow: (args: { outboxId: bigint; leaseMs?: number }) => Promise<ClaimOutboxRowResult>
  processOutboxIdempotent: (args: { outboxId: bigint }) => Promise<ProcessOutboxIdempotentResult>
  enqueueDeadLetter: (payload: OutboxDeadLetterJobData) => Promise<unknown>
  scheduleRetry?: (payload: OutboxRetrySchedulePayload) => Promise<unknown>
}

const defaultDeps: OutboxSyncProcessorDeps = {
  claimOutboxRow,
  processOutboxIdempotent: async (args) => await processOutboxIdempotent(args),
  enqueueDeadLetter: async (_payload) => undefined,
  scheduleRetry: async (_payload) => undefined,
}

function parseOutboxId(value: unknown): bigint {
  const normalized = String(value ?? '').trim()
  if (!normalized) throw new Error('Missing outboxId in BullMQ job payload')
  return BigInt(normalized)
}

export async function processOutboxSyncJob(
  job: Job<OutboxSyncJobData>,
  deps: OutboxSyncProcessorDeps = defaultDeps
): Promise<OutboxSyncProcessorResult> {
  const outboxId = parseOutboxId(job.data?.outboxId)
  const queueAttempt = (job.attemptsMade ?? 0) + 1
  const source = job.data?.source ?? 'producer-scan'

  const claimed = await deps.claimOutboxRow({ outboxId })
  if (!claimed.claimed) {
    if (!claimed.row) {
      return { outboxId: outboxId.toString(), status: 'SKIPPED_NOT_FOUND', queueAttempt }
    }

    if (claimed.row.status === gate_event_outbox_status.SENT) {
      return { outboxId: outboxId.toString(), status: 'SKIPPED_ALREADY_SENT', queueAttempt }
    }

    if (claimed.row.status === gate_event_outbox_status.FAILED) {
      return { outboxId: outboxId.toString(), status: 'SKIPPED_TERMINAL', queueAttempt }
    }

    return { outboxId: outboxId.toString(), status: 'SKIPPED_NOT_DUE', queueAttempt }
  }

  const outcome = await deps.processOutboxIdempotent({ outboxId })

  if (outcome.status === 'SENT' || outcome.status === 'ALREADY_SENT') {
    // ================================================================
    // Step 3: Deliver webhooks (async, non-blocking)
    // Webhook failures are fire-and-forget — they have their own retry/DLQ
    // ================================================================
    if (outcome.row) {
      const payload = outcome.row.payload_json as Record<string, unknown> | undefined
      const siteId = BigInt(outcome.row.site_id)
      const { deliverWebhooksForOutboxEvent } = await import('../../server/services/webhook-outbox.service')
      void deliverWebhooksForOutboxEvent({
        outboxId,
        siteId,
        mongoCollection: String(outcome.row.mongo_collection ?? 'device_events'),
        payloadJson: payload ?? {},
        eventId: outcome.row.mongo_doc_id ?? outboxId.toString(),
      }).catch((err: unknown) => {
        console.warn(`[OutboxSyncProcessor] Webhook delivery failed for outbox ${outboxId}:`, err)
      })
    }

    return {
      outboxId: outboxId.toString(),
      status: 'SENT',
      attempts: outcome.attempts,
      queueAttempt,
    }
  }

  if (outcome.status === 'FAILED' || outcome.status === 'TERMINAL_FAILED') {
    await deps.enqueueDeadLetter({
      outboxId: outboxId.toString(),
      attempts: outcome.attempts,
      lastError: 'lastError' in outcome ? outcome.lastError ?? null : null,
      failedAt: new Date().toISOString(),
      queueAttempt,
    })

    return {
      outboxId: outboxId.toString(),
      status: 'FAILED',
      attempts: outcome.attempts,
      lastError: 'lastError' in outcome ? outcome.lastError ?? null : null,
      queueAttempt,
    }
  }

  if (outcome.status === 'RETRY') {
    await deps.scheduleRetry?.({
      outboxId: outboxId.toString(),
      attempts: outcome.attempts,
      nextRetryAt: outcome.nextRetryAt,
      lastError: outcome.lastError ?? null,
      queueAttempt,
      source,
    })

    return {
      outboxId: outboxId.toString(),
      status: 'RETRY',
      attempts: outcome.attempts,
      nextRetryAt: outcome.nextRetryAt,
      lastError: outcome.lastError ?? null,
      queueAttempt,
    }
  }

  return {
    outboxId: outboxId.toString(),
    status: 'SKIPPED_NOT_FOUND',
    queueAttempt,
  }
}

export function createOutboxSyncProcessorWithDeadLetter(deps: {
  enqueueDeadLetter: (payload: OutboxDeadLetterJobData) => Promise<unknown>
  scheduleRetry?: (payload: OutboxRetrySchedulePayload) => Promise<unknown>
  claimOutboxRow?: OutboxSyncProcessorDeps['claimOutboxRow']
  processOutboxIdempotent?: OutboxSyncProcessorDeps['processOutboxIdempotent']
}) {
  return async (job: Job<OutboxSyncJobData>) =>
    await processOutboxSyncJob(job, {
      claimOutboxRow: deps.claimOutboxRow ?? claimOutboxRow,
      processOutboxIdempotent: deps.processOutboxIdempotent ?? (async (args) => await processOutboxIdempotent(args)),
      enqueueDeadLetter: deps.enqueueDeadLetter,
      scheduleRetry: deps.scheduleRetry ?? (async (_payload) => undefined),
    })
}

export default {
  processOutboxSyncJob,
  createOutboxSyncProcessorWithDeadLetter,
}