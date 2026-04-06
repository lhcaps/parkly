import type { ReviewQueueItem } from '@/lib/contracts/reviews'
import type { SessionAllowedAction, SessionDetail, SessionState, SessionSummary } from '@/lib/contracts/sessions'
import { isRecord } from '@/lib/http/errors'

export function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function stringOrNull(value: unknown) {
  return typeof value === 'string' ? value : null
}

export function booleanOrFalse(value: unknown) {
  return typeof value === 'boolean' ? value : false
}

export function numberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function directionOrDefault(value: unknown): 'ENTRY' | 'EXIT' {
  return value === 'EXIT' ? 'EXIT' : 'ENTRY'
}

export function sessionStateOrDefault(value: unknown): SessionState {
  const known: SessionState[] = [
    'OPEN',
    'WAITING_READ',
    'WAITING_DECISION',
    'APPROVED',
    'WAITING_PAYMENT',
    'DENIED',
    'PASSED',
    'TIMEOUT',
    'CANCELLED',
    'ERROR',
  ]
  return known.includes(value as SessionState) ? (value as SessionState) : 'OPEN'
}

export function normalizeAllowedActions(value: unknown): SessionAllowedAction[] {
  return Array.isArray(value)
    ? value.filter((item): item is SessionAllowedAction => typeof item === 'string')
    : []
}

export function normalizeSessionSummary(input: unknown): SessionSummary {
  const row = isRecord(input) ? input : {}

  return {
    sessionId: stringOrEmpty(row.sessionId),
    siteCode: stringOrEmpty(row.siteCode),
    gateCode: stringOrEmpty(row.gateCode),
    laneCode: stringOrEmpty(row.laneCode),
    direction: directionOrDefault(row.direction),
    status: sessionStateOrDefault(row.status),
    allowedActions: normalizeAllowedActions(row.allowedActions),
    ticketId: stringOrNull(row.ticketId),
    correlationId: stringOrNull(row.correlationId),
    openedAt: stringOrEmpty(row.openedAt),
    lastReadAt: stringOrNull(row.lastReadAt),
    resolvedAt: stringOrNull(row.resolvedAt),
    closedAt: stringOrNull(row.closedAt),
    plateCompact: stringOrNull(row.plateCompact),
    rfidUid: stringOrNull(row.rfidUid),
    presenceActive: booleanOrFalse(row.presenceActive),
    reviewRequired: booleanOrFalse(row.reviewRequired),
    readCount: numberOrZero(row.readCount),
    decisionCount: numberOrZero(row.decisionCount),
    barrierCommandCount: numberOrZero(row.barrierCommandCount),
  }
}

export function normalizeSessionSummaryList(input: unknown): SessionSummary[] {
  return Array.isArray(input) ? input.map((item) => normalizeSessionSummary(item)) : []
}

export function normalizeSessionDetail(input: unknown): SessionDetail {
  const row = isRecord(input) ? input : {}
  const session = normalizeSessionSummary(row.session)

  return {
    ...(row as SessionDetail),
    session,
    reads: Array.isArray(row.reads) ? row.reads : [],
    decisions: Array.isArray(row.decisions) ? row.decisions : [],
    barrierCommands: Array.isArray(row.barrierCommands) ? row.barrierCommands : [],
    manualReviews: Array.isArray(row.manualReviews) ? row.manualReviews : [],
    incidents: Array.isArray(row.incidents) ? row.incidents : [],
    timeline: Array.isArray(row.timeline) ? row.timeline : [],
  }
}

export function normalizeReviewQueueItem(input: unknown): ReviewQueueItem {
  const row = isRecord(input) ? input : {}

  return {
    reviewId: stringOrEmpty(row.reviewId),
    status: stringOrEmpty(row.status),
    queueReasonCode: stringOrEmpty(row.queueReasonCode),
    claimedByUserId: stringOrNull(row.claimedByUserId),
    claimedAt: stringOrNull(row.claimedAt),
    resolvedByUserId: stringOrNull(row.resolvedByUserId),
    resolvedAt: stringOrNull(row.resolvedAt),
    note: stringOrNull(row.note),
    snapshot: row.snapshot ?? null,
    createdAt: stringOrEmpty(row.createdAt),
    session: normalizeSessionSummary(row.session),
    latestDecision: isRecord(row.latestDecision) ? (row.latestDecision as ReviewQueueItem['latestDecision']) : null,
    actions: Array.isArray(row.actions)
      ? row.actions.filter((item): item is ReviewQueueItem['actions'][number] => typeof item === 'string')
      : [],
  }
}

export function normalizeReviewQueueList(input: unknown): ReviewQueueItem[] {
  return Array.isArray(input) ? input.map((item) => normalizeReviewQueueItem(item)) : []
}
