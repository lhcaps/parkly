import { Prisma, gate_event_outbox_status } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { trySyncOutboxToMongo } from '../../services/event.service';

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v.trim() === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function previewOutboxBatch(limit?: number): Promise<bigint[]> {
  const safeLimit = Math.min(200, Math.max(1, limit ?? envInt('OUTBOX_BATCH_SIZE', 50)));
  const ids = await prisma.$queryRaw<{ outbox_id: any }[]>(Prisma.sql`
    SELECT outbox_id
    FROM gate_event_outbox
    WHERE status = 'PENDING'
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY COALESCE(next_retry_at, created_at), outbox_id
    LIMIT ${safeLimit}
  `);
  return ids.map((r) => BigInt(r.outbox_id));
}

export async function claimOutboxBatch(args?: {
  limit?: number;
}): Promise<{ outboxIds: bigint[]; batchSize: number; leaseMs: number }> {
  const batchSize = Math.min(200, Math.max(1, args?.limit ?? envInt('OUTBOX_BATCH_SIZE', 50)));
  const leaseMs = envInt('OUTBOX_LEASE_MS', 120_000);

  const outboxIds = await prisma.$transaction(async (tx) => {
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

  return { outboxIds, batchSize, leaseMs };
}

export async function drainOutboxOnce(args?: {
  limit?: number;
  dryRun?: boolean;
}): Promise<
  | { dryRun: true; candidates: bigint[] }
  | { dryRun: false; claimed: number; ok: number; fail: number; outboxIds: bigint[] }
> {
  if (args?.dryRun) {
    const candidates = await previewOutboxBatch(args.limit);
    return { dryRun: true, candidates };
  }

  const { outboxIds } = await claimOutboxBatch({ limit: args?.limit });
  if (outboxIds.length === 0) return { dryRun: false, claimed: 0, ok: 0, fail: 0, outboxIds: [] };

  let ok = 0;
  let fail = 0;
  for (const id of outboxIds) {
    const synced = await trySyncOutboxToMongo(id);
    if (synced) ok++;
    else fail++;
  }

  return { dryRun: false, claimed: outboxIds.length, ok, fail, outboxIds };
}

export async function requeueOutbox(args: { outboxIds?: bigint[]; limit?: number }): Promise<{ changed: number }> {
  if (args.outboxIds && args.outboxIds.length) {
    const res = await prisma.gate_event_outbox.updateMany({
      where: { outbox_id: { in: args.outboxIds } },
      data: { status: gate_event_outbox_status.PENDING, next_retry_at: null, last_error: null },
    });
    return { changed: res.count };
  }

  const safeLimit = Math.min(500, Math.max(1, args.limit ?? 100));
  const res = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE gate_event_outbox
      SET status = 'PENDING', next_retry_at = NULL, last_error = NULL
      WHERE status = 'FAILED'
      ORDER BY outbox_id DESC
      LIMIT ${safeLimit}
    `
  );

  return { changed: Number(res) || 0 };
}

export async function listOutbox(args: {
  siteId?: bigint;
  status?: gate_event_outbox_status;
  limit?: number;
  cursor?: bigint;
}): Promise<{ items: any[]; nextCursor: bigint | null }> {
  const limit = Math.min(200, Math.max(1, args.limit ?? 50));

  const where: any = {
    ...(args.siteId ? { site_id: args.siteId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(args.cursor ? { outbox_id: { lt: args.cursor } } : {}),
  };

  const items = await prisma.gate_event_outbox.findMany({
    where,
    orderBy: { outbox_id: 'desc' },
    take: limit,
  });

  const nextCursor = items.length === limit ? items[items.length - 1].outbox_id : null;
  return { items, nextCursor };
}
