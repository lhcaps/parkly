export * from '@/lib/http/client'
export * from '@/lib/http/errors'
export * from '@/lib/http/sse'

export * from '@/lib/contracts/common'
export * from '@/lib/contracts/alpr'
export * from '@/lib/contracts/laneFlow'
export * from '@/lib/contracts/topology'
export * from '@/lib/contracts/devices'
export * from '@/lib/contracts/sessions'
export * from '@/lib/contracts/reviews'
export * from '@/lib/contracts/outbox'
export * from '@/lib/contracts/mobile'

export * from '@/lib/api/system'
export * from '@/lib/api/alpr'
export * from '@/lib/api/laneFlow'
export * from '@/lib/api/topology'
export * from '@/lib/api/sessions'
export * from '@/lib/api/reviews'
export * from '@/lib/api/devices'
export * from '@/lib/api/outbox'
export * from '@/lib/api/mobile'

export type RealtimeDeviceHealthSnapshot = import('@/lib/contracts/devices').DeviceHealthSnapshot
export type RealtimeLaneStatusSnapshot = import('@parkly/contracts').LaneStatusSnapshot
export type RealtimeOutboxSnapshot = import('@/lib/contracts/outbox').OutboxSnapshot

export type { LaneStatusSnapshot, LaneStatusStreamItem } from '@parkly/contracts'

export type DefaultContextPrefs = {
  siteCode: string
  laneCode: string
  direction: 'ENTRY' | 'EXIT'
}

const DEFAULT_CONTEXT_STORAGE_KEY = 'parkly.defaultContext.v2'
const KNOWN_LOCAL_CACHE_KEYS = [
  'parkly_token',
  'parkly.mobilePairs.v1',
  DEFAULT_CONTEXT_STORAGE_KEY,
] as const

export function getBuildDebugInfo() {
  return {
    mode: import.meta.env.MODE,
    dev: Boolean(import.meta.env.DEV),
    prod: Boolean(import.meta.env.PROD),
    baseUrl: import.meta.env.BASE_URL,
  }
}

export function readDefaultContextPrefs(): DefaultContextPrefs {
  if (typeof window === 'undefined') {
    return { siteCode: '', laneCode: '', direction: 'ENTRY' }
  }

  try {
    const raw = window.localStorage.getItem(DEFAULT_CONTEXT_STORAGE_KEY)
    if (!raw) return { siteCode: '', laneCode: '', direction: 'ENTRY' }

    const parsed = JSON.parse(raw) as Partial<DefaultContextPrefs>
    return {
      siteCode: typeof parsed.siteCode === 'string' ? parsed.siteCode : '',
      laneCode: typeof parsed.laneCode === 'string' ? parsed.laneCode : '',
      direction: parsed.direction === 'EXIT' ? 'EXIT' : 'ENTRY',
    }
  } catch {
    return { siteCode: '', laneCode: '', direction: 'ENTRY' }
  }
}

export function writeDefaultContextPrefs(value: Partial<DefaultContextPrefs>) {
  if (typeof window === 'undefined') return
  const next: DefaultContextPrefs = {
    siteCode: typeof value.siteCode === 'string' ? value.siteCode : '',
    laneCode: typeof value.laneCode === 'string' ? value.laneCode : '',
    direction: value.direction === 'EXIT' ? 'EXIT' : 'ENTRY',
  }
  window.localStorage.setItem(DEFAULT_CONTEXT_STORAGE_KEY, JSON.stringify(next))
  return next
}

export function resetDefaultContextPrefs() {
  if (typeof window === 'undefined') return { siteCode: '', laneCode: '', direction: 'ENTRY' as const }
  window.localStorage.removeItem(DEFAULT_CONTEXT_STORAGE_KEY)
  return { siteCode: '', laneCode: '', direction: 'ENTRY' as const }
}

export function listLocalAppCacheKeys() {
  if (typeof window === 'undefined') return [] as string[]
  const keys = new Set<string>()

  for (const key of KNOWN_LOCAL_CACHE_KEYS) {
    if (window.localStorage.getItem(key) != null) {
      keys.add(key)
    }
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key) continue
    if (key.startsWith('parkly.') || key.startsWith('parkly_')) {
      keys.add(key)
    }
  }

  return Array.from(keys).sort()
}

export function clearLocalAppCache() {
  if (typeof window === 'undefined') return

  const keys = listLocalAppCacheKeys()
  for (const key of keys) {
    window.localStorage.removeItem(key)
  }
}
