import type { NextFunction, Request, Response, Router } from 'express'

import { config } from '../../../../server/config'
import { ok } from '../../../../server/http'
import { ingestZonePresenceEvent } from '../../application/ingest-zone-presence-event'

function requireInternalApiKey(req: Request, res: Response, next: NextFunction) {
  const providedKey = String(req.header('x-internal-api-key') ?? '').trim()
  if (!providedKey) {
    const rid = (req as any).id ?? 'unknown'
    res.status(401).json({
      requestId: rid,
      code: 'UNAUTHORIZED',
      message: 'Missing x-internal-api-key header',
      details: {},
    })
    return
  }

  const expectedKey = String(process.env.INTERNAL_PRESENCE_API_KEY ?? config.tokens.WORKER ?? '').trim()
  if (!expectedKey) {
    const rid = (req as any).id ?? 'unknown'
    res.status(503).json({
      requestId: rid,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Internal presence endpoint not configured; set INTERNAL_PRESENCE_API_KEY or explicitly enable legacy worker token fallback',
      details: {},
    })
    return
  }

  if (providedKey !== expectedKey) {
    const rid = (req as any).id ?? 'unknown'
    res.status(403).json({
      requestId: rid,
      code: 'FORBIDDEN',
      message: 'Invalid x-internal-api-key',
      details: {},
    })
    return
  }

  next()
}

export function registerZonePresenceRoutes(api: Router) {
  api.post('/internal/presence-events', requireInternalApiKey, async (req: Request, res: Response, next: NextFunction) => {
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
