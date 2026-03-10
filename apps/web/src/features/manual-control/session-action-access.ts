import type { SessionAllowedAction } from '@/lib/api'

export type OperatorRole = 'GUARD' | 'OPS' | 'ADMIN' | string

const ACTION_ROLES: Record<SessionAllowedAction, readonly string[]> = {
  APPROVE: ['GUARD', 'OPS', 'ADMIN'],
  REQUIRE_PAYMENT: ['GUARD', 'OPS', 'ADMIN'],
  DENY: ['GUARD', 'OPS', 'ADMIN'],
  CONFIRM_PASS: ['GUARD', 'OPS', 'ADMIN'],
  CANCEL: ['OPS', 'ADMIN'],
}

export function canRunSessionAction(role: OperatorRole, action: SessionAllowedAction) {
  const allowed = ACTION_ROLES[action] ?? []
  return allowed.includes(role)
}

export function getSessionActionLockReason(role: OperatorRole, action: SessionAllowedAction, allowedActions: SessionAllowedAction[]) {
  if (!allowedActions.includes(action)) return 'State machine hiện tại không cho phép action này.'
  if (!canRunSessionAction(role, action)) return `Role ${role || 'UNKNOWN'} không có quyền cho action ${action}.`
  return ''
}
