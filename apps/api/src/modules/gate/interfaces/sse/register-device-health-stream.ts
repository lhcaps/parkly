import type { Router } from 'express'

import { requireAuth } from '../../../../server/auth'
import { getDeviceHealthSnapshot, getRealtimeThresholds } from '../../../../server/services/gate-realtime.service'

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

export function registerDeviceHealthStream(api: Router) {
  api.get('/stream/device-health', requireAuth(['ADMIN', 'OPS', 'GUARD', 'WORKER']), async (req, res, next) => {
    try {
      const siteCode = typeof req.query.siteCode === 'string' && req.query.siteCode.trim() ? req.query.siteCode.trim() : undefined
      initSse(res)

      const emit = async () => {
        const rows = await getDeviceHealthSnapshot(siteCode)
        send(res, 'device_health_snapshot', {
          ts: Date.now(),
          siteCode: siteCode ?? null,
          rows,
        })
      }

      send(res, 'hello', { ts: Date.now(), kind: 'device_health' })
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
