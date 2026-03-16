export type AuthRole = 'ADMIN' | 'OPS' | 'GUARD' | 'CASHIER' | 'WORKER'

export type SiteScopeInfo = {
  siteId: string
  siteCode: string
  scopeLevel: string
}

export type UserPrincipalDto = {
  principalType: 'USER'
  role: AuthRole
  actorLabel: string
  userId: string
  username: string
  sessionId: string
  siteScopes: SiteScopeInfo[]
}

export type ServicePrincipalDto = {
  principalType: 'SERVICE'
  role: AuthRole
  actorLabel: string
  serviceCode: string
  siteScopes: []
}

export type AuthPrincipal = UserPrincipalDto | ServicePrincipalDto

export type AuthTokenBundle = {
  accessToken: string
  refreshToken: string
  accessExpiresAt: string
  refreshExpiresAt: string
  principal: AuthPrincipal
}

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
