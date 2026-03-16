import { ApiError } from '../../../server/http'
import { createOrGetEntryTicketTx, touchCredentialDirectionTx } from '../../../server/services/ticket-service'
import { clearActivePresenceTx, upsertActivePresenceTx } from '../../../server/services/presence-service'
import type { DecisionEngineEvalResult } from './decision-engine'

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))
}

export async function resolveBarrierDeviceIdTx(tx: any, args: {
  laneId: bigint
  primaryDeviceId?: bigint | null
}) {
  const rows = (await tx.$queryRawUnsafe(
    `
      SELECT gld.device_id AS deviceId
      FROM gate_lane_devices gld
      WHERE gld.lane_id = ?
        AND gld.device_role = 'BARRIER'
      ORDER BY gld.is_primary DESC, gld.sort_order ASC, gld.lane_device_id ASC
      LIMIT 1
    `,
    String(args.laneId),
  )) as Array<Record<string, unknown>>

  if (rows[0]?.deviceId != null) return BigInt(rows[0].deviceId as any)
  return args.primaryDeviceId ?? null
}

export async function ensureBarrierOpenCommandTx(tx: any, args: {
  sessionId: bigint
  siteId: bigint
  laneId: bigint
  barrierDeviceId: bigint | null
  occurredAt: Date
  requestId?: string
  reasonCode: string
  payload?: unknown
}) {
  const existing = await tx.gate_barrier_commands.findFirst({
    where: {
      session_id: args.sessionId,
      command_type: 'OPEN',
      reason_code: args.reasonCode,
    },
    orderBy: [{ command_id: 'desc' }],
    select: { command_id: true },
  })

  if (existing?.command_id != null) return { commandId: BigInt(existing.command_id), created: false }

  const created = await tx.gate_barrier_commands.create({
    data: {
      session_id: args.sessionId,
      site_id: args.siteId,
      lane_id: args.laneId,
      device_id: args.barrierDeviceId,
      command_type: 'OPEN',
      status: 'ACKED',
      request_id: args.requestId ?? null,
      reason_code: args.reasonCode,
      payload_json: jsonSafe(args.payload),
      issued_at: args.occurredAt,
      ack_at: args.occurredAt,
    },
    select: { command_id: true },
  })

  return { commandId: BigInt(created.command_id), created: true }
}

export type ProcessEntryApprovalInput = {
  tx: any
  siteId: bigint
  siteCode: string
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

export async function processApprovedEntryTx(input: ProcessEntryApprovalInput) {
  if (!input.decision || input.decision.finalAction !== 'APPROVE') {
    return { changed: false, reason: 'NOT_APPROVED' as const }
  }

  const barrierDeviceId = await resolveBarrierDeviceIdTx(input.tx, {
    laneId: input.laneId,
    primaryDeviceId: input.primaryDeviceId,
  })

  const ticket = await createOrGetEntryTicketTx(input.tx, {
    siteId: input.siteId,
    siteCode: input.siteCode,
    sessionId: input.sessionId,
    occurredAt: input.occurredAt,
    plateCompact: input.plateCompact,
    rfidUid: input.rfidUid,
  })

  await upsertActivePresenceTx(input.tx, {
    siteId: input.siteId,
    sessionId: input.sessionId,
    ticketId: ticket.ticketId,
    plateCompact: input.plateCompact,
    rfidUid: input.rfidUid,
    entryLaneCode: input.laneCode,
    occurredAt: input.occurredAt,
    evidenceReadEventId: input.readEventId ?? null,
  })

  await ensureBarrierOpenCommandTx(input.tx, {
    sessionId: input.sessionId,
    siteId: input.siteId,
    laneId: input.laneId,
    barrierDeviceId,
    occurredAt: input.occurredAt,
    requestId: input.requestId,
    reasonCode: input.decision.reasonCode === 'SUBSCRIPTION_AUTO_APPROVED' ? 'ENTRY_SUBSCRIPTION_APPROVED' : 'ENTRY_APPROVED',
    payload: {
      source: 'PR07_ENTRY_FLOW',
      ticketId: String(ticket.ticketId),
      ticketCode: ticket.ticketCode,
      decisionCode: input.decision.decisionCode,
      reasonCode: input.decision.reasonCode,
      subscriptionMatch: input.decision.subscriptionMatch ?? null,
      payload: input.payload ?? null,
    },
  })

  await input.tx.gate_passage_sessions.update({
    where: { session_id: input.sessionId },
    data: {
      ticket_id: ticket.ticketId,
      presence_active: true,
      updated_at: input.occurredAt,
    },
  })

  await touchCredentialDirectionTx(input.tx, {
    siteId: input.siteId,
    rfidUid: input.rfidUid,
    direction: 'ENTRY',
    occurredAt: input.occurredAt,
  })

  return {
    changed: true,
    ticketId: ticket.ticketId,
    ticketCode: ticket.ticketCode,
    barrierDeviceId,
  }
}

export async function markExitPassEffectsTx(tx: any, args: {
  siteId: bigint
  sessionId: bigint
  ticketId?: bigint | null
  plateCompact?: string | null
  rfidUid?: string | null
  occurredAt: Date
}) {
  await clearActivePresenceTx(tx, {
    siteId: args.siteId,
    ticketId: args.ticketId ?? null,
    plateCompact: args.plateCompact ?? null,
    rfidUid: args.rfidUid ?? null,
    occurredAt: args.occurredAt,
    nextStatus: 'EXITED',
  })

  if (args.ticketId != null) {
    await tx.tickets.updateMany({
      where: {
        ticket_id: args.ticketId,
        status: 'OPEN',
      },
      data: {
        status: 'CLOSED',
        exit_time: args.occurredAt,
      },
    })
  }

  await touchCredentialDirectionTx(tx, {
    siteId: args.siteId,
    rfidUid: args.rfidUid,
    direction: 'EXIT',
    occurredAt: args.occurredAt,
  })
}

export async function assertEntryDirection(direction: 'ENTRY' | 'EXIT') {
  if (direction !== 'ENTRY') {
    throw new ApiError({ code: 'BAD_REQUEST', message: 'process-entry chỉ áp dụng cho lane ENTRY' })
  }
}

export async function processLegacyEntryGateEvent(input: {
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
    direction: 'ENTRY',
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
        ? input.payload as Record<string, unknown>
        : { rawPayload: input.payload ?? null }),
    },
  })
}
