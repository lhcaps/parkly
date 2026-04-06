import type { Router, Request, Response, NextFunction } from 'express'

import { authService } from '../../auth/application/auth-service'
import { requireAuth, getRequestActor } from '../../../server/auth'
import { ADMIN_OPS_ROLES, ALL_CANONICAL_USER_ROLES } from '../../../server/auth-policies'
import { ApiError, ok } from '../../../server/http'
import { validateOrThrow } from '../../../server/validation'
import type { AppRole } from '../../../server/config'

import {
  ListUsersQuerySchema,
  UserIdParamSchema,
  CreateUserBodySchema,
  UpdateUserBodySchema,
  SetUserStatusBodySchema,
  SetSiteScopesBodySchema,
  RevokeSessionsBodySchema,
} from './user-management.schemas'

import {
  listUsers,
  getUserDetail,
  createUser,
  updateUser,
  setUserSiteScopes,
  getMyProfile,
  updateMyProfile,
} from '../application/user-management.service'

const SUPER_ADMIN_ONLY: AppRole[] = []

export function registerUserManagementRoutes(api: Router) {
  // ── Me / Self Profile ───────────────────────────────────────────────────────

  api.get('/users/me/profile', requireAuth(ALL_CANONICAL_USER_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const actor = getRequestActor(req)
      if (actor.principalType !== 'USER') {
        throw new ApiError({
          code: 'FORBIDDEN',
          message: 'Hồ sơ cá nhân chỉ dành cho phiên đăng nhập người dùng',
          details: { principalType: actor.principalType },
        })
      }
      const profile = await getMyProfile(actor.userId)
      res.json(ok(rid, profile))
    } catch (e) {
      next(e)
    }
  })

  api.patch('/users/me/profile', requireAuth(ALL_CANONICAL_USER_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const actor = getRequestActor(req)
      if (actor.principalType !== 'USER') {
        throw new ApiError({
          code: 'FORBIDDEN',
          message: 'Cập nhật hồ sơ chỉ dành cho phiên đăng nhập người dùng',
          details: { principalType: actor.principalType },
        })
      }

      const body = req.body ?? {}
      const result = await updateMyProfile(actor.userId, {
        password: body.password,
        actorUserId: actor.actorUserId,
      })
      res.json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })

  // ── Admin: List Users ──────────────────────────────────────────────────────

  api.get('/admin/users', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const query = validateOrThrow(ListUsersQuerySchema, req.query ?? {})
      const result = await listUsers({
        siteCode: query.siteCode,
        role: query.role,
        status: query.status,
        search: query.search,
        cursor: query.cursor,
        limit: query.limit,
      })
      res.json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })

  // ── Admin: Get User Detail ──────────────────────────────────────────────────

  api.get('/admin/users/:userId', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const params = validateOrThrow(UserIdParamSchema, req.params ?? {})
      const detail = await getUserDetail(params.userId)
      res.json(ok(rid, detail))
    } catch (e) {
      next(e)
    }
  })

  // ── Admin: Create User (SUPER_ADMIN only) ─────────────────────────────────

  api.post('/admin/users', requireAuth(SUPER_ADMIN_ONLY), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const body = validateOrThrow(CreateUserBodySchema, req.body ?? {})
      const actor = getRequestActor(req)

      const result = await createUser({
        username: body.username,
        password: body.password,
        role: body.role,
        siteScopes: body.siteScopes,
        mustChangePassword: body.mustChangePassword,
        actorUserId: actor.actorUserId,
      })

      res.status(201).json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })

  // ── Admin: Update User ─────────────────────────────────────────────────────

  api.patch('/admin/users/:userId', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const params = validateOrThrow(UserIdParamSchema, req.params ?? {})
      const body = validateOrThrow(UpdateUserBodySchema, req.body ?? {})
      const actor = getRequestActor(req)

      const result = await updateUser(params.userId, {
        username: body.username,
        password: body.password,
        role: body.role,
        mustChangePassword: body.mustChangePassword,
        reason: body.reason,
        actorUserId: actor.actorUserId,
      })

      res.json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })

  // ── Admin: Enable User ──────────────────────────────────────────────────────

  api.post('/admin/users/:userId/enable', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const params = validateOrThrow(UserIdParamSchema, req.params ?? {})
      const body = validateOrThrow(SetUserStatusBodySchema, req.body ?? {})

      const user = await authService.setUserStatus({
        targetUserId: params.userId,
        status: 'ACTIVE',
        actor: req.auth ?? undefined,
        reason: body.reason ?? 'ADMIN_ENABLED',
      })

      res.json(ok(rid, { userId: user.userId, username: user.username, status: user.status }))
    } catch (e) {
      next(e)
    }
  })

  // ── Admin: Disable User ─────────────────────────────────────────────────────

  api.post('/admin/users/:userId/disable', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const params = validateOrThrow(UserIdParamSchema, req.params ?? {})
      const body = validateOrThrow(SetUserStatusBodySchema, req.body ?? {})

      const user = await authService.setUserStatus({
        targetUserId: params.userId,
        status: 'DISABLED',
        actor: req.auth ?? undefined,
        reason: body.reason ?? 'ADMIN_DISABLED',
      })

      res.json(ok(rid, { userId: user.userId, username: user.username, status: user.status }))
    } catch (e) {
      next(e)
    }
  })

  // ── Admin: Set Site Scopes ──────────────────────────────────────────────────

  api.put('/admin/users/:userId/site-scopes', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const params = validateOrThrow(UserIdParamSchema, req.params ?? {})
      const body = validateOrThrow(SetSiteScopesBodySchema, req.body ?? {})
      const actor = getRequestActor(req)

      const result = await setUserSiteScopes(params.userId, body.siteScopes, actor.actorUserId)
      res.json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })

  // ── Admin: Revoke All Sessions ───────────────────────────────────────────────

  api.post('/admin/users/:userId/revoke-sessions', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const params = validateOrThrow(UserIdParamSchema, req.params ?? {})
      const body = validateOrThrow(RevokeSessionsBodySchema, req.body ?? {})

      const result = await authService.revokeAllUserSessions({
        targetUserId: params.userId,
        actor: req.auth ?? undefined,
        reason: body.reason ?? 'ADMIN_REVOKE_SESSIONS',
      })

      res.json(ok(rid, {
        userId: result.user.userId,
        revokedSessionCount: result.revokedSessionIds.length,
        revokedSessionIds: result.revokedSessionIds,
      }))
    } catch (e) {
      next(e)
    }
  })
}
