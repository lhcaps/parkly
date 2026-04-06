import type { NextFunction, Request, Response } from 'express'

import {
  authService,
  type AuthenticatedPrincipal,
  type AuthenticatedServicePrincipal,
  type AuthenticatedUserPrincipal,
} from '../modules/auth/application/auth-service'
import { config, type AppRole } from './config'
import { ApiError, fail } from './http'
import { setAuditActorContext } from './services/audit-service'
import { observeSecretMissingAuthHeader, observeSecretReject } from './metrics'

function extractBearer(req: Request): string | null {
  const header = String(req.header('authorization') ?? '').trim()
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1] ? String(match[1]).trim() : null
}

function resolveRequestToken(req: Request) {
  return extractBearer(req)
}

function getRequestMeta(req: Request) {
  const reqWithNet = req as Request & { ip?: unknown; socket?: { remoteAddress?: unknown } }
  const directIp = String(reqWithNet.ip ?? reqWithNet.socket?.remoteAddress ?? '').trim()
  const forwardedIp = String(req.header('x-forwarded-for') ?? '').split(',')[0]?.trim() ?? ''
  return {
    ipAddress: directIp || forwardedIp || null,
    userAgent: String(req.header('user-agent') ?? '').trim() || null,
  }
}

function sendAuthError(req: Request, res: Response, error: unknown) {
  const rid = (req as any).id ?? 'unknown'
  const apiError = error instanceof ApiError
    ? error
    : new ApiError({ code: 'UNAUTHENTICATED', message: 'Không thể xác thực request' })

  res.status(apiError.statusCode).json(fail(rid, {
    code: apiError.code,
    message: apiError.message,
    details: apiError.details,
  }))
}

export async function tryResolveAuthFromRequest(req: Request): Promise<AuthenticatedPrincipal | null> {
  const token = resolveRequestToken(req)
  if (!token && config.authMode !== 'OFF') {
    observeSecretMissingAuthHeader({ channel: 'ACCESS_TOKEN' })
    return null
  }
  try {
    const principal = await authService.authenticateAccessToken(token ?? '__auth_off__', getRequestMeta(req))
    req.auth = principal
    setAuditActorContext(principal)
    return principal
  } catch {
    if (token) observeSecretReject({ channel: 'ACCESS_TOKEN', reason: 'INVALID_OR_EXPIRED_TOKEN' })
    return null
  }
}

export async function resolveAuthFromRequest(req: Request): Promise<AuthenticatedPrincipal> {
  const existing = req.auth
  if (existing) return existing

  const token = resolveRequestToken(req)
  if (!token && config.authMode !== 'OFF') {
    observeSecretMissingAuthHeader({ channel: 'ACCESS_TOKEN' })
    throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Thiếu Bearer token' })
  }

  try {
    const principal = await authService.authenticateAccessToken(token ?? '__auth_off__', getRequestMeta(req))
    req.auth = principal
    setAuditActorContext(principal)
    return principal
  } catch (error) {
    if (token) observeSecretReject({ channel: 'ACCESS_TOKEN', reason: 'INVALID_OR_EXPIRED_TOKEN' })
    throw error
  }
}

const ALL_LEGACY_ROLES: AppRole[] = ['ADMIN', 'OPS', 'WORKER']

export function requireAuth(allowed: AppRole[]) {
  return function middleware(req: Request, res: Response, next: NextFunction) {
    void (async () => {
      const principal = await resolveAuthFromRequest(req)

      if (principal.role === 'SUPER_ADMIN') {
        return next()
      }

      if (!allowed.includes(principal.role)) {
        const rid = (req as any).id ?? 'unknown'
        const err = new ApiError({
          code: 'FORBIDDEN',
          message: `Role '${principal.role}' is not permitted to access this resource`,
          details: {
            requiredRoles: allowed,
            currentRole: principal.role,
            hint: 'SUPER_ADMIN bypasses all role checks',
          },
        })
        res.status(err.statusCode).json(fail(rid, {
          code: err.code,
          message: err.message,
          details: err.details,
        }))
        return
      }

      next()
    })().catch((error) => sendAuthError(req, res, error))
  }
}

export type RequestActorUser = Pick<
  AuthenticatedUserPrincipal,
  'principalType' | 'role' | 'actorUserId' | 'actorLabel' | 'userId' | 'username' | 'sessionId'
>
export type RequestActorService = Pick<AuthenticatedServicePrincipal, 'principalType' | 'role' | 'actorLabel'> & {
  actorUserId: undefined
}

export function getRequestActor(req: Request): RequestActorUser | RequestActorService {
  const principal = req.auth
  if (!principal) {
    throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Actor chưa được xác thực' })
  }

  if (principal.principalType === 'SERVICE') {
    return {
      principalType: 'SERVICE',
      role: principal.role,
      actorUserId: undefined,
      actorLabel: principal.actorLabel,
    }
  }

  return {
    principalType: 'USER',
    role: principal.role,
    actorUserId: principal.actorUserId,
    actorLabel: principal.actorLabel,
    userId: principal.userId,
    username: principal.username,
    sessionId: principal.sessionId,
  }
}
