import type { SseEnvelope } from '../../../server/sse-contract'
import { publishSseEnvelope } from '../../../server/sse-contract'

export const INCIDENT_SSE_CHANNEL = 'incidents'

type Listener = (envelope: SseEnvelope) => void
const listeners = new Set<Listener>()

export async function publishIncidentEnvelope<T = unknown>(args: {
  eventType: 'incident.opened' | 'incident.updated' | 'incident.resolved' | 'incident.reopened'
  payload: T
  occurredAt?: string | Date
  siteCode?: string | null
  laneCode?: string | null
  correlationId?: string | null
}) {
  const envelope = await publishSseEnvelope(INCIDENT_SSE_CHANNEL, args)
  for (const listener of listeners) {
    try { listener(envelope) } catch {}
  }
  return envelope
}

export function subscribeIncidentEvents(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
