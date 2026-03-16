import { postJson } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import { normalizeSessionSummary } from '@/lib/contracts/normalize'
import type { LaneFlowSubmitPayload, LaneFlowSubmitRes } from '@/lib/contracts/laneFlow'
import type { OpenSessionRes, ResolveSessionRes } from '@/lib/contracts/sessions'
import { getAuthoritativePlate } from '@/lib/api/alpr'
import type { PlateCanonicalDto } from '@parkly/contracts'

function normalizePreviewPlate(value: unknown): PlateCanonicalDto | null {
  if (!isRecord(value)) return null
  return getAuthoritativePlate(value as { plate?: PlateCanonicalDto | null } & Partial<PlateCanonicalDto>)
}

function normalizeOpenSession(value: unknown): OpenSessionRes {
  const row = isRecord(value) ? value : {}
  return {
    reused: typeof row.reused === 'boolean' ? row.reused : false,
    reuseWindowMs: typeof row.reuseWindowMs === 'number' ? row.reuseWindowMs : 0,
    session: normalizeSessionSummary(row.session),
    plate: normalizePreviewPlate(row.plate),
  }
}

function normalizeResolveSession(value: unknown): ResolveSessionRes {
  const row = isRecord(value) ? value : {}
  return {
    session: normalizeSessionSummary(row.session),
    plate: normalizePreviewPlate(row.plate),
    decision: isRecord(row.decision) ? (row.decision as ResolveSessionRes['decision']) : null,
  }
}

export function submitLaneFlow(payload: LaneFlowSubmitPayload) {
  return postJson<LaneFlowSubmitRes>('/api/lane-flow/submit', payload, (value) => {
    const row = isRecord(value) ? value : {}
    const event = isRecord(row.event) ? row.event : {}
    return {
      previewPlate: normalizePreviewPlate(row.previewPlate),
      open: normalizeOpenSession(row.open),
      event: {
        changed: typeof event.changed === 'boolean' ? event.changed : false,
        eventId: typeof event.eventId === 'string' || typeof event.eventId === 'number' ? event.eventId : '',
        eventTime: typeof event.eventTime === 'string' ? event.eventTime : '',
        outboxId: typeof event.outboxId === 'string' || typeof event.outboxId === 'number' ? event.outboxId : '',
        siteCode: typeof event.siteCode === 'string' ? event.siteCode : '',
        deviceCode: typeof event.deviceCode === 'string' ? event.deviceCode : '',
        laneCode: typeof event.laneCode === 'string' ? event.laneCode : '',
      },
      resolved: normalizeResolveSession(row.resolved),
    }
  })
}
