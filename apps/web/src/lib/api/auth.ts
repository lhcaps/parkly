import { asCanonicalAuthRole } from '@parkly/contracts'

import { apiFetch, postJson } from '@/lib/http/client'
import { ApiError, extractRequestId, isRecord } from '@/lib/http/errors'
import type { AuthPrincipal, AuthTokenBundle, PasswordPolicyDescriptor, SiteScopeInfo } from '@/lib/contracts/auth'

function normalizeSiteScope(value: unknown): SiteScopeInfo {
  const row = isRecord(value) ? value : {}
  return {
    siteId: typeof row.siteId === 'string' ? row.siteId : '',
    siteCode: typeof row.siteCode === 'string' ? row.siteCode : '',
    scopeLevel: typeof row.scopeLevel === 'string' ? row.scopeLevel : '',
  }
}

function requireAuthRole(value: unknown, context: string, requestId?: string) {
  const role = asCanonicalAuthRole(value)
  if (role) return role

  throw new ApiError({
    code: 'INVALID_AUTH_ROLE',
    message: `${context} returned an invalid role value.`,
    requestId,
  })
}

function normalizePrincipal(value: unknown): AuthPrincipal {
  const row = isRecord(value) ? value : {}
  const requestId = extractRequestId(row)
  const principalType = row.principalType === 'SERVICE' ? 'SERVICE' : 'USER'

  if (principalType === 'SERVICE') {
    return {
      principalType,
      role: typeof row.role === 'string' ? row.role : '',
      actorLabel: typeof row.actorLabel === 'string' ? row.actorLabel : '',
      serviceCode: typeof row.serviceCode === 'string' ? row.serviceCode : '',
      siteScopes: [],
    }
  }

  const siteScopes = Array.isArray(row.siteScopes) ? row.siteScopes.map(normalizeSiteScope).filter((item) => item.siteCode) : []
  return {
    principalType,
    role: requireAuthRole(row.role, 'Auth principal', requestId),
    actorLabel: typeof row.actorLabel === 'string' ? row.actorLabel : '',
    userId: typeof row.userId === 'string' ? row.userId : '',
    username: typeof row.username === 'string' ? row.username : '',
    sessionId: typeof row.sessionId === 'string' ? row.sessionId : '',
    siteScopes,
  }
}

function parseAuthTokenBundle(value: unknown): AuthTokenBundle {
  const row = isRecord(value) ? value : {}
  return {
    accessToken: typeof row.accessToken === 'string' ? row.accessToken : '',
    refreshToken: typeof row.refreshToken === 'string' ? row.refreshToken : '',
    accessExpiresAt: typeof row.accessExpiresAt === 'string' ? row.accessExpiresAt : '',
    refreshExpiresAt: typeof row.refreshExpiresAt === 'string' ? row.refreshExpiresAt : '',
    principal: normalizePrincipal(row.principal),
  }
}

export function getAuthPasswordPolicy() {
  return apiFetch<PasswordPolicyDescriptor>('/api/auth/password-policy', undefined, (value) => {
    const row = isRecord(value) ? value : {}
    const policy = isRecord(row.policy) ? row.policy : {}
    return {
      bootstrapProfile: row.bootstrapProfile === 'PRODUCTION' ? 'PRODUCTION' : 'DEMO',
      demoSeedCredentialsEnabled: Boolean(row.demoSeedCredentialsEnabled),
      description: typeof row.description === 'string' ? row.description : '',
      policy: {
        minLength: typeof policy.minLength === 'number' ? policy.minLength : 0,
        requireUppercase: Boolean(policy.requireUppercase),
        requireLowercase: Boolean(policy.requireLowercase),
        requireDigit: Boolean(policy.requireDigit),
        requireSpecial: Boolean(policy.requireSpecial),
      },
    }
  })
}

export function loginWithPassword(input: { username: string; password: string; role?: string | null }) {
  return postJson<AuthTokenBundle>('/api/auth/login', {
    username: input.username,
    password: input.password,
    ...(input.role ? { role: input.role } : {}),
  }, parseAuthTokenBundle)
}

export function refreshAuthSession(refreshToken: string) {
  return postJson<AuthTokenBundle>('/api/auth/refresh', { refreshToken }, (value) => {
    const row = parseAuthTokenBundle(value)
    return {
      ...row,
      refreshToken: row.refreshToken || refreshToken,
    }
  })
}

export function logoutAuthSession(refreshToken?: string | null) {
  return postJson<{ revoked: boolean; principal: AuthPrincipal | null }>('/api/auth/logout', refreshToken ? { refreshToken } : {}, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      revoked: Boolean(row.revoked),
      principal: row.principal == null ? null : normalizePrincipal(row.principal),
    }
  })
}

export function getAuthMe() {
  return apiFetch<AuthPrincipal>('/api/auth/me', undefined, normalizePrincipal)
}
