import { buildPlateCanonical, evaluateGateDecision } from '@parkly/gate-core'

import { prisma } from '../../../lib/prisma'
import { resolvePaymentStatusForTicket, type PaymentResolution } from '../../../server/services/payment-status-resolver'
import { findActivePresenceByTicket, findActivePresenceConflicts } from '../../../server/services/presence-service'
import {
  findCredentialByRfid,
  resolveOpenTicketForDecision,
  resolveSubscriptionDecisionContext,
  type SubscriptionDecisionContext,
} from '../../../server/services/ticket-service'
import {
  buildCustomDecision,
  buildManualDecision,
  getDecisionThresholdsFromEnv,
  type ActivePresenceContext,
  type CredentialStatus,
  type DeviceHealth,
  type DeviceHealthSnapshot,
  type DecisionExplainableResult,
  type DecisionRuleOutput,
  type OpenTicketContext,
  type PaymentStatus,
} from '../domain/decision'
import type { SessionDirection } from './open-session'

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))
}

function envFlag(name: string, fallback = false) {
  const raw = String(process.env[name] ?? '').trim().toUpperCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'TRUE' || raw === 'YES' || raw === 'ON'
}

function extractRequestedSpotCode(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const record = payload as Record<string, unknown>
  for (const key of ['spotCode', 'assignedSpotCode', 'requestedSpotCode', 'parkingSpotCode']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim().toUpperCase()
  }
  return null
}

export type DecisionEngineEvalInput = {
  siteId: bigint
  laneId: bigint
  deviceId: bigint | null
  currentSessionId?: bigint | string | number | null
  currentLaneCode?: string | null
  direction: SessionDirection
  occurredAt: Date
  presenceActive: boolean
  plateRaw?: string | null
  plateCompact?: string | null
  plateValidity?: 'STRICT_VALID' | 'REVIEW' | 'INVALID' | 'UNKNOWN'
  ocrConfidence?: number | null
  rfidUid?: string | null
  payload?: unknown
}

export type DecisionEvidenceContext = {
  openTicket: OpenTicketContext
  paymentStatus: PaymentStatus
  paymentResolution: PaymentResolution | null
  deviceHealth: DeviceHealth
  deviceHealthSnapshot: DeviceHealthSnapshot
  activePresence: ActivePresenceContext
  credentialStatus: CredentialStatus
  plateTicketId: string | null
  rfidTicketId: string | null
  subscriptionMatch: SubscriptionDecisionContext
}

export type DecisionEngineEvalResult = DecisionExplainableResult & DecisionEvidenceContext

async function resolveActivePresenceContext(args: {
  siteId: bigint
  openTicketId?: string | null
  plateCompact?: string | null
  rfidUid?: string | null
  occurredAt: Date
  currentSessionId?: bigint | string | number | null
  currentLaneCode?: string | null
}): Promise<ActivePresenceContext> {
  const thresholds = getDecisionThresholdsFromEnv()
  const currentSessionId = args.currentSessionId == null ? null : String(args.currentSessionId)
  const currentLaneCode = String(args.currentLaneCode ?? '').trim().toUpperCase() || null
  const conflicts = await findActivePresenceConflicts({
    siteId: args.siteId,
    ticketId: args.openTicketId ?? null,
    plateCompact: args.plateCompact ?? null,
    rfidUid: args.rfidUid ?? null,
  })

  const filtered = conflicts.filter((conflict) => {
    if (currentSessionId && conflict.sessionId === currentSessionId) return false

    const lastSeenAt = new Date(conflict.lastSeenAt)
    const ageSeconds = Math.max(0, Math.trunc((args.occurredAt.getTime() - lastSeenAt.getTime()) / 1000))
    if (ageSeconds > thresholds.antiPassbackStaleSeconds) return false

    const conflictLaneCode = String(conflict.entryLaneCode ?? '').trim().toUpperCase() || null
    if (
      currentLaneCode &&
      conflictLaneCode &&
      currentLaneCode === conflictLaneCode &&
      ageSeconds <= thresholds.antiPassbackSameLaneDebounceSeconds
    ) {
      return false
    }

    return true
  })

  return filtered[0] ?? null
}

async function resolveCredentialStatus(args: { siteId: bigint; rfidUid?: string | null }): Promise<CredentialStatus> {
  const credential = await findCredentialByRfid({ siteId: args.siteId, rfidUid: args.rfidUid })
  if (!credential) return 'UNKNOWN'
  return credential.status
}

