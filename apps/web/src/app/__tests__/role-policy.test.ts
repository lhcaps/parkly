import { describe, expect, it } from 'vitest'
import {
  canAccessRoute,
  getCanonicalRoutesForRole,
  getForbiddenFallbackPath,
  getRoleHome,
  listRoutePolicies,
} from '@/lib/auth/role-policy'

describe('role policy registry', () => {
  it('exposes canonical subscriptions and parking live for admin navigation', () => {
    const paths = getCanonicalRoutesForRole('ADMIN').map((route) => route.path)

    expect(paths).toContain('/subscriptions')
    expect(paths).toContain('/parking-live')
    expect(paths).toContain('/overview')
  })

  it('blocks cashier from subscriptions and resolves the correct fallback', () => {
    expect(canAccessRoute('CASHIER', '/subscriptions')).toBe(false)
    expect(getForbiddenFallbackPath('CASHIER', '/subscriptions')).toBe('/reports')
    expect(getRoleHome('CASHIER')).toBe('/reports')
  })

  it('blocks worker from parking live and keeps worker home on lane monitor', () => {
    expect(canAccessRoute('WORKER', '/parking-live')).toBe(false)
    expect(getRoleHome('WORKER')).toBe('/lane-monitor')
  })

  it('keeps standalone hidden routes out of canonical shell listings', () => {
    const canonicalPaths = listRoutePolicies({ canonicalOnly: true }).map((route) => route.path)

    expect(canonicalPaths).not.toContain('/mobile-capture')
  })
})
