import { useEffect, useState } from 'react'

export type StreamFeedState = {
  connected: boolean
  error: string
}

function dedupeFeedItem<T extends { eventId?: string; outboxId?: string; ts?: number }>(items: T[]) {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const key = `${item.eventId ?? ''}:${item.outboxId ?? ''}:${item.ts ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export function useSseFeed<T extends { eventId?: string; outboxId?: string; ts?: number }>(args: {
  url: string
  eventName: string
  enabled?: boolean
  maxItems?: number
}) {
  const [items, setItems] = useState<T[]>([])
  const [state, setState] = useState<StreamFeedState>({ connected: false, error: '' })

  useEffect(() => {
    if (args.enabled === false) return

    const es = new EventSource(args.url)
    es.onopen = () => setState({ connected: true, error: '' })
    es.onerror = () => setState({ connected: false, error: 'SSE bị ngắt. Kiểm tra token hoặc backend.' })
    es.addEventListener(args.eventName, (event) => {
      try {
        const next = JSON.parse((event as MessageEvent).data) as T
        setItems((prev) => dedupeFeedItem([next, ...prev]).slice(0, args.maxItems ?? 100))
        setState({ connected: true, error: '' })
      } catch {
        setState({ connected: false, error: 'Payload SSE không parse được.' })
      }
    })

    return () => {
      es.close()
    }
  }, [args.enabled, args.eventName, args.maxItems, args.url])

  return { items, setItems, state }
}
