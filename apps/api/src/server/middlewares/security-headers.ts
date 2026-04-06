/**
 * Security Headers Middleware.
 *
 * Implements OWASP-recommended HTTP security headers.
 * Mount early in the middleware chain, before routes.
 *
 * ```ts
 * app.use(securityHeaders)
 * ```
 */

import type { Request, Response, NextFunction } from 'express-serve-static-core'

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // ─── HSTS: enforce HTTPS for 1 year ───────────────────────────────
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

  // ─── Content-Type sniffing prevention ─────────────────────────────
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // ─── Clickjacking protection ──────────────────────────────────────
  res.setHeader('X-Frame-Options', 'DENY')

  // ─── XSS filter (legacy browsers) ────────────────────────────────
  res.setHeader('X-XSS-Protection', '1; mode=block')

  // ─── Referrer leak prevention ─────────────────────────────────────
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // ─── CSP: restrict resource loading ───────────────────────────────
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  )

  // ─── Permissions Policy ───────────────────────────────────────────
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  )

  // ─── Remove server fingerprint ────────────────────────────────────
  ;(res as any).removeHeader?.('X-Powered-By')

  next()
}
