/**
 * Multi-Tenancy Middleware — site-scope enforcement.
 *
 * Extracts `siteCode` from the authenticated user's JWT scope and injects it
 * into `req.siteScope`. All downstream queries MUST use this scope to prevent
 * cross-site data leakage.
 *
 * Usage: mount after auth middleware on all tenant-scoped routes.
 *
 * ```ts
 * router.use(requireAuth, enforceSiteScope)
 * router.get('/sessions', (req, res) => {
 *   const sessions = await repo.findBySite(req.siteScope.siteCode)
 * })
 * ```
 */

import type { Request, Response, NextFunction } from 'express-serve-static-core'
import { ApiError } from '../http'

export type SiteScope = {
  siteCode: string
  siteCodes: string[]
  isSuperAdmin: boolean
}

declare module 'express-serve-static-core' {
  interface Request {
    siteScope?: SiteScope
  }
}

/**
 * Enforces site scope from the authenticated principal.
 * Rejects requests without a valid site scope with 403.
 */
export function enforceSiteScope(req: Request, _res: Response, next: NextFunction): void {
  const auth = req.auth
  if (!auth) {
    return next(new ApiError({ code: 'UNAUTHENTICATED', message: 'Authentication required for site-scoped operations' }))
  }

  const role = auth.role?.toUpperCase() ?? ''
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SYSTEM'

  // Extract site codes from JWT claims (siteScopes array)
  const siteCodes: string[] = []
  if (auth.siteScopes && Array.isArray(auth.siteScopes)) {
    for (const scope of auth.siteScopes) {
      const code = typeof scope === 'object' && scope !== null ? String((scope as { siteCode?: string }).siteCode ?? '').trim() : ''
      if (code && !siteCodes.includes(code)) {
        siteCodes.push(code)
      }
    }
  }

  if (!isSuperAdmin && siteCodes.length === 0) {
    return next(new ApiError({
      code: 'FORBIDDEN',
      message: 'User has no site scope assigned. Contact administrator.',
    }))
  }

  req.siteScope = {
    siteCode: siteCodes[0] ?? '*',
    siteCodes: isSuperAdmin && siteCodes.length === 0 ? ['*'] : siteCodes,
    isSuperAdmin,
  }

  next()
}

/**
 * Validates that a query's siteCode matches the authenticated scope.
 * Use in service/repository methods before executing queries.
 */
export function assertSiteAccess(scope: SiteScope | undefined, targetSiteCode: string): void {
  if (!scope) {
    throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Site scope not available' })
  }
  if (scope.isSuperAdmin) return
  if (scope.siteCodes.includes('*')) return
  if (!scope.siteCodes.includes(targetSiteCode)) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: `Access denied to site ${targetSiteCode}`,
      details: { allowedSites: scope.siteCodes, requestedSite: targetSiteCode },
    })
  }
}

/**
 * Tenant-aware Redis key builder.
 *
 * Ensures all cache keys are prefixed with the site code to prevent cross-tenant
 * cache pollution.
 *
 * ```ts
 * const key = tenantCacheKey('SITE_DN_VIN', 'session', sessionId)
 * // → "site:SITE_DN_VIN:session:abc123"
 * ```
 */
export function tenantCacheKey(siteCode: string, ...parts: string[]): string {
  const safeSiteCode = String(siteCode ?? '').trim() || 'UNKNOWN'
  return `site:${safeSiteCode}:${parts.join(':')}`
}
