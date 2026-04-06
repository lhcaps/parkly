import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { emitRealtimeTelemetry } from '@/features/_shared/realtime/realtime-telemetry'
import { connectSseWithRetry, makeSseUrl, type RealtimeConnectionState, type SseMessage, type SseStatusDetail } from '@/lib/http/sse'
import { extractRequestId } from '@/lib/http/errors'
import { getParkingLiveBoard, getParkingLiveSummary } from '../api/parking-live'
import { applyRecentChangesToFloors, getBoardLatestUpdateAt, groupBoardIntoFloors, normalizeParkingLiveBoard } from '../mappers'
import type {
  FloorGroup,
  ParkingLiveBoard,
  ParkingLiveDataState,
  ParkingLiveFeedState,
  ParkingLiveFreshnessView,
  ParkingLiveSummary,
  SlotViewModel,
} from '../types'

const POLL_INTERVAL_MS = 5_000
const STALE_THRESHOLD_MS = 20_000
const EVENT_COALESCE_MS = 200

const PARKING_STREAM_NAME = 'parking-live'

type UseParkingLiveDataResult = {
  floors: FloorGroup[]
  raw: SlotViewModel[]
  summary: ParkingLiveSummary | null
  state: ParkingLiveDataState
  refresh: (forceReconcile?: boolean) => Promise<void>
  connectionStatus: ParkingLiveFreshnessView['status']
  freshness: ParkingLiveFreshnessView
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function mapStreamToViewStatus(
  streamStatus: RealtimeConnectionState,
  hasSnapshot: boolean,
  snapshotError: string,
  isSnapshotStale: boolean,
): ParkingLiveFreshnessView['status'] {
  if (streamStatus === 'unauthorized' || streamStatus === 'failed') {
    return hasSnapshot ? 'stale' : 'error'
  }
  if (snapshotError && !hasSnapshot) return 'error'
  if (streamStatus === 'reconnecting') return hasSnapshot ? 'retrying' : 'loading'
  if (streamStatus === 'connecting') return hasSnapshot ? 'retrying' : 'loading'
  if (streamStatus === 'stale') return 'stale'
  if (isSnapshotStale) return 'stale'
  if (streamStatus === 'connected') return 'connected'
  if (snapshotError && hasSnapshot) return 'stale'
  if (hasSnapshot) return 'connected'
  return 'idle'
}

function createInitialFeedState(): ParkingLiveFeedState {
  return {
    status: 'idle',
    reconnectCount: 0,
    error: '',
    staleSince: null,
    lastDeltaAt: null,
    nextRetryAt: null,
  }
}

export function useParkingLiveData(siteCode: string): UseParkingLiveDataResult {
  const [summary, setSummary] = useState<ParkingLiveSummary | null>(null)
  const [floors, setFloors] = useState<FloorGroup[]>([])
  const [state, setState] = useState<ParkingLiveDataState>({
    lastFetchedAt: null,
    isStale: false,
    loading: false,
    error: '',
  })
  const [feedState, setFeedState] = useState<ParkingLiveFeedState>(() => createInitialFeedState())
  const [lastReconciledAt, setLastReconciledAt] = useState<string | null>(null)
  const [lastSummaryAt, setLastSummaryAt] = useState<string | null>(null)
  const [requestIdHint, setRequestIdHint] = useState<string | null>(null)

  const prevSlotsRef = useRef<SlotViewModel[]>([])
  const pendingRefreshRef = useRef<number | null>(null)
  const snapshotAbortRef = useRef<AbortController | null>(null)
  const lastSnapshotRef = useRef<ParkingLiveBoard | null>(null)
  const lastSnapshotAtRef = useRef<string | null>(null)

  const applyBoard = useCallback((nextBoard: ParkingLiveBoard, snapshotFetchedAt: string) => {
    const nextFloors = groupBoardIntoFloors(nextBoard)
    const withChanges = applyRecentChangesToFloors(nextFloors, prevSlotsRef.current)
    prevSlotsRef.current = withChanges.flatMap((floor) => floor.slots)
    lastSnapshotRef.current = nextBoard
    lastSnapshotAtRef.current = snapshotFetchedAt
    setFloors(withChanges)
    setLastReconciledAt(nextBoard.connection.reconciledAt ?? null)
    setState((current) => ({
      ...current,
      lastFetchedAt: snapshotFetchedAt,
      isStale: false,
      loading: false,
      error: '',
    }))
  }, [])

  const loadSnapshot = useCallback(async (forceReconcile = false, reason: 'initial' | 'manual' | 'delta' | 'poll' = 'manual') => {
    if (!siteCode) {
      snapshotAbortRef.current?.abort()
      snapshotAbortRef.current = null
      setSummary(null)
      setFloors([])
      setLastReconciledAt(null)
      setLastSummaryAt(null)
      setRequestIdHint(null)
      setFeedState(createInitialFeedState())
      setState({ lastFetchedAt: null, isStale: false, loading: false, error: '' })
      prevSlotsRef.current = []
      lastSnapshotRef.current = null
      lastSnapshotAtRef.current = null
      return
    }

    snapshotAbortRef.current?.abort()
    const controller = new AbortController()
    snapshotAbortRef.current = controller

    setState((current) => ({
      ...current,
      loading: current.lastFetchedAt == null || forceReconcile,
      error: '',
    }))

    try {
      const [nextBoard, nextSummary] = await Promise.all([
        getParkingLiveBoard({ siteCode, refresh: forceReconcile, signal: controller.signal }),
        getParkingLiveSummary(siteCode, { refresh: forceReconcile, signal: controller.signal }),
      ])

      if (controller.signal.aborted) return
      const fetchedAt = new Date().toISOString()
      applyBoard(nextBoard, fetchedAt)
      setSummary(nextSummary)
      setLastSummaryAt(nextSummary.updatedAt ?? fetchedAt)
      setFeedState((current) => ({
        ...current,
        error: '',
        status: current.status === 'idle' ? 'loading' : current.status,
      }))
      setRequestIdHint(null)
      emitRealtimeTelemetry('snapshot_refreshed', {
        stream: PARKING_STREAM_NAME,
        reason,
        lastSnapshotAt: fetchedAt,
      })
    } catch (error) {
      if (controller.signal.aborted) return
      const message = toMessage(error)
      setRequestIdHint(extractRequestId(error) ?? null)
      setState((current) => ({
        ...current,
        loading: false,
        error: message,
      }))
      if (lastSnapshotRef.current) {
        setState((current) => ({ ...current, isStale: true }))
      }
      emitRealtimeTelemetry('stream_failed', {
        stream: PARKING_STREAM_NAME,
        reason,
        lastSnapshotAt: lastSnapshotAtRef.current,
        requestIdHint: extractRequestId(error) ?? null,
      })
    }
  }, [applyBoard, siteCode])

  const scheduleRefresh = useCallback((forceReconcile = false, reason: 'delta' | 'poll' | 'manual' = 'delta') => {
    if (pendingRefreshRef.current != null) window.clearTimeout(pendingRefreshRef.current)
    pendingRefreshRef.current = window.setTimeout(() => {
      pendingRefreshRef.current = null
      void loadSnapshot(forceReconcile, reason)
    }, forceReconcile ? 50 : EVENT_COALESCE_MS)
  }, [loadSnapshot])

  useEffect(() => {
    void loadSnapshot(false, 'initial')
  }, [loadSnapshot])

  useEffect(() => {
    if (!siteCode) return undefined

    const controller = new AbortController()
    const url = makeSseUrl(`/api/stream/parking-live?siteCode=${encodeURIComponent(siteCode)}`)

    function updateFeedStatus(status: RealtimeConnectionState, detail: SseStatusDetail) {
      setFeedState((current) => {
        const hasSnapshot = Boolean(lastSnapshotAtRef.current)
        const shouldPreserveStaleSurface =
          hasSnapshot
          && (current.status === 'stale' || current.status === 'error')
          && (status === 'connecting' || status === 'reconnecting')

        const nextStatus =
          status === 'connected'
            ? 'connected'
            : shouldPreserveStaleSurface
              ? 'stale'
              : status === 'reconnecting' || status === 'connecting'
                ? (current.lastDeltaAt || hasSnapshot ? 'retrying' : 'loading')
                : status === 'stale'
                  ? 'stale'
                  : status === 'failed' || status === 'unauthorized'
                    ? (hasSnapshot ? 'stale' : 'error')
                    : current.status

        const staleSince = status === 'connected'
          ? null
          : shouldPreserveStaleSurface || status === 'stale' || status === 'failed' || status === 'unauthorized'
            ? current.staleSince ?? new Date().toISOString()
            : current.staleSince

        return {
          ...current,
          status: nextStatus,
          reconnectCount: detail.reconnectCount,
          nextRetryAt: detail.nextRetryAt ?? null,
          staleSince,
          error: detail.error || (status === 'connected' ? '' : current.error),
        }
      })

      if (status === 'unauthorized' || status === 'failed') {
        emitRealtimeTelemetry('stream_failed', {
          stream: PARKING_STREAM_NAME,
          status,
          reconnectCount: detail.reconnectCount,
          nextRetryAt: detail.nextRetryAt ?? null,
          lastSnapshotAt: lastSnapshotAtRef.current,
        })
      }
    }

    function handleMessage(message: SseMessage) {
      const receivedAt = new Date().toISOString()
      setFeedState((current) => ({
        ...current,
        lastDeltaAt: receivedAt,
        staleSince: null,
        error: '',
        status: 'connected',
      }))

      if (message.event === 'snapshot.ready') {
        try {
          const payload = JSON.parse(message.data) as unknown
          const normalized = normalizeParkingLiveBoard({
            site: { siteCode, name: siteCode },
            filters: { floorKey: null, zoneCode: null, status: null, q: null, refresh: false },
            floors: (payload as { floors?: unknown }).floors,
            connection: {
              source: 'projection',
              reconciledAt: (payload as { reconciledAt?: unknown }).reconciledAt ?? null,
              streamSupported: true,
            },
          })
          applyBoard(normalized, receivedAt)
        } catch {
          scheduleRefresh(false, 'delta')
        }
        return
      }

      if (message.event === 'slot.updated' || message.event === 'floor.summary.updated') {
        scheduleRefresh(false, 'delta')
        return
      }

      if (message.event === 'stream.stale') {
        setFeedState((current) => ({
          ...current,
          status: 'stale',
          staleSince: current.staleSince ?? new Date().toISOString(),
        }))
        setState((current) => ({ ...current, isStale: true }))
      }
    }

    void connectSseWithRetry({
      url,
      signal: controller.signal,
      onStatusChange: updateFeedStatus,
      onMessage: handleMessage,
      onError: (error) => {
        setFeedState((current) => ({
          ...current,
          error: current.error || toMessage(error),
          status: lastSnapshotAtRef.current ? 'stale' : 'error',
          staleSince: current.staleSince ?? new Date().toISOString(),
        }))
      },
      retryDelayMs: 500,
      maxRetryDelayMs: 5000,
      maxReconnects: 20,
    })

    return () => {
      controller.abort()
    }
  }, [applyBoard, scheduleRefresh, siteCode])

  useEffect(() => {
    if (!siteCode) return undefined
    const timer = window.setInterval(() => {
      if (!document.hidden) scheduleRefresh(false, 'poll')
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [scheduleRefresh, siteCode])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setState((current) => {
        if (!current.lastFetchedAt) return current
        const age = Date.now() - Date.parse(current.lastFetchedAt)
        const isStale = age > STALE_THRESHOLD_MS
        if (isStale === current.isStale) return current
        return { ...current, isStale }
      })

      setFeedState((current) => {
        if (!current.lastDeltaAt) return current
        const age = Date.now() - Date.parse(current.lastDeltaAt)
        if (age <= STALE_THRESHOLD_MS) {
          if (current.status !== 'stale') return current
          return { ...current, status: 'connected', staleSince: null }
        }
        if (current.status === 'stale' && current.staleSince) return current
        return {
          ...current,
          status: 'stale',
          staleSince: current.staleSince ?? new Date().toISOString(),
        }
      })
    }, 5000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => () => {
    if (pendingRefreshRef.current != null) window.clearTimeout(pendingRefreshRef.current)
    snapshotAbortRef.current?.abort()
  }, [])

  const refresh = useCallback(async (forceReconcile = false) => {
    await loadSnapshot(forceReconcile, 'manual')
  }, [loadSnapshot])

  const raw = useMemo(() => floors.flatMap((floor) => floor.slots), [floors])
  const latestBoardUpdateAt = useMemo(() => getBoardLatestUpdateAt(floors), [floors])

  const freshness = useMemo<ParkingLiveFreshnessView>(() => {
    const hasSnapshot = floors.length > 0
    const status = mapStreamToViewStatus(
      feedState.status === 'loading'
        ? 'connecting'
        : feedState.status === 'retrying'
          ? 'reconnecting'
          : feedState.status === 'error'
            ? 'failed'
            : feedState.status === 'stale'
              ? 'stale'
              : feedState.status === 'connected'
                ? 'connected'
                : 'idle',
      hasSnapshot,
      state.error || feedState.error,
      state.isStale,
    )

    return {
      status,
      lastFetchedAt: state.lastFetchedAt,
      lastSummaryAt,
      lastReconciledAt,
      lastDeltaAt: feedState.lastDeltaAt,
      staleSince: status === 'stale' || status === 'error' ? (feedState.staleSince ?? state.lastFetchedAt) : null,
      nextRetryAt: feedState.nextRetryAt,
      fallbackPolling: Boolean(siteCode),
      reconnectCount: feedState.reconnectCount,
      error: state.error || feedState.error,
      hasSnapshot,
      requestIdHint,
    }
  }, [feedState, lastReconciledAt, lastSummaryAt, requestIdHint, siteCode, state.error, state.isStale, state.lastFetchedAt, floors.length])

  return {
    floors,
    raw,
    summary,
    state,
    refresh,
    connectionStatus: freshness.status,
    freshness: {
      ...freshness,
      lastSummaryAt: freshness.lastSummaryAt ?? summary?.updatedAt ?? latestBoardUpdateAt,
    },
  }
}
