import { ApiError } from '../../../../server/http'

export type ReviewActor = {
  role: string
  actorUserId?: bigint
  actorLabel: string
}

export function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))
}

export function toBigIntId(value: string | number | bigint, fieldName = 'id'): bigint {
  try {
    return BigInt(value)
  } catch {
    throw new ApiError({ code: 'BAD_REQUEST', message: `${fieldName} không hợp lệ: ${String(value)}` })
  }
}

export function auditActorSnapshot(actor: ReviewActor) {
  return {
    role: actor.role,
    actorUserId: actor.actorUserId == null ? null : actor.actorUserId.toString(),
    actorLabel: actor.actorLabel,
  }
}

export async function resolveExistingActorUserIdTx(tx: any, actorUserId?: bigint): Promise<bigint | null> {
  if (actorUserId == null) return null

  const found = await tx.users.findUnique({
    where: { user_id: actorUserId },
    select: { user_id: true },
  })

  return found?.user_id ?? null
}

export function appendAuditTrail(existing: unknown, entry: Record<string, unknown>) {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {}

  const currentTrail = Array.isArray(base.auditTrail) ? [...(base.auditTrail as unknown[])] : []
  currentTrail.push(jsonSafe(entry))

  return {
    ...base,
    auditTrail: currentTrail,
    lastAuditEntry: jsonSafe(entry),
  }
}

export async function captureSessionReviewSnapshotTx(tx: any, args: {
  sessionId: bigint
  reviewId?: bigint | null
}) {
  const session = await tx.gate_passage_sessions.findUnique({
    where: { session_id: args.sessionId },
    select: {
      session_id: true,
      status: true,
      direction: true,
      ticket_id: true,
      lane_id: true,
      site_id: true,
      opened_at: true,
      last_read_at: true,
      resolved_at: true,
      closed_at: true,
      plate_compact: true,
      rfid_uid: true,
      presence_active: true,
      review_required: true,
    },
  })

  const review = args.reviewId == null
    ? null
    : await tx.gate_manual_reviews.findUnique({
        where: { review_id: args.reviewId },
        select: {
          review_id: true,
          status: true,
          queue_reason_code: true,
          claimed_by_user_id: true,
          claimed_at: true,
          resolved_by_user_id: true,
          resolved_at: true,
          note: true,
          snapshot_json: true,
        },
      })

  return jsonSafe({
    session: session
      ? {
          sessionId: session.session_id,
          status: session.status,
          direction: session.direction,
          ticketId: session.ticket_id,
          laneId: session.lane_id,
          siteId: session.site_id,
          openedAt: session.opened_at,
          lastReadAt: session.last_read_at,
          resolvedAt: session.resolved_at,
          closedAt: session.closed_at,
          plateCompact: session.plate_compact,
          rfidUid: session.rfid_uid,
          presenceActive: session.presence_active,
          reviewRequired: session.review_required,
        }
      : null,
    review: review
      ? {
          reviewId: review.review_id,
          status: review.status,
          queueReasonCode: review.queue_reason_code,
          claimedByUserId: review.claimed_by_user_id,
          claimedAt: review.claimed_at,
          resolvedByUserId: review.resolved_by_user_id,
          resolvedAt: review.resolved_at,
          note: review.note,
        }
      : null,
  })
}

export async function ensureMutableSessionStatus(session: any) {
  const currentStatus = String(session.status)
  if (['PASSED', 'DENIED', 'TIMEOUT', 'CANCELLED', 'ERROR'].includes(currentStatus)) {
    throw new ApiError({
      code: 'CONFLICT',
      message: 'Session hiện tại không cho phép manual override',
      details: { currentStatus },
    })
  }
}

export async function ensureReviewRowTx(tx: any, args: {
  sessionId: bigint
  siteId: bigint
  laneId: bigint
  queueReasonCode: string
  note?: string | null
}) {
  const existing = await tx.gate_manual_reviews.findFirst({
    where: {
      session_id: args.sessionId,
      status: { in: ['OPEN', 'CLAIMED'] },
    },
    orderBy: [{ created_at: 'asc' }, { review_id: 'asc' }],
  })

  if (existing) return existing

  return tx.gate_manual_reviews.create({
    data: {
      session_id: args.sessionId,
      site_id: args.siteId,
      lane_id: args.laneId,
      status: 'OPEN',
      queue_reason_code: args.queueReasonCode,
      note: args.note ?? null,
    },
  })
}
