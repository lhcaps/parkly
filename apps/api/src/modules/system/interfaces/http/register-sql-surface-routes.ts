import type { NextFunction, Request, Response, Router } from 'express'
import { z } from 'zod'

import { ALL_CANONICAL_USER_ROLES, ADMIN_OPS_ROLES } from '../../../../server/auth-policies'
import { requireAuth } from '../../../../server/auth'
import { ok } from '../../../../server/http'
import { validateOrThrow } from '../../../../server/validation'
import {
  cleanupSqlAuthSessions,
  createSqlManualReview,
  forceSqlLaneRecovery,
  getSqlSurfaceSnapshot,
  quoteSqlTicketPrice,
  revokeSqlUserSessions,
} from '../../application/sql-surface.service'

const SnapshotQuery = z.object({
  siteCode: z.string().trim().min(1).optional(),
})

const RevokeUserSessionsBody = z.object({
  targetUserId: z.union([z.string().trim().regex(/^\d+$/), z.number().int().positive()]),
  exceptSessionId: z.string().trim().min(1).optional().nullable(),
  reason: z.string().trim().max(255).optional().nullable(),
})

const ForceLaneRecoveryBody = z.object({
  laneId: z.union([z.string().trim().regex(/^\d+$/), z.number().int().positive()]),
})

const ManualReviewBody = z.object({
  sessionId: z.union([z.string().trim().regex(/^\d+$/), z.number().int().positive()]),
  queueReasonCode: z.string().trim().max(64).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
})

const PricingQuoteBody = z.object({
  siteCode: z.string().trim().min(1),
  vehicleType: z.enum(['CAR', 'MOTORBIKE']),
  entryTime: z.string().datetime(),
  exitTime: z.string().datetime(),
})

export function registerSqlSurfaceRoutes(api: Router) {
  api.get('/ops/sql-surface', requireAuth(ALL_CANONICAL_USER_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(SnapshotQuery, req.query ?? {})
      const data = await getSqlSurfaceSnapshot({
        principal: req.auth!,
        requestedSiteCode: parsed.siteCode ?? null,
      })
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })

  api.post('/ops/sql-surface/actions/auth-cleanup', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await cleanupSqlAuthSessions()
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })

  api.post('/ops/sql-surface/actions/revoke-user-sessions', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(RevokeUserSessionsBody, req.body ?? {})
      const data = await revokeSqlUserSessions({
        principal: req.auth!,
        targetUserId: String(parsed.targetUserId),
        exceptSessionId: parsed.exceptSessionId ?? null,
        reason: parsed.reason ?? null,
      })
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })

  api.post('/ops/sql-surface/actions/force-lane-recovery', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(ForceLaneRecoveryBody, req.body ?? {})
      const data = await forceSqlLaneRecovery({
        principal: req.auth!,
        laneId: String(parsed.laneId),
      })
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })

  api.post('/ops/sql-surface/actions/create-manual-review', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(ManualReviewBody, req.body ?? {})
      const data = await createSqlManualReview({
        principal: req.auth!,
        sessionId: String(parsed.sessionId),
        queueReasonCode: parsed.queueReasonCode ?? null,
        note: parsed.note ?? null,
      })
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })

  api.post('/ops/sql-surface/actions/pricing-quote', requireAuth(ALL_CANONICAL_USER_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(PricingQuoteBody, req.body ?? {})
      const data = await quoteSqlTicketPrice({
        principal: req.auth!,
        siteCode: parsed.siteCode,
        vehicleType: parsed.vehicleType,
        entryTime: new Date(parsed.entryTime),
        exitTime: new Date(parsed.exitTime),
      })
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })
}
