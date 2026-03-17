import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { connectSseWithRetry, makeSseUrl, type RealtimeConnectionState, type SseMessage } from '@/lib/http/sse'
import { getParkingLiveBoard, getParkingLiveSummary } from '../api/parking-live'
import { applyRecentChangesToFloors, groupBoardIntoFloors, normalizeParkingLiveBoard } from '../mappers'
import type { FloorGroup, ParkingLiveBoard, ParkingLiveDataState, ParkingLiveSummary, SlotViewModel } from '../types'

const POLL_INTERVAL_MS = 30_000
const STALE_THRESHOLD_MS = 45_000

type UseParkingLiveDataResult = {
  floors: FloorGroup[]
  raw: SlotViewModel[]
  summary: ParkingLiveSummary | null
  state: ParkingLiveDataState
  refresh: (forceReconcile?: boolean) => Promise<void>
  connectionStatus: 'idle' | 'loading' | 'ok' | 'stale' | 'error'
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function mapRealtimeStatus(status: RealtimeConnectionState, hasError: boolean, stale: boolean): 'idle' | 'loading' | 'ok' | 'stale' | 'error' {
  if (hasError || status === 'failed' || status === 'unauthorized') return 'error'
  if (stale || status === 'stale' || status === 'reconnecting') return 'stale'
  if (status === 'connected') return 'ok'
  if (status === 'connecting') return 'loading'
  return 'idle'
}

export function useParkingLiveData(siteCode: string): UseParkingLiveDataResult {
  const [, setBoard] = useState<ParkingLiveBoard | null>(null)
  const [summary, setSummary] = useState<ParkingLiveSummary | null>(null)
  const [floors, setFloors] = useState<FloorGroup[]>([])
  const [state, setState] = useState<ParkingLiveDataState>({
    lastFetchedAt: null,
    isStale: false,
    loading: false,
    error: '',
  })
  const [streamState, setStreamState] = useState<RealtimeConnectionState>('idle')

  const prevSlotsRef = useRef<SlotViewModel[]>([])
  const pendingRefreshRef = useRef<number | null>(null)

  const applyBoard = useCallback((nextBoard: ParkingLiveBoard) => {
    const nextFloors = groupBoardIntoFloors(nextBoard)
    const withChanges = applyRecentChangesToFloors(nextFloors, prevSlotsRef.current)
    prevSlotsRef.current = withChanges.flatMap((floor) => floor.slots)
    setBoard(nextBoard)
    setFloors(withChanges)
    setState((current) => ({
      ...current,
      lastFetchedAt: new Date().toISOString(),
      isStale: false,
      loading: false,
      error: '',
    }))
  }, [])

  const loadSnapshot = useCallback(async (forceReconcile = false) => {
    if (!siteCode) {
      setBoard(null)
      setSummary(null)
      setFloors([])
      setState({ lastFetchedAt: null, isStale: false, loading: false, error: '' })
      return
    }

    setState((current) => ({ ...current, loading: current.lastFetchedAt == null, error: '' }))

    try {
      const [nextBoard, nextSummary] = await Promise.all([
        getParkingLiveBoard({ siteCode, refresh: forceReconcile }),
        getParkingLiveSummary(siteCode, forceReconcile),
      ])
      applyBoard(nextBoard)
      setSummary(nextSummary)
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: toMessage(error),
      }))
    }
  }, [applyBoard, siteCode])

  const scheduleRefresh = useCallback((forceReconcile = false) => {
    if (pendingRefreshRef.current != null) window.clearTimeout(pendingRefreshRef.current)
    pendingRefreshRef.current = window.setTimeout(() => {
      pendingRefreshRef.current = null
      void loadSnapshot(forceReconcile)
    }, forceReconcile ? 50 : 250)
  }, [loadSnapshot])

  useEffect(() => {
    void loadSnapshot(false)
  }, [loadSnapshot])

  useEffect(() => {
    if (!siteCode) {
      setStreamState('idle')
      return
    }

    const controller = new AbortController()
    const url = makeSseUrl(`/api/stream/parking-live?siteCode=${encodeURIComponent(siteCode)}`)

    function handleMessage(message: SseMessage) {
      if (message.event === 'snapshot.ready') {
        try {
          const payload = JSON.parse(message.data) as unknown
          const normalized = normalizeParkingLiveBoard({
            site: { siteCode, name: siteCode },
            filters: { floorKey: null, zoneCode: null, status: null, q: null, refresh: false },
            floors: (payload as any)?.floors,
            connection: {
              source: 'projection',
              reconciledAt: (payload as any)?.reconciledAt ?? null,
              streamSupported: true,
            },
          })
          applyBoard(normalized)
        } catch {
          scheduleRefresh(false)
        }
        return
      }

      if (message.event === 'slot.updated' || message.event === 'floor.summary.updated') {
        scheduleRefresh(false)
        return
      }

      if (message.event === 'stream.stale') {
        setState((current) => ({ ...current, isStale: true }))
      }
    }

    void connectSseWithRetry({
      url,
      signal: controller.signal,
      onStatusChange: (status) => setStreamState(status),
      onMessage: handleMessage,
      onError: (error) => {
        setState((current) => ({ ...current, error: current.error || toMessage(error) }))
      },
      retryDelayMs: 1500,
      maxRetryDelayMs: 10000,
      maxReconnects: 10,
    })

    return () => {
      controller.abort()
    }
  }, [applyBoard, scheduleRefresh, siteCode])

  useEffect(() => {
    if (!siteCode) return
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadSnapshot(false)
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [loadSnapshot, siteCode])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setState((current) => {
        if (!current.lastFetchedAt) return current
        const age = Date.now() - Date.parse(current.lastFetchedAt)
        const isStale = age > STALE_THRESHOLD_MS
        if (isStale === current.isStale) return current
        return { ...current, isStale }
      })
    }, 5000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => () => {
    if (pendingRefreshRef.current != null) window.clearTimeout(pendingRefreshRef.current)
  }, [])

  const refresh = useCallback(async (forceReconcile = false) => {
    await loadSnapshot(forceReconcile)
  }, [loadSnapshot])

  const raw = useMemo(() => floors.flatMap((floor) => floor.slots), [floors])
  const connectionStatus = mapRealtimeStatus(streamState, Boolean(state.error), state.isStale)

  return {
    floors,
    raw,
    summary,
    state,
    refresh,
    connectionStatus,
  }
}
