import type { ReviewQueueAction, SessionAllowedAction } from '@/lib/api'
import type { SessionState } from '@/lib/contracts/sessions'

export type OperatorRole = 'GUARD' | 'OPS' | 'ADMIN' | string

// States where no further lane action is possible — session lifecycle is closed.
export const TERMINAL_SESSION_STATES: ReadonlySet<SessionState> = new Set([
  'PASSED',
  'TIMEOUT',
  'DENIED',
  'CANCELLED',
  'ERROR',
] as SessionState[])

export function isSessionTerminal(status: SessionState | string): boolean {
  return TERMINAL_SESSION_STATES.has(status as SessionState)
}

const SESSION_ACTION_ROLES: Record<SessionAllowedAction, readonly string[]> = {
  APPROVE: ['GUARD', 'OPS', 'ADMIN'],
  REQUIRE_PAYMENT: ['GUARD', 'OPS', 'ADMIN'],
  DENY: ['GUARD', 'OPS', 'ADMIN'],
  CONFIRM_PASS: ['GUARD', 'OPS', 'ADMIN'],
  CANCEL: ['OPS', 'ADMIN'],
}

const REVIEW_ACTION_ROLES: Record<ReviewQueueAction, readonly string[]> = {
  CLAIM: ['GUARD', 'OPS', 'ADMIN'],
  MANUAL_APPROVE: ['GUARD', 'OPS', 'ADMIN'],
  MANUAL_REJECT: ['GUARD', 'OPS', 'ADMIN'],
  MANUAL_OPEN_BARRIER: ['OPS', 'ADMIN'],
}

function labelSessionAction(action: SessionAllowedAction) {
  if (action === 'APPROVE') return 'approve'
  if (action === 'REQUIRE_PAYMENT') return 'require payment'
  if (action === 'DENY') return 'deny'
  if (action === 'CONFIRM_PASS') return 'confirm pass'
  return 'cancel'
}

function labelReviewAction(action: ReviewQueueAction) {
  if (action === 'CLAIM') return 'claim'
  if (action === 'MANUAL_APPROVE') return 'manual approve'
  if (action === 'MANUAL_REJECT') return 'manual reject'
  return 'manual open barrier'
}

function mapReviewActionToSessionAction(action: ReviewQueueAction): SessionAllowedAction | null {
  if (action === 'MANUAL_APPROVE') return 'APPROVE'
  if (action === 'MANUAL_REJECT') return 'DENY'
  return null
}

export function canRunSessionAction(role: OperatorRole, action: SessionAllowedAction) {
  const allowed = SESSION_ACTION_ROLES[action] ?? []
  return allowed.includes(role)
}

export function getSessionActionLockReason(
  role: OperatorRole,
  action: SessionAllowedAction,
  allowedActions: SessionAllowedAction[],
  liveSessionStatus?: string,
) {
  if (liveSessionStatus && isSessionTerminal(liveSessionStatus)) {
    return `Session is ${liveSessionStatus} — ${labelSessionAction(action)} is no longer available.`
  }
  if (!allowedActions.includes(action)) return 'The current state machine does not permit this action.'
  if (!canRunSessionAction(role, action)) return `Role ${role || 'UNKNOWN'} does not have permission for action ${action}.`
  return ''
}

export function canRunReviewWorkspaceAction(role: OperatorRole, action: ReviewQueueAction) {
  const allowed = REVIEW_ACTION_ROLES[action] ?? []
  return allowed.includes(role)
}

export function getReviewWorkspaceActionLockReason(
  role: OperatorRole,
  action: ReviewQueueAction,
  allowedActions: ReviewQueueAction[],
  /** Pass live session status when available — terminal sessions block all actions. */
  liveSessionStatus?: string,
  /** Pass live session allowedActions when available — review actions must intersect with current session state. */
  liveSessionAllowedActions?: SessionAllowedAction[],
) {
  if (liveSessionStatus && isSessionTerminal(liveSessionStatus)) {
    return `Session is ${liveSessionStatus} — no actions are possible on a terminal session.`
  }

  if (!allowedActions.includes(action)) return 'This action is not currently available for this queue item.'

  if (action === 'MANUAL_OPEN_BARRIER' && Array.isArray(liveSessionAllowedActions) && liveSessionAllowedActions.length === 0) {
    return 'The live session exposes no permitted actions. Refresh the session snapshot before attempting a barrier override.'
  }

  const mappedAction = mapReviewActionToSessionAction(action)
  if (mappedAction && Array.isArray(liveSessionAllowedActions) && !liveSessionAllowedActions.includes(mappedAction)) {
    return `The live session no longer permits ${labelReviewAction(action)}. Refresh the queue detail and confirm the new state.`
  }

  if (!canRunReviewWorkspaceAction(role, action)) {
    return `Role ${role || 'UNKNOWN'} does not have permission for action ${action}.`
  }

  return ''
}

const MANUAL_BARRIER_OVERRIDE_ROLES: readonly string[] = ['OPS', 'ADMIN']

export function canRunManualBarrierOverride(role: OperatorRole) {
  return MANUAL_BARRIER_OVERRIDE_ROLES.includes(role)
}

export function getManualBarrierOverrideLockReason(
  role: OperatorRole,
  /** Pass live session status when available. */
  liveSessionStatus?: string,
  /** Pass live allowedActions when available. */
  liveAllowedActions?: SessionAllowedAction[],
) {
  if (!role) return 'Could not resolve the current operator role.'
  if (liveSessionStatus && isSessionTerminal(liveSessionStatus)) {
    return `Session is ${liveSessionStatus} — a new session must be opened before a barrier override is possible.`
  }
  if (liveAllowedActions && liveAllowedActions.length === 0) {
    return 'The backend reports no permitted actions for this session. Refresh to confirm current state.'
  }
  if (!canRunManualBarrierOverride(role)) {
    return `Role ${role} does not have the manual-open-barrier permission. OPS or ADMIN required.`
  }
  return ''
}
