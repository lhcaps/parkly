import { apiFetch, buildQuery, postJson } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import type {
  MutateSessionRes,
  OpenSessionPayload,
  OpenSessionRes,
  ResolveSessionPayload,
  ResolveSessionRes,
  SessionAllowedAction,
  SessionDetail,
  SessionState,
  SessionSummary,
} from '@/lib/contracts/sessions'

function normalizeAllowedActions(value: unknown): SessionAllowedAction[] {
  return Array.isArray(value) ? value.filter((item): item is SessionAllowedAction => typeof item === 'string') : []
}

function normalizeSessionSummary(value: unknown): SessionSummary {
  const row = isRecord(value) ? value : {}
  return {
    ...(row as SessionSummary),
    allowedActions: normalizeAllowedActions(row.allowedActions),
  }
}

function normalizeSessionDetail(value: unknown): SessionDetail {
  const row = isRecord(value) ? value : {}
  const session = normalizeSessionSummary(row.session)
  return {
    ...(row as SessionDetail),
    session,
    reads: Array.isArray(row.reads) ? row.reads : [],
    decisions: Array.isArray(row.decisions) ? row.decisions : [],
    barrierCommands: Array.isArray(row.barrierCommands) ? row.barrierCommands : [],
    manualReviews: Array.isArray(row.manualReviews) ? row.manualReviews : [],
    incidents: Array.isArray(row.incidents) ? row.incidents : [],
    timeline: Array.isArray(row.timeline) ? row.timeline : [],
  }
}

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
  return apiFetch<{ rows: SessionSummary[] }>(`/api/gate-sessions${qs ? `?${qs}` : ''}`, undefined, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      rows: Array.isArray(row.rows) ? row.rows.map((item) => normalizeSessionSummary(item)) : [],
    }
  })
}

export function confirmPass(sessionId: string, body: { requestId: string; idempotencyKey: string; occurredAt?: string; reasonCode?: string; rawPayload?: unknown }) {
  return postJson<MutateSessionRes>(`/api/gate-sessions/${encodeURIComponent(sessionId)}/confirm-pass`, body, normalizeMutateSessionRes)
}

export function cancelSession(sessionId: string, body: { requestId: string; idempotencyKey: string; occurredAt?: string; reasonCode?: string; note?: string; rawPayload?: unknown }) {
  return postJson<MutateSessionRes>(`/api/gate-sessions/${encodeURIComponent(sessionId)}/cancel`, body, normalizeMutateSessionRes)
}
