import { ApiError } from '../../../../server/http'
import { withAuditActor } from '../../../../server/services/with-actor'
import { ensureSessionTransition } from '../../domain/session'
import { buildManualApproveDecision } from '../decision-engine'
import { getSessionSummary } from '../open-session'
import { ensureBarrierOpenCommandTx, resolveBarrierDeviceIdTx } from '../process-entry'
import { appendAuditTrail, auditActorSnapshot, captureSessionReviewSnapshotTx, ensureMutableSessionStatus, ensureReviewRowTx, jsonSafe, resolveExistingActorUserIdTx, toBigIntId, writeReviewAuditLog, type ReviewActor } from './common'

export async function manualOpenBarrierForSession(args: {
  sessionId: string | number | bigint
  occurredAt?: Date
  reasonCode: string
  note: string
  actor: ReviewActor
}) {
  const sessionId = toBigIntId(args.sessionId, 'sessionId')
  const occurredAt = args.occurredAt ?? new Date()

  const result = await withAuditActor(args.actor.actorUserId, async (tx) => {
    const effectiveActorUserId = await resolveExistingActorUserIdTx(tx, args.actor.actorUserId)

    const session = await tx.gate_passage_sessions.findUnique({ where: { session_id: sessionId } })
    if (!session) throw new ApiError({ code: 'NOT_FOUND', message: `Không tìm thấy session ${String(sessionId)}` })

    await ensureMutableSessionStatus(session, {
      message: 'Session hiện tại không cho phép manual open barrier',
      requiredAction: 'APPROVE',
    })
    ensureSessionTransition(String(session.status) as any, 'APPROVED')

    const lane = await tx.gate_lanes.findUnique({ where: { lane_id: session.lane_id } })
    if (!lane) throw new ApiError({ code: 'NOT_FOUND', message: 'Không resolve được lane cho session' })

    const review = await ensureReviewRowTx(tx, {
      sessionId,
      siteId: session.site_id,
      laneId: session.lane_id,
      queueReasonCode: args.reasonCode.trim(),
      note: args.note.trim(),
      effectiveActorUserId,
      operation: 'manual open barrier',
    })

    const beforeSnapshot = await captureSessionReviewSnapshotTx(tx, { sessionId, reviewId: BigInt(review.review_id) })
    const decision = buildManualApproveDecision(args.reasonCode, args.note)
    const barrierDeviceId = await resolveBarrierDeviceIdTx(tx, {
      laneId: session.lane_id,
      primaryDeviceId: lane.primary_device_id,
    })

    await tx.gate_passage_sessions.update({
      where: { session_id: sessionId },
      data: {
        status: 'APPROVED',
        review_required: false,
        last_read_at: occurredAt,
        resolved_at: occurredAt,
        updated_at: occurredAt,
      },
    })

    await tx.gate_decisions.create({
      data: {
        session_id: sessionId,
        site_id: session.site_id,
        lane_id: session.lane_id,
        decision_code: decision.decisionCode,
        final_action: decision.finalAction,
        reason_code: args.reasonCode.trim(),
        reason_detail: args.note.trim(),
        input_snapshot_json: jsonSafe({
          ...decision.inputSnapshot,
          source: 'PR10_MANUAL_OPEN_BARRIER',
          actor: auditActorSnapshot(args.actor),
          beforeSnapshot,
        }),
        threshold_snapshot_json: jsonSafe({
          ...decision.thresholdSnapshot,
          source: 'PR10_MANUAL_OPEN_BARRIER',
        }),
      },
    })

    await ensureBarrierOpenCommandTx(tx, {
      sessionId,
      siteId: session.site_id,
      laneId: session.lane_id,
      barrierDeviceId,
      occurredAt,
      requestId: `manual-barrier:${sessionId.toString()}`,
      reasonCode: args.reasonCode.trim(),
      payload: {
        source: 'PR10_MANUAL_OPEN_BARRIER',
        actor: auditActorSnapshot(args.actor),
        note: args.note.trim(),
      },
    })

    const afterSnapshot = await captureSessionReviewSnapshotTx(tx, { sessionId, reviewId: BigInt(review.review_id) })
    const completeAuditEntry = {
      type: 'MANUAL_OPEN_BARRIER',
      at: occurredAt.toISOString(),
      reasonCode: args.reasonCode.trim(),
      note: args.note.trim(),
      actor: auditActorSnapshot(args.actor),
      beforeSnapshot,
      afterSnapshot,
    }

    await tx.gate_manual_reviews.update({
      where: { review_id: review.review_id },
      data: {
        status: 'RESOLVED',
        resolved_by_user_id: effectiveActorUserId,
        resolved_at: occurredAt,
        note: args.note.trim(),
        snapshot_json: appendAuditTrail(review.snapshot_json, completeAuditEntry),
      },
    })

    await tx.gate_incidents.create({
      data: {
        session_id: sessionId,
        site_id: session.site_id,
        lane_id: session.lane_id,
        device_id: barrierDeviceId,
        severity: 'INFO',
        status: 'ACKED',
        incident_type: 'MANUAL_OPEN_BARRIER',
        title: args.reasonCode.trim(),
        detail: args.note.trim(),
        snapshot_json: jsonSafe(completeAuditEntry),
        resolved_at: occurredAt,
      },
    })

    return {
      data: {
        session: await getSessionSummary(sessionId),
        reviewId: String(review.review_id),
        changed: true,
      },
      audit: {
        siteId: session.site_id,
        reviewId: review.review_id,
        sessionId,
        beforeSnapshot,
        afterSnapshot,
      },
    }
  })

  await writeReviewAuditLog({
    siteId: result.audit.siteId,
    reviewId: result.audit.reviewId,
    sessionId: result.audit.sessionId,
    action: 'GATE_REVIEW_MANUAL_OPEN_BARRIER',
    actor: args.actor,
    beforeSnapshot: result.audit.beforeSnapshot,
    afterSnapshot: result.audit.afterSnapshot,
    occurredAt,
  })

  return result.data
}
