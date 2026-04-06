import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';

import { ADMIN_OPS_ROLES } from '../../../../server/auth-policies';
import { getRequestActor, requireAuth } from '../../../../server/auth';
import { ok, withCursorPage } from '../../../../server/http';
import {
  createAdminSubscription,
  createAdminSubscriptionSpot,
  createAdminSubscriptionVehicle,
  getAdminSubscriptionDetail,
  listAdminSubscriptionSpots,
  listAdminSubscriptionVehicles,
  listAdminSubscriptions,
  updateAdminSubscription,
  updateAdminSubscriptionSpot,
  updateAdminSubscriptionVehicle,
} from '../../application/admin-subscriptions';
import { validateOrThrow } from '../../../../server/validation';

// Use canonical role groups from auth-policies. SUPER_ADMIN bypasses all role checks.

const SubscriptionListQuery = z.object({
  siteCode: z.string().trim().min(1).optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED']).optional(),
  plate: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().trim().optional(),
});

const CreateSubscriptionBody = z.object({
  siteCode: z.string().trim().min(1),
  customerId: z.coerce.string().trim().min(1),
  planType: z.enum(['MONTHLY', 'VIP']),
  startDate: z.string().trim().min(10),
  endDate: z.string().trim().min(10),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED']).optional(),
});

const PatchSubscriptionBody = z.object({
  planType: z.enum(['MONTHLY', 'VIP']).optional(),
  startDate: z.string().trim().min(10).optional(),
  endDate: z.string().trim().min(10).optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED']).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Patch body không được rỗng' });

const ListSpotQuery = z.object({
  siteCode: z.string().trim().min(1).optional(),
  subscriptionId: z.coerce.string().trim().min(1).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'RELEASED']).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().trim().optional(),
});

const CreateSpotBody = z.object({
  subscriptionId: z.coerce.string().trim().min(1),
  siteCode: z.string().trim().min(1),
  spotId: z.coerce.string().trim().min(1),
  assignedMode: z.enum(['ASSIGNED', 'PREFERRED']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'RELEASED']).optional(),
  isPrimary: z.boolean().optional(),
  assignedFrom: z.string().trim().min(10).optional().nullable(),
  assignedUntil: z.string().trim().min(10).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
});

const PatchSpotBody = z.object({
  assignedMode: z.enum(['ASSIGNED', 'PREFERRED']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'RELEASED']).optional(),
  isPrimary: z.boolean().optional(),
  assignedFrom: z.string().trim().min(10).optional().nullable(),
  assignedUntil: z.string().trim().min(10).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Patch body không được rỗng' });

const ListVehicleQuery = z.object({
  siteCode: z.string().trim().min(1).optional(),
  subscriptionId: z.coerce.string().trim().min(1).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REMOVED']).optional(),
  plate: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().trim().optional(),
});

const CreateVehicleBody = z.object({
  subscriptionId: z.coerce.string().trim().min(1),
  siteCode: z.string().trim().min(1),
  vehicleId: z.coerce.string().trim().min(1),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REMOVED']).optional(),
  isPrimary: z.boolean().optional(),
  validFrom: z.string().trim().min(10).optional().nullable(),
  validTo: z.string().trim().min(10).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
});

const PatchVehicleBody = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REMOVED']).optional(),
  isPrimary: z.boolean().optional(),
  validFrom: z.string().trim().min(10).optional().nullable(),
  validTo: z.string().trim().min(10).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Patch body không được rỗng' });

export function registerSubscriptionAdminRoutes(api: Router) {
  api.get('/admin/subscriptions', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(SubscriptionListQuery, req.query ?? {});
      const data = await listAdminSubscriptions(parsed);
      res.json(ok((req as any).id, withCursorPage(data.items, { limit: parsed.limit ?? 50, nextCursor: data.nextCursor, sort: 'subscriptionId:desc' })));
    } catch (error) {
      next(error);
    }
  });

  api.get('/admin/subscriptions/:subscriptionId', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getAdminSubscriptionDetail(String(req.params.subscriptionId));
      res.json(ok((req as any).id, data));
    } catch (error) {
      next(error);
    }
  });

  api.post('/admin/subscriptions', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = { data: validateOrThrow(CreateSubscriptionBody, req.body ?? {}) };
      const data = await createAdminSubscription(parsed.data, { actorUserId: getRequestActor(req).actorUserId });
      res.status(201).json(ok((req as any).id, data));
    } catch (error) {
      next(error);
    }
  });

  api.patch('/admin/subscriptions/:subscriptionId', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = { data: validateOrThrow(PatchSubscriptionBody, req.body ?? {}) };
      const data = await updateAdminSubscription(String(req.params.subscriptionId), parsed.data, { actorUserId: getRequestActor(req).actorUserId });
      res.json(ok((req as any).id, data));
    } catch (error) {
      next(error);
    }
  });

  api.get('/admin/subscription-spots', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(ListSpotQuery, req.query ?? {});
      const data = await listAdminSubscriptionSpots(parsed);
      res.json(ok((req as any).id, withCursorPage(data.items, { limit: parsed.limit ?? 50, nextCursor: data.nextCursor, sort: 'subscriptionSpotId:desc' })));
    } catch (error) {
      next(error);
    }
  });

  api.post('/admin/subscription-spots', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = { data: validateOrThrow(CreateSpotBody, req.body ?? {}) };
      const data = await createAdminSubscriptionSpot(parsed.data, { actorUserId: getRequestActor(req).actorUserId });
      res.status(201).json(ok((req as any).id, data));
    } catch (error) {
      next(error);
    }
  });

  api.patch('/admin/subscription-spots/:subscriptionSpotId', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = { data: validateOrThrow(PatchSpotBody, req.body ?? {}) };
      const data = await updateAdminSubscriptionSpot(String(req.params.subscriptionSpotId), parsed.data, { actorUserId: getRequestActor(req).actorUserId });
      res.json(ok((req as any).id, data));
    } catch (error) {
      next(error);
    }
  });

  api.get('/admin/subscription-vehicles', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(ListVehicleQuery, req.query ?? {});
      const data = await listAdminSubscriptionVehicles(parsed);
      res.json(ok((req as any).id, withCursorPage(data.items, { limit: parsed.limit ?? 50, nextCursor: data.nextCursor, sort: 'subscriptionVehicleId:desc' })));
    } catch (error) {
      next(error);
    }
  });

  api.post('/admin/subscription-vehicles', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = { data: validateOrThrow(CreateVehicleBody, req.body ?? {}) };
      const data = await createAdminSubscriptionVehicle(parsed.data, { actorUserId: getRequestActor(req).actorUserId });
      res.status(201).json(ok((req as any).id, data));
    } catch (error) {
      next(error);
    }
  });

  api.patch('/admin/subscription-vehicles/:subscriptionVehicleId', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = { data: validateOrThrow(PatchVehicleBody, req.body ?? {}) };
      const data = await updateAdminSubscriptionVehicle(String(req.params.subscriptionVehicleId), parsed.data, { actorUserId: getRequestActor(req).actorUserId });
      res.json(ok((req as any).id, data));
    } catch (error) {
      next(error);
    }
  });
}
