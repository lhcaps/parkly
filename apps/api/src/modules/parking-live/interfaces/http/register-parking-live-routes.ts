import type { NextFunction, Request, Response, Router } from 'express'
import { z } from 'zod'

import { requireAuth } from '../../../../server/auth'
import { ApiError, ok } from '../../../../server/http'
import { getParkingLiveSpotDetail } from '../../application/get-parking-live-spot-detail'
import { getParkingLiveSummary } from '../../application/get-parking-live-summary'
import { listParkingLiveBoard } from '../../application/list-parking-live-board'


const BooleanishSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') return value
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return undefined
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true
  if (['0', 'false', 'no', 'off'].includes(raw)) return false
  return value
}, z.boolean().optional())

const ParkingLiveStatusEnum = z.enum([
  'EMPTY',
  'OCCUPIED_MATCHED',
  'OCCUPIED_UNKNOWN',
  'OCCUPIED_VIOLATION',
  'SENSOR_STALE',
  'BLOCKED',
  'RESERVED',
])

const BoardQuerySchema = z.object({
  siteCode: z.string().trim().min(1),
  floorKey: z.string().trim().min(1).optional(),
  zoneCode: z.string().trim().min(1).optional(),
  status: ParkingLiveStatusEnum.optional(),
  q: z.string().trim().optional(),
  refresh: BooleanishSchema,
})

const SummaryQuerySchema = z.object({
  siteCode: z.string().trim().min(1),
  refresh: BooleanishSchema,
})

const SpotDetailQuerySchema = z.object({
  siteCode: z.string().trim().min(1),
  refresh: BooleanishSchema,
})

function parseOrThrow<T extends z.ZodTypeAny>(schema: T, payload: unknown) {
  const parsed = schema.safeParse(payload)
  if (parsed.success) return parsed.data

  const hasMissingSiteCode = parsed.error.issues.some((issue) => issue.path[0] === 'siteCode' && (issue.code === 'invalid_type' || issue.code === 'too_small'))
  if (hasMissingSiteCode) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Thiếu siteCode',
      details: parsed.error.flatten(),
    })
  }

  throw new ApiError({
    code: 'UNPROCESSABLE_ENTITY',
    message: 'Bộ lọc parking live không hợp lệ',
    details: parsed.error.flatten(),
  })
}

export function registerParkingLiveRoutes(api: Router) {
  api.get('/ops/parking-live', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseOrThrow(BoardQuerySchema, req.query ?? {})
      const data = await listParkingLiveBoard(query)
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })

  api.get('/ops/parking-live/summary', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseOrThrow(SummaryQuerySchema, req.query ?? {})
      const data = await getParkingLiveSummary(query)
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })

  api.get('/ops/parking-live/spots/:spotCode', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseOrThrow(SpotDetailQuerySchema, req.query ?? {})
      const spotCode = String(req.params.spotCode ?? '').trim()
      if (!spotCode) {
        throw new ApiError({ code: 'BAD_REQUEST', message: 'Thiếu spotCode' })
      }
      const data = await getParkingLiveSpotDetail({
        siteCode: query.siteCode,
        spotCode,
        refresh: query.refresh,
      })
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })
}
