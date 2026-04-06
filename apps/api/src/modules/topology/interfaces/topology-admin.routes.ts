import type { Router, Request, Response, NextFunction } from 'express'

import { requireAuth, getRequestActor } from '../../../server/auth'
import { ADMIN_OPS_ROLES } from '../../../server/auth-policies'
import { ok } from '../../../server/http'
import { validateOrThrow } from '../../../server/validation'
import type { AppRole } from '../../../server/config'

import {
  CreateSiteBodySchema,
  UpdateSiteBodySchema,
  SiteIdParamSchema,
  CreateDeviceBodySchema,
  UpdateDeviceBodySchema,
  DeviceIdParamSchema,
  CreateLaneBodySchema,
  UpdateLaneBodySchema,
  LaneIdParamSchema,
  SyncLaneDevicesBodySchema,
  UnassignedDevicesQuerySchema,
} from './topology-admin.schemas'

import {
  createSite,
  updateSite,
  createDevice,
  updateDevice,
  createLane,
  updateLane,
  syncLaneDevices,
  getUnassignedDevices,
} from '../application/topology-admin.service'

// SUPER_ADMIN bypasses all checks automatically via requireAuth internals.
// For "create site" which is SUPER_ADMIN-only, pass empty array — only SUPER_ADMIN passes.
const SUPER_ADMIN_ONLY: AppRole[] = []

export function registerTopologyAdminRoutes(api: Router) {

  // ── Sites ───────────────────────────────────────────────────────────────────

  api.post('/admin/topology/sites', requireAuth(SUPER_ADMIN_ONLY), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const body = validateOrThrow(CreateSiteBodySchema, req.body)
      const actor = getRequestActor(req)
      const result = await createSite(body, actor.actorUserId)
      res.status(201).json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })

  api.patch('/admin/topology/sites/:siteId', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const params = validateOrThrow(SiteIdParamSchema, req.params)
      const body = validateOrThrow(UpdateSiteBodySchema, req.body)
      const actor = getRequestActor(req)
      const result = await updateSite(params.siteId, body, actor.actorUserId)
      res.json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })

  // ── Devices ─────────────────────────────────────────────────────────────────

  api.post('/admin/topology/devices', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const body = validateOrThrow(CreateDeviceBodySchema, req.body)
      const actor = getRequestActor(req)
      const result = await createDevice(body, actor.actorUserId)
      res.status(201).json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })

  api.patch('/admin/topology/devices/:deviceId', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const params = validateOrThrow(DeviceIdParamSchema, req.params)
      const body = validateOrThrow(UpdateDeviceBodySchema, req.body)
      const actor = getRequestActor(req)
      const result = await updateDevice(params.deviceId, body, actor.actorUserId)
      res.json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })

  api.get('/admin/topology/devices/unassigned', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const query = validateOrThrow(UnassignedDevicesQuerySchema, req.query)
      const rows = await getUnassignedDevices(query.siteCode)
      res.json(ok(rid, { rows }))
    } catch (e) {
      next(e)
    }
  })

  // ── Lanes ───────────────────────────────────────────────────────────────────

  api.post('/admin/topology/lanes', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const body = validateOrThrow(CreateLaneBodySchema, req.body)
      const actor = getRequestActor(req)
      const result = await createLane(body, actor.actorUserId)
      res.status(201).json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })

  api.patch('/admin/topology/lanes/:laneId', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const params = validateOrThrow(LaneIdParamSchema, req.params)
      const body = validateOrThrow(UpdateLaneBodySchema, req.body)
      const actor = getRequestActor(req)
      const result = await updateLane(params.laneId, body, actor.actorUserId)
      res.json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })

  // ── Lane Device Sync (The Killer Endpoint) ─────────────────────────────────

  api.put('/admin/topology/lanes/:laneId/devices', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rid = (req as any).id
      const params = validateOrThrow(LaneIdParamSchema, req.params)
      const body = validateOrThrow(SyncLaneDevicesBodySchema, req.body)
      const actor = getRequestActor(req)
      const result = await syncLaneDevices(params.laneId, body.devices, actor.actorUserId)
      res.json(ok(rid, result))
    } catch (e) {
      next(e)
    }
  })
}
