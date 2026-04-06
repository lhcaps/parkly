import { describe, expect, it } from 'vitest'
import { ApiError, toAppErrorDisplay } from '@/lib/http/errors'

describe('toAppErrorDisplay', () => {
  it('keeps plain UI error strings as application errors instead of dependency outages', () => {
    const display = toAppErrorDisplay('NOT_FOUND: Khong tim thay customer', 'Subscription create failed')

    expect(display.kind).toBe('unknown')
    expect(display.title).toBe('Subscription create failed')
    expect(display.message).toContain('NOT_FOUND: Khong tim thay customer')
    expect(display.title).not.toBe('Service temporarily unavailable')
  })

  it('keeps generic Error instances out of dependency-down classification', () => {
    const display = toAppErrorDisplay(new Error('Local form validation failed'), 'Create subscription failed')

    expect(display.kind).toBe('unknown')
    expect(display.title).toBe('Create subscription failed')
    expect(display.message).toContain('Local form validation failed')
  })

  it('still classifies explicit dependency failures correctly', () => {
    const display = toAppErrorDisplay(new ApiError({
      status: 503,
      code: 'DEP_UNAVAILABLE',
      message: 'Redis unavailable',
      details: { dependency: 'redis' },
    }), 'Load failed')

    expect(display.kind).toBe('dependencyDown')
    expect(display.title).toBe('Service temporarily unavailable')
    expect(display.nextAction).toContain('redis')
  })
})
