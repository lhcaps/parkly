import { Prisma } from '@prisma/client'

import { prisma } from '../../../lib/prisma'
import { type AuthenticatedPrincipal } from '../../../modules/auth/application/auth-service'
import { pickDashboardAllowedSiteCodesFromPolicy } from '../../../modules/dashboard/application/dashboard-site-scope-policy'
import { ApiError } from '../../http'

export type ResolvedDashboardSiteScope = {
  requestedSiteCode: string | null
  siteCodes: string[]
  siteCount: number
  isAllSites: boolean
}

function normalizeSiteCode(value?: string | null) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

async function listActiveSiteCodes() {
  const rows = await prisma.$queryRaw<Array<{ siteCode: string }>>(Prisma.sql`
    SELECT site_code AS siteCode
    FROM parking_sites
    WHERE is_active = 1
    ORDER BY site_code ASC
  `)
  return [...new Set(rows.map((row) => String(row.siteCode ?? '')).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

export async function resolveDashboardSiteScope(args: {
  principal: AuthenticatedPrincipal
  requestedSiteCode?: string | null
}): Promise<ResolvedDashboardSiteScope> {
  const requestedSiteCode = normalizeSiteCode(args.requestedSiteCode)
  const activeSiteCodes = await listActiveSiteCodes()
  const allowedSiteCodes = pickDashboardAllowedSiteCodesFromPolicy(args.principal, activeSiteCodes)

  if (requestedSiteCode) {
    if (!activeSiteCodes.includes(requestedSiteCode)) {
      throw new ApiError({
        code: 'NOT_FOUND',
        message: `Site ${requestedSiteCode} không tồn tại hoặc không còn active`,
      })
    }
    if (!allowedSiteCodes.includes(requestedSiteCode)) {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: `Không có quyền truy cập site ${requestedSiteCode}`,
      })
    }
    return {
      requestedSiteCode,
      siteCodes: [requestedSiteCode],
      siteCount: 1,
      isAllSites: false,
    }
  }

  if (allowedSiteCodes.length === 0) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Tài khoản chưa được gán site scope cho dashboard',
    })
  }

  return {
    requestedSiteCode: null,
    siteCodes: allowedSiteCodes,
    siteCount: allowedSiteCodes.length,
    isAllSites: allowedSiteCodes.length === activeSiteCodes.length,
  }
}
