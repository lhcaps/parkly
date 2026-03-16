export type RealtimeTelemetryEvent =
  | 'stream_opened'
  | 'reconnect'
  | 'stale'
  | 'unauthorized'
  | 'snapshot_mismatch'
  | 'manual_resync'
  | 'lost_context'

export type RealtimeTelemetryDetail = {
  stream: string
  eventName?: string
  status?: string
  reconnectCount?: number
  reason?: string
  receivedAt?: string | null
  lastSnapshotAt?: string | null
  staleSince?: string | null
}

const REALTIME_TELEMETRY_EVENT = 'parkly:realtime-telemetry'

export function getRealtimeTelemetryEventName() {
  return REALTIME_TELEMETRY_EVENT
}

export function emitRealtimeTelemetry(event: RealtimeTelemetryEvent, detail: RealtimeTelemetryDetail) {
  if (typeof window === 'undefined') return

  const payload = {
    event,
    ...detail,
    at: new Date().toISOString(),
  }

  window.dispatchEvent(new CustomEvent(REALTIME_TELEMETRY_EVENT, {
    detail: payload,
  }))

  if (import.meta.env.DEV) {
    console.debug('[realtime]', payload)
  }
}
