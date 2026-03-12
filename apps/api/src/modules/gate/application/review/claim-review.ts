import { prisma } from '../../../../lib/prisma'
import { getSessionSummary } from '../open-session'
import { ApiError } from '../../../../server/http'
import { withAuditActor } from '../../../../server/services/with-actor'
import { appendAuditTrail, auditActorSnapshot, captureSessionReviewSnapshotTx, jsonSafe, resolveExistingActorUserIdTx, toBigIntId, type ReviewActor } from './common'

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

function deriveQueueActions(status: string) {
  if (status === 'OPEN') return ['CLAIM', 'MANUAL_APPROVE', 'MANUAL_REJECT', 'MANUAL_OPEN_BARRIER'] as const
  if (status === 'CLAIMED') return ['MANUAL_APPROVE', 'MANUAL_REJECT', 'MANUAL_OPEN_BARRIER'] as const
  return [] as const
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
  status?: 'OPEN' | 'CLAIMED' | 'RESOLVED' | 'CANCELLED'
  limit?: number
  cursor?: bigint
}): Promise<{ items: ReviewQueueRow[]; nextCursor: string | null }> {
  const limit = Math.min(200, Math.max(1, args?.limit ?? 50))
  const params: Array<string | number> = []
  const where: string[] = []

  if (args?.siteCode?.trim()) {
    where.push('ps.site_code = ?')
    params.push(args.siteCode.trim())
  }

  if (args?.status?.trim()) {
    where.push('gmr.status = ?')
    params.push(args.status.trim())
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
        session: await getSessionSummary(sessionId),
        latestDecision: await getLatestDecision(sessionId),
        actions: [...deriveQueueActions(String(row.status))],
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

  return withAuditActor(args.actor.actorUserId, async (tx) => {
    const effectiveActorUserId = await resolveExistingActorUserIdTx(tx, args.actor.actorUserId)

    const review = await tx.gate_manual_reviews.findUnique({ where: { review_id: reviewId } })
    if (!review) throw new ApiError({ code: 'NOT_FOUND', message: `Không tìm thấy review ${String(reviewId)}` })

    if (String(review.status) === 'RESOLVED' || String(review.status) === 'CANCELLED') {
      throw new ApiError({
        code: 'CONFLICT',
        message: 'Review đã kết thúc nên không thể claim',
        details: { status: review.status },
      })
    }

    if (String(review.status) === 'CLAIMED') {
      const sameActor = effectiveActorUserId != null && review.claimed_by_user_id != null && BigInt(review.claimed_by_user_id) == effectiveActorUserId
      if (!sameActor) {
        throw new ApiError({
          code: 'CONFLICT',
          message: 'Review đang được người khác claim',
          details: {
            claimedByUserId: review.claimed_by_user_id == null ? null : review.claimed_by_user_id.toString(),
          },
        })
      }
    }

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
      session: await getSessionSummary(BigInt(review.session_id)),
      reviewId: String(reviewId),
      changed: true,
    }
  })
}
