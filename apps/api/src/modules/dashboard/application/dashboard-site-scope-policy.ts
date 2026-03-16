export type DashboardScopePrincipal = {
  principalType: 'USER' | 'SERVICE'
  role: string
  siteScopes?: Array<{ siteCode: string }>
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

export function pickDashboardAllowedSiteCodesFromPolicy(principal: DashboardScopePrincipal, activeSiteCodes: string[]) {
  const normalizedActiveSiteCodes = uniqueSorted(activeSiteCodes)
  const scopedSiteCodes = uniqueSorted((principal.siteScopes ?? []).map((scope) => scope.siteCode))
  if (scopedSiteCodes.length > 0) return scopedSiteCodes.filter((siteCode) => normalizedActiveSiteCodes.includes(siteCode))
  if (principal.principalType === 'SERVICE') return normalizedActiveSiteCodes
  if (principal.role === 'ADMIN' || principal.role === 'OPS') return normalizedActiveSiteCodes
  return []
}
