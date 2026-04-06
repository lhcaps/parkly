import type { Job } from 'bullmq'

import { prisma } from '../../lib/prisma'
import type { OutboxDeadLetterJobData } from '../queues/outbox.queue'

export type OutboxDeadLetterProcessorResult = {
  acknowledged: true
  outboxId: string
  attempts: number
  lastError: string | null
  failedAt: string
  queueAttempt: number
}

export type PersistOutboxDeadLetterRecordArgs = {
  outboxId: string
  attempts: number
  lastError: string | null
  failedAt: string
  queueAttempt: number
}

export type OutboxDeadLetterProcessorDeps = {
  persistDlqRecord?: (args: PersistOutboxDeadLetterRecordArgs) => Promise<void>
}

async function persistDlqRecordToDatabase(args: PersistOutboxDeadLetterRecordArgs): Promise<void> {
  try {
    const source = await prisma.gate_event_outbox.findUnique({
      where: { outbox_id: BigInt(args.outboxId) },
    })

    if (!source) {
      console.error('[outbox:dlq:persist] source outbox row not found', {
        outboxId: args.outboxId,
        queueAttempt: args.queueAttempt,
      })
      return
    }

    await prisma.gate_event_outbox_dlq.upsert({
      where: { outbox_id: source.outbox_id },
      update: {
        site_id: source.site_id,
        event_id: source.event_id,
        event_time: source.event_time,
        payload_json: source.payload_json,
        final_status: 'TERMINAL_FAILED',
        failure_reason: args.lastError ?? source.last_error ?? null,
        attempts: args.attempts,
        moved_at: new Date(args.failedAt),
      },
      create: {
        outbox_id: source.outbox_id,
        site_id: source.site_id,
        event_id: source.event_id,
        event_time: source.event_time,
        payload_json: source.payload_json,
        final_status: 'TERMINAL_FAILED',
        failure_reason: args.lastError ?? source.last_error ?? null,
        attempts: args.attempts,
        moved_at: new Date(args.failedAt),
      },
    })
  } catch (persistErr) {
    console.error('[outbox:dlq:persist] failed to persist DLQ record:', {
      outboxId: args.outboxId,
      error: String(persistErr),
    })
  }
}

export async function processOutboxDeadLetterJob(
  job: Job<OutboxDeadLetterJobData>,
  deps: OutboxDeadLetterProcessorDeps = {},
): Promise<OutboxDeadLetterProcessorResult> {
  const payload = job.data
  const persistDlqRecord = deps.persistDlqRecord ?? persistDlqRecordToDatabase

  await persistDlqRecord({
    outboxId: payload.outboxId,
    attempts: payload.attempts,
    lastError: payload.lastError,
    failedAt: payload.failedAt,
    queueAttempt: payload.queueAttempt,
  })

  console.error('[outbox:dlq]', {
    outboxId: payload.outboxId,
    attempts: payload.attempts,
    queueAttempt: payload.queueAttempt,
    failedAt: payload.failedAt,
    lastError: payload.lastError,
  })

  return {
    acknowledged: true,
    outboxId: payload.outboxId,
    attempts: payload.attempts,
    lastError: payload.lastError ?? null,
    failedAt: payload.failedAt,
    queueAttempt: payload.queueAttempt,
  }
}

export default {
  processOutboxDeadLetterJob,
}
