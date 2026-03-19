import type { TFunction } from 'i18next'
import type { AuthRole } from '@/lib/contracts/auth'

export type RoleLabelDescriptor = {
  label: string
  focusLabel: string
  forbiddenCopy: string
  badgeLabel: string
}

const ROLE_KEY_MAP: Record<
  AuthRole,
  { label: string; focusLabel: string; forbiddenCopy: string; badgeLabel: string }
> = {
  ADMIN: {
    label: 'role.ADMIN.label',
    focusLabel: 'role.ADMIN.focusLabel',
    forbiddenCopy: 'role.ADMIN.forbiddenCopy',
    badgeLabel: 'role.ADMIN.badgeLabel',
  },
  OPS: {
    label: 'role.OPS.label',
    focusLabel: 'role.OPS.focusLabel',
    forbiddenCopy: 'role.OPS.forbiddenCopy',
    badgeLabel: 'role.OPS.badgeLabel',
  },
  GUARD: {
    label: 'role.GUARD.label',
    focusLabel: 'role.GUARD.focusLabel',
    forbiddenCopy: 'role.GUARD.forbiddenCopy',
    badgeLabel: 'role.GUARD.badgeLabel',
  },
  CASHIER: {
    label: 'role.CASHIER.label',
    focusLabel: 'role.CASHIER.focusLabel',
    forbiddenCopy: 'role.CASHIER.forbiddenCopy',
    badgeLabel: 'role.CASHIER.badgeLabel',
  },
  WORKER: {
    label: 'role.WORKER.label',
    focusLabel: 'role.WORKER.focusLabel',
    forbiddenCopy: 'role.WORKER.forbiddenCopy',
    badgeLabel: 'role.WORKER.badgeLabel',
  },
}

/** Dịch nhãn vai trò — luôn gọi trong component đã mount react-i18next. */
export function translateRoleLabels(
  role: AuthRole | string | null | undefined,
  t: TFunction,
): RoleLabelDescriptor {
  if (!role) {
    return {
      label: t('role.anonymous.label'),
      focusLabel: t('role.anonymous.focusLabel'),
      forbiddenCopy: t('role.anonymous.forbiddenCopy'),
      badgeLabel: t('role.anonymous.badgeLabel'),
    }
  }

  const keys = ROLE_KEY_MAP[role as AuthRole]
  if (!keys) {
    return {
      label: String(role),
      focusLabel: t('role.anonymous.focusLabel'),
      forbiddenCopy: t('role.anonymous.forbiddenCopy'),
      badgeLabel: String(role),
    }
  }

  return {
    label: t(keys.label),
    focusLabel: t(keys.focusLabel),
    forbiddenCopy: t(keys.forbiddenCopy),
    badgeLabel: t(keys.badgeLabel),
  }
}
