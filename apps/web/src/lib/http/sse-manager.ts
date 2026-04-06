import type { SseMessage } from '@/lib/http/sse'
import { getAuthChangedEventName } from '@/lib/http/client'

export type RealtimeConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'stale' | 'unauthorized' | 'failed'

export type SseStatusDetail = {
  reconnectCount: number
  error?: string
  nextRetryAt?: string | null
  lastEventId?: string
}

type Subscriber = {
  onStatusChange?: (status: RealtimeConnectionState, detail: SseStatusDetail) => void
  onMessage: (message: SseMessage) => void
  onError?: (error: unknown) => void
  onOpen?: () => void
}

type ConnectionEntry = {
  url: string
  subscribers: Map<string, Subscriber>
  status: RealtimeConnectionState
  detail: SseStatusDetail
  controller: AbortController | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  retryDelayMs: number
  reconnectCount: number
  hasOpened: boolean
  retryTimeoutId?: ReturnType<typeof setTimeout>
  active: boolean
  pendingAuthListeners?: {
    onAuthChanged: (() => void) | null
    onStorage: ((e: StorageEvent) => void) | null
  }
}

const entries = new Map<string, ConnectionEntry>()

let messageIdCounter = 0
function nextId() {
  return `ss_${++messageIdCounter}_${Date.now().toString(36)}`
}

function delay(ms: number, signal?: AbortSignal): Promise<'aborted' | 'completed'> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }
    signal?.addEventListener('abort', onAbort)
  }).then(() => 'completed' as const)
}

async function streamSseInternal(
  entry: ConnectionEntry,
  onOpen: () => void,
  onEvent: (message: SseMessage) => void,
  lastEventId?: string,
) {
  const token = ((): string => {
    try {
      return localStorage.getItem('parkly_token') || ''
    } catch {
      return ''
    }
  })()

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'Cache-Control': 'no-cache',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (lastEventId) headers['Last-Event-ID'] = lastEventId

  const response = await fetch(entry.url, {
    method: 'GET',
    headers,
    signal: entry.controller!.signal,
    cache: 'no-store',
  })

  if (!response.ok) {
    const message =
      response.status === 401
        ? 'Realtime stream rejected — session token is no longer valid (401).'
        : response.status === 403
          ? 'Realtime stream forbidden — session is valid but current role/site is not permitted (403).'
          : `Realtime stream returned HTTP ${response.status} ${response.statusText}`
    throw { status: response.status, message }
  }

  if (!response.body) {
    throw new Error('Realtime stream has no readable body.')
  }

  onOpen()

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  function parseEventBlock(block: string): SseMessage | null {
    const lines = block.split('\n')
    let event = 'message'
    let id = ''
    let retry: number | null = null
    const dataLines: string[] = []

    for (const line of lines) {
      if (!line || line.startsWith(':')) continue
      const sep = line.indexOf(':')
      const field = sep >= 0 ? line.slice(0, sep) : line
      const rawVal = sep >= 0 ? line.slice(sep + 1) : ''
      const value = rawVal.startsWith(' ') ? rawVal.slice(1) : rawVal

      if (field === 'event') event = value || 'message'
      else if (field === 'data') dataLines.push(value)
      else if (field === 'id') id = value
      else if (field === 'retry') {
        const parsed = Number(value)
        retry = Number.isFinite(parsed) && parsed >= 0 ? parsed : null
      }
    }

    if (dataLines.length === 0 && !id && event === 'message') return null

    return { event, data: dataLines.join('\n'), id, retry }
  }

  try {
    while (!entry.controller!.signal.aborted) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })

      const blocks: string[] = []
      const normalized = buffer.replace(/\r\n/g, '\n')
      let start = 0
      while (start < normalized.length) {
        const boundary = normalized.indexOf('\n\n', start)
        if (boundary === -1) break
        blocks.push(normalized.slice(start, boundary))
        start = boundary + 2
      }
      buffer = normalized.slice(start)

      for (const block of blocks) {
        const parsed = parseEventBlock(block)
        if (!parsed) continue
        onEvent(parsed)
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch { /* ignore */ }
  }
}

