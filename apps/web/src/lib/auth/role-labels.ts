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
  SUPER_ADMIN: {
    label: 'role.SUPER_ADMIN.label',
    focusLabel: 'role.SUPER_ADMIN.focusLabel',
    forbiddenCopy: 'role.SUPER_ADMIN.forbiddenCopy',
    badgeLabel: 'role.SUPER_ADMIN.badgeLabel',
  },
  SITE_ADMIN: {
    label: 'role.SITE_ADMIN.label',
    focusLabel: 'role.SITE_ADMIN.focusLabel',
    forbiddenCopy: 'role.SITE_ADMIN.forbiddenCopy',
    badgeLabel: 'role.SITE_ADMIN.badgeLabel',
  },
  MANAGER: {
    label: 'role.MANAGER.label',
    focusLabel: 'role.MANAGER.focusLabel',
    forbiddenCopy: 'role.MANAGER.forbiddenCopy',
    badgeLabel: 'role.MANAGER.badgeLabel',
  },
  OPERATOR: {
    label: 'role.OPERATOR.label',
    focusLabel: 'role.OPERATOR.focusLabel',
    forbiddenCopy: 'role.OPERATOR.forbiddenCopy',
    badgeLabel: 'role.OPERATOR.badgeLabel',
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
  VIEWER: {
    label: 'role.VIEWER.label',
    focusLabel: 'role.VIEWER.focusLabel',
    forbiddenCopy: 'role.VIEWER.forbiddenCopy',
    badgeLabel: 'role.VIEWER.badgeLabel',
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
