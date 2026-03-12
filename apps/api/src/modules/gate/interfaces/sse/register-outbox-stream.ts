import type { Router } from 'express'

import { requireAuth } from '../../../../server/auth'
import {
  createRowDiff,
  diffRowMaps,
  filterReplayBySite,
  getSseReplaySince,
  initSse,
  keyOf,
  publishSseEnvelope,
  resolveRequestLastEventSequence,
  writeLegacySseEvent,
  writeSseComment,
  writeSseEnvelope,
} from '../../../../server/sse-contract'
import { getOutboxSnapshot, getRealtimeThresholds, pumpBarrierCommandLifecycle } from '../../../../server/services/gate-realtime.service'

const CHANNEL = 'outbox'

export function registerOutboxStream(api: Router) {
  api.get('/stream/outbox', requireAuth(['ADMIN', 'OPS', 'GUARD', 'WORKER']), async (req, res, next) => {
    try {
      const siteCode = typeof req.query.siteCode === 'string' && req.query.siteCode.trim() ? req.query.siteCode.trim() : undefined
      const limitRaw = Number(req.query.limit ?? 40)
      const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.trunc(limitRaw))) : 40
      initSse(res)
      writeLegacySseEvent(res, 'hello', { ts: Date.now(), kind: 'outbox' })

      const replayAfter = resolveRequestLastEventSequence(req, CHANNEL)
      const replay = filterReplayBySite(await getSseReplaySince(CHANNEL, replayAfter), siteCode)
      for (const item of replay) writeSseEnvelope(res, CHANNEL, item)

      let previous = new Map<string, { row: any; fingerprint: string }>()

      const emit = async (initial = false) => {
        const barrierLifecycle = await pumpBarrierCommandLifecycle()
        const rows = await getOutboxSnapshot({ siteCode, limit })
        const current = createRowDiff(rows, (row) => keyOf([row.outboxId]))
        const diff = diffRowMaps(previous, current)
        const hasBarrierLifecycle = barrierLifecycle.promotedToSent > 0 || barrierLifecycle.timedOut > 0
        const hasChanges = initial || diff.upserts.length > 0 || diff.removes.length > 0 || hasBarrierLifecycle

        if (hasChanges) {
          for (const row of diff.upserts) {
            const envelope = await publishSseEnvelope(CHANNEL, {
              eventType: 'outbox.item.upsert',
              siteCode: row.siteCode,
              laneCode: row.laneCode,
              payload: row,
            })
            writeSseEnvelope(res, CHANNEL, envelope)
          }

          for (const key of diff.removes) {
            const [removedOutboxId] = key.split('::')
            const envelope = await publishSseEnvelope(CHANNEL, {
              eventType: 'outbox.item.remove',
              siteCode: siteCode ?? null,
              payload: { outboxId: removedOutboxId || null },
            })
            writeSseEnvelope(res, CHANNEL, envelope)
          }

          if (hasBarrierLifecycle) {
            const envelope = await publishSseEnvelope(CHANNEL, {
              eventType: 'outbox.barrier.lifecycle',
              siteCode: siteCode ?? null,
              payload: barrierLifecycle,
            })
            writeSseEnvelope(res, CHANNEL, envelope)
          }

          writeLegacySseEvent(res, 'outbox_snapshot', {
            ts: Date.now(),
            siteCode: siteCode ?? null,
            barrierLifecycle,
            rows,
          })
        }

        previous = current
      }

      try {
        await emit(true)
      } catch (error) {
        writeLegacySseEvent(res, 'stream_error', { message: error instanceof Error ? error.message : String(error) })
        res.end()
        return
      }

      const timer = setInterval(async () => {
        try {
          await emit(false)
          writeSseComment(res, `ping ${Date.now()}`)
        } catch (error) {
          writeLegacySseEvent(res, 'stream_error', { message: error instanceof Error ? error.message : String(error) })
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
