import type { AuthRole } from '@/lib/contracts/auth'

export type RoleLabelDescriptor = {
  label: string
  focusLabel: string
  forbiddenCopy: string
  badgeLabel: string
}

const ROLE_LABELS: Record<AuthRole, RoleLabelDescriptor> = {
  ADMIN: {
    label: 'Administrator',
    focusLabel: 'System oversight',
    forbiddenCopy: 'This route is outside the administrator session scope that is active right now.',
    badgeLabel: 'ADMIN',
  },
  OPS: {
    label: 'Operations',
    focusLabel: 'Operations control',
    forbiddenCopy: 'This route is not part of the current operations workspace policy.',
    badgeLabel: 'OPS',
  },
  GUARD: {
    label: 'Guard',
    focusLabel: 'Lane decisions',
    forbiddenCopy: 'This route is outside the lane and checkpoint workflow assigned to the guard console.',
    badgeLabel: 'GUARD',
  },
  CASHIER: {
    label: 'Cashier',
    focusLabel: 'Payment follow-up',
    forbiddenCopy: 'This route is outside cashier reporting and payment follow-up access.',
    badgeLabel: 'CASHIER',
  },
  WORKER: {
    label: 'Worker',
    focusLabel: 'Monitoring watch',
    forbiddenCopy: 'This route is outside the monitoring and background-operations scope of the worker console.',
    badgeLabel: 'WORKER',
  },
}

export function getRoleLabels(role?: AuthRole | string | null) {
  if (!role) {
    return {
      label: 'Anonymous',
      focusLabel: 'No active session',
      forbiddenCopy: 'You need an authenticated session before this route can open.',
      badgeLabel: 'SIGNED-OUT',
    }
  }

  return ROLE_LABELS[role as AuthRole] ?? {
    label: role,
    focusLabel: 'Console access',
    forbiddenCopy: 'This route is blocked by the current role policy.',
    badgeLabel: role,
  }
}
