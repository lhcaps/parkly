export type PerfMetric = {
  name: string
  durationMs: number
  at: string
  detail?: string
}

declare global {
  interface Window {
    __parklyPerfMetrics?: PerfMetric[]
  }
}

export function recordPerfMetric(name: string, durationMs: number, detail?: string) {
  if (typeof window === 'undefined') return
  const metric: PerfMetric = {
    name,
    durationMs: Number(durationMs.toFixed(1)),
    at: new Date().toISOString(),
    detail,
  }
  window.__parklyPerfMetrics = [...(window.__parklyPerfMetrics ?? []), metric].slice(-100)
  if (import.meta.env.DEV) {
    console.debug('[parkly:perf]', metric)
  }
}

export async function measureAsync<T>(name: string, task: () => Promise<T>, detail?: string) {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now()
  try {
    return await task()
  } finally {
    const end = typeof performance !== 'undefined' ? performance.now() : Date.now()
    recordPerfMetric(name, end - start, detail)
  }
}
