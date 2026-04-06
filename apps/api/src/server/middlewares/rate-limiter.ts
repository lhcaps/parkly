/**
 * Rate Limiter Middleware.
 *
 * In-memory sliding window rate limiter for mutation endpoints.
 * For production, swap the in-memory store with Redis via `ioredis`.
 *
 * Usage:
 * ```ts
 * router.post('/sessions', rateLimiter({ maxRequests: 30, windowMs: 60_000 }), handler)
 * ```
 */

import type { Request, Response, NextFunction } from 'express-serve-static-core'
import { ApiError } from '../http'

type RateLimitEntry = {
  timestamps: number[]
}

type RateLimiterOptions = {
  /** Max requests per window. Default: 60. */
  maxRequests?: number
  /** Window size in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number
  /** Key extractor. Default: IP + path. */
  keyFn?: (req: Request) => string
  /** Skip rate limiting for certain requests. */
  skipFn?: (req: Request) => boolean
}

const DEFAULT_MAX = 60
const DEFAULT_WINDOW_MS = 60_000

// In-memory store (replace with Redis for multi-instance deployments)
const store = new Map<string, RateLimitEntry>()

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < DEFAULT_WINDOW_MS * 2)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}, 5 * 60_000).unref()

function defaultKeyFn(req: Request): string {
  const raw = req as any
  const ip = raw.ip || raw.socket?.remoteAddress || 'unknown'
  const auth = req.auth
  const userId = auth?.principalType === 'USER' ? auth.userId : null
  return userId ? `user:${userId}` : `ip:${ip}`
}

export function rateLimiter(opts: RateLimiterOptions = {}) {
  const maxRequests = Math.max(1, opts.maxRequests ?? DEFAULT_MAX)
  const windowMs = Math.max(1000, opts.windowMs ?? DEFAULT_WINDOW_MS)
  const keyFn = opts.keyFn ?? defaultKeyFn
  const skipFn = opts.skipFn

  return (req: Request, res: Response, next: NextFunction): void => {
    if (skipFn?.(req)) return next()

    const key = keyFn(req)
    const now = Date.now()

    let entry = store.get(key)
    if (!entry) {
      entry = { timestamps: [] }
      store.set(key, entry)
    }

    // Remove expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

    if (entry.timestamps.length >= maxRequests) {
      const retryAfterMs = windowMs - (now - entry.timestamps[0])
      const retryAfterSec = Math.ceil(retryAfterMs / 1000)
      res.setHeader('Retry-After', String(retryAfterSec))
      res.setHeader('X-RateLimit-Limit', String(maxRequests))
      res.setHeader('X-RateLimit-Remaining', '0')
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + retryAfterMs) / 1000)))
      return next(
        new ApiError({
          code: 'SERVICE_UNAVAILABLE',
          statusCode: 429,
          message: `Rate limit exceeded. Try again in ${retryAfterSec}s.`,
          details: { retryAfterSeconds: retryAfterSec, limit: maxRequests, windowMs },
        }),
      )
    }

    entry.timestamps.push(now)

    // Set rate limit info headers
    res.setHeader('X-RateLimit-Limit', String(maxRequests))
    res.setHeader('X-RateLimit-Remaining', String(maxRequests - entry.timestamps.length))

    next()
  }
}

/**
 * Pre-configured rate limiters for common use cases.
 */
export const RATE_LIMITS = {
  /** Auth endpoints: 10 req/min (brute-force protection) */
  auth: rateLimiter({ maxRequests: 10, windowMs: 60_000 }),
  /** Write endpoints: 30 req/min */
  mutation: rateLimiter({ maxRequests: 30, windowMs: 60_000 }),
  /** Read endpoints: 120 req/min */
  query: rateLimiter({ maxRequests: 120, windowMs: 60_000 }),
  /** Device capture: 600 req/min (high-frequency ALPR) */
  capture: rateLimiter({ maxRequests: 600, windowMs: 60_000 }),
  /** File upload: 10 req/min */
  upload: rateLimiter({ maxRequests: 10, windowMs: 60_000 }),
} as const
