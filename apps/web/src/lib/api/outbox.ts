import { apiFetch, buildQuery, postJson } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import type { OutboxDrainRes, OutboxListItem, OutboxListRes, OutboxRequeueRes } from '@/lib/contracts/outbox'

function normalizeOutboxListItem(value: unknown): OutboxListItem | null {
  if (!isRecord(value)) return null
  return {
    outboxId: typeof value.outboxId === 'string' ? value.outboxId : '',
    eventId: typeof value.eventId === 'string' ? value.eventId : '',
    siteId: typeof value.siteId === 'string' ? value.siteId : null,
    eventTime: typeof value.eventTime === 'string' ? value.eventTime : '',
    status: typeof value.status === 'string' ? value.status : 'UNKNOWN',
    attempts: typeof value.attempts === 'number' && Number.isFinite(value.attempts) ? value.attempts : 0,
    sentAt: typeof value.sentAt === 'string' ? value.sentAt : null,
    nextRetryAt: typeof value.nextRetryAt === 'string' ? value.nextRetryAt : null,
    lastError: typeof value.lastError === 'string' ? value.lastError : null,
    mongoDocId: typeof value.mongoDocId === 'string' ? value.mongoDocId : null,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    payload: value.payload,
  }
}

export function getOutboxItems(params?: { siteCode?: string; status?: 'PENDING' | 'SENT' | 'FAILED'; limit?: number; cursor?: string }) {
  const qs = buildQuery(params)
  return apiFetch<OutboxListRes>(`/api/outbox${qs ? `?${qs}` : ''}`, undefined, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      rows: Array.isArray(row.rows)
        ? row.rows.map((item) => normalizeOutboxListItem(item)).filter((item): item is OutboxListItem => Boolean(item))
        : [],
      nextCursor: typeof row.nextCursor === 'string' ? row.nextCursor : null,
    }
  })
}

export function requeueOutboxItems(body: { outboxIds?: string[]; limit?: number }) {
  return postJson<OutboxRequeueRes>('/api/outbox/requeue', body, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      changed: typeof row.changed === 'number' && Number.isFinite(row.changed) ? row.changed : 0,
    }
  })
}

export function drainOutbox(body?: { limit?: number; dryRun?: boolean }) {
  return postJson<OutboxDrainRes>('/api/outbox/drain', body ?? {}, (value) => {
    const row = isRecord(value) ? value : {}
    if (row.dryRun === true) {
      return {
        dryRun: true,
        candidates: Array.isArray(row.candidates) ? row.candidates.filter((item): item is string => typeof item === 'string') : [],
      }
    }
    return {
      dryRun: false,
      claimed: typeof row.claimed === 'number' && Number.isFinite(row.claimed) ? row.claimed : 0,
      ok: typeof row.ok === 'number' && Number.isFinite(row.ok) ? row.ok : 0,
      fail: typeof row.fail === 'number' && Number.isFinite(row.fail) ? row.fail : 0,
      outboxIds: Array.isArray(row.outboxIds) ? row.outboxIds.filter((item): item is string => typeof item === 'string') : [],
    }
  })
}
