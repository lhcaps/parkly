/**
 * ghost-presence-purge.worker.ts — Ghost Presence Purge BullMQ Worker
 *
 * Finds stale `gate_active_presence` records where:
 *   - status = 'ACTIVE'
 *   - entered_at > 24 hours ago
 * Clears them with status = 'CLEARED' inside a Prisma transaction,
 * and writes audit logs for each cleared record.
 *
 * Registered as a BullMQ repeatable job: cron "0 2 * * *" (02:00 AM daily).
 * Run: pnpm worker:ghost-presence-purge
 */

import 'dotenv/config';

import { Queue } from 'bullmq';
import { prisma } from '../../lib/prisma';
import { closeRedis, getRedisClient } from '../../lib/redis';
import { createBullmqConnectionOptions } from '../queues/outbox.queue';
import { apiLogger } from '../../server/logger';

const QUEUE_NAME = 'parkly:ghost-presence-purge';
const GHOST_TIMEOUT_HOURS = 24;
const BATCH_SIZE = 200;
const JOB_NAME = 'ghost-presence-purge';
const CRON_EXPRESSION = '0 2 * * *'; // 02:00 AM every day

type PurgeResult = {
  totalScanned: number;
  totalCleared: number;
  auditCount: number;
  errors: string[];
};

/* ─── Core purge logic ───────────────────────────────────────── */

async function purgeGhostPresences(): Promise<PurgeResult> {
  const cutoff = new Date(Date.now() - GHOST_TIMEOUT_HOURS * 60 * 60 * 1000);
  const result: PurgeResult = {
    totalScanned: 0,
    totalCleared: 0,
    auditCount: 0,
    errors: [],
  };

  const log = (msg: string, extra?: Record<string, unknown>) => {
    apiLogger.info({ type: 'ghost-presence-purge', ...extra }, msg);
  };

  const logError = (msg: string, err: unknown) => {
    const errorMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(errorMsg);
    apiLogger.error({ type: 'ghost-presence-purge', err }, msg);
  };

  try {
    // Count candidates first
    const candidates = await prisma.$queryRawUnsafe<
      Array<{ presence_id: bigint; site_id: bigint; plate_compact: string | null; entry_lane_code: string; entered_at: Date }>
    >(
      `
      SELECT presence_id, site_id, plate_compact, entry_lane_code, entered_at
      FROM gate_active_presence
      WHERE status = 'ACTIVE'
        AND entered_at < ?
      LIMIT 10000
      `,
      cutoff.toISOString().slice(0, 19).replace('T', ' '),
    );

    result.totalScanned = candidates.length;

    if (candidates.length === 0) {
      log('No ghost presences to purge', { cutoff: cutoff.toISOString() });
      return result;
    }

    log('Ghost presence candidates found', {
      count: candidates.length,
      cutoffHours: GHOST_TIMEOUT_HOURS,
    });

    // Process in batches within a single Prisma transaction
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);

      try {
        await prisma.$transaction(async (tx) => {
          const ids = batch.map((r) => r.presence_id.toString());

          // 1. Update batch: status → CLEARED, cleared_at → NOW()
          await tx.$executeRawUnsafe(
            `
            UPDATE gate_active_presence
            SET status = 'CLEARED',
                cleared_at = NOW(3),
                updated_at = NOW(3)
            WHERE presence_id IN (${ids.map(() => '?').join(',')})
              AND status = 'ACTIVE'
            `,
            ...ids,
          );

          // 2. Write audit log for each cleared record
          for (const record of batch) {
            await tx.$executeRawUnsafe(
              `
              INSERT INTO audit_logs
                (site_id, actor_user_id, action, entity_table, entity_id, before_json, after_json, request_id, occurred_at)
              VALUES (?, NULL, 'SYSTEM_AUTO_PURGE_GHOST_PRESENCE', 'gate_active_presence', ?, ?, ?, NULL, NOW(3))
              `,
              record.site_id.toString(),
              record.presence_id.toString(),
              JSON.stringify({ status: 'ACTIVE' }),
              JSON.stringify({ status: 'CLEARED', reason: 'auto_reconciled_timeout', cleared_at: new Date().toISOString() }),
            );
          }
        });

        result.totalCleared += batch.length;
        result.auditCount += batch.length;

        log('Batch cleared', {
          batchStart: i,
          batchSize: batch.length,
          totalCleared: result.totalCleared,
        });
      } catch (err) {
        logError(`Batch clear failed (offset=${i})`, err);
        // Continue with next batch
      }
    }

    log('Ghost presence purge completed', {
      scanned: result.totalScanned,
      cleared: result.totalCleared,
      audited: result.auditCount,
      errors: result.errors.length,
    });
  } catch (err) {
    logError('Fatal: ghost presence purge failed', err);
    throw err;
  }

  return result;
}

