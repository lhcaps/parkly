import type { NextFunction, Request, Response, Router } from 'express'

import { ok } from '../../../../server/http'
import { ingestZonePresenceEvent } from '../../application/ingest-zone-presence-event'

export function registerZonePresenceRoutes(api: Router) {
  api.post('/internal/presence-events', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ingestZonePresenceEvent({
        body: req.body,
        apiKey: String(req.header('x-internal-api-key') ?? '').trim() || null,
        signature: String(req.header('x-internal-signature') ?? '').trim() || null,
        timestamp: String(req.header('x-internal-timestamp') ?? '').trim() || null,
      })

      const statusCode = data.status === 'ACCEPTED' ? 202 : data.status === 'DEDUPED' ? 200 : 422
      res.status(statusCode).json(ok((req as any).id, data))
    } catch (error) {
      next(error)
    }
  })
}
