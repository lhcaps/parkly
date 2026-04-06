import type { NextFunction, Request, Response, Router } from 'express'
import { z } from 'zod'

import {
  ADMIN_OPS_CASHIER_ROLES,
  DASHBOARD_READ_ROLES,
} from '../../../../server/auth-policies'
import { requireAuth } from '../../../../server/auth'
import { ok } from '../../../../server/http'
import { validateOrThrow } from '../../../../server/validation'
import {
  getDashboardIncidentSummary,
  getDashboardLaneSummary,
  getDashboardOccupancySummary,
  getDashboardSiteSummary,
  getDashboardSubscriptionSummary,
  getDashboardSummary,
} from '../../application/dashboard-summary'

// ─── Role definitions ───────────────────────────────────────────────────────
// SUPER_ADMIN bypasses ALL role checks (see requireAuth in server/auth.ts).

const DashboardSummaryQuery = z.object({
  siteCode: z.string().trim().min(1).optional(),
  sinceHours: z.coerce.number().int().positive().max(24 * 30).optional(),
  expiringInDays: z.coerce.number().int().min(0).max(90).optional(),
})

const DashboardSliceQuery = z.object({
  siteCode: z.string().trim().min(1).optional(),
  sinceHours: z.coerce.number().int().positive().max(24 * 30).optional(),
  expiringInDays: z.coerce.number().int().min(0).max(90).optional(),
})

export function registerDashboardRoutes(api: Router) {
  api.get('/ops/dashboard/summary', requireAuth(DASHBOARD_READ_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(DashboardSummaryQuery, req.query ?? {})
      const data = await getDashboardSummary({
        principal: req.auth!,
        siteCode: parsed.siteCode ?? null,
        sinceHours: parsed.sinceHours,
        expiringInDays: parsed.expiringInDays,
      })
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })

  api.get('/ops/dashboard/sites/:siteCode/summary', requireAuth(DASHBOARD_READ_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(DashboardSliceQuery, req.query ?? {})
      const data = await getDashboardSiteSummary({
        principal: req.auth!,
        siteCode: String(req.params.siteCode ?? '').trim(),
        sinceHours: parsed.sinceHours,
        expiringInDays: parsed.expiringInDays,
      })
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })

  api.get('/ops/dashboard/incidents/summary', requireAuth(DASHBOARD_READ_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(DashboardSliceQuery, req.query ?? {})
      const data = await getDashboardIncidentSummary({
        principal: req.auth!,
        siteCode: parsed.siteCode ?? null,
        sinceHours: parsed.sinceHours,
      })
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })

  api.get('/ops/dashboard/occupancy/summary', requireAuth(DASHBOARD_READ_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(DashboardSliceQuery, req.query ?? {})
      const data = await getDashboardOccupancySummary({
        principal: req.auth!,
        siteCode: parsed.siteCode ?? null,
      })
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })

  api.get('/ops/dashboard/lanes/summary', requireAuth(DASHBOARD_READ_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(DashboardSliceQuery, req.query ?? {})
      const data = await getDashboardLaneSummary({
        principal: req.auth!,
        siteCode: parsed.siteCode ?? null,
      })
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })

  api.get('/ops/dashboard/subscriptions/summary', requireAuth(ADMIN_OPS_CASHIER_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(DashboardSliceQuery, req.query ?? {})
      const data = await getDashboardSubscriptionSummary({
        principal: req.auth!,
        siteCode: parsed.siteCode ?? null,
        expiringInDays: parsed.expiringInDays,
      })
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })
}
