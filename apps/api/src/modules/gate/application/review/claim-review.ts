import { prisma } from '../../../../lib/prisma'
import { getSessionSummary } from '../open-session'
import { ApiError } from '../../../../server/http'
import { withAuditActor } from '../../../../server/services/with-actor'
import { isTerminalSessionStatus, type SessionAllowedAction, type SessionStatus } from '../../domain/session'
import { appendAuditTrail, auditActorSnapshot, captureSessionReviewSnapshotTx, ensureMutableSessionStatus, ensureReviewMutationAllowed, resolveExistingActorUserIdTx, toBigIntId, writeReviewAuditLog, type ReviewActor } from './common'

export type ReviewQueueRow = {
  reviewId: string
  status: string
  queueReasonCode: string
  claimedByUserId: string | null
  claimedAt: string | null
  resolvedByUserId: string | null
  resolvedAt: string | null
  note: string | null
  snapshot: unknown
  createdAt: string
  session: Awaited<ReturnType<typeof getSessionSummary>>
  latestDecision: {
    decisionId: string
    decisionCode: string
    recommendedAction: string
    finalAction: string
    reasonCode: string
    reasonDetail: string | null
    reviewRequired: boolean
    explanation: string
    inputSnapshot: unknown
    thresholdSnapshot: unknown
    createdAt: string
  } | null
  actions: Array<'CLAIM' | 'MANUAL_APPROVE' | 'MANUAL_REJECT' | 'MANUAL_OPEN_BARRIER'>
}

function iso(value: unknown) {
  return value == null ? null : new Date(String(value)).toISOString()
}

function deriveQueueActions(args: {
  reviewStatus: string
  sessionStatus: SessionStatus
  sessionAllowedActions: SessionAllowedAction[]
}) {
  if (isTerminalSessionStatus(args.sessionStatus)) return [] as const

  const canMutateReview = args.reviewStatus === 'OPEN' || args.reviewStatus === 'CLAIMED'
  if (!canMutateReview) return [] as const

  const actions: Array<'CLAIM' | 'MANUAL_APPROVE' | 'MANUAL_REJECT' | 'MANUAL_OPEN_BARRIER'> = []

  if (args.reviewStatus === 'OPEN') {
    actions.push('CLAIM')
  }

  if (args.sessionAllowedActions.includes('APPROVE')) {
    actions.push('MANUAL_APPROVE', 'MANUAL_OPEN_BARRIER')
  }

  if (args.sessionAllowedActions.includes('DENY')) {
    actions.push('MANUAL_REJECT')
  }

  return actions
}

async function getLatestDecision(sessionId: bigint) {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        decision_id AS decisionId,
        decision_code AS decisionCode,
        final_action AS finalAction,
        reason_code AS reasonCode,
        reason_detail AS reasonDetail,
        input_snapshot_json AS inputSnapshot,
        threshold_snapshot_json AS thresholdSnapshot,
        created_at AS createdAt
      FROM gate_decisions
      WHERE session_id = ?
      ORDER BY created_at DESC, decision_id DESC
      LIMIT 1
    `,
    String(sessionId),
  )

  const row = rows[0]
  if (!row) return null

  return {
    decisionId: String(row.decisionId),
    decisionCode: String(row.decisionCode),
    recommendedAction: String(row.finalAction),
    finalAction: String(row.finalAction),
    reasonCode: String(row.reasonCode),
    reasonDetail: row.reasonDetail == null ? null : String(row.reasonDetail),
    reviewRequired: String(row.finalAction) === 'REVIEW' || String(row.finalAction) === 'PAYMENT_HOLD',
    explanation: row.reasonDetail == null ? String(row.reasonCode) : String(row.reasonDetail),
    inputSnapshot: row.inputSnapshot ?? null,
    thresholdSnapshot: row.thresholdSnapshot ?? null,
    createdAt: new Date(String(row.createdAt)).toISOString(),
  }
}

export async function listGateReviewQueue(args?: {
  siteCode?: string
  siteCodes?: string[]
  /** DONE = completed reviews (RESOLVED + CANCELLED) for operator history UI */
  status?: 'OPEN' | 'CLAIMED' | 'RESOLVED' | 'CANCELLED' | 'DONE'
  limit?: number
  cursor?: bigint
}): Promise<{ items: ReviewQueueRow[]; nextCursor: string | null }> {
  const limit = Math.min(200, Math.max(1, args?.limit ?? 50))
  const params: Array<string | number> = []
  const where: string[] = []
  const scopedSiteCodes = [...new Set((args?.siteCodes ?? []).map((siteCode) => String(siteCode ?? '').trim()).filter(Boolean))]

  if (args?.siteCode?.trim()) {
    where.push('ps.site_code = ?')
    params.push(args.siteCode.trim())
  } else if (args?.siteCodes) {
    if (scopedSiteCodes.length === 0) return { items: [], nextCursor: null }
    where.push(`ps.site_code IN (${scopedSiteCodes.map(() => '?').join(', ')})`)
    params.push(...scopedSiteCodes)
  }

  if (args?.status?.trim()) {
    const s = args.status.trim().toUpperCase()
    if (s === 'DONE') {
      where.push("gmr.status IN ('RESOLVED', 'CANCELLED')")
    } else {
      where.push('gmr.status = ?')
      params.push(s)
    }
  } else {
    where.push("gmr.status IN ('OPEN', 'CLAIMED')")
  }

  if (args?.cursor != null) {
    where.push('gmr.review_id < ?')
    params.push(String(args.cursor))
  }

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        gmr.review_id AS reviewId,
        gmr.session_id AS sessionId,
        gmr.status AS status,
        gmr.queue_reason_code AS queueReasonCode,
        gmr.claimed_by_user_id AS claimedByUserId,
        gmr.claimed_at AS claimedAt,
        gmr.resolved_by_user_id AS resolvedByUserId,
        gmr.resolved_at AS resolvedAt,
        gmr.note AS note,
        gmr.snapshot_json AS snapshot,
        gmr.created_at AS createdAt
      FROM gate_manual_reviews gmr
      INNER JOIN parking_sites ps ON ps.site_id = gmr.site_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY gmr.review_id DESC
      LIMIT ${limit}
    `,
    ...params,
  )

  const items = await Promise.all(
    rows.map(async (row) => {
      const sessionId = BigInt(String(row.sessionId))
      const session = await getSessionSummary(sessionId)
      return {
        reviewId: String(row.reviewId),
        status: String(row.status),
        queueReasonCode: String(row.queueReasonCode),
        claimedByUserId: row.claimedByUserId == null ? null : String(row.claimedByUserId),
        claimedAt: iso(row.claimedAt),
        resolvedByUserId: row.resolvedByUserId == null ? null : String(row.resolvedByUserId),
        resolvedAt: iso(row.resolvedAt),
        note: row.note == null ? null : String(row.note),
        snapshot: row.snapshot ?? null,
        createdAt: new Date(String(row.createdAt)).toISOString(),
        session,
        latestDecision: await getLatestDecision(sessionId),
        actions: [...deriveQueueActions({
          reviewStatus: String(row.status),
          sessionStatus: session.status,
          sessionAllowedActions: session.allowedActions,
        })],
      }
    }),
  )

  return {
    items,
    nextCursor: items.length === limit ? items[items.length - 1]?.reviewId ?? null : null,
  }
}

