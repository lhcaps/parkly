import type { Router } from 'express'

import { GATE_MONITOR_READ_ROLES } from '../../../../server/auth-policies'
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
import { filterRowsBySiteCodes, resolveAuthorizedSiteScope } from '../../../../server/services/read-models/site-scope'
import { getLaneStatusSnapshot, getRealtimeThresholds, pumpBarrierCommandLifecycle } from '../../../../server/services/gate-realtime.service'

// ─── Role definitions ───────────────────────────────────────────────────────
// SUPER_ADMIN bypasses ALL role checks (see requireAuth in server/auth.ts).

const CHANNEL = 'lane-status'

export function registerLaneStatusStream(api: Router) {
  api.get('/stream/lane-status', requireAuth(GATE_MONITOR_READ_ROLES), async (req, res, next) => {
    try {
      const siteCode = typeof req.query.siteCode === 'string' && req.query.siteCode.trim() ? req.query.siteCode.trim() : undefined
      const scope = await resolveAuthorizedSiteScope({
        principal: req.auth!,
        requestedSiteCode: siteCode ?? null,
        resourceLabel: 'lane status',
      })
      const allowedSiteCodes = new Set(scope.siteCodes)
      initSse(res)
      writeLegacySseEvent(res, 'hello', { ts: Date.now(), kind: 'lane_status' })

      const replayAfter = resolveRequestLastEventSequence(req, CHANNEL)
      const replay = scope.requestedSiteCode
        ? filterReplayBySite(await getSseReplaySince(CHANNEL, replayAfter), scope.requestedSiteCode)
        : (await getSseReplaySince(CHANNEL, replayAfter)).filter((item) => {
            const replaySiteCode = item.siteCode == null ? null : String(item.siteCode)
            return replaySiteCode != null && allowedSiteCodes.has(replaySiteCode)
          })
      for (const item of replay) writeSseEnvelope(res, CHANNEL, item)

      let previous = new Map<string, { row: any; fingerprint: string }>()

      const emit = async (initial = false) => {
        const barrierLifecycle = await pumpBarrierCommandLifecycle()
        const rows = scope.requestedSiteCode
          ? await getLaneStatusSnapshot(scope.requestedSiteCode)
          : filterRowsBySiteCodes(await getLaneStatusSnapshot(), scope.siteCodes)
        const current = createRowDiff(rows, (row) => keyOf([row.siteCode, row.laneCode]))
        const diff = diffRowMaps(previous, current)
        const hasBarrierLifecycle = barrierLifecycle.promotedToSent > 0 || barrierLifecycle.timedOut > 0
        const hasChanges = initial || diff.upserts.length > 0 || diff.removes.length > 0 || hasBarrierLifecycle

        if (hasChanges) {
          for (const row of diff.upserts) {
            const envelope = await publishSseEnvelope(CHANNEL, {
              eventType: 'lane.status.upsert',
              siteCode: row.siteCode,
              laneCode: row.laneCode,
              payload: row,
            })
            writeSseEnvelope(res, CHANNEL, envelope)
          }

          for (const key of diff.removes) {
            const [removedSiteCode, removedLaneCode] = key.split('::')
            const envelope = await publishSseEnvelope(CHANNEL, {
              eventType: 'lane.status.remove',
              siteCode: removedSiteCode || null,
              laneCode: removedLaneCode || null,
              payload: {
                siteCode: removedSiteCode || null,
                laneCode: removedLaneCode || null,
              },
            })
            writeSseEnvelope(res, CHANNEL, envelope)
          }

          if (hasBarrierLifecycle) {
            const envelope = await publishSseEnvelope(CHANNEL, {
              eventType: 'lane.barrier.lifecycle',
              siteCode: scope.requestedSiteCode ?? null,
              payload: barrierLifecycle,
            })
            writeSseEnvelope(res, CHANNEL, envelope)
          }

          writeLegacySseEvent(res, 'lane_status_snapshot', {
            ts: Date.now(),
            siteCode: scope.requestedSiteCode ?? null,
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
