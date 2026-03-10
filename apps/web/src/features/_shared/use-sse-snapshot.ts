import { useEffect, useState } from 'react'

export type StreamState = {
  connected: boolean
  error: string
}

export function useSseSnapshot<T>(args: {
  url: string
  eventName: string
  enabled?: boolean
}) {
  const [data, setData] = useState<T | null>(null)
  const [state, setState] = useState<StreamState>({ connected: false, error: '' })

  useEffect(() => {
    if (args.enabled === false) return

    const es = new EventSource(args.url)
    es.onopen = () => setState({ connected: true, error: '' })
    es.onerror = () => setState({ connected: false, error: 'SSE bị ngắt. Kiểm tra token hoặc backend.' })
    es.addEventListener(args.eventName, (event) => {
      try {
        setData(JSON.parse((event as MessageEvent).data) as T)
        setState({ connected: true, error: '' })
      } catch {
        setState({ connected: false, error: 'Payload SSE không parse được.' })
      }
    })

    return () => {
      es.close()
    }
  }, [args.enabled, args.eventName, args.url])

  return { data, state }
}