export async function claimGateReview(args: {
  reviewId: string | number | bigint
  occurredAt?: Date
  reasonCode: string
  note: string
  actor: ReviewActor
}) {
  const reviewId = toBigIntId(args.reviewId, 'reviewId')
  const occurredAt = args.occurredAt ?? new Date()

  const result = await withAuditActor(args.actor.actorUserId, async (tx) => {
    const effectiveActorUserId = await resolveExistingActorUserIdTx(tx, args.actor.actorUserId)

    const review = await tx.gate_manual_reviews.findUnique({ where: { review_id: reviewId } })
    if (!review) throw new ApiError({ code: 'NOT_FOUND', message: `Không tìm thấy review ${String(reviewId)}` })

    ensureReviewMutationAllowed(review, {
      effectiveActorUserId,
      operation: 'claim',
    })

    const session = await tx.gate_passage_sessions.findUnique({
      where: { session_id: BigInt(review.session_id) },
      select: { session_id: true, status: true },
    })

    if (!session) {
      throw new ApiError({
        code: 'NOT_FOUND',
        message: `Không tìm thấy session ${String(review.session_id)}`,
      })
    }

    await ensureMutableSessionStatus(session, {
      message: 'Review không thể claim vì session đã terminal',
    })

    const beforeSnapshot = await captureSessionReviewSnapshotTx(tx, {
      sessionId: BigInt(review.session_id),
      reviewId,
    })

    const nextSnapshot = appendAuditTrail(review.snapshot_json, {
      type: 'REVIEW_CLAIM',
      at: occurredAt.toISOString(),
      reasonCode: args.reasonCode.trim(),
      note: args.note.trim(),
      actor: auditActorSnapshot(args.actor),
      beforeSnapshot,
    })

    await tx.gate_manual_reviews.update({
      where: { review_id: reviewId },
      data: {
        status: 'CLAIMED',
        claimed_by_user_id: effectiveActorUserId ?? review.claimed_by_user_id ?? null,
        claimed_at: occurredAt,
        note: args.note.trim(),
        snapshot_json: nextSnapshot,
      },
    })

    const afterSnapshot = await captureSessionReviewSnapshotTx(tx, {
      sessionId: BigInt(review.session_id),
      reviewId,
    })

    await tx.gate_manual_reviews.update({
      where: { review_id: reviewId },
      data: {
        snapshot_json: appendAuditTrail(nextSnapshot, {
          type: 'REVIEW_CLAIM_RESULT',
          at: occurredAt.toISOString(),
          actor: auditActorSnapshot(args.actor),
          afterSnapshot,
        }),
      },
    })

    return {
      data: {
        session: await getSessionSummary(BigInt(review.session_id)),
        reviewId: String(reviewId),
        changed: true,
      },
      audit: {
        siteId: review.site_id,
        sessionId: review.session_id,
        reviewId,
        beforeSnapshot,
        afterSnapshot,
      },
    }
  })

  await writeReviewAuditLog({
    siteId: result.audit.siteId,
    sessionId: result.audit.sessionId,
    reviewId: result.audit.reviewId,
    action: 'GATE_REVIEW_CLAIM',
    actor: args.actor,
    beforeSnapshot: result.audit.beforeSnapshot,
    afterSnapshot: result.audit.afterSnapshot,
    occurredAt,
  })

  return result.data
}