async function resolvePaymentContext(args: {
  ticketId?: string | null
  direction: SessionDirection
  occurredAt: Date
}): Promise<{ paymentStatus: PaymentStatus; paymentResolution: PaymentResolution | null }> {
  if (args.direction === 'ENTRY') return { paymentStatus: 'NOT_APPLICABLE', paymentResolution: null }
  if (!args.ticketId) return { paymentStatus: 'NOT_APPLICABLE', paymentResolution: null }

  const paymentResolution = await resolvePaymentStatusForTicket({
    ticketId: BigInt(args.ticketId),
    occurredAt: args.occurredAt,
  })

  return {
    paymentStatus: paymentResolution.paymentStatus,
    paymentResolution,
  }
}

async function resolveDeviceHealth(args: {
  siteId: bigint
  deviceId: bigint | null
  occurredAt: Date
}): Promise<{ health: DeviceHealth; snapshot: DeviceHealthSnapshot }> {
  const thresholds = getDecisionThresholdsFromEnv()

  if (args.deviceId == null) {
    return {
      health: 'UNKNOWN',
      snapshot: {
        status: null,
        reportedAt: null,
        ageSeconds: null,
        health: 'UNKNOWN',
      },
    }
  }

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT status, reported_at AS reportedAt
      FROM device_heartbeats
      WHERE site_id = ?
        AND device_id = ?
      ORDER BY reported_at DESC, heartbeat_id DESC
      LIMIT 1
    `,
    String(args.siteId),
    String(args.deviceId),
  )

  const row = rows[0]
  if (!row?.reportedAt) {
    return {
      health: 'UNKNOWN',
      snapshot: {
        status: row?.status == null ? null : String(row.status),
        reportedAt: null,
        ageSeconds: null,
        health: 'UNKNOWN',
      },
    }
  }

  const reportedAt = new Date(String(row.reportedAt))
  const ageSeconds = Math.max(0, Math.trunc((args.occurredAt.getTime() - reportedAt.getTime()) / 1000))
  const rawStatus = String(row.status ?? '').toUpperCase()

  let health: DeviceHealth = 'HEALTHY'
  if (rawStatus === 'OFFLINE' || ageSeconds > thresholds.offlineHeartbeatAgeSeconds) {
    health = 'OFFLINE'
  } else if (rawStatus === 'DEGRADED' || ageSeconds > thresholds.degradedHeartbeatAgeSeconds) {
    health = 'DEGRADED'
  } else if (!rawStatus || rawStatus === 'UNKNOWN') {
    health = 'UNKNOWN'
  }

  return {
    health,
    snapshot: {
      status: rawStatus || null,
      reportedAt: reportedAt.toISOString(),
      ageSeconds,
      health,
    },
  }
}

export function applySubscriptionDecisionOverride(args: {
  direction: SessionDirection
  baseDecision: DecisionRuleOutput
  paymentStatus: PaymentStatus
  presenceActive: boolean
  openTicketId?: string | null
  exitPresenceTicketId?: string | null
  subscriptionMatch: SubscriptionDecisionContext
}) {
  const subscriptionMatch = args.subscriptionMatch
  if (!subscriptionMatch?.lookupEnabled) return args.baseDecision

  if (args.direction === 'ENTRY') {
    if (subscriptionMatch.reviewRequired && args.baseDecision.recommendedAction === 'APPROVE') {
      return buildCustomDecision({
        decisionCode: 'SUBSCRIPTION_REVIEW_REQUIRED',
        recommendedAction: 'REVIEW',
        reasonCode: 'SUBSCRIPTION_REVIEW_REQUIRED',
        reasonDetail: subscriptionMatch.reasonDetail,
      })
    }

    if (subscriptionMatch.eligibleEntry && args.baseDecision.recommendedAction === 'APPROVE') {
      return buildCustomDecision({
        decisionCode: 'SUBSCRIPTION_AUTO_APPROVED',
        recommendedAction: 'APPROVE',
        reasonCode: 'SUBSCRIPTION_AUTO_APPROVED',
        reasonDetail: subscriptionMatch.reasonDetail,
      })
    }

    return args.baseDecision
  }

  const exitPresenceValid = Boolean(args.openTicketId && args.exitPresenceTicketId && args.openTicketId === args.exitPresenceTicketId)
  const canBypassExitPayment = subscriptionMatch.eligibleExit
    && args.presenceActive
    && exitPresenceValid
    && (
      args.baseDecision.recommendedAction === 'PAYMENT_HOLD'
      || (args.baseDecision.recommendedAction === 'APPROVE' && args.paymentStatus === 'SUBSCRIPTION_COVERED')
    )

  if (subscriptionMatch.reviewRequired && (args.baseDecision.recommendedAction === 'APPROVE' || args.baseDecision.recommendedAction === 'PAYMENT_HOLD')) {
    return buildCustomDecision({
      decisionCode: 'SUBSCRIPTION_REVIEW_REQUIRED',
      recommendedAction: 'REVIEW',
      reasonCode: 'SUBSCRIPTION_REVIEW_REQUIRED',
      reasonDetail: subscriptionMatch.reasonDetail,
    })
  }

  if (canBypassExitPayment) {
    return buildCustomDecision({
      decisionCode: 'SUBSCRIPTION_EXIT_BYPASS_PAYMENT',
      recommendedAction: 'APPROVE',
      reasonCode: 'SUBSCRIPTION_EXIT_BYPASS_PAYMENT',
      reasonDetail: subscriptionMatch.reasonDetail,
    })
  }

  return args.baseDecision
}

export async function evaluateSessionDecision(args: DecisionEngineEvalInput): Promise<DecisionEngineEvalResult> {
  const thresholds = getDecisionThresholdsFromEnv()
  const enableSubscriptions = envFlag('DECISION_ENABLE_SUBSCRIPTIONS', false)
  const requestedSpotCode = extractRequestedSpotCode(args.payload)

  const openTicketContext = await resolveOpenTicketForDecision({
    siteId: args.siteId,
    direction: args.direction,
    plateCompact: args.plateCompact,
    rfidUid: args.rfidUid,
  })
  const { paymentStatus, paymentResolution } = await resolvePaymentContext({
    ticketId: openTicketContext.openTicket?.ticketId ?? null,
    direction: args.direction,
    occurredAt: args.occurredAt,
  })
  const deviceHealth = await resolveDeviceHealth({
    siteId: args.siteId,
    deviceId: args.deviceId,
    occurredAt: args.occurredAt,
  })
  const activePresence = await resolveActivePresenceContext({
    siteId: args.siteId,
    openTicketId: openTicketContext.openTicket?.ticketId ?? null,
    plateCompact: args.plateCompact ?? null,
    rfidUid: args.rfidUid ?? null,
    occurredAt: args.occurredAt,
    currentSessionId: args.currentSessionId ?? null,
    currentLaneCode: args.currentLaneCode ?? null,
  })
  const credentialStatus = await resolveCredentialStatus({
    siteId: args.siteId,
    rfidUid: args.rfidUid,
  })

  const [subscriptionMatch, exitPresence] = await Promise.all([
    enableSubscriptions
      ? resolveSubscriptionDecisionContext({
          siteId: args.siteId,
          occurredAt: args.occurredAt,
          plateCompact: args.plateCompact ?? null,
          rfidUid: args.rfidUid ?? null,
          requestedSpotCode,
        })
      : Promise.resolve(null),
    args.direction === 'EXIT' && openTicketContext.openTicket?.ticketId
      ? findActivePresenceByTicket({ siteId: args.siteId, ticketId: openTicketContext.openTicket.ticketId })
      : Promise.resolve(null),
  ])

  const rawOutput = evaluateGateDecision(
    {
      plateValidity: args.plateValidity ?? 'UNKNOWN',
      ocrConfidence: args.ocrConfidence ?? null,
      rfidUid: args.rfidUid?.trim() || null,
      laneDirection: args.direction,
      presenceActive: args.presenceActive,
      openTicket: openTicketContext.openTicket,
      activePresence,
      paymentStatus,
      deviceHealth: deviceHealth.health,
      credentialStatus,
      plateTicketId: openTicketContext.plateTicketId,
      rfidTicketId: openTicketContext.rfidTicketId,
    },
    thresholds,
  )

  const softenedAntiPassback = rawOutput.decisionCode === 'ANTI_PASSBACK_BLOCKED'
    && ((args.plateValidity ?? 'UNKNOWN') !== 'STRICT_VALID' || (args.ocrConfidence ?? 0) < thresholds.ocrApproveMin)
      ? buildManualDecision({
          recommendedAction: 'REVIEW',
          reasonCode: 'ANTI_PASSBACK_REVIEW_REQUIRED',
          reasonDetail: 'ALPR chưa đủ chắc để hard deny anti-passback. Session được đẩy sang review để operator xác nhận.',
        })
      : rawOutput

  const output = applySubscriptionDecisionOverride({
    direction: args.direction,
    baseDecision: softenedAntiPassback,
    paymentStatus,
    presenceActive: args.presenceActive,
    openTicketId: openTicketContext.openTicket?.ticketId ?? null,
    exitPresenceTicketId: exitPresence?.ticketId ?? null,
    subscriptionMatch,
  })

  const plate = buildPlateCanonical(args.plateRaw ?? args.plateCompact ?? null)

  return {
    ...output,
    finalAction: output.recommendedAction,
    explanation: output.reasonDetail,
    inputSnapshot: jsonSafe({
      plateValidity: args.plateValidity ?? 'UNKNOWN',
      plateRaw: args.plateRaw ?? null,
      plateCompact: args.plateCompact ?? null,
      plateFamily: plate.plateFamily,
      ocrConfidence: args.ocrConfidence ?? null,
      rfidUid: args.rfidUid?.trim() || null,
      laneDirection: args.direction,
      currentSessionId: args.currentSessionId == null ? null : String(args.currentSessionId),
      currentLaneCode: args.currentLaneCode ?? null,
      presenceActive: args.presenceActive,
      openTicket: openTicketContext.openTicket,
      openTicketSelection: {
        selectedBy: openTicketContext.selectedBy,
        mismatch: openTicketContext.mismatch,
        plateTicketId: openTicketContext.plateTicketId,
        rfidTicketId: openTicketContext.rfidTicketId,
      },
      paymentStatus,
      paymentResolution,
      deviceHealth: deviceHealth.health,
      deviceHealthSnapshot: deviceHealth.snapshot,
      activePresence,
      credentialStatus,
      plateTicketId: openTicketContext.plateTicketId,
      rfidTicketId: openTicketContext.rfidTicketId,
      requestedSpotCode,
      subscriptionMatch,
      exitPresence,
    }),
    thresholdSnapshot: jsonSafe({
      ocrApproveMin: thresholds.ocrApproveMin,
      ocrReviewMin: thresholds.ocrReviewMin,
      degradedHeartbeatAgeSeconds: thresholds.degradedHeartbeatAgeSeconds,
      offlineHeartbeatAgeSeconds: thresholds.offlineHeartbeatAgeSeconds,
      antiPassbackStaleSeconds: thresholds.antiPassbackStaleSeconds,
      antiPassbackSameLaneDebounceSeconds: thresholds.antiPassbackSameLaneDebounceSeconds,
      decisionEnableSubscriptions: enableSubscriptions,
      engineVersion: 'PR09_SUBSCRIPTION_V1',
    }),
    openTicket: openTicketContext.openTicket,
    paymentStatus,
    paymentResolution,
    deviceHealth: deviceHealth.health,
    deviceHealthSnapshot: deviceHealth.snapshot,
    activePresence,
    credentialStatus,
    plateTicketId: openTicketContext.plateTicketId,
    rfidTicketId: openTicketContext.rfidTicketId,
    subscriptionMatch,
  }
}

export function buildManualApproveDecision(reasonCode?: string, reasonDetail?: string) {
  return buildManualDecision({
    recommendedAction: 'APPROVE',
    reasonCode: reasonCode?.trim() || 'MANUAL_APPROVE',
    reasonDetail: reasonDetail?.trim() || 'Operator đã approve thủ công từ session UI.',
  })
}

export function buildManualDenyDecision(reasonCode?: string, reasonDetail?: string) {
  return buildManualDecision({
    recommendedAction: 'DENY',
    reasonCode: reasonCode?.trim() || 'MANUAL_DENY',
    reasonDetail: reasonDetail?.trim() || 'Operator đã deny thủ công từ session UI.',
  })
}

export function buildManualPaymentHoldDecision(reasonCode?: string, reasonDetail?: string) {
  return buildManualDecision({
    recommendedAction: 'PAYMENT_HOLD',
    reasonCode: reasonCode?.trim() || 'MANUAL_PAYMENT_HOLD',
    reasonDetail: reasonDetail?.trim() || 'Operator đã giữ session ở WAITING_PAYMENT.',
  })
}
