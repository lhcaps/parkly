import type { NextFunction, Request, Response, Router } from 'express'
import { z } from 'zod'

import { requireAuth, tryResolveAuthFromRequest } from '../../../../server/auth'
import { ApiError, ok } from '../../../../server/http'
import { authService, serializePrincipal } from '../../application/auth-service'
import type { AppRole } from '../../../../server/config'
import { validateOrThrow } from '../../../../server/validation'

const LoginBodySchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  role: z.enum(['ADMIN', 'OPS', 'GUARD', 'CASHIER', 'WORKER']).optional(),
})

const RefreshBodySchema = z.object({
  refreshToken: z.string().trim().min(1),
})

const LogoutBodySchema = z.object({
  refreshToken: z.string().trim().min(1).optional(),
}).partial()

const RevokeAllBodySchema = z.object({
  reason: z.string().trim().min(1).max(255).optional(),
  exceptSessionId: z.string().trim().min(1).max(36).optional(),
}).partial()

const AdminUserMutationBodySchema = z.object({
  reason: z.string().trim().min(1).max(255).optional(),
}).partial()

const AdminUserParamsSchema = z.object({
  userId: z.string().trim().min(1),
})

const ALL_ROLES: AppRole[] = ['ADMIN', 'OPS', 'GUARD', 'CASHIER', 'WORKER']

function getRequestIp(req: Request) {
  const reqWithNet = req as Request & { ip?: unknown; socket?: { remoteAddress?: unknown } }
  const directIp = String(reqWithNet.ip ?? reqWithNet.socket?.remoteAddress ?? '').trim()
  const forwardedIp = String(req.header('x-forwarded-for') ?? '').split(',')[0]?.trim() ?? ''
  return directIp || forwardedIp || null
}

function getUserAgent(req: Request) {
  return String(req.header('user-agent') ?? '').trim() || null
}

function extractBearer(req: Request): string | null {
  const value = String(req.header('authorization') ?? '').trim()
  const match = /^Bearer\s+(.+)$/i.exec(value)
  return match?.[1] ? String(match[1]).trim() : null
}

export function registerAuthRoutes(api: Router) {
  api.get('/auth/password-policy', (req: Request, res: Response) => {
    res.json(ok((req as any).id, authService.getPasswordPolicy()))
  })

  api.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(LoginBodySchema, req.body ?? {})

      const data = await authService.login({
        username: parsed.username,
        password: parsed.password,
        role: parsed.role,
        ipAddress: getRequestIp(req),
        userAgent: getUserAgent(req),
      })

      res.json(ok((req as any).id, {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        accessExpiresAt: data.accessExpiresAt,
        refreshExpiresAt: data.refreshExpiresAt,
        principal: serializePrincipal(data.principal),
      }))
    } catch (error) {
      next(error)
    }
  })

  api.post('/auth/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(RefreshBodySchema, req.body ?? {})

      const data = await authService.refresh({
        refreshToken: parsed.refreshToken,
        ipAddress: getRequestIp(req),
        userAgent: getUserAgent(req),
      })

      res.json(ok((req as any).id, {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        accessExpiresAt: data.accessExpiresAt,
        refreshExpiresAt: data.refreshExpiresAt,
        principal: serializePrincipal(data.principal),
      }))
    } catch (error) {
      next(error)
    }
  })

  api.post('/auth/logout', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(LogoutBodySchema, req.body ?? {})

      const existingPrincipal = await tryResolveAuthFromRequest(req)
      const accessToken = extractBearer(req)
      const result = await authService.logout({
        accessToken,
        refreshToken: parsed.refreshToken ?? null,
        reason: existingPrincipal?.principalType === 'USER' ? `LOGOUT:${existingPrincipal.userId}` : 'LOGOUT',
      })

      res.json(ok((req as any).id, {
        revoked: result.revoked,
        principal: result.principal ? serializePrincipal(result.principal) : null,
      }))
    } catch (error) {
      next(error)
    }
  })

  api.post('/auth/revoke-all', requireAuth(ALL_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(RevokeAllBodySchema, req.body ?? {})
      const principal = (req as any).auth!
      if (principal.principalType !== 'USER') throw new ApiError({ code: 'FORBIDDEN', message: 'Service principal không được self revoke session user' })
      const result = await authService.revokeAllUserSessions({
        targetUserId: principal.userId,
        actor: principal,
        reason: parsed.reason ?? 'SELF_REVOKE_ALL',
        exceptSessionId: parsed.exceptSessionId ?? null,
      })

      res.json(ok((req as any).id, {
        userId: result.user.userId,
        revokedSessionCount: result.revokedSessionIds.length,
        revokedSessionIds: result.revokedSessionIds,
      }))
    } catch (error) {
      next(error)
    }
  })

  api.post('/auth/admin/users/:userId/revoke-all', requireAuth(['ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = validateOrThrow(AdminUserParamsSchema, req.params ?? {})
      const parsed = validateOrThrow(AdminUserMutationBodySchema, req.body ?? {})
      const result = await authService.revokeAllUserSessions({
        targetUserId: params.userId,
        actor: (req as any).auth!,
        reason: parsed.reason ?? 'ADMIN_REVOKE_ALL',
      })
      res.json(ok((req as any).id, {
        userId: result.user.userId,
        revokedSessionCount: result.revokedSessionIds.length,
        revokedSessionIds: result.revokedSessionIds,
      }))
    } catch (error) {
      next(error)
    }
  })

  api.post('/auth/admin/users/:userId/disable', requireAuth(['ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = validateOrThrow(AdminUserParamsSchema, req.params ?? {})
      const parsed = validateOrThrow(AdminUserMutationBodySchema, req.body ?? {})
      const user = await authService.setUserStatus({
        targetUserId: params.userId,
        status: 'DISABLED',
        actor: (req as any).auth!,
        reason: parsed.reason ?? 'ADMIN_DISABLED',
      })
      res.json(ok((req as any).id, {
        userId: user.userId,
        username: user.username,
        status: user.status,
      }))
    } catch (error) {
      next(error)
    }
  })

  api.post('/auth/admin/users/:userId/enable', requireAuth(['ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = validateOrThrow(AdminUserParamsSchema, req.params ?? {})
      const parsed = validateOrThrow(AdminUserMutationBodySchema, req.body ?? {})
      const user = await authService.setUserStatus({
        targetUserId: params.userId,
        status: 'ACTIVE',
        actor: (req as any).auth!,
        reason: parsed.reason ?? 'ADMIN_ENABLED',
      })
      res.json(ok((req as any).id, {
        userId: user.userId,
        username: user.username,
        status: user.status,
      }))
    } catch (error) {
      next(error)
    }
  })

  api.get('/auth/me', requireAuth(ALL_ROLES), async (req: Request, res: Response) => {
    res.json(ok((req as any).id, serializePrincipal((req as any).auth!)))
  })
}
