import { Prisma, gate_event_outbox_status } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { trySyncOutboxToMongo } from '../../services/event.service'

export type OutboxRow = NonNullable<Awaited<ReturnType<typeof prisma.gate_event_outbox.findUnique>>>

export type OutboxRetryConfig = {
  batchSize: number
  leaseMs: number
  maxAttempts: number
  backoffBaseMs: number
  backoffMaxMs: number
  backoffJitter: boolean
}

export type ClaimOutboxRowResult = {
  claimed: boolean
  row: OutboxRow | null
  leaseMs: number
}

export type ProcessOutboxIdempotentResult =
  | {
      outboxId: bigint
      status: 'SENT'
      attempts: number
      nextRetryAt: null
      row: OutboxRow | null
    }
  | {
      outboxId: bigint
      status: 'RETRY'
      attempts: number
      nextRetryAt: string | null
      row: OutboxRow | null
      lastError: string | null
    }
  | {
      outboxId: bigint
      status: 'FAILED'
      attempts: number
      nextRetryAt: null
      row: OutboxRow | null
      lastError: string | null
    }
  | {
      outboxId: bigint
      status: 'ALREADY_SENT' | 'TERMINAL_FAILED' | 'NOT_FOUND'
      attempts: number
      nextRetryAt: string | null
      row: OutboxRow | null
      lastError?: string | null
    }

function envInt(name: string, fallback: number): number {
  const v = process.env[name]
  if (v == null || v.trim() === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name]
  if (v == null || v.trim() === '') return fallback
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes' || v.toLowerCase() === 'on'
}

export function getOutboxRetryConfig(): OutboxRetryConfig {
  return {
    batchSize: Math.min(500, Math.max(1, envInt('OUTBOX_BATCH_SIZE', 50))),
    leaseMs: Math.max(1_000, envInt('OUTBOX_LEASE_MS', 120_000)),
    maxAttempts: Math.max(1, envInt('OUTBOX_MAX_ATTEMPTS', 8)),
    backoffBaseMs: Math.max(100, envInt('OUTBOX_BACKOFF_BASE_MS', 5_000)),
    backoffMaxMs: Math.max(100, envInt('OUTBOX_BACKOFF_MAX_MS', 300_000)),
    backoffJitter: envBool('OUTBOX_BACKOFF_JITTER', true),
  }
}

export function computeOutboxRetryDelayMs(attempts: number): number {
  const cfg = getOutboxRetryConfig()
  const exp = Math.min(30, Math.max(0, attempts - 1))
  const raw = Math.min(cfg.backoffMaxMs, cfg.backoffBaseMs * 2 ** exp)
  if (cfg.backoffJitter) return Math.floor(Math.random() * raw)
  return raw
}

export async function previewOutboxBatch(limit?: number): Promise<bigint[]> {
  const cfg = getOutboxRetryConfig()
  const safeLimit = Math.min(200, Math.max(1, limit ?? cfg.batchSize))
  const ids = await prisma.$queryRaw<{ outbox_id: unknown }[]>(Prisma.sql`
    SELECT outbox_id
    FROM gate_event_outbox
    WHERE status = 'PENDING'
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY COALESCE(next_retry_at, created_at), outbox_id
    LIMIT ${safeLimit}
  `)

  return ids.map((r) => BigInt(String(r.outbox_id)))
}

export async function getOutboxRow(outboxId: bigint): Promise<OutboxRow | null> {
  return await prisma.gate_event_outbox.findUnique({
    where: { outbox_id: outboxId },
  })
}

export async function claimOutboxBatch(args?: {
  limit?: number
}): Promise<{ outboxIds: bigint[]; batchSize: number; leaseMs: number }> {
  const cfg = getOutboxRetryConfig()
  const batchSize = Math.min(200, Math.max(1, args?.limit ?? cfg.batchSize))
  const leaseMs = cfg.leaseMs

  const outboxIds = await prisma.$transaction(async (tx) => {
    const ids = await tx.$queryRaw<{ outbox_id: unknown }[]>(Prisma.sql`
      SELECT outbox_id
      FROM gate_event_outbox
      WHERE status = 'PENDING'
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY COALESCE(next_retry_at, created_at), outbox_id
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `)

    if (ids.length === 0) return [] as bigint[]

    const leaseUntil = new Date(Date.now() + leaseMs)
    const outboxIds = ids.map((r) => BigInt(String(r.outbox_id)))

    await tx.gate_event_outbox.updateMany({
      where: {
        outbox_id: { in: outboxIds },
        status: gate_event_outbox_status.PENDING,
        OR: [{ next_retry_at: null }, { next_retry_at: { lte: new Date() } }],
      },
      data: { next_retry_at: leaseUntil },
    })

    return outboxIds
  })

  return { outboxIds, batchSize, leaseMs }
}

