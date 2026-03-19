import { createHash, randomUUID } from 'node:crypto'

import { buildRedisKey, runRedisCommand } from '../../lib/redis'
import { config } from '../config'
import {
  incrementAlprPreviewCacheEvent,
  incrementAlprPreviewDedupeSuppressed,
} from '../metrics'

export type AlprPreviewCacheStatus = 'DISABLED' | 'MISS' | 'HIT' | 'DEDUPED'

export type AlprPreviewCacheScopeInput = {
  surface: string
  siteCode?: string | null
  laneCode?: string | null
  imageUrl?: string | null
  plateHint?: string | null
}

export type AlprPreviewCacheMeta = {
  status: AlprPreviewCacheStatus
  debugKey: string
  dedupeKey: string | null
  responseKey: string | null
}

type CachedEnvelope<T> = {
  cachedAt: string
  value: T
}

const RELEASE_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

const compatMemoryCache = new Map<string, { expiresAt: number; value: unknown }>()
const compatInflight = new Map<string, Promise<unknown>>()

function normalizeSegment(value: string | null | undefined, fallback: string) {
  const normalized = String(value ?? '').trim().toUpperCase()
  return normalized || fallback
}

function normalizeImageUrl(value: string | null | undefined) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function normalizePlateHint(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toUpperCase()
  return normalized || null
}

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseEnvelope<T>(raw: string | null): CachedEnvelope<T> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CachedEnvelope<T>
    if (!parsed || typeof parsed !== 'object' || !('value' in parsed)) return null
    return parsed
  } catch {
    return null
  }
}

function buildScope(input: AlprPreviewCacheScopeInput) {
  const surface = String(input.surface ?? '').trim() || 'POST /api/alpr/preview'
  const siteCode = normalizeSegment(input.siteCode ?? null, 'GLOBAL')
  const laneCode = normalizeSegment(input.laneCode ?? null, 'UNSCOPED')
  const imageUrl = normalizeImageUrl(input.imageUrl ?? null)
  const plateHint = normalizePlateHint(input.plateHint ?? null)
  const imageHash = imageUrl ? hashText(imageUrl) : null
  const hintHash = plateHint ? hashText(plateHint) : 'NO_HINT'
  const debugKey = `${surface}|${siteCode}|${laneCode}|${imageHash ?? 'NO_IMAGE'}|${hintHash}`

  return {
    surface,
    siteCode,
    laneCode,
    imageUrl,
    plateHint,
    imageHash,
    hintHash,
    debugKey,
    dedupeKey: imageHash
      ? buildRedisKey('alpr-preview', 'dedupe', siteCode, laneCode, surface, imageHash, hintHash)
      : null,
    responseKey: imageHash
      ? buildRedisKey('alpr-preview', 'response', siteCode, laneCode, surface, imageHash, hintHash)
      : null,
  }
}

function resolveCompatScope(input: any) {
  if (typeof input === 'string' && input.trim()) {
    return {
      debugKey: input.trim(),
      dedupeKey: `compat:${input.trim()}`,
      responseKey: `compat:${input.trim()}`,
      surface: 'compat',
      imageHash: input.trim(),
    }
  }

  const surface = String(input?.surface ?? 'POST /api/alpr/preview')
  const imageUrl = input?.imageUrl ?? input?.imagePath ?? input?.url ?? null
  const plateHint = input?.plateHint ?? null
  const siteCode = input?.siteCode ?? null
  const laneCode = input?.laneCode ?? null

  const scope = buildScope({ surface, siteCode, laneCode, imageUrl, plateHint })
  return scope
}

async function readCachedValue<T>(responseKey: string | null): Promise<T | null> {
  if (!responseKey) return null

  if (config.previewCache.backend !== 'REDIS') {
    const hit = compatMemoryCache.get(responseKey)
    if (!hit) return null
    if (hit.expiresAt <= Date.now()) {
      compatMemoryCache.delete(responseKey)
      return null
    }
    return hit.value as T
  }

  const raw = await runRedisCommand('GET', async (client) => {
    return await client.get(responseKey)
  })

  const parsed = parseEnvelope<T>(raw)
  if (!parsed) return null
  return parsed.value
}

async function writeCachedValue<T>(responseKey: string | null, value: T, ttlMs: number): Promise<void> {
  if (!responseKey) return

  if (config.previewCache.backend !== 'REDIS') {
    compatMemoryCache.set(responseKey, {
      value,
      expiresAt: Date.now() + Math.max(50, ttlMs),
    })
    return
  }

  const payload: CachedEnvelope<T> = {
    cachedAt: new Date().toISOString(),
    value,
  }

  await runRedisCommand('SET', async (client) => {
    await client.set(responseKey, JSON.stringify(payload), 'PX', Math.max(100, ttlMs))
  })
}

async function tryAcquireDedupeLock(dedupeKey: string | null, ttlMs: number, token: string): Promise<boolean> {
  if (!dedupeKey) return false

  if (config.previewCache.backend !== 'REDIS') {
    if (compatInflight.has(dedupeKey)) return false
    const promise = Promise.resolve(token)
    compatInflight.set(dedupeKey, promise)
    return true
  }

  const result = await runRedisCommand('SET', async (client) => {
    return await client.set(dedupeKey, token, 'PX', Math.max(100, ttlMs), 'NX')
  })

  return result === 'OK'
}

