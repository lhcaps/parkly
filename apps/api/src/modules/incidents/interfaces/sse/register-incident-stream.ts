import type { Router } from 'express'

import { requireAuth } from '../../../../server/auth'
import {
  filterReplayBySite,
  getSseReplaySince,
  initSse,
  resolveRequestLastEventSequence,
  writeLegacySseEvent,
  writeSseComment,
  writeSseEnvelope,
} from '../../../../server/sse-contract'
import { INCIDENT_SSE_CHANNEL, subscribeIncidentEvents } from '../../application/incident-bus'
import { listGateIncidents } from '../../application/incident-service'

export function registerIncidentStream(api: Router) {
  api.get('/stream/incidents', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req, res, next) => {
    try {
      const siteCode = typeof req.query.siteCode === 'string' && req.query.siteCode.trim() ? req.query.siteCode.trim() : undefined
      initSse(res)
      writeLegacySseEvent(res, 'hello', { ts: Date.now(), kind: 'incidents' })

      const replayAfter = resolveRequestLastEventSequence(req, INCIDENT_SSE_CHANNEL)
      const replay = filterReplayBySite(await getSseReplaySince(INCIDENT_SSE_CHANNEL, replayAfter), siteCode)
      for (const item of replay) writeSseEnvelope(res, INCIDENT_SSE_CHANNEL, item)

      const snapshot = await listGateIncidents({ siteCode, status: 'OPEN', limit: 100 })
      writeLegacySseEvent(res, 'incident_snapshot', { ts: Date.now(), siteCode: siteCode ?? null, rows: snapshot.rows })

      const unsubscribe = subscribeIncidentEvents((envelope) => {
        if (siteCode && envelope.siteCode && envelope.siteCode !== siteCode) return
        writeSseEnvelope(res, INCIDENT_SSE_CHANNEL, envelope)
      })

      const timer = setInterval(() => {
        try { writeSseComment(res, `ping ${Date.now()}`) } catch { clearInterval(timer); unsubscribe(); res.end() }
      }, 15000)

      req.on('close', () => { clearInterval(timer); unsubscribe() })
    } catch (error) { next(error) }
  })
}
