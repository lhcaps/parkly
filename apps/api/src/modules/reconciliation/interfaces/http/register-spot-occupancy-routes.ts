import type { NextFunction, Request, Response, Router } from 'express'
import { z } from 'zod'

import { requireAuth } from '../../../../server/auth'
import { ApiError, ok } from '../../../../server/http'
import {
  getSpotOccupancyProjectionDetail,
  listSpotOccupancyProjection,
  runReconciliation,
} from '../../application/run-reconciliation'

const ListSpotOccupancyQuery = z.object({
  siteCode: z.string().trim().min(1),
  spotCode: z.string().trim().optional(),
  zoneCode: z.string().trim().optional(),
  status: z.enum(['EMPTY', 'OCCUPIED_MATCHED', 'OCCUPIED_UNKNOWN', 'OCCUPIED_VIOLATION', 'SENSOR_STALE']).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  refresh: z.coerce.boolean().optional(),
})

const SpotDetailQuery = z.object({
  siteCode: z.string().trim().min(1),
  refresh: z.coerce.boolean().optional(),
})

export function registerSpotOccupancyRoutes(api: Router) {
  api.get('/ops/spot-occupancy', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = ListSpotOccupancyQuery.safeParse(req.query ?? {})
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() })

      let refreshResult: Awaited<ReturnType<typeof runReconciliation>> | null = null
      if (parsed.data.refresh) {
        refreshResult = await runReconciliation({
          siteCode: parsed.data.siteCode,
          spotCode: parsed.data.spotCode ?? null,
        })
      }

      const rows = await listSpotOccupancyProjection({
        siteCode: parsed.data.siteCode,
        spotCode: parsed.data.spotCode ?? null,
        zoneCode: parsed.data.zoneCode ?? null,
        status: parsed.data.status ?? null,
        limit: parsed.data.limit ?? 500,
      })

      res.json(ok((req as any).id, { rows, refresh: refreshResult }))
    } catch (error) {
      next(error)
    }
  })

  api.get('/ops/spot-occupancy/:spotCode', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = SpotDetailQuery.safeParse(req.query ?? {})
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() })

      let refreshResult: Awaited<ReturnType<typeof runReconciliation>> | null = null
      if (parsed.data.refresh) {
        refreshResult = await runReconciliation({
          siteCode: parsed.data.siteCode,
          spotCode: String(req.params.spotCode),
        })
      }

      const row = await getSpotOccupancyProjectionDetail({
        siteCode: parsed.data.siteCode,
        spotCode: String(req.params.spotCode),
      })
      if (!row) throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy occupancy projection cho spot này' })

      res.json(ok((req as any).id, { row, refresh: refreshResult }))
    } catch (error) {
      next(error)
    }
  })
}
