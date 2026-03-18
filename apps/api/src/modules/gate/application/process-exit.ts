import { prisma } from '../../../lib/prisma'
import { ApiError } from '../../../server/http'
import { clearActivePresenceTx } from '../../../server/services/presence-service'
import { touchCredentialDirectionTx } from '../../../server/services/ticket-service'
import type { DecisionEngineEvalResult } from './decision-engine'
import { ensureBarrierOpenCommandTx, resolveBarrierDeviceIdTx } from './process-entry'
import type { Tx } from '../../../server/services/with-actor'

export type ProcessExitApprovalInput = {
  tx: Tx
  siteId: bigint
  laneId: bigint
  laneCode: string
  primaryDeviceId?: bigint | null
  sessionId: bigint
  occurredAt: Date
  requestId?: string
  decision: DecisionEngineEvalResult | null
  plateCompact?: string | null
  rfidUid?: string | null
  readEventId?: bigint | null
  payload?: unknown
}

export async function processApprovedExitTx(input: ProcessExitApprovalInput) {
  if (!input.decision || input.decision.finalAction !== 'APPROVE') {
    return { changed: false, reason: 'NOT_APPROVED' as const }
  }

  const ticketIdRaw = input.decision.openTicket?.ticketId ?? null
  if (!ticketIdRaw) {
    return { changed: false, reason: 'NO_OPEN_TICKET' as const }
  }

  const ticketId = BigInt(ticketIdRaw)
  const barrierDeviceId = await resolveBarrierDeviceIdTx(input.tx, {
    laneId: input.laneId,
    primaryDeviceId: input.primaryDeviceId,
  })

  await ensureBarrierOpenCommandTx(input.tx, {
    sessionId: input.sessionId,
    siteId: input.siteId,
    laneId: input.laneId,
    barrierDeviceId,
    occurredAt: input.occurredAt,
    requestId: input.requestId,
    reasonCode: input.decision.reasonCode === 'SUBSCRIPTION_EXIT_BYPASS_PAYMENT' ? 'EXIT_SUBSCRIPTION_BYPASS_PAYMENT' : 'EXIT_APPROVED',
    payload: {
      source: 'PR08_EXIT_FLOW',
      ticketId: String(ticketId),
      ticketCode: input.decision.openTicket?.ticketCode ?? null,
      matchedBy: input.decision.openTicket?.matchedBy ?? null,
      paymentStatus: input.decision.paymentStatus,
      decisionCode: input.decision.decisionCode,
      reasonCode: input.decision.reasonCode,
      subscriptionMatch: input.decision.subscriptionMatch ?? null,
      evidenceReadEventId: input.readEventId == null ? null : String(input.readEventId),
      payload: input.payload ?? null,
    },
  })

  await input.tx.tickets.updateMany({
    where: {
      ticket_id: ticketId,
      status: 'OPEN',
    },
    data: {
      status: 'CLOSED',
      exit_time: input.occurredAt,
    },
  })

  await clearActivePresenceTx(input.tx, {
    siteId: input.siteId,
    ticketId,
    plateCompact: input.plateCompact ?? null,
    rfidUid: input.rfidUid ?? null,
    occurredAt: input.occurredAt,
    nextStatus: 'EXITED',
  })

  await input.tx.gate_passage_sessions.update({
    where: { session_id: input.sessionId },
    data: {
      status: 'PASSED',
      ticket_id: ticketId,
      presence_active: false,
      review_required: false,
      resolved_at: input.occurredAt,
      closed_at: input.occurredAt,
      updated_at: input.occurredAt,
    },
  })

  await touchCredentialDirectionTx(input.tx, {
    siteId: input.siteId,
    rfidUid: input.rfidUid,
    direction: 'EXIT',
    occurredAt: input.occurredAt,
  })

  return {
    changed: true,
    ticketId,
    barrierDeviceId,
  }
}

export async function assertExitDirection(direction: 'ENTRY' | 'EXIT') {
  if (direction !== 'EXIT') {
    throw new ApiError({ code: 'BAD_REQUEST', message: 'process-exit chỉ áp dụng cho lane EXIT' })
  }
}

export async function processLegacyExitGateEvent(input: {
  siteCode: string
  laneCode: string
  deviceCode?: string
  occurredAt: Date
  plateRaw?: string | null
  ocrConfidence?: number | null
  rfidUid?: string | null
  requestId: string
  idempotencyKey: string
  payload?: unknown
}) {
  const { openOrReuseSessionAndResolve } = await import('./resolve-session')

  return openOrReuseSessionAndResolve({
    siteCode: input.siteCode,
    laneCode: input.laneCode,
    direction: 'EXIT',
    occurredAt: input.occurredAt,
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
    deviceCode: input.deviceCode,
    readType: input.rfidUid ? 'RFID' : input.plateRaw ? 'ALPR' : 'SENSOR',
    sensorState: input.rfidUid || input.plateRaw ? undefined : 'PRESENT',
    presenceActive: true,
    plateRaw: input.plateRaw ?? undefined,
    ocrConfidence: input.ocrConfidence ?? undefined,
    rfidUid: input.rfidUid ?? undefined,
    payload: {
      legacyEventAdapter: true,
      ...(input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
        ? (input.payload as Record<string, unknown>)
        : { rawPayload: input.payload ?? null }),
    },
  })
}