async function releaseDedupeLock(dedupeKey: string | null, token: string): Promise<void> {
  if (!dedupeKey) return

  if (config.previewCache.backend !== 'REDIS') {
    const current = compatInflight.get(dedupeKey)
    if (current) compatInflight.delete(dedupeKey)
    return
  }

  await runRedisCommand('EVAL', async (client) => {
    await client.eval(RELEASE_LOCK_SCRIPT, 1, dedupeKey, token)
  })
}

async function waitForCachedValue<T>(responseKey: string | null, timeoutMs: number, pollIntervalMs: number): Promise<T | null> {
  if (!responseKey) return null

  const deadline = Date.now() + Math.max(100, timeoutMs)
  const intervalMs = Math.max(25, pollIntervalMs)

  while (Date.now() < deadline) {
    const cached = await readCachedValue<T>(responseKey)
    if (cached !== null) return cached
    await sleep(intervalMs)
  }

  return await readCachedValue<T>(responseKey)
}

export async function resolveAlprPreviewCached<T>(
  input: AlprPreviewCacheScopeInput,
  compute: () => Promise<T>,
): Promise<{ value: T; meta: AlprPreviewCacheMeta }> {
  const scope = buildScope(input)

  if (config.previewCache.backend !== 'REDIS' || !scope.imageHash) {
    const value = await compute()
    incrementAlprPreviewCacheEvent({ surface: scope.surface, result: 'DISABLED' })
    return {
      value,
      meta: {
        status: 'DISABLED',
        debugKey: scope.debugKey,
        dedupeKey: scope.dedupeKey,
        responseKey: scope.responseKey,
      },
    }
  }

  const hotCached = await readCachedValue<T>(scope.responseKey)
  if (hotCached !== null) {
    incrementAlprPreviewCacheEvent({ surface: scope.surface, result: 'HIT' })
    return {
      value: hotCached,
      meta: {
        status: 'HIT',
        debugKey: scope.debugKey,
        dedupeKey: scope.dedupeKey,
        responseKey: scope.responseKey,
      },
    }
  }

  const lockToken = randomUUID()
  const claimed = await tryAcquireDedupeLock(scope.dedupeKey, config.previewCache.dedupeTtlMs, lockToken)

  if (!claimed) {
    const deduped = await waitForCachedValue<T>(
      scope.responseKey,
      config.previewCache.dedupeTtlMs,
      config.previewCache.pollIntervalMs,
    )

    if (deduped !== null) {
      incrementAlprPreviewCacheEvent({ surface: scope.surface, result: 'DEDUPED' })
      incrementAlprPreviewDedupeSuppressed(scope.surface, 1)
      return {
        value: deduped,
        meta: {
          status: 'DEDUPED',
          debugKey: scope.debugKey,
          dedupeKey: scope.dedupeKey,
          responseKey: scope.responseKey,
        },
      }
    }
  }

  try {
    const value = await compute()
    await writeCachedValue(scope.responseKey, value, config.previewCache.responseTtlMs)
    incrementAlprPreviewCacheEvent({ surface: scope.surface, result: 'MISS' })
    return {
      value,
      meta: {
        status: 'MISS',
        debugKey: scope.debugKey,
        dedupeKey: scope.dedupeKey,
        responseKey: scope.responseKey,
      },
    }
  } finally {
    if (claimed) {
      await releaseDedupeLock(scope.dedupeKey, lockToken).catch(() => void 0)
    }
  }
}

export function __resetAlprPreviewCachesForTests() {
  compatMemoryCache.clear()
  compatInflight.clear()
}

export function computeLocalImageFingerprint(input: any): string | null {
  const raw =
    String(
      input?.imageUrl ??
      input?.imagePath ??
      input?.filePath ??
      input?.filename ??
      input?.buffer ??
      '',
    ).trim()

  if (!raw) return null
  return hashText(raw)
}

export function createAlprPreviewRequestKey(input: any): string {
  return resolveCompatScope(input).debugKey
}

export async function readAlprPreviewCache<T = unknown>(input: any): Promise<T | null> {
  const scope = resolveCompatScope(input)
  return await readCachedValue<T>(scope.responseKey)
}

export async function writeAlprPreviewCache<T = unknown>(input: any, value: T, ttlMs?: number): Promise<void> {
  const scope = resolveCompatScope(input)
  await writeCachedValue(scope.responseKey, value, ttlMs ?? config.previewCache.responseTtlMs)
}

export async function withAlprPreviewInflightDedupe<T = unknown>(
  input: any,
  compute: () => Promise<T>,
): Promise<T> {
  const key = resolveCompatScope(input).dedupeKey ?? resolveCompatScope(input).debugKey

  if (compatInflight.has(key)) {
    return await compatInflight.get(key) as T
  }

  const promise = (async () => {
    try {
      return await compute()
    } finally {
      compatInflight.delete(key)
    }
  })()

  compatInflight.set(key, promise)
  return await promise
}

export default {
  resolveAlprPreviewCached,
  __resetAlprPreviewCachesForTests,
  computeLocalImageFingerprint,
  createAlprPreviewRequestKey,
  readAlprPreviewCache,
  writeAlprPreviewCache,
  withAlprPreviewInflightDedupe,
}