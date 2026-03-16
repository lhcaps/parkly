import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { connectSseWithRetry, SseHttpError, type RealtimeConnectionState } from '@/lib/http/sse'
import { emitRealtimeTelemetry } from '@/features/_shared/realtime/realtime-telemetry'

export type StreamState = {
  status: RealtimeConnectionState
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
  if (error instanceof SseHttpError) return error.message
  return error instanceof Error ? error.message : 'SSE disconnected. Check token or backend.'
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
  const reconnectCountRef = useRef(0)
  const lastSnapshotAtRef = useRef<string | null>(null)

  const applySnapshot = useCallback((next: T, source: 'stream' | 'bootstrap' | 'manual' | 'reconnect') => {
    const now = new Date().toISOString()
    const nextHash = safeHash(next)
    const previousHash = lastSnapshotHashRef.current

    if (source !== 'stream' && previousHash && previousHash !== nextHash) {
      emitRealtimeTelemetry('snapshot_mismatch', {
        stream: args.url,
        eventName: args.eventName,
        reason: source,
        receivedAt: now,
        lastSnapshotAt: lastSnapshotAtRef.current,
      })
    }

    lastSnapshotHashRef.current = nextHash
    lastSnapshotAtRef.current = now
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
    if (!args.loadSnapshot) {
      setResyncNonce((value) => value + 1)
      return
    }

    if (reason === 'manual') {
      emitRealtimeTelemetry('manual_resync', {
        stream: args.url,
        eventName: args.eventName,
        reason,
        reconnectCount: reconnectCountRef.current,
      })
    }

    setState((current) => ({
      ...current,
      refreshing: true,
      error: current.unauthorized ? current.error : '',
    }))

    try {
      const snapshot = await args.loadSnapshot()
      applySnapshot(snapshot, reason)
      setState((current) => ({
        ...current,
        refreshing: false,
      }))
    } catch (error) {
      setState((current) => ({
        ...current,
        refreshing: false,
        error: toStreamError(error),
      }))
    }
  }, [applySnapshot, args.eventName, args.loadSnapshot, args.url])

  useEffect(() => {
    if (args.enabled === false) {
      setState(createInitialState())
      setData(null)
      return
    }

    const controller = new AbortController()
    let active = true

    firstOpenSeenRef.current = false
    lastSemanticKeyRef.current = ''

    if (args.loadSnapshot) {
      void refreshSnapshot('bootstrap')
    } else {
      setState((current) => ({
        ...current,
        status: 'connecting',
        connected: false,
        unauthorized: false,
        stale: false,
        error: '',
      }))
    }

    void connectSseWithRetry({
      url: args.url,
      signal: controller.signal,
      onOpen: () => {
        emitRealtimeTelemetry(firstOpenSeenRef.current ? 'reconnect' : 'stream_opened', {
          stream: args.url,
          eventName: args.eventName,
          reconnectCount: reconnectCountRef.current,
        })

        if (firstOpenSeenRef.current && args.loadSnapshot) {
          void refreshSnapshot('reconnect')
        }

        firstOpenSeenRef.current = true
      },
      onStatusChange: (status, detail) => {
        if (!active) return
        reconnectCountRef.current = detail.reconnectCount
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
      },
      onError: (error) => {
        if (!active) return
        const message = toStreamError(error)
        setState((current) => ({
          ...current,
          connected: false,
          error: message,
        }))
      },
      onMessage: (message) => {
        if (message.event !== args.eventName) return
        const semanticKey = message.id || `${message.event}:${message.data}`
        if (semanticKey && semanticKey === lastSemanticKeyRef.current) return
        lastSemanticKeyRef.current = semanticKey

        try {
          const next = JSON.parse(message.data) as T
          applySnapshot(next, 'stream')
        } catch {
          setState((current) => ({
            ...current,
            connected: false,
            status: current.unauthorized ? 'unauthorized' : 'failed',
            error: 'SSE payload could not be parsed.',
          }))
        }
      },
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [applySnapshot, args.enabled, args.eventName, args.loadSnapshot, args.url, refreshSnapshot, resyncNonce])

  useEffect(() => {
    if (args.enabled === false) return

    const timer = window.setInterval(() => {
      setState((current) => {
        if (current.unauthorized) return current
        const anchor = current.lastSnapshotAt ?? current.receivedAt
        if (!anchor) return current
        const anchorMs = new Date(anchor).getTime()
        if (!Number.isFinite(anchorMs)) return current

        const expired = Date.now() - anchorMs > staleAfterMs
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
