import { useEffect, useMemo } from 'react'
import type { LaneStatusSnapshot } from '@parkly/contracts'
import { emitRealtimeTelemetry } from '@/features/_shared/realtime/realtime-telemetry'
import { useSseSnapshot } from '@/features/_shared/use-sse-snapshot'
import { makeSseUrl } from '@/lib/http/sse'
import { getLaneStatusSnapshot } from '@/lib/api/ops'
import { selectRunLaneLaneCode, selectRunLaneSiteCode } from '@/features/run-lane/store/runLaneSelectors'
import { useRunLaneStore } from '@/features/run-lane/store/runLaneStoreContext'

const STALE_AFTER_MS = 45_000


async function loadRunLaneSnapshot(siteCode: string): Promise<LaneStatusSnapshot> {
  const snapshot = await getLaneStatusSnapshot({ siteCode, limit: 200 })
  return {
    ts: Date.now(),
    siteCode,
    barrierLifecycle: {
      promotedToSent: 0,
      timedOut: 0,
    },
    rows: snapshot.rows,
  }
}

export function useRunLaneLiveState() {
  const siteCode = useRunLaneStore(selectRunLaneSiteCode)
  const laneCode = useRunLaneStore(selectRunLaneLaneCode)

  const { data, state, resync } = useSseSnapshot<LaneStatusSnapshot>({
    url: makeSseUrl(siteCode ? `/api/stream/lane-status?siteCode=${encodeURIComponent(siteCode)}` : '/api/stream/lane-status'),
    eventName: 'lane_status_snapshot',
    enabled: Boolean(siteCode),
    staleAfterMs: STALE_AFTER_MS,
    loadSnapshot: siteCode
      ? () => loadRunLaneSnapshot(siteCode)
      : undefined,
  })

  const rows = data?.rows ?? []

  const selectedLaneLive = useMemo(() => {
    if (!siteCode || !laneCode) return null
    return rows.find((row) => row.siteCode === siteCode && row.laneCode === laneCode) ?? null
  }, [laneCode, rows, siteCode])

  const lostContext = Boolean(siteCode && laneCode && state.lastSnapshotAt && !selectedLaneLive)

  useEffect(() => {
    if (!lostContext) return
    emitRealtimeTelemetry('lost_context', {
      stream: siteCode ? `/api/stream/lane-status?siteCode=${siteCode}` : '/api/stream/lane-status',
      eventName: 'lane_status_snapshot',
      reason: `${siteCode || '—'}:${laneCode || '—'}`,
      receivedAt: state.receivedAt,
      lastSnapshotAt: state.lastSnapshotAt,
      reconnectCount: state.reconnectCount,
    })
  }, [laneCode, lostContext, siteCode, state.lastSnapshotAt, state.receivedAt, state.reconnectCount])

  return {
    rows,
    snapshotLoading: state.refreshing && !data,
    refreshing: state.refreshing,
    snapshotError: state.error,
    streamConnected: state.connected,
    streamError: state.error,
    reconnectCount: state.reconnectCount,
    lastEventAt: state.receivedAt,
    lastSnapshotAt: state.lastSnapshotAt,
    stale: state.stale,
    status: state.status,
    unauthorized: state.unauthorized,
    staleSince: state.staleSince,
    siteCode,
    laneCode,
    selectedLaneLive,
    lostContext,
    refreshSnapshot: resync,
  }
}
