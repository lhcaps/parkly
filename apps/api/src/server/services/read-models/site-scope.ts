import { Prisma } from '@prisma/client'
import { isGlobalAuthRole } from '@parkly/contracts'

import { prisma } from '../../../lib/prisma'
import { type AuthenticatedPrincipal } from '../../../modules/auth/application/auth-service'
import { ApiError } from '../../http'

export type ResolvedSiteScope = {
  requestedSiteCode: string | null
  siteCodes: string[]
  siteCount: number
  isAllSites: boolean
}

function normalizeSiteCode(value?: string | null) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => normalizeSiteCode(value)).filter((value): value is string => value != null))]
    .sort((a, b) => a.localeCompare(b))
}

async function listSiteCodes(activeOnly = true) {
  const query = activeOnly
    ? Prisma.sql`
        SELECT site_code AS siteCode
        FROM parking_sites
        WHERE is_active = 1
        ORDER BY site_code ASC
      `
    : Prisma.sql`
        SELECT site_code AS siteCode
        FROM parking_sites
        ORDER BY site_code ASC
      `
  const rows = await prisma.$queryRaw<Array<{ siteCode: string }>>(query)
  return uniqueSorted(rows.map((row) => row.siteCode))
}

export function getPrincipalScopedSiteCodes(principal: AuthenticatedPrincipal) {
  if (principal.principalType !== 'USER') return []
  return uniqueSorted((principal.siteScopes ?? []).map((scope) => scope.siteCode))
}

export function pickAllowedSiteCodesFromPrincipal(principal: AuthenticatedPrincipal, candidateSiteCodes: string[]) {
  const normalizedCandidateSiteCodes = uniqueSorted(candidateSiteCodes)
  if (principal.principalType === 'SERVICE') return normalizedCandidateSiteCodes
  if (isGlobalAuthRole(principal.role)) return normalizedCandidateSiteCodes

  const scopedSiteCodes = getPrincipalScopedSiteCodes(principal)
  return scopedSiteCodes.filter((siteCode) => normalizedCandidateSiteCodes.includes(siteCode))
}

export async function resolveAuthorizedSiteScope(args: {
  principal: AuthenticatedPrincipal
  requestedSiteCode?: string | null
  resourceLabel?: string
  activeOnly?: boolean
  allowEmpty?: boolean
}): Promise<ResolvedSiteScope> {
  const requestedSiteCode = normalizeSiteCode(args.requestedSiteCode)
  const candidateSiteCodes = await listSiteCodes(args.activeOnly ?? true)
  const allowedSiteCodes = pickAllowedSiteCodesFromPrincipal(args.principal, candidateSiteCodes)
  const resourceLabel = String(args.resourceLabel ?? 'resource').trim() || 'resource'

  if (requestedSiteCode) {
    if (!candidateSiteCodes.includes(requestedSiteCode)) {
      throw new ApiError({
        code: 'NOT_FOUND',
        message: `Site ${requestedSiteCode} khÃ´ng tá»“n táº¡i hoáº·c khÃ´ng cÃ²n active`,
      })
    }
    if (!allowedSiteCodes.includes(requestedSiteCode)) {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: `KhÃ´ng cÃ³ quyá»n truy cáº­p site ${requestedSiteCode}`,
      })
    }
    return {
      requestedSiteCode,
      siteCodes: [requestedSiteCode],
      siteCount: 1,
      isAllSites: false,
    }
  }

  if (!args.allowEmpty && allowedSiteCodes.length === 0) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: `TÃ i khoáº£n chÆ°a Ä‘Æ°á»£c gÃ¡n site scope cho ${resourceLabel}`,
    })
  }

  return {
    requestedSiteCode: null,
    siteCodes: allowedSiteCodes,
    siteCount: allowedSiteCodes.length,
    isAllSites: candidateSiteCodes.length > 0 && allowedSiteCodes.length === candidateSiteCodes.length,
  }
}

export async function resolveDashboardSiteScope(args: {
  principal: AuthenticatedPrincipal
  requestedSiteCode?: string | null
}): Promise<ResolvedSiteScope> {
  return resolveAuthorizedSiteScope({
    principal: args.principal,
    requestedSiteCode: args.requestedSiteCode,
    resourceLabel: 'dashboard',
    activeOnly: true,
  })
}

export function filterRowsBySiteCodes<T extends { siteCode: string | null | undefined }>(rows: T[], siteCodes: string[]) {
  if (siteCodes.length === 0) return []
  const allowed = new Set(siteCodes)
  return rows.filter((row) => {
    const siteCode = normalizeSiteCode(row.siteCode)
    return siteCode != null && allowed.has(siteCode)
  })
}
