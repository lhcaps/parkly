import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { emitRealtimeTelemetry } from '@/features/_shared/realtime/realtime-telemetry'
import { sseManager } from '@/lib/http/sse-manager'
import type { SseMessage } from '@/lib/http/sse'

export type StreamState = {
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'stale' | 'unauthorized' | 'failed'
  connected: boolean
  unauthorized: boolean
  stale: boolean
  refreshing: boolean
  error: string
  reconnectCount: number
  receivedAt: string | null
  lastSnapshotAt: string | null
  staleSince: string | null
}

function toStreamError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error)
  return msg || 'SSE disconnected. Check token or backend.'
}

function safeHash(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function createInitialState(): StreamState {
  return {
    status: 'idle',
    connected: false,
    unauthorized: false,
    stale: false,
    refreshing: false,
    error: '',
    reconnectCount: 0,
    receivedAt: null,
    lastSnapshotAt: null,
    staleSince: null,
  }
}

export function useSseSnapshot<T>(args: {
  url: string
  eventName: string
  enabled?: boolean
  staleAfterMs?: number
  loadSnapshot?: () => Promise<T>
}) {
  const staleAfterMs = args.staleAfterMs ?? 45_000
  const [data, setData] = useState<T | null>(null)
  const [state, setState] = useState<StreamState>(() => createInitialState())
  const [resyncNonce, setResyncNonce] = useState(0)

  const firstOpenSeenRef = useRef(false)
  const lastSemanticKeyRef = useRef('')
  const lastSnapshotHashRef = useRef('')
  const refreshInFlightRef = useRef(false)
  const lastRefreshTimeRef = useRef(0)
  const mountedRef = useRef(true)
  const subscriptionIdRef = useRef<string | null>(null)
  const bootstrapDoneRef = useRef(false)

  const applySnapshot = useCallback((next: T, source: 'stream' | 'bootstrap' | 'manual' | 'reconnect') => {
    if (!mountedRef.current) return

    const now = new Date().toISOString()
    const nextHash = safeHash(next)
    const previousHash = lastSnapshotHashRef.current

    if (source !== 'stream' && previousHash && previousHash !== nextHash) {
      emitRealtimeTelemetry('snapshot_mismatch', {
        stream: args.url,
        eventName: args.eventName,
        reason: source,
        receivedAt: now,
        lastSnapshotAt: lastSnapshotHashRef.current || null,
      })
    }

    lastSnapshotHashRef.current = nextHash
    lastSemanticKeyRef.current = ''
    refreshInFlightRef.current = false

    setData(next)
    setState((current) => ({
      ...current,
      status: current.unauthorized ? current.status : 'connected',
      connected: !current.unauthorized,
      stale: false,
      error: current.unauthorized ? current.error : '',
      receivedAt: source === 'stream' ? now : current.receivedAt,
      lastSnapshotAt: now,
      staleSince: null,
    }))
  }, [args.eventName, args.url])

  const refreshSnapshot = useCallback(async (reason: 'bootstrap' | 'manual' | 'reconnect' = 'manual') => {
    if (!mountedRef.current) return
    if (refreshInFlightRef.current) return

    const now = Date.now()
    const minRefreshInterval = 8_000
    if (now - lastRefreshTimeRef.current < minRefreshInterval) return
    lastRefreshTimeRef.current = now

    if (!args.loadSnapshot) {
      setResyncNonce((value) => value + 1)
      return
    }

    if (reason === 'manual') {
      emitRealtimeTelemetry('manual_resync', {
        stream: args.url,
        eventName: args.eventName,
        reason,
        reconnectCount: 0,
      })
    }

    refreshInFlightRef.current = true

    setState((current) => ({
      ...current,
      refreshing: true,
      error: current.unauthorized ? current.error : '',
    }))

    try {
      const snapshot = await args.loadSnapshot()
      if (!mountedRef.current) return
      applySnapshot(snapshot, reason)
      setState((current) => ({
        ...current,
        refreshing: false,
      }))
    } catch (error) {
      if (!mountedRef.current) return
      refreshInFlightRef.current = false
      setState((current) => ({
        ...current,
        refreshing: false,
        error: toStreamError(error),
      }))
    }
  }, [applySnapshot, args.eventName, args.loadSnapshot, args.url])

  // Mount/unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Subscribe to SSE via global manager
  useEffect(() => {
    if (args.enabled === false) {
      setState(createInitialState())
      setData(null)
      if (subscriptionIdRef.current !== null) {
        sseManager.unsubscribe(args.url, subscriptionIdRef.current)
        subscriptionIdRef.current = null
      }
      return
    }

    const onOpen = () => {
      if (!mountedRef.current) return
      emitRealtimeTelemetry(firstOpenSeenRef.current ? 'reconnect' : 'stream_opened', {
        stream: args.url,
        eventName: args.eventName,
        reconnectCount: 0,
      })

      firstOpenSeenRef.current = true

      // Only do bootstrap refresh on very first open, not on every reconnect
      if (!bootstrapDoneRef.current && args.loadSnapshot) {
        bootstrapDoneRef.current = true
        void refreshSnapshot('bootstrap')
      }
    }

    const onStatusChange = (status: StreamState['status'], detail: { reconnectCount: number; error?: string }) => {
      if (!mountedRef.current) return
      setState((current) => ({
        ...current,
        status,
        connected: status === 'connected',
        unauthorized: status === 'unauthorized',
        stale: status === 'stale',
        reconnectCount: detail.reconnectCount,
        error: detail.error || (status === 'connected' ? '' : current.error),
      }))

      if (status === 'unauthorized') {
        emitRealtimeTelemetry('unauthorized', {
          stream: args.url,
          eventName: args.eventName,
          reconnectCount: detail.reconnectCount,
          status,
        })
      }
    }

    const onMessage = (message: SseMessage) => {
      if (!mountedRef.current) return
      if (message.event !== args.eventName) return

      const semanticKey = message.id || `${message.event}:${message.data}`
      if (semanticKey && semanticKey === lastSemanticKeyRef.current) return
      lastSemanticKeyRef.current = semanticKey

      try {
        const next = JSON.parse(message.data) as T
        applySnapshot(next, 'stream')
      } catch {
        if (!mountedRef.current) return
        setState((current) => ({
          ...current,
          connected: false,
          status: current.unauthorized ? 'unauthorized' : 'failed',
          error: 'SSE payload could not be parsed.',
        }))
      }
    }

    const onError = (error: unknown) => {
      if (!mountedRef.current) return
      const message = toStreamError(error)
      setState((current) => ({
        ...current,
        connected: false,
        error: message,
      }))
    }

    const id = sseManager.subscribe({
      url: args.url,
      onOpen,
      onMessage,
      onError,
      onStatusChange,
    })
    subscriptionIdRef.current = id

    // Bootstrap if snapshot is provided
    if (args.loadSnapshot && !bootstrapDoneRef.current) {
      void refreshSnapshot('bootstrap')
      bootstrapDoneRef.current = true
    }

    return () => {
      if (subscriptionIdRef.current !== null) {
        sseManager.unsubscribe(args.url, subscriptionIdRef.current)
        subscriptionIdRef.current = null
      }
    }
  }, [args.enabled, args.eventName, args.loadSnapshot, args.url, applySnapshot, refreshSnapshot])

  // Stale detection interval
  useEffect(() => {
    if (args.enabled === false) return

    let active = true

    const timer = window.setInterval(() => {
      if (!active || !mountedRef.current) return
      setState((current) => {
        if (current.unauthorized) return current

        const snapshotAnchor = current.lastSnapshotAt
        const eventAnchor = current.receivedAt

        const isSnapshotStale = snapshotAnchor && Date.now() - new Date(snapshotAnchor).getTime() > staleAfterMs
        const isEventStale = eventAnchor && Date.now() - new Date(eventAnchor).getTime() > staleAfterMs
        const expired = isSnapshotStale && isEventStale

        if (!expired) {
          if (!current.stale && current.status !== 'stale') return current
          return {
            ...current,
            stale: false,
            staleSince: null,
            status: current.connected ? 'connected' : current.status,
          }
        }

        if (current.stale && current.staleSince) return current

        const staleSince = new Date().toISOString()
        emitRealtimeTelemetry('stale', {
          stream: args.url,
          eventName: args.eventName,
          reconnectCount: current.reconnectCount,
          staleSince,
          receivedAt: current.receivedAt,
          lastSnapshotAt: current.lastSnapshotAt,
        })

        return {
          ...current,
          stale: true,
          status: current.unauthorized ? 'unauthorized' : 'stale',
          staleSince,
        }
      })
    }, 5_000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [args.enabled, args.eventName, args.url, staleAfterMs])

  const resync = useCallback(async () => {
    await refreshSnapshot('manual')
  }, [refreshSnapshot])

  const result = useMemo(() => ({
    data,
    state,
    resync,
  }), [data, resync, state])

  return result
}
