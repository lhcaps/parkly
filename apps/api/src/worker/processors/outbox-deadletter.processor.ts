import type { Job } from 'bullmq';
import type { OutboxDeadLetterJobData } from '../queues/outbox.queue';

export type OutboxDeadLetterProcessorResult = {
  acknowledged: true;
  outboxId: string;
  attempts: number;
  lastError: string | null;
  failedAt: string;
  queueAttempt: number;
};

export async function processOutboxDeadLetterJob(
  job: Job<OutboxDeadLetterJobData>
): Promise<OutboxDeadLetterProcessorResult> {
  const payload = job.data;

  // eslint-disable-next-line no-console
  console.error('[outbox:dlq]', {
    outboxId: payload.outboxId,
    attempts: payload.attempts,
    queueAttempt: payload.queueAttempt,
    failedAt: payload.failedAt,
    lastError: payload.lastError,
  });

  return {
    acknowledged: true,
    outboxId: payload.outboxId,
    attempts: payload.attempts,
    lastError: payload.lastError ?? null,
    failedAt: payload.failedAt,
    queueAttempt: payload.queueAttempt,
  };
}

export default {
  processOutboxDeadLetterJob,
}