import * as dotenv from 'dotenv';
dotenv.config();

import { Prisma, gate_event_outbox_status } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { trySyncOutboxToMongo } from '../services/event.service';
import { randomUUID } from 'node:crypto';

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v.trim() === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Drain outbox -> MongoDB.
 *
 * Cải tiến (v2.1): có cơ chế "lease" ngắn để tránh 2 worker xử lý cùng 1 row.
 * - Claim batch bằng SELECT ... FOR UPDATE SKIP LOCKED (MySQL 8)
 * - Set next_retry_at = now + leaseMs để tạm "khóa" row (không cần thêm status PROCESSING)
 * - Sau khi xử lý, trySyncOutboxToMongo sẽ set next_retry_at theo backoff hoặc NULL khi SENT
 */
async function main() {
  const workerId = randomUUID();
  const batchSize = envInt('OUTBOX_BATCH_SIZE', 50);
  const leaseMs = envInt('OUTBOX_LEASE_MS', 120_000);

  const claimed = await prisma.$transaction(async (tx) => {
    const ids = await tx.$queryRaw<{ outbox_id: any }[]>(Prisma.sql`
      SELECT outbox_id
      FROM gate_event_outbox
      WHERE status = 'PENDING'
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY COALESCE(next_retry_at, created_at), outbox_id
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `);

    if (ids.length === 0) return [] as bigint[];

    const leaseUntil = new Date(Date.now() + leaseMs);
    const outboxIds = ids.map((r) => BigInt(r.outbox_id));

    // Lease: tạm thời đẩy next_retry_at lên tương lai để worker khác không pick trùng.
    // Defense-in-depth: only lease rows that are still PENDING & due.
    await tx.gate_event_outbox.updateMany({
      where: {
        outbox_id: { in: outboxIds },
        status: gate_event_outbox_status.PENDING,
        OR: [{ next_retry_at: null }, { next_retry_at: { lte: new Date() } }],
      },
      data: { next_retry_at: leaseUntil },
    });

    return outboxIds;
  });

  if (claimed.length === 0) {
    console.log('No pending outbox rows.');
    return;
  }

  console.log(
    `[outbox:drain] worker=${workerId} claimed=${claimed.length} batchSize=${batchSize} leaseMs=${leaseMs}`
  );

  let ok = 0;
  let fail = 0;
  for (const id of claimed) {
    const synced = await trySyncOutboxToMongo(id);
    if (synced) ok++;
    else fail++;
  }

  console.log(`Drained: ok=${ok}, fail=${fail}, total=${claimed.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
