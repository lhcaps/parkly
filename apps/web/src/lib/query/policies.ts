type CacheEntry<T> = {
  expiresAt: number
  promise: Promise<T>
}

const readCache = new Map<string, CacheEntry<unknown>>()

export const queryTtl = {
  topology: 60_000,
  system: 15_000,
  reports: 20_000,
} as const

export function cachedRead<T>(key: string, ttlMs: number, loader: () => Promise<T>) {
  const now = Date.now()
  const cached = readCache.get(key) as CacheEntry<T> | undefined
  if (cached && cached.expiresAt > now) {
    return cached.promise
  }

  const promise = loader().catch((error) => {
    readCache.delete(key)
    throw error
  })

  readCache.set(key, {
    expiresAt: now + Math.max(ttlMs, 0),
    promise,
  })

  return promise
}

export function invalidateCachedRead(prefix?: string) {
  if (!prefix) {
    readCache.clear()
    return
  }

  for (const key of readCache.keys()) {
    if (key.startsWith(prefix)) readCache.delete(key)
  }
}
