import { pickAllowedSiteCodesFromPrincipal } from '../../../server/services/read-models/site-scope'
import type { AuthenticatedPrincipal } from '../../auth/application/auth-service'

export function pickDashboardAllowedSiteCodesFromPolicy(principal: AuthenticatedPrincipal, activeSiteCodes: string[]) {
  return pickAllowedSiteCodesFromPrincipal(principal, activeSiteCodes)
}
