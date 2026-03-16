import type { NextFunction, Request, Response, Router } from 'express'
import { z } from 'zod'

import { getRequestActor, requireAuth } from '../../../../server/auth'
import { ApiError, ok, buildCursorPageInfo } from '../../../../server/http'
import { getGateIncidentDetail, listGateIncidents, resolveGateIncident, type IncidentResolveAction } from '../../application/incident-service'
import { validateOrThrow } from '../../../../server/validation'

const QuerySchema = z.object({
  siteCode: z.string().trim().min(1).optional(),
  status: z.enum(['OPEN', 'ACKED', 'RESOLVED', 'IGNORED']).optional(),
  severity: z.enum(['INFO', 'WARN', 'CRITICAL']).optional(),
  incidentType: z.string().trim().min(1).optional(),
  sourceKey: z.string().trim().min(1).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
})

const ResolveSchema = z.object({
  action: z.enum(['WARNING_ACKNOWLEDGED', 'WHEEL_LOCK_REQUESTED', 'DISMISSED', 'IGNORED', 'RESOLVED']),
  note: z.string().trim().max(2000).optional(),
  evidenceMediaId: z.union([z.string().trim().min(1), z.number().int().positive()]).optional(),
})

function parseIncidentId(raw: string) {
  const value = String(raw ?? '').trim()
  if (!/^\d+$/.test(value)) throw new ApiError({ code: 'BAD_REQUEST', message: 'incidentId không hợp lệ' })
  return value
}

export function registerGateIncidentRoutes(api: Router) {
  api.get('/ops/incidents', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(QuerySchema, req.query ?? {})
      const page = await listGateIncidents(parsed)
      const pageInfo = buildCursorPageInfo({
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        limit: parsed.limit ?? 50,
        sort: 'incidentId:desc',
      })
      res.json(ok((req as any).id, {
        rows: page.rows,
        nextCursor: pageInfo.nextCursor,
        pageInfo,
      }))
    } catch (error) { next(error) }
  })

  api.get('/ops/incidents/:incidentId', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detail = await getGateIncidentDetail(parseIncidentId(req.params.incidentId))
      if (!detail) throw new ApiError({ code: 'NOT_FOUND', message: 'Incident không tồn tại' })
      res.json(ok((req as any).id, detail))
    } catch (error) { next(error) }
  })

  api.post('/ops/incidents/:incidentId/resolve', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(ResolveSchema, req.body ?? {})
      const actor = getRequestActor(req)
      const detail = await resolveGateIncident({
        incidentId: parseIncidentId(req.params.incidentId),
        action: parsed.action as IncidentResolveAction,
        note: parsed.note ?? null,
        evidenceMediaId: parsed.evidenceMediaId == null ? null : String(parsed.evidenceMediaId),
        actor: { role: actor.role, actorUserId: actor.actorUserId ?? null, actorLabel: actor.actorLabel },
      })
      res.json(ok((req as any).id, detail))
    } catch (error) { next(error) }
  })
}