function notifySubscribers(entry: ConnectionEntry, status: RealtimeConnectionState, detail?: Partial<SseStatusDetail>) {
  const merged: SseStatusDetail = { ...entry.detail, ...detail, reconnectCount: entry.reconnectCount }
  entry.status = status
  if (detail?.error !== undefined) entry.detail.error = detail.error
  if (detail?.nextRetryAt !== undefined) entry.detail.nextRetryAt = detail.nextRetryAt
  if (detail?.lastEventId !== undefined) entry.detail.lastEventId = detail.lastEventId

  for (const sub of entry.subscribers.values()) {
    try {
      sub.onStatusChange?.(status, merged)
    } catch { /* ignore subscriber errors */ }
  }
}

function notifySubscribersMessage(entry: ConnectionEntry, message: SseMessage) {
  for (const sub of entry.subscribers.values()) {
    try {
      sub.onMessage(message)
    } catch { /* ignore */ }
  }
}

function notifySubscribersError(entry: ConnectionEntry, error: unknown) {
  for (const sub of entry.subscribers.values()) {
    try {
      sub.onError?.(error)
    } catch { /* ignore */ }
  }
}

function notifySubscribersOpen(entry: ConnectionEntry) {
  for (const sub of entry.subscribers.values()) {
    try {
      sub.onOpen?.()
    } catch { /* ignore */ }
  }
}

async function runConnection(entry: ConnectionEntry) {
  if (!entry.active) return

  entry.controller = new AbortController()
  let lastEventId = entry.detail.lastEventId || ''

  const onOpen = () => {
    if (!entry.active) return
    entry.retryDelayMs = 1500
    entry.hasOpened = true
    entry.reconnectCount = 0
    notifySubscribers(entry, 'connected', { reconnectCount: 0, error: undefined })
    notifySubscribersOpen(entry)
  }

  const onEvent = (message: SseMessage) => {
    if (!entry.active) return
    if (message.id) {
      lastEventId = message.id
      entry.detail.lastEventId = message.id
    }
    if (message.retry != null) {
      entry.retryDelayMs = Math.min(Math.max(750, message.retry), 12000)
    }
    notifySubscribersMessage(entry, message)
  }

  notifySubscribers(entry, entry.hasOpened ? 'reconnecting' : 'connecting')

  try {
    await streamSseInternal(entry, onOpen, onEvent, lastEventId)
  } catch (error) {
    if (!entry.active || entry.controller.signal.aborted) return

    const httpError = error as { status?: number; message?: string } | undefined

    if (httpError?.status === 401) {
      entry.active = false
      notifySubscribers(entry, 'unauthorized', { error: httpError?.message || 'Unauthorized' })
      return
    }

    if (httpError?.status === 403) {
      entry.active = false
      notifySubscribers(entry, 'failed', { error: httpError?.message || 'Forbidden' })
      return
    }

    notifySubscribersError(entry, error)
    notifySubscribers(entry, entry.hasOpened ? 'reconnecting' : 'connecting', {
      error: httpError?.message || String(error),
    })

    entry.reconnectCount += 1
    if (entry.reconnectCount > 8) {
      entry.active = false
      notifySubscribers(entry, 'failed', {
        reconnectCount: entry.reconnectCount,
        error: 'Realtime stream reconnect budget exceeded.',
      })
      return
    }

    const nextRetryAt = new Date(Date.now() + entry.retryDelayMs).toISOString()
    notifySubscribers(entry, entry.hasOpened ? 'reconnecting' : 'connecting', {
      reconnectCount: entry.reconnectCount,
      nextRetryAt,
    })

    entry.retryTimeoutId = setTimeout(async () => {
      if (!entry.active) return
      entry.retryDelayMs = Math.min(Math.round(entry.retryDelayMs * 1.6), 12000)
      await runConnection(entry)
    }, entry.retryDelayMs)
  }
}

