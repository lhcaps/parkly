import type { NextFunction, Request, Response, Router } from 'express'
import { z } from 'zod'

import { requireAuth } from '../../../../server/auth'
import { ok, withCursorPage } from '../../../../server/http'
import { parseRequiredNumericString, validateOrThrow } from '../../../../server/validation'
import { getOpsAuditDetail, listOpsAudit } from '../../application/audit-read'

const AuditListQuery = z.object({
  siteCode: z.string().trim().min(1).optional(),
  actorUserId: z.string().trim().regex(/^\d+$/).optional(),
  action: z.string().trim().min(1).optional(),
  entityTable: z.string().trim().min(1).optional(),
  entityId: z.string().trim().min(1).optional(),
  requestId: z.string().trim().min(1).optional(),
  correlationId: z.string().trim().min(1).optional(),
  from: z.string().trim().min(10).optional(),
  to: z.string().trim().min(10).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().trim().regex(/^\d+$/).optional(),
})

export function registerAuditRoutes(api: Router) {
  api.get('/ops/audit', requireAuth(['ADMIN', 'OPS']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(AuditListQuery, req.query ?? {})
      const data = await listOpsAudit(parsed)
      res.json(ok((req as any).id, withCursorPage(data.items, {
        limit: parsed.limit ?? 50,
        nextCursor: data.nextCursor,
        sort: 'auditId:desc',
      })))
    } catch (error) {
      next(error)
    }
  })

  api.get('/ops/audit/:auditId', requireAuth(['ADMIN', 'OPS']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auditId = parseRequiredNumericString(req.params.auditId, 'auditId')
      const data = await getOpsAuditDetail(auditId)
      res.json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })
}
