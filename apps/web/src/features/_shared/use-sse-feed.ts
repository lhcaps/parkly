import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { connectSseWithRetry, SseHttpError, type RealtimeConnectionState } from '@/lib/http/sse'
import { emitRealtimeTelemetry } from '@/features/_shared/realtime/realtime-telemetry'

export type StreamFeedState = {
  status: RealtimeConnectionState
  connected: boolean
  unauthorized: boolean
  stale: boolean
  error: string
  reconnectCount: number
  receivedAt: string | null
  staleSince: string | null
}

function toStreamError(error: unknown) {
  if (error instanceof SseHttpError) return error.message
  return error instanceof Error ? error.message : 'SSE disconnected. Check token or backend.'
}

function createInitialState(): StreamFeedState {
  return {
    status: 'idle',
    connected: false,
    unauthorized: false,
    stale: false,
    error: '',
    reconnectCount: 0,
    receivedAt: null,
    staleSince: null,
  }
}

function defaultKeyOf<T extends { eventId?: string; outboxId?: string; ts?: number | string }>(item: T) {
  return `${item.eventId ?? ''}:${item.outboxId ?? ''}:${item.ts ?? ''}`
}

function dedupeFeedItems<T>(items: T[], keyOf: (item: T) => string) {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const key = keyOf(item)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export function useSseFeed<T extends { eventId?: string; outboxId?: string; ts?: number | string }>(args: {
  url: string
  eventName: string
  enabled?: boolean
  maxItems?: number
  staleAfterMs?: number
  keyOf?: (item: T) => string
}) {
  const staleAfterMs = args.staleAfterMs ?? 45_000
  const [items, setItems] = useState<T[]>([])
  const [state, setState] = useState<StreamFeedState>(() => createInitialState())
  const [resyncNonce, setResyncNonce] = useState(0)
  const lastSemanticKeyRef = useRef('')
  const firstOpenSeenRef = useRef(false)
  const reconnectCountRef = useRef(0)

  useEffect(() => {
    if (args.enabled === false) {
      setItems([])
      setState(createInitialState())
      return
    }

    const keyOf = args.keyOf ?? defaultKeyOf<T>
    const controller = new AbortController()
    let active = true
    lastSemanticKeyRef.current = ''
    firstOpenSeenRef.current = false

    setState((current) => ({
      ...current,
      status: 'connecting',
      connected: false,
      unauthorized: false,
      stale: false,
      error: '',
    }))

    void connectSseWithRetry({
      url: args.url,
      signal: controller.signal,
      onOpen: () => {
        emitRealtimeTelemetry(firstOpenSeenRef.current ? 'reconnect' : 'stream_opened', {
          stream: args.url,
          eventName: args.eventName,
          reconnectCount: reconnectCountRef.current,
        })
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
        setState((current) => ({
          ...current,
          connected: false,
          error: toStreamError(error),
        }))
      },
      onMessage: (message) => {
        if (message.event !== args.eventName) return
        const semanticKey = message.id || `${message.event}:${message.data}`
        if (semanticKey && semanticKey === lastSemanticKeyRef.current) return
        lastSemanticKeyRef.current = semanticKey

        try {
          const next = JSON.parse(message.data) as T
          const receivedAt = new Date().toISOString()
          setItems((current) => dedupeFeedItems([next, ...current], keyOf).slice(0, args.maxItems ?? 100))
          setState((current) => ({
            ...current,
            status: 'connected',
            connected: true,
            stale: false,
            error: '',
            receivedAt,
            staleSince: null,
          }))
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
  }, [args.enabled, args.eventName, args.keyOf, args.maxItems, args.url, resyncNonce])

  useEffect(() => {
    if (args.enabled === false) return

    const timer = window.setInterval(() => {
      setState((current) => {
        if (current.unauthorized || !current.receivedAt) return current
        const receivedAtMs = new Date(current.receivedAt).getTime()
        if (!Number.isFinite(receivedAtMs)) return current

        const expired = Date.now() - receivedAtMs > staleAfterMs
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

  const resync = useCallback(() => {
    emitRealtimeTelemetry('manual_resync', {
      stream: args.url,
      eventName: args.eventName,
      reconnectCount: reconnectCountRef.current,
      reason: 'manual',
    })
    setResyncNonce((value) => value + 1)
  }, [args.eventName, args.url])

  return useMemo(() => ({ items, setItems, state, resync }), [items, resync, state])
}
