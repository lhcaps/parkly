// Polling hook for spot occupancy.
// No dedicated SSE stream exists for parking occupancy.
// We poll every POLL_INTERVAL_MS. When tab is hidden, polling pauses.
// On manual refresh, `?refresh=true` is passed to trigger backend reconciliation.

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSpotOccupancy } from '../api/parking-live'
import { groupRowsIntoFloors, markRecentlyChanged, rowToSlotViewModel } from '../mappers'
import type { FloorGroup, ParkingLiveDataState, SlotViewModel, SpotProjectionRow } from '../types'

const POLL_INTERVAL_MS = 15_000   // 15 seconds
const STALE_THRESHOLD_MS = 35_000 // warn if last fetch was >35s ago

type UseParkingLiveDataResult = {
  floors: FloorGroup[]
  raw: SpotProjectionRow[]
  state: ParkingLiveDataState
  refresh: (forceReconcile?: boolean) => Promise<void>
  connectionStatus: 'idle' | 'loading' | 'ok' | 'stale' | 'error'
}

export function useParkingLiveData(siteCode: string): UseParkingLiveDataResult {
  const [raw, setRaw] = useState<SpotProjectionRow[]>([])
  const [floors, setFloors] = useState<FloorGroup[]>([])
  const [state, setState] = useState<ParkingLiveDataState>({
    rows: [],
    lastFetchedAt: null,
    isStale: false,
    loading: false,
    error: '',
  })

  const prevSlotsRef = useRef<SlotViewModel[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const staleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const doFetch = useCallback(async (reconcile = false) => {
    if (!siteCode) return
    setState((prev) => ({ ...prev, loading: prev.rows.length === 0, error: '' }))
    try {
      const rows = await getSpotOccupancy({ siteCode, refresh: reconcile, limit: 1000 })
      const now = new Date().toISOString()

      // Detect recently changed slots for pulse effect
      const currentSlots = rows.map(rowToSlotViewModel)
      const withChanges = markRecentlyChanged(currentSlots, prevSlotsRef.current)
      prevSlotsRef.current = currentSlots

      // Build floors with change markers applied
      const rowsWithChanges = rows.map((row, i) => row) // keep raw for detail panel
      setRaw(rows)
      setFloors(groupRowsIntoFloors(rows))

      setState({
        rows,
        lastFetchedAt: now,
        isStale: false,
        loading: false,
        error: '',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setState((prev) => ({ ...prev, loading: false, error: msg }))
    }
  }, [siteCode])

  // Initial fetch
  useEffect(() => {
    void doFetch()
  }, [doFetch])

  // Polling interval
  useEffect(() => {
    if (!siteCode) return
    intervalRef.current = setInterval(() => {
      // Pause when tab is hidden
      if (document.hidden) return
      void doFetch()
    }, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [doFetch, siteCode])

  // Stale check: every 5s, check if lastFetchedAt is too old
  useEffect(() => {
    staleCheckRef.current = setInterval(() => {
      setState((prev) => {
        if (!prev.lastFetchedAt) return prev
        const age = Date.now() - Date.parse(prev.lastFetchedAt)
        const isStale = age > STALE_THRESHOLD_MS
        if (isStale === prev.isStale) return prev
        return { ...prev, isStale }
      })
    }, 5_000)
    return () => {
      if (staleCheckRef.current) clearInterval(staleCheckRef.current)
    }
  }, [])

  const refresh = useCallback(async (forceReconcile = false) => {
    await doFetch(forceReconcile)
  }, [doFetch])

  const connectionStatus =
    state.error ? 'error'
    : state.isStale ? 'stale'
    : state.loading ? 'loading'
    : state.lastFetchedAt ? 'ok'
    : 'idle'

  return { floors, raw, state, refresh, connectionStatus }
}
