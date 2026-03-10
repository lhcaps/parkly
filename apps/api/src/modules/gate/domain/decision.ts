import {
  DEFAULT_GATE_DECISION_THRESHOLDS,
  normalizeGateDecisionThresholds,
  type GateActivePresenceContext,
  type GateCredentialStatus,
  type GateDecisionCode,
  type GateDecisionMatchedBy,
  type GateDecisionRuleInput,
  type GateDecisionRuleOutput,
  type GateDecisionThresholds,
  type GateDeviceHealth,
  type GateOpenTicketContext,
  type GatePaymentStatus,
  type GateRecommendedAction,
} from '@parkly/gate-core'

export type DecisionCode = GateDecisionCode
export type RecommendedAction = GateRecommendedAction
export type DeviceHealth = GateDeviceHealth
export type PaymentStatus = GatePaymentStatus
export type DecisionThresholds = GateDecisionThresholds
export type DecisionRuleInput = GateDecisionRuleInput
export type DecisionRuleOutput = GateDecisionRuleOutput
export type OpenTicketContext = GateOpenTicketContext
export type DecisionMatchedBy = GateDecisionMatchedBy
export type CredentialStatus = GateCredentialStatus
export type ActivePresenceContext = GateActivePresenceContext

export type DeviceHealthSnapshot = {
  status: string | null
  reportedAt: string | null
  ageSeconds: number | null
  health: DeviceHealth
}

export type DecisionExplainableResult = DecisionRuleOutput & {
  finalAction: RecommendedAction
  explanation: string
  inputSnapshot: Record<string, unknown>
  thresholdSnapshot: Record<string, unknown>
}

function envNumber(name: string, fallback: number) {
  const raw = Number(process.env[name] ?? fallback)
  return Number.isFinite(raw) ? raw : fallback
}

export function getDecisionThresholdsFromEnv(): DecisionThresholds & {
  antiPassbackStaleSeconds: number
  antiPassbackSameLaneDebounceSeconds: number
} {
  return {
    ...normalizeGateDecisionThresholds({
      ocrApproveMin: envNumber('GATE_DECISION_OCR_APPROVE_THRESHOLD', DEFAULT_GATE_DECISION_THRESHOLDS.ocrApproveMin),
      ocrReviewMin: envNumber('GATE_DECISION_OCR_REVIEW_THRESHOLD', DEFAULT_GATE_DECISION_THRESHOLDS.ocrReviewMin),
      degradedHeartbeatAgeSeconds: envNumber(
        'GATE_DECISION_DEVICE_DEGRADED_THRESHOLD_SECONDS',
        DEFAULT_GATE_DECISION_THRESHOLDS.degradedHeartbeatAgeSeconds,
      ),
      offlineHeartbeatAgeSeconds: envNumber(
        'GATE_DECISION_DEVICE_OFFLINE_THRESHOLD_SECONDS',
        DEFAULT_GATE_DECISION_THRESHOLDS.offlineHeartbeatAgeSeconds,
      ),
    }),
    antiPassbackStaleSeconds: envNumber('GATE_DECISION_ANTI_PASSBACK_STALE_SECONDS', 15 * 60),
    antiPassbackSameLaneDebounceSeconds: envNumber('GATE_DECISION_ANTI_PASSBACK_SAME_LANE_DEBOUNCE_SECONDS', 8),
  }
}

export function buildManualDecision(args: {
  recommendedAction: RecommendedAction
  reasonCode: string
  reasonDetail: string
}): DecisionExplainableResult {
  const decisionCode: DecisionCode =
    args.recommendedAction === 'APPROVE'
      ? 'AUTO_APPROVED'
      : args.recommendedAction === 'DENY'
        ? 'AUTO_DENIED'
        : args.recommendedAction === 'PAYMENT_HOLD'
          ? 'PAYMENT_REQUIRED'
          : 'REVIEW_REQUIRED'

  return {
    decisionCode,
    recommendedAction: args.recommendedAction,
    finalAction: args.recommendedAction,
    reasonCode: args.reasonCode,
    reasonDetail: args.reasonDetail,
    reviewRequired: args.recommendedAction === 'REVIEW',
    explanation: args.reasonDetail,
    inputSnapshot: {
      source: 'MANUAL_OVERRIDE',
      recommendedAction: args.recommendedAction,
    },
    thresholdSnapshot: {
      source: 'MANUAL_OVERRIDE',
    },
  }
}
