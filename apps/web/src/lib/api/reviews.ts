import { apiFetch, buildQuery, postJson } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import { normalizeReviewQueueList } from '@/lib/contracts/normalize'
import type { ManualAuditPayload, ReviewQueueRes } from '@/lib/contracts/reviews'
import type { ManualReviewActionResponse } from '@parkly/contracts'

export function getReviewQueue(params?: {
  siteCode?: string
  /** DONE = RESOLVED + CANCELLED (backend aggregate) */
  status?: 'OPEN' | 'CLAIMED' | 'RESOLVED' | 'CANCELLED' | 'DONE'
  sessionId?: string
  plate?: string
  laneCode?: string
  q?: string
  from?: string
  to?: string
  limit?: number
}) {
  const qs = buildQuery(params)
  return apiFetch<ReviewQueueRes>(`/api/gate-review-queue${qs ? `?${qs}` : ''}`, undefined, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      rows: normalizeReviewQueueList(row.rows),
    }
  })
}

export function claimReview(reviewId: string, body: ManualAuditPayload) {
  return postJson<ManualReviewActionResponse>(`/api/gate-review-queue/${encodeURIComponent(reviewId)}/claim`, body)
}

export function manualApproveSession(sessionId: string, body: ManualAuditPayload) {
  return postJson<ManualReviewActionResponse>(`/api/gate-sessions/${encodeURIComponent(sessionId)}/manual-approve`, body)
}

export function manualRejectSession(sessionId: string, body: ManualAuditPayload) {
  return postJson<ManualReviewActionResponse>(`/api/gate-sessions/${encodeURIComponent(sessionId)}/manual-reject`, body)
}

export function manualOpenBarrier(sessionId: string, body: ManualAuditPayload) {
  return postJson<ManualReviewActionResponse>(`/api/gate-sessions/${encodeURIComponent(sessionId)}/manual-open-barrier`, body)
}
