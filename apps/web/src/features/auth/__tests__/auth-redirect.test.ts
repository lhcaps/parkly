import { describe, expect, it } from 'vitest'
import { describeResolvedDestination, readRequestedRoute, resolvePostLoginRoute } from '../auth-redirect'

describe('auth redirect resolution', () => {
  it('returns the original deep link when the authenticated role is allowed', () => {
    expect(resolvePostLoginRoute({
      role: 'GUARD',
      state: { from: { pathname: '/session-history', search: '?siteCode=SITE01&sessionId=GS-1' } },
    })).toBe('/session-history?siteCode=SITE01&sessionId=GS-1')
  })

  it('falls back to role home when the requested route is forbidden', () => {
    expect(resolvePostLoginRoute({
      role: 'CASHIER',
      state: { from: { pathname: '/subscriptions', search: '?id=sub_123' } },
    })).toBe('/reports')
  })

  it('can fall back to the first canonical route when explicitly requested', () => {
    expect(resolvePostLoginRoute({
      role: 'WORKER',
      state: { from: { pathname: '/parking-live' } },
      fallbackToFirstAllowed: true,
    })).toBe('/overview')
  })

  it('ignores login and forbidden as requested destinations', () => {
    expect(readRequestedRoute({ from: { pathname: '/login' } })).toBeNull()
    expect(describeResolvedDestination({ role: 'OPS', state: { from: { pathname: '/forbidden' } } })).toBe('/overview')
  })
})
