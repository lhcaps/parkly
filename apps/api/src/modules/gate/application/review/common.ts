import { ApiError } from '../../../../server/http'
import { buildAuditActorSnapshot, writeAuditLog } from '../../../../server/services/audit-service'
import { getAllowedActions, isTerminalSessionStatus, type SessionAllowedAction, type SessionStatus } from '../../domain/session'

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

function buildSessionConflictDetails(session: any, currentStatus: SessionStatus, requiredAction?: SessionAllowedAction) {
  return {
    currentStatus,
    requiredAction: requiredAction ?? null,
    allowedActions: getAllowedActions(currentStatus),
    sessionId: session?.session_id == null ? null : String(session.session_id),
  }
}

export async function ensureMutableSessionStatus(
  session: any,
  options?: { message?: string; requiredAction?: SessionAllowedAction },
) {
  const currentStatus = String(session.status ?? 'OPEN') as SessionStatus
  const details = buildSessionConflictDetails(session, currentStatus, options?.requiredAction)

  if (isTerminalSessionStatus(currentStatus)) {
    throw new ApiError({
      code: 'CONFLICT',
      message: options?.message ?? 'Session hiện tại không cho phép manual override',
      details,
    })
  }

  if (options?.requiredAction && !details.allowedActions.includes(options.requiredAction)) {
    throw new ApiError({
      code: 'CONFLICT',
      message: options.message ?? 'Session hiện tại không cho phép thao tác này',
      details,
    })
  }
}

function isSameClaimActor(review: any, effectiveActorUserId: bigint | null) {
  return effectiveActorUserId != null && review.claimed_by_user_id != null && BigInt(review.claimed_by_user_id) == effectiveActorUserId
}

export function ensureReviewMutationAllowed(review: any, args: {
  effectiveActorUserId: bigint | null
  operation: string
}) {
  const reviewStatus = String(review.status)

  if (reviewStatus === 'RESOLVED' || reviewStatus === 'CANCELLED') {
    throw new ApiError({
      code: 'CONFLICT',
      message: `Review đã kết thúc nên không thể ${args.operation}`,
      details: {
        reviewId: review.review_id == null ? null : String(review.review_id),
        status: reviewStatus,
      },
    })
  }

  if (reviewStatus === 'CLAIMED' && !isSameClaimActor(review, args.effectiveActorUserId)) {
    throw new ApiError({
      code: 'CONFLICT',
      message: `Review đang được người khác claim nên không thể ${args.operation}`,
      details: {
        reviewId: review.review_id == null ? null : String(review.review_id),
        status: reviewStatus,
        claimedByUserId: review.claimed_by_user_id == null ? null : String(review.claimed_by_user_id),
      },
    })
  }
}

export async function ensureReviewRowTx(tx: any, args: {
  sessionId: bigint
  siteId: bigint
  laneId: bigint
  queueReasonCode: string
  note?: string | null
  effectiveActorUserId?: bigint | null
  operation?: string
}) {
  const existing = await tx.gate_manual_reviews.findFirst({
    where: {
      session_id: args.sessionId,
      status: { in: ['OPEN', 'CLAIMED'] },
    },
    orderBy: [{ created_at: 'asc' }, { review_id: 'asc' }],
  })

  if (existing) {
    ensureReviewMutationAllowed(existing, {
      effectiveActorUserId: args.effectiveActorUserId ?? null,
      operation: args.operation ?? 'thao tác',
    })
    return existing
  }

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

export async function writeReviewAuditLog(args: {
  siteId: bigint | number | string
  reviewId: bigint | number | string
  sessionId: bigint | number | string
  action: string
  actor: ReviewActor
  beforeSnapshot?: unknown
  afterSnapshot?: unknown
  occurredAt: string | Date
}) {
  await writeAuditLog({
    siteId: String(args.siteId),
    actor: buildAuditActorSnapshot({
      principalType: args.actor.actorUserId == null ? 'SYSTEM' : 'USER',
      role: args.actor.role,
      actorUserId: args.actor.actorUserId == null ? null : args.actor.actorUserId.toString(),
      actorLabel: args.actor.actorLabel,
    }),
    actorUserId: args.actor.actorUserId == null ? null : args.actor.actorUserId.toString(),
    action: args.action,
    entityTable: 'gate_manual_reviews',
    entityId: String(args.reviewId),
    beforeSnapshot: {
      sessionId: String(args.sessionId),
      reviewId: String(args.reviewId),
      snapshot: args.beforeSnapshot ?? null,
    },
    afterSnapshot: {
      sessionId: String(args.sessionId),
      reviewId: String(args.reviewId),
      snapshot: args.afterSnapshot ?? null,
    },
    occurredAt: args.occurredAt,
  })
}