function startConnection(url: string) {
  let entry = entries.get(url)
  if (entry) return entry

  entry = {
    url,
    subscribers: new Map(),
    status: 'idle',
    detail: { reconnectCount: 0 },
    controller: null,
    reconnectTimer: null,
    retryDelayMs: 1500,
    reconnectCount: 0,
    hasOpened: false,
    active: true,
    pendingAuthListeners: undefined,
  }

  entries.set(url, entry)
  void runConnection(entry)
  return entry
}

function stopConnection(url: string) {
  const entry = entries.get(url)
  if (!entry) return

  if (entry.pendingAuthListeners) {
    if (entry.pendingAuthListeners.onAuthChanged) {
      window.removeEventListener(getAuthChangedEventName(), entry.pendingAuthListeners.onAuthChanged)
    }
    if (entry.pendingAuthListeners.onStorage) {
      window.removeEventListener('storage', entry.pendingAuthListeners.onStorage)
    }
    entry.pendingAuthListeners = undefined
  }

  if (entry.retryTimeoutId != null) {
    clearTimeout(entry.retryTimeoutId)
    entry.retryTimeoutId = undefined
  }
  if (entry.reconnectTimer != null) {
    clearTimeout(entry.reconnectTimer)
    entry.reconnectTimer = null
  }
  entry.active = false
  entry.controller?.abort()

  if (entry.subscribers.size === 0) {
    entries.delete(url)
  }
}

function readToken(): string {
  try {
    return localStorage.getItem('parkly_token') || ''
  } catch {
    return ''
  }
}

export type SseSubscriptionId = string

export function subscribeToSse(args: {
  url: string
  onOpen?: () => void
  onMessage: (message: SseMessage) => void
  onError?: (error: unknown) => void
  onStatusChange?: (status: RealtimeConnectionState, detail: SseStatusDetail) => void
}): SseSubscriptionId {
  const id = nextId()
  const entry = startConnection(args.url)

  entry.subscribers.set(id, {
    onOpen: args.onOpen,
    onMessage: args.onMessage,
    onError: args.onError,
    onStatusChange: args.onStatusChange,
  })

  args.onStatusChange?.(entry.status, entry.detail)

  // If the entry has no token yet, defer the connection until auth is ready.
  // This prevents 401 on SSE when the page loads before the token is hydrated.
  if (!readToken()) {
    entry.status = 'idle'
    entry.detail = { reconnectCount: 0 }
    entry.active = false
    entry.controller?.abort()

    entry.pendingAuthListeners = { onAuthChanged: null, onStorage: null }

    function onAuthChanged() {
      if (entry.pendingAuthListeners) {
        window.removeEventListener(getAuthChangedEventName(), entry.pendingAuthListeners.onAuthChanged!)
        window.removeEventListener('storage', entry.pendingAuthListeners.onStorage!)
        entry.pendingAuthListeners = undefined
      }
      entry.active = true
      void runConnection(entry)
    }

    function onStorage(e: StorageEvent) {
      if (e.key !== 'parkly_token') return
      if (!e.newValue) return
      onAuthChanged()
    }

    entry.pendingAuthListeners.onAuthChanged = onAuthChanged
    entry.pendingAuthListeners.onStorage = onStorage

    window.addEventListener(getAuthChangedEventName(), onAuthChanged)
    window.addEventListener('storage', onStorage)
  }

  return id
}

export function unsubscribeFromSse(url: string, subscriptionId: SseSubscriptionId) {
  const entry = entries.get(url)
  if (!entry) return

  entry.subscribers.delete(subscriptionId)

  if (entry.subscribers.size === 0) {
    stopConnection(url)
  }
}

export function getSseConnectionState(url: string): { status: RealtimeConnectionState; detail: SseStatusDetail } | null {
  const entry = entries.get(url)
  if (!entry) return null
  return { status: entry.status, detail: entry.detail }
}

export const sseManager = {
  subscribe: subscribeToSse,
  unsubscribe: unsubscribeFromSse,
  getState: getSseConnectionState,
  unsubscribeAll() {
    for (const url of Array.from(entries.keys())) {
      stopConnection(url)
    }
  },
}
