import type { Router } from 'express'

import { requireAuth } from '../../../../server/auth'
import { getOutboxSnapshot, getRealtimeThresholds, pumpBarrierCommandLifecycle } from '../../../../server/services/gate-realtime.service'

function initSse(res: any) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()
}

function send(res: any, event: string, data: unknown) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export function registerOutboxStream(api: Router) {
  api.get('/stream/outbox', requireAuth(['ADMIN', 'OPS', 'GUARD', 'WORKER']), async (req, res, next) => {
    try {
      const siteCode = typeof req.query.siteCode === 'string' && req.query.siteCode.trim() ? req.query.siteCode.trim() : undefined
      const limitRaw = Number(req.query.limit ?? 40)
      const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.trunc(limitRaw))) : 40
      initSse(res)

      const emit = async () => {
        const barrierLifecycle = await pumpBarrierCommandLifecycle()
        const rows = await getOutboxSnapshot({ siteCode, limit })
        send(res, 'outbox_snapshot', {
          ts: Date.now(),
          siteCode: siteCode ?? null,
          barrierLifecycle,
          rows,
        })
      }

      send(res, 'hello', { ts: Date.now(), kind: 'outbox' })
      try {
        await emit()
      } catch (error) {
        send(res, 'stream_error', { message: error instanceof Error ? error.message : String(error) })
        res.end()
        return
      }

      const timer = setInterval(async () => {
        try {
          await emit()
          res.write(`: ping ${Date.now()}\n\n`)
        } catch (error) {
          send(res, 'stream_error', { message: error instanceof Error ? error.message : String(error) })
          clearInterval(timer)
          res.end()
        }
      }, getRealtimeThresholds().ssePollMs)

      req.on('close', () => clearInterval(timer))
    } catch (error) {
      next(error)
    }
  })
}
