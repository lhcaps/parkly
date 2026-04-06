import { apiFetch, buildQuery, postJson } from '@/lib/http/client'
import type { ManualAuditPayload } from '@/lib/contracts/reviews'
import { isRecord } from '@/lib/http/errors'
import {
  normalizeSessionDetail,
  normalizeSessionSummary,
  normalizeSessionSummaryList,
} from '@/lib/contracts/normalize'
import type {
  MutateSessionRes,
  OpenSessionPayload,
  OpenSessionRes,
  ResolveSessionPayload,
  ResolveSessionRes,
  ManualReviewActionResponse,
  SessionDetail,
  SessionState,
} from '@/lib/contracts/sessions'

function normalizeMutateSessionRes(value: unknown): MutateSessionRes {
  const row = isRecord(value) ? value : {}
  return {
    changed: typeof row.changed === 'boolean' ? row.changed : false,
    session: normalizeSessionSummary(row.session),
  }
}

export function openSession(payload: OpenSessionPayload) {
  return postJson<OpenSessionRes>('/api/gate-sessions/open', payload)
}

export function resolveSession(payload: ResolveSessionPayload) {
  return postJson<ResolveSessionRes>('/api/gate-sessions/resolve', payload)
}

export function getSessionDetail(sessionId: string) {
  return apiFetch<SessionDetail>(`/api/gate-sessions/${encodeURIComponent(sessionId)}`, undefined, normalizeSessionDetail)
}

export function getSessions(params?: {
  siteCode?: string
  laneCode?: string
  status?: SessionState
  direction?: 'ENTRY' | 'EXIT'
  sessionId?: string
  plate?: string
  q?: string
  from?: string
  to?: string
  limit?: number
}) {
  const qs = buildQuery(params)
  return apiFetch<{ rows: ReturnType<typeof normalizeSessionSummaryList> }>(`/api/gate-sessions${qs ? `?${qs}` : ''}`, undefined, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      rows: normalizeSessionSummaryList(row.rows),
    }
  })
}

export function confirmPass(sessionId: string, body: { requestId: string; idempotencyKey: string; occurredAt?: string; reasonCode?: string; rawPayload?: unknown }) {
  return postJson<MutateSessionRes>(`/api/gate-sessions/${encodeURIComponent(sessionId)}/confirm-pass`, body, normalizeMutateSessionRes)
}

export function cancelSession(sessionId: string, body: { requestId: string; idempotencyKey: string; occurredAt?: string; reasonCode?: string; note?: string; rawPayload?: unknown }) {
  return postJson<MutateSessionRes>(`/api/gate-sessions/${encodeURIComponent(sessionId)}/cancel`, body, normalizeMutateSessionRes)
}


export function manualOpenBarrierSession(sessionId: string, body: ManualAuditPayload) {
  return postJson<ManualReviewActionResponse>(`/api/gate-sessions/${encodeURIComponent(sessionId)}/manual-open-barrier`, body)
}
