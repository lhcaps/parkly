import type { Router, Request, Response, NextFunction } from 'express'

import { requireAuth, getRequestActor } from '../../../server/auth'
import { ADMIN_OPS_ROLES } from '../../../server/auth-policies'
import { ApiError, ok } from '../../../server/http'
import { validateOrThrow } from '../../../server/validation'

import {
  ListCustomersQuerySchema,
  CustomerIdParamSchema,
  CreateCustomerBodySchema,
  UpdateCustomerBodySchema,
} from './customer-management.schemas'

import {
  listCustomers,
  getCustomerDetail,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../application/customer-management.service'

export function registerCustomerManagementRoutes(api: Router) {
  // ── List Customers ─────────────────────────────────────────────────────────

  api.get('/admin/customers', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const query = validateOrThrow(ListCustomersQuerySchema, req.query ?? {})
      const result = await listCustomers({
        search: query.search,
        status: query.status,
        vehicleType: query.vehicleType,
        cursor: query.cursor,
        limit: query.limit,
      })
      res.json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })

  // ── Get Customer Detail ────────────────────────────────────────────────────

  api.get('/admin/customers/:customerId', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const params = validateOrThrow(CustomerIdParamSchema, req.params ?? {})
      const detail = await getCustomerDetail(params.customerId)
      res.json(ok(rid, detail))
    } catch (e) {
      next(e)
    }
  })

  // ── Create Customer ──────────────────────────────────────────────────────────

  api.post('/admin/customers', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const body = validateOrThrow(CreateCustomerBodySchema, req.body ?? {})
      const actor = getRequestActor(req)

      const result = await createCustomer({
        fullName: body.fullName,
        phone: body.phone,
        email: body.email || undefined,
        actorUserId: actor.actorUserId,
      })

      res.status(201).json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })

  // ── Update Customer ────────────────────────────────────────────────────────

  api.patch('/admin/customers/:customerId', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const params = validateOrThrow(CustomerIdParamSchema, req.params ?? {})
      const body = validateOrThrow(UpdateCustomerBodySchema, req.body ?? {})
      const actor = getRequestActor(req)

      const result = await updateCustomer(params.customerId, {
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        status: body.status,
        actorUserId: actor.actorUserId,
      })

      res.json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })

  // ── Delete Customer ─────────────────────────────────────────────────────────

  api.delete('/admin/customers/:customerId', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const params = validateOrThrow(CustomerIdParamSchema, req.params ?? {})
      const actor = getRequestActor(req)

      await deleteCustomer(params.customerId, actor.actorUserId)

      res.json(ok(rid, { customerId: params.customerId }))
    } catch (e) {
      next(e)
    }
  })
}
