import { buildUrl, getToken, invalidateAuthSession } from '@/lib/http/client'

export type SseMessage = {
  event: string
  data: string
  id: string
  retry: number | null
}

export type RealtimeConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'stale' | 'unauthorized' | 'failed'

export class SseHttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'SseHttpError'
    this.status = status
  }
}

function splitEventBlocks(buffer: string) {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const blocks: string[] = []
  let start = 0

  while (start < normalized.length) {
    const boundary = normalized.indexOf('\n\n', start)
    if (boundary === -1) break
    blocks.push(normalized.slice(start, boundary))
    start = boundary + 2
  }

  return {
    events: blocks,
    rest: normalized.slice(start),
  }
}

function parseEventBlock(block: string): SseMessage | null {
  const lines = block.split('\n')
  let event = 'message'
  let id = ''
  let retry: number | null = null
  const dataLines: string[] = []

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue

    const separatorIndex = line.indexOf(':')
    const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line
    const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : ''
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue

    if (field === 'event') event = value || 'message'
    else if (field === 'data') dataLines.push(value)
    else if (field === 'id') id = value
    else if (field === 'retry') {
      const parsed = Number(value)
      retry = Number.isFinite(parsed) && parsed >= 0 ? parsed : null
    }
  }

  if (dataLines.length === 0 && !id && event === 'message') return null

  return {
    event,
    data: dataLines.join('\n'),
    id,
    retry,
  }
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }

    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    function onAbort() {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }

    signal?.addEventListener('abort', onAbort)
  })
}

export function makeSseUrl(path: string) {
  return buildUrl(path)
}

export async function streamSse(args: {
  url: string
  signal: AbortSignal
  lastEventId?: string
  onOpen?: () => void
  onEvent: (message: SseMessage) => void
}) {
  const token = getToken()
  const headers = new Headers({
    Accept: 'text/event-stream',
    'Cache-Control': 'no-cache',
  })

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (args.lastEventId) {
    headers.set('Last-Event-ID', args.lastEventId)
  }

  const response = await fetch(args.url, {
    method: 'GET',
    headers,
    signal: args.signal,
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = response.status === 401
      ? 'Realtime stream rejected — session token is no longer valid (401).'
      : response.status === 403
        ? 'Realtime stream forbidden — session is valid but current role/site is not permitted (403).'
        : `Realtime stream returned HTTP ${response.status} ${response.statusText}`
    throw new SseHttpError(response.status, message)
  }

  if (!response.body) {
    throw new Error('Realtime stream has no readable body.')
  }

  args.onOpen?.()

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (!args.signal.aborted) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })
      const { events, rest } = splitEventBlocks(buffer)
      buffer = rest

      for (const block of events) {
        const parsed = parseEventBlock(block)
        if (!parsed) continue
        args.onEvent(parsed)
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      // ignore reader cancel failures during shutdown/reconnect
    }
  }
}

function normalizeRetryDelay(retryDelayMs: number, maxRetryDelayMs: number) {
  return Math.min(Math.max(750, retryDelayMs), Math.max(750, maxRetryDelayMs))
}

export async function connectSseWithRetry(args: {
  url: string
  signal: AbortSignal
  onOpen?: () => void
  onMessage: (message: SseMessage) => void
  onError?: (error: unknown) => void
  onStatusChange?: (status: RealtimeConnectionState, detail: { reconnectCount: number; error?: string }) => void
  retryDelayMs?: number
  maxRetryDelayMs?: number
  maxReconnects?: number
}) {
  let lastEventId = ''
  let retryDelayMs = normalizeRetryDelay(args.retryDelayMs ?? 1500, args.maxRetryDelayMs ?? 12_000)
  let reconnectCount = 0
  let hasOpened = false

  args.onStatusChange?.('connecting', { reconnectCount })

  while (!args.signal.aborted) {
    try {
      await streamSse({
        url: args.url,
        signal: args.signal,
        lastEventId: lastEventId || undefined,
        onOpen: () => {
          args.onStatusChange?.('connected', { reconnectCount })
          args.onOpen?.()
          hasOpened = true
        },
        onEvent: (message) => {
          if (message.id) lastEventId = message.id
          if (message.retry != null) {
            retryDelayMs = normalizeRetryDelay(message.retry, args.maxRetryDelayMs ?? 12_000)
          }
          args.onMessage(message)
        },
      })
    } catch (error) {
      if (args.signal.aborted) break

      args.onError?.(error)

      if (error instanceof SseHttpError && error.status === 401) {
        invalidateAuthSession('sse-401', {
          code: 'SSE_HTTP_401',
          status: 401,
          surface: 'shell',
          path: args.url,
        })
        args.onStatusChange?.('unauthorized', { reconnectCount, error: error.message })
        break
      }

      if (error instanceof SseHttpError && error.status === 403) {
        args.onStatusChange?.('failed', { reconnectCount, error: error.message })
        break
      }
    }

    if (args.signal.aborted) break

    reconnectCount += 1
    if (reconnectCount > (args.maxReconnects ?? 8)) {
      args.onStatusChange?.('failed', {
        reconnectCount,
        error: 'Realtime stream reconnect budget exceeded.',
      })
      break
    }

    args.onStatusChange?.(hasOpened ? 'reconnecting' : 'connecting', { reconnectCount })
    await delay(retryDelayMs, args.signal)
    retryDelayMs = normalizeRetryDelay(Math.round(retryDelayMs * 1.6), args.maxRetryDelayMs ?? 12_000)
  }
}
