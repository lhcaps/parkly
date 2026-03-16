import type { NextFunction, Request, Response } from 'express'

import { authService, type AuthenticatedPrincipal } from '../modules/auth/application/auth-service'
import { config, type AppRole } from './config'
import { ApiError, fail } from './http'
import { setAuditActorContext } from './services/audit-service'
import { observeSecretMissingAuthHeader, observeSecretReject } from './metrics'

function extractBearer(req: Request): string | null {
  const header = String(req.header('authorization') ?? '').trim()
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1] ? String(match[1]).trim() : null
}

function extractQueryToken(req: Request): string | null {
  if (config.allowQueryToken !== 'ON') return null
  if (req.method !== 'GET') return null
  const token = String((req.query as any)?.token ?? '').trim()
  return token || null
}

function resolveRequestToken(req: Request) {
  return extractBearer(req) ?? extractQueryToken(req)
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

export function requireAuth(allowed: AppRole[]) {
  return function middleware(req: Request, res: Response, next: NextFunction) {
    void (async () => {
      const principal = await resolveAuthFromRequest(req)
      if (!allowed.includes(principal.role)) {
        throw new ApiError({ code: 'FORBIDDEN', message: `Role ${principal.role} không được phép truy cập` })
      }
      next()
    })().catch((error) => sendAuthError(req, res, error))
  }
}

export function getRequestActor(req: Request) {
  const principal = req.auth
  if (!principal) {
    throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Actor chưa được xác thực' })
  }

  if (principal.principalType === 'SERVICE') {
    return {
      role: principal.role,
      actorUserId: undefined,
      actorLabel: principal.actorLabel,
    }
  }

  return {
    role: principal.role,
    actorUserId: principal.actorUserId,
    actorLabel: principal.actorLabel,
  }
}