/* ─── Queue + repeatable job registration ───────────────────── */

async function ensureRepeatableJob(queue: Queue): Promise<void> {
  // Remove any existing repeatable jobs with same name to avoid duplicates
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    if (job.name === JOB_NAME) {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Add new repeatable job
  await queue.add(JOB_NAME, {}, {
    repeat: {
      pattern: CRON_EXPRESSION,
      tz: 'Asia/Ho_Chi_Minh',
    },
    jobId: `ghost-presence-purge-repeating`,
    removeOnComplete: true,
    removeOnFail: false,
  });
}

/* ─── Polling loop ───────────────────────────────────────────── */

async function pollQueue(): Promise<void> {
  const POLL_INTERVAL_MS = Math.max(
    1_000,
    Number(process.env.GHOST_PRESENCE_PURGE_POLL_INTERVAL_MS ?? 5_000),
  );

  let stopping = false;

  while (!stopping) {
    try {
      const redis = await getRedisClient({ connect: true });
      if (!redis) {
        apiLogger.warn({ type: 'ghost-presence-purge' }, 'Redis not available, waiting...');
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const queue = new Queue(QUEUE_NAME, {
        connection: createBullmqConnectionOptions(),
      });

      // Ensure repeatable job is registered on each poll cycle
      await ensureRepeatableJob(queue).catch((err) => {
        apiLogger.warn({ type: 'ghost-presence-purge', err }, 'Failed to register repeatable job');
      });

      // Atomic dequeue: LPOP from head of list
      const raw = await redis.lpop(QUEUE_NAME);

      if (raw) {
        try {
          const payload = JSON.parse(String(raw));
          apiLogger.info({ type: 'ghost-presence-purge', payload }, 'Job dequeued, starting purge');

          const result = await purgeGhostPresences();

          apiLogger.info(
            { type: 'ghost-presence-purge', ...result },
            `Ghost purge job completed: cleared=${result.totalCleared}/${result.totalScanned}`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          apiLogger.error({ type: 'ghost-presence-purge', err }, `Job processing failed: ${msg}`);
        }
      } else {
        // No jobs — idle wait
        await sleep(POLL_INTERVAL_MS);
      }

      await queue.close().catch(() => void 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      apiLogger.error({ type: 'ghost-presence-purge', err }, `Poll error: ${msg}`);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

/* ─── Manual trigger (for testing / admin API) ──────────────── */

export async function triggerGhostPresencePurge(): Promise<PurgeResult> {
  return purgeGhostPresences();
}

/* ─── Entry point ────────────────────────────────────────────── */

async function main(): Promise<void> {
  apiLogger.info(
    { type: 'ghost-presence-purge', cron: CRON_EXPRESSION, timeoutHours: GHOST_TIMEOUT_HOURS },
    'Ghost Presence Purge worker starting',
  );

  const stop = async () => {
    apiLogger.info({ type: 'ghost-presence-purge' }, 'Shutting down...');
    await prisma.$disconnect();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());

  await pollQueue();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((e) => {
  apiLogger.fatal({ type: 'ghost-presence-purge', err: e }, 'Fatal: ghost presence purge worker crashed');
  process.exitCode = 1;
});
