/**
 * Domain Events Bus + Multi-tenancy — Vitest test suite.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { domainEvents } from '../lib/domain-events'
import { assertSiteAccess, tenantCacheKey, type SiteScope } from '../server/middlewares/site-scope'
import { ApiError } from '../server/http'

// ─── Domain Events ────────────────────────────────────────────────────────────

describe('DomainEventBus', () => {
  beforeEach(() => {
    domainEvents.removeAll()
  })

  it('emits SessionOpened with validated payload', () => {
    const listener = vi.fn()
    domainEvents.on('SessionOpened', listener)

    domainEvents.emit('SessionOpened', {
      sessionId: 's-001',
      siteCode: 'SITE_DN_VIN',
      gateCode: 'GATE_A',
      laneCode: 'LANE_A1',
      direction: 'ENTRY',
      plateCompact: '51AB12345',
      rfidUid: null,
      openedAt: '2026-03-10T08:00:00Z',
    })

    expect(listener).toHaveBeenCalledOnce()
    expect(listener.mock.calls[0][0].eventName).toBe('SessionOpened')
    expect(listener.mock.calls[0][0].payload.sessionId).toBe('s-001')
    expect(listener.mock.calls[0][0].emittedAt).toBeTruthy()
  })

  it('rejects invalid payload', () => {
    expect(() => {
      domainEvents.emit('SessionOpened', {
        sessionId: 's-001',
        // missing required fields
      } as any)
    }).toThrow()
  })

  it('onAll receives all event types', () => {
    const globalListener = vi.fn()
    domainEvents.onAll(globalListener)

    domainEvents.emit('SessionOpened', {
      sessionId: 's-001', siteCode: 'S', gateCode: 'G', laneCode: 'L',
      direction: 'ENTRY', plateCompact: null, rfidUid: null, openedAt: '2026-01-01T00:00:00Z',
    })
    domainEvents.emit('DecisionMade', {
      sessionId: 's-002', siteCode: 'S', laneCode: 'L', direction: 'EXIT',
      decisionCode: 'AUTO_APPROVED', reasonCode: 'EXIT_TICKET_READY',
      recommendedAction: 'APPROVE', reviewRequired: false, decidedAt: '2026-01-01T00:00:00Z',
    })

    expect(globalListener).toHaveBeenCalledTimes(2)
    expect(globalListener.mock.calls[0][0].eventName).toBe('SessionOpened')
    expect(globalListener.mock.calls[1][0].eventName).toBe('DecisionMade')
  })

  it('unsubscribe stops receiving events', () => {
    const listener = vi.fn()
    const unsub = domainEvents.on('BarrierCommand', listener)

    domainEvents.emit('BarrierCommand', {
      siteCode: 'S', laneCode: 'L', command: 'OPEN',
      triggeredBy: 'AUTO', sessionId: null, commandedAt: '2026-01-01T00:00:00Z',
    })
    expect(listener).toHaveBeenCalledOnce()

    unsub()
    domainEvents.emit('BarrierCommand', {
      siteCode: 'S', laneCode: 'L', command: 'CLOSE',
      triggeredBy: 'MANUAL', sessionId: null, commandedAt: '2026-01-01T00:00:01Z',
    })
    expect(listener).toHaveBeenCalledOnce() // still 1
  })

  it('listener errors do not propagate to emitter', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    domainEvents.on('SessionResolved', () => {
      throw new Error('Listener crashed!')
    })

    expect(() => {
      domainEvents.emit('SessionResolved', {
        sessionId: 's-001', siteCode: 'S', resolution: 'COMPLETED',
        resolvedBy: 'admin', resolvedAt: '2026-01-01T00:00:00Z',
        durationMinutes: 120, amountPaid: null,
      })
    }).not.toThrow()

    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('eventNames returns all registered event types', () => {
    expect(domainEvents.eventNames).toEqual(
      expect.arrayContaining(['SessionOpened', 'SessionResolved', 'DecisionMade', 'BarrierCommand'])
    )
    expect(domainEvents.eventNames.length).toBe(8)
  })
})

// ─── Multi-tenancy ────────────────────────────────────────────────────────────

describe('assertSiteAccess', () => {
  it('allows access to matching site', () => {
    const scope: SiteScope = { siteCode: 'SITE_DN_VIN', siteCodes: ['SITE_DN_VIN'], isSuperAdmin: false }
    expect(() => assertSiteAccess(scope, 'SITE_DN_VIN')).not.toThrow()
  })

  it('blocks access to different site', () => {
    const scope: SiteScope = { siteCode: 'SITE_DN_VIN', siteCodes: ['SITE_DN_VIN'], isSuperAdmin: false }
    expect(() => assertSiteAccess(scope, 'SITE_HCM')).toThrow(ApiError)
  })

  it('super admin can access any site', () => {
    const scope: SiteScope = { siteCode: '*', siteCodes: ['*'], isSuperAdmin: true }
    expect(() => assertSiteAccess(scope, 'SITE_ANY')).not.toThrow()
  })

  it('null scope throws unauthenticated', () => {
    expect(() => assertSiteAccess(undefined, 'SITE_DN_VIN')).toThrow(ApiError)
  })

  it('multi-site user can access all assigned sites', () => {
    const scope: SiteScope = { siteCode: 'SITE_A', siteCodes: ['SITE_A', 'SITE_B'], isSuperAdmin: false }
    expect(() => assertSiteAccess(scope, 'SITE_A')).not.toThrow()
    expect(() => assertSiteAccess(scope, 'SITE_B')).not.toThrow()
    expect(() => assertSiteAccess(scope, 'SITE_C')).toThrow()
  })
})

describe('tenantCacheKey', () => {
  it('builds prefixed cache key', () => {
    expect(tenantCacheKey('SITE_DN_VIN', 'session', 's-001')).toBe('site:SITE_DN_VIN:session:s-001')
  })

  it('handles empty site code', () => {
    expect(tenantCacheKey('', 'session', '1')).toBe('site:UNKNOWN:session:1')
  })

  it('supports multiple parts', () => {
    expect(tenantCacheKey('S', 'presence', 'lane', 'L1')).toBe('site:S:presence:lane:L1')
  })
})