export async function claimOutboxRow(args: {
  outboxId: bigint
  leaseMs?: number
}): Promise<ClaimOutboxRowResult> {
  const cfg = getOutboxRetryConfig()
  const leaseMs = Math.max(1_000, args.leaseMs ?? cfg.leaseMs)

  const result = await prisma.$transaction(async (tx) => {
    const now = new Date()
    const current = await tx.gate_event_outbox.findUnique({
      where: { outbox_id: args.outboxId },
    })

    if (!current) {
      return { claimed: false, row: null as OutboxRow | null }
    }

    if (current.status !== gate_event_outbox_status.PENDING) {
      return { claimed: false, row: current }
    }

    if (current.next_retry_at && current.next_retry_at > now) {
      return { claimed: false, row: current }
    }

    const leaseUntil = new Date(Date.now() + leaseMs)

    const updated = await tx.gate_event_outbox.updateMany({
      where: {
        outbox_id: args.outboxId,
        status: gate_event_outbox_status.PENDING,
        OR: [{ next_retry_at: null }, { next_retry_at: { lte: now } }],
      },
      data: { next_retry_at: leaseUntil },
    })

    const fresh = await tx.gate_event_outbox.findUnique({
      where: { outbox_id: args.outboxId },
    })

    return {
      claimed: updated.count === 1,
      row: fresh,
    }
  })

  return {
    ...result,
    leaseMs,
  }
}

export async function processOutboxIdempotent(args: {
  outboxId: bigint
  syncFn?: (outboxId: bigint) => Promise<boolean>
}): Promise<ProcessOutboxIdempotentResult> {
  const syncFn = args.syncFn ?? trySyncOutboxToMongo

  const before = await getOutboxRow(args.outboxId)
  if (!before) {
    return {
      outboxId: args.outboxId,
      status: 'NOT_FOUND',
      attempts: 0,
      nextRetryAt: null,
      row: null,
    }
  }

  if (before.status === gate_event_outbox_status.SENT) {
    return {
      outboxId: args.outboxId,
      status: 'ALREADY_SENT',
      attempts: before.attempts,
      nextRetryAt: before.next_retry_at ? before.next_retry_at.toISOString() : null,
      row: before,
      lastError: before.last_error ?? null,
    }
  }

  if (before.status === gate_event_outbox_status.FAILED) {
    return {
      outboxId: args.outboxId,
      status: 'TERMINAL_FAILED',
      attempts: before.attempts,
      nextRetryAt: null,
      row: before,
      lastError: before.last_error ?? null,
    }
  }

  const synced = await syncFn(args.outboxId)
  const after = await getOutboxRow(args.outboxId)

  if (synced || after?.status === gate_event_outbox_status.SENT) {
    return {
      outboxId: args.outboxId,
      status: 'SENT',
      attempts: after?.attempts ?? before.attempts,
      nextRetryAt: null,
      row: after,
    }
  }

  if (after?.status === gate_event_outbox_status.FAILED) {
    return {
      outboxId: args.outboxId,
      status: 'FAILED',
      attempts: after.attempts,
      nextRetryAt: null,
      row: after,
      lastError: after.last_error ?? null,
    }
  }

  return {
    outboxId: args.outboxId,
    status: 'RETRY',
    attempts: after?.attempts ?? before.attempts + 1,
    nextRetryAt: after?.next_retry_at ? after.next_retry_at.toISOString() : null,
    row: after,
    lastError: after?.last_error ?? null,
  }
}

export async function drainOutboxOnce(args?: {
  limit?: number
  dryRun?: boolean
}): Promise<
  | { dryRun: true; candidates: bigint[] }
  | { dryRun: false; claimed: number; ok: number; fail: number; outboxIds: bigint[] }
> {
  if (args?.dryRun) {
    const candidates = await previewOutboxBatch(args.limit)
    return { dryRun: true, candidates }
  }

  const { outboxIds } = await claimOutboxBatch({ limit: args?.limit })
  if (outboxIds.length === 0) return { dryRun: false, claimed: 0, ok: 0, fail: 0, outboxIds: [] }

  let ok = 0
  let fail = 0

  for (const id of outboxIds) {
    const result = await processOutboxIdempotent({ outboxId: id })
    if (result.status === 'SENT' || result.status === 'ALREADY_SENT') ok++
    else fail++
  }

  return { dryRun: false, claimed: outboxIds.length, ok, fail, outboxIds }
}

export async function requeueOutbox(args: {
  outboxIds?: bigint[]
  limit?: number
}): Promise<{ changed: number }> {
  if (args.outboxIds && args.outboxIds.length) {
    const res = await prisma.gate_event_outbox.updateMany({
      where: { outbox_id: { in: args.outboxIds } },
      data: {
        status: gate_event_outbox_status.PENDING,
        next_retry_at: null,
      },
    })

    return { changed: res.count }
  }

  const safeLimit = Math.min(500, Math.max(1, args.limit ?? 100))
  const res = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE gate_event_outbox
      SET status = 'PENDING', next_retry_at = NULL
      WHERE status = 'FAILED'
      ORDER BY outbox_id DESC
      LIMIT ${safeLimit}
    `
  )

  return { changed: Number(res) || 0 }
}

export async function listOutbox(args: {
  siteId?: bigint
  status?: gate_event_outbox_status
  limit?: number
  cursor?: bigint
}): Promise<{ items: OutboxRow[]; nextCursor: bigint | null }> {
  const limit = Math.min(200, Math.max(1, args.limit ?? 50))

  const where = {
    ...(args.siteId ? { site_id: args.siteId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(args.cursor ? { outbox_id: { lt: args.cursor } } : {}),
  }

  const items = await prisma.gate_event_outbox.findMany({
    where,
    orderBy: { outbox_id: 'desc' },
    take: limit,
  })

  const nextCursor = items.length === limit ? items[items.length - 1].outbox_id : null
  return { items, nextCursor }
}