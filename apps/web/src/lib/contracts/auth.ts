import type {
  AuthPrincipal as ContractAuthPrincipal,
  AuthRole as ContractAuthRole,
  AuthTokenBundle as ContractAuthTokenBundle,
  ServiceAuthPrincipal,
  SiteScopeInfo as ContractSiteScopeInfo,
  UserAuthPrincipal,
} from '@parkly/contracts'

export type AuthRole = ContractAuthRole
export type SiteScopeInfo = ContractSiteScopeInfo
export type UserPrincipalDto = UserAuthPrincipal
export type ServicePrincipalDto = ServiceAuthPrincipal
export type AuthPrincipal = ContractAuthPrincipal
export type AuthTokenBundle = ContractAuthTokenBundle

export type PasswordPolicyDescriptor = {
  bootstrapProfile: 'DEMO' | 'PRODUCTION'
  demoSeedCredentialsEnabled: boolean
  description: string
  policy: {
    minLength: number
    requireUppercase: boolean
    requireLowercase: boolean
    requireDigit: boolean
    requireSpecial: boolean
  }
}
