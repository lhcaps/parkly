import type { ReviewQueueAction, ReviewQueueItem } from '@/lib/contracts/reviews'
import type { SessionDetail } from '@/lib/contracts/sessions'
import type { OperatorRole } from '@/features/manual-control/session-action-access'
import { canRunReviewWorkspaceAction } from '@/features/manual-control/session-action-access'

export type ReviewReasonProfile = {
  title: string
  summary: string
  operatorHint: string
  tone: 'warning' | 'error' | 'info'
}

const REVIEW_REASON_PROFILES: Array<{ test: (code: string) => boolean; profile: ReviewReasonProfile }> = [
  {
    test: (code) => code === 'SUBSCRIPTION_REVIEW_REQUIRED',
    profile: {
      title: 'Subscription blocked from fast-path',
      summary: 'Session has a subscription but the engine blocked auto-approve — manual confirmation required.',
      operatorHint: 'Cross-check plate, lane, and subscription status before approving or holding the barrier.',
      tone: 'warning',
    },
  },
  {
    test: (code) => code === 'ANTI_PASSBACK_REVIEW_REQUIRED',
    profile: {
      title: 'Anti-passback triggered review',
      summary: 'System detected possible ticket reuse, wrong direction, or mismatched entry/exit loop.',
      operatorHint: 'Review the most recent session timeline and only open the barrier after verifying the situation.',
      tone: 'error',
    },
  },
  {
    test: (code) => code.includes('PAYMENT') || code.includes('UNPAID'),
    profile: {
      title: 'Payment hold',
      summary: 'Current decision is holding the vehicle — payment or fee reconciliation is pending.',
      operatorHint: 'Confirm payment collected, or escalate to payment hold rather than opening the barrier immediately.',
      tone: 'warning',
    },
  },
  {
    test: (code) => code.includes('PLATE') || code.includes('OCR') || code.includes('ALPR'),
    profile: {
      title: 'Plate verification required',
      summary: 'Plate signal or confidence is insufficient for the backend to conclude safely.',
      operatorHint: 'Cross-reference the image, plate candidates, and the plate tied to the ticket or subscription before confirming.',
      tone: 'warning',
    },
  },
  {
    test: (code) => code.includes('RFID') || code.includes('TAG'),
    profile: {
      title: 'RFID / tag anomaly',
      summary: 'RFID read does not match expectations or requires on-site device/vehicle verification.',
      operatorHint: 'Cross-check RFID against session context and lane device before approving.',
      tone: 'warning',
    },
  },
  {
    test: (code) => code.includes('MISMATCH') || code.includes('WRONG') || code.includes('NO_ACTIVE'),
    profile: {
      title: 'Business rule mismatch',
      summary: 'Decision engine detected a rule mismatch across plate, position, subscription, or current conditions. trường.',
      operatorHint: 'Review all context before overriding. When uncertain, reject or escalate.lation.',
      tone: 'error',
    },
  },
]

export function describeReviewReason(code: string): ReviewReasonProfile {
  const normalized = code.trim().toUpperCase()
  return REVIEW_REASON_PROFILES.find((item) => item.test(normalized))?.profile ?? {
    title: 'Manual review required',
    summary: 'Backend queued this session for a human decision rather than resolving it automatically.',
    operatorHint: 'Read the latest decision, incidents, and review history before acting.',
    tone: 'info',
  }
}

export function labelReviewAction(action: ReviewQueueAction) {
  if (action === 'MANUAL_APPROVE') return 'Approve'
  if (action === 'MANUAL_REJECT') return 'Reject'
  if (action === 'MANUAL_OPEN_BARRIER') return 'Open barrier'
  return 'Claim'
}

export function getPrimaryReviewAction(item: ReviewQueueItem, role: OperatorRole) {
  const preferredOrder: ReviewQueueAction[] = ['CLAIM', 'MANUAL_APPROVE', 'MANUAL_OPEN_BARRIER', 'MANUAL_REJECT']
  return preferredOrder.find((action) => item.actions.includes(action) && canRunReviewWorkspaceAction(role, action)) ?? item.actions[0] ?? null
}

export function getReviewNextActionText(item: ReviewQueueItem, role: OperatorRole) {
  const primary = getPrimaryReviewAction(item, role)
  if (!primary) return 'This case is waiting for the backend to open the next action, or your current role is insufficient.'
  if (primary === 'CLAIM') return 'Claim the case first to lock ownership before proceeding.'
  if (primary === 'MANUAL_APPROVE') return 'Can approve directly if context is sufficiently clear.'
  if (primary === 'MANUAL_OPEN_BARRIER') return 'This case requires OPS/ADMIN to open the barrier with audit rather than automatic processing. auto-open.'
  return 'This case leans toward reject or escalation rather than letting the vehicle through.'
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return value
  return new Date(ms).toLocaleString('vi-VN')
}

export function formatRelativeMinutes(value: string | null | undefined) {
  if (!value) return '—'
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return '—'
  const diffMs = Date.now() - ms
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))
  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}

export function getSessionContextHeadline(detail: SessionDetail | null) {
  if (!detail) return 'Session context not loaded yet.'
  const latestDecision = detail.decisions[detail.decisions.length - 1]
  if (!latestDecision) return '— decision snapshot trong session detail.'
  return latestDecision.explanation || latestDecision.reasonDetail || latestDecision.reasonCode || 'Decision đã có nhưng chưa có explanation.'
}

export function prettyJson(value: unknown) {
  if (value == null) return 'null'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
