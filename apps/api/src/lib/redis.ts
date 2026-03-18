import Redis, { type RedisOptions } from 'ioredis'

import { config } from '../server/config'
import * as metricsModule from '../server/metrics'

const REDIS_CONNECT_TIMEOUT_MS = 3_000
const REDIS_COMMAND_TIMEOUT_MS = 3_000
const REDIS_HEALTH_CACHE_MS = 5_000

export type RedisHealthSnapshot = {
  configured: boolean
  required: boolean
  keyPrefix: string
  db: number
  url: string | null
  connected: boolean
  ready: boolean
  available: boolean
  degraded: boolean
  latencyMs: number | null
  lastCheckAt: string | null
  lastError: string | null
}

type RedisRuntimeConfig = {
  url: string | null
  prefix: string
  db: number
  required: boolean
  tls: boolean
}

type RedisSingletonState = {
  client: Redis | null
  connectPromise: Promise<Redis | null> | null
  healthPromise: Promise<RedisHealthSnapshot> | null
  listenersAttached: boolean
  lastError: string | null
  lastLatencyMs: number | null
  lastCheckAt: number | null
  lastHealth: RedisHealthSnapshot | null
}

const state: RedisSingletonState = {
  client: null,
  connectPromise: null,
  healthPromise: null,
  listenersAttached: false,
  lastError: null,
  lastLatencyMs: null,
  lastCheckAt: null,
  lastHealth: null,
}

function getMetricsApi(): {
  setRedisUp?: (value: number) => void
  incrementRedisCommandFailures?: (commandName: string) => void
  observeRedisLatency?: (commandName: string, latencyMs: number) => void
} {
  return metricsModule as unknown as {
    setRedisUp?: (value: number) => void
    incrementRedisCommandFailures?: (commandName: string) => void
    observeRedisLatency?: (commandName: string, latencyMs: number) => void
  }
}

function setRedisUp(value: number) {
  getMetricsApi().setRedisUp?.(value)
}

function incrementRedisCommandFailures(commandName: string) {
  getMetricsApi().incrementRedisCommandFailures?.(commandName)
}

function observeRedisLatency(commandName: string, latencyMs: number) {
  getMetricsApi().observeRedisLatency?.(commandName, latencyMs)
}

function asObject<T extends object>(value: unknown): Partial<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Partial<T>
}

function parseBooleanFlag(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'ON' || normalized === 'TRUE' || normalized === '1' || normalized === 'YES') return true
  if (normalized === 'OFF' || normalized === 'FALSE' || normalized === '0' || normalized === 'NO') return false
  return fallback
}

function parseInteger(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function getRedisRuntimeConfig(): RedisRuntimeConfig {
  const configAny = asObject<{ redis: Partial<RedisRuntimeConfig> }>(config as unknown)
  const redisConfig = asObject<RedisRuntimeConfig>(configAny.redis)

  const url = String(redisConfig.url ?? process.env.REDIS_URL ?? '').trim() || null
  const prefix = String(redisConfig.prefix ?? process.env.REDIS_PREFIX ?? 'parkly:dev').trim() || 'parkly:dev'
  const db = parseInteger(redisConfig.db ?? process.env.REDIS_DB, 0)
  const required = parseBooleanFlag(redisConfig.required ?? process.env.REDIS_REQUIRED, false)
  const tls = parseBooleanFlag(redisConfig.tls ?? process.env.REDIS_TLS, false)

  return { url, prefix, db, required, tls }
}

function jitter(ms: number) {
  return Math.floor(Math.random() * ms)
}

function sanitizeError(error: unknown) {
  const message = String((error as { message?: unknown } | null | undefined)?.message ?? error ?? 'Unknown Redis error').trim()
  return message || 'Unknown Redis error'
}

function redactRedisUrl(rawUrl: string | null | undefined) {
  if (!rawUrl) return null
  try {
    const parsed = new URL(rawUrl)
    if (parsed.password) parsed.password = '***'
    if (parsed.username) parsed.username = '***'
    return parsed.toString()
  } catch {
    return rawUrl.replace(/:\/\/([^@]+)@/, '://***@')
  }
}

function isClientConnected(client: Redis | null) {
  const status = client?.status ?? ''
  return status === 'connect' || status === 'connecting' || status === 'ready' || status === 'reconnecting'
}

function isClientReady(client: Redis | null) {
  return client?.status === 'ready'
}

function buildBaseSnapshot(overrides: Partial<RedisHealthSnapshot> = {}): RedisHealthSnapshot {
  const runtime = getRedisRuntimeConfig()

  return {
    configured: Boolean(runtime.url),
    required: runtime.required,
    keyPrefix: runtime.prefix,
    db: runtime.db,
    url: redactRedisUrl(runtime.url),
    connected: isClientConnected(state.client),
    ready: isClientReady(state.client),
    available: isClientReady(state.client),
    degraded: Boolean(runtime.required && !isClientReady(state.client)),
    latencyMs: state.lastLatencyMs,
    lastCheckAt: state.lastCheckAt ? new Date(state.lastCheckAt).toISOString() : null,
    lastError: state.lastError,
    ...overrides,
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, commandName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Redis ${commandName} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function rememberRedisFailure(error: unknown, command = 'unknown') {
  state.lastError = sanitizeError(error)
  state.lastCheckAt = Date.now()
  incrementRedisCommandFailures(command)
  setRedisUp(0)
}

function needsTls(rawUrl: string) {
  try {
    return new URL(rawUrl).protocol === 'rediss:'
  } catch {
    return false
  }
}

function buildRedisOptions(runtime: RedisRuntimeConfig): RedisOptions {
  if (!runtime.url) {
    throw new Error('REDIS_URL is not configured')
  }

  const parsedUrl = new URL(runtime.url)

  const options: RedisOptions = {
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : 6379,
    username: parsedUrl.username || undefined,
    password: parsedUrl.password || undefined,
    db: runtime.db,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times: number) => Math.min(250 * 2 ** times, 5_000) + jitter(250),
  }

  if (runtime.tls || needsTls(runtime.url)) {
    options.tls = {}
  }

  return options
}

function attachRedisListeners(client: Redis) {
  if (state.listenersAttached) return
  state.listenersAttached = true

  client.on('connect', () => {
    state.lastError = null
    state.lastCheckAt = Date.now()
  })

  client.on('ready', () => {
    state.lastError = null
    state.lastCheckAt = Date.now()
    setRedisUp(1)
  })

  client.on('reconnecting', () => {
    state.lastCheckAt = Date.now()
    setRedisUp(0)
  })

  client.on('close', () => {
    state.lastCheckAt = Date.now()
    setRedisUp(0)
  })

  client.on('end', () => {
    state.lastCheckAt = Date.now()
    setRedisUp(0)
  })

  client.on('error', (error: unknown) => {
    rememberRedisFailure(error, 'socket')
  })
}

function createRedisClientInstance(): Redis {
  const runtime = getRedisRuntimeConfig()
  const client = new Redis(buildRedisOptions(runtime))
  attachRedisListeners(client)
  return client
}

async function safeCloseClient(client: Redis | null) {
  if (!client) return

  try {
    if (client.status === 'wait') {
      client.disconnect(false)
      return
    }

    await withTimeout(client.quit(), REDIS_COMMAND_TIMEOUT_MS, 'quit')
  } catch {
    try {
      client.disconnect(false)
    } catch {
      // noop
    }
  }
}

function resetSingletonClient(nextClient: Redis | null) {
  if (state.client === nextClient) {
    state.client = null
    state.listenersAttached = false
  }
}

export function buildRedisKey(...parts: Array<string | number | null | undefined>) {
  const runtime = getRedisRuntimeConfig()
  const normalized = parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)

  return [runtime.prefix, ...normalized].join(':')
}

export async function getRedisClient(opts: { connect?: boolean } = {}): Promise<Redis | null> {
  const runtime = getRedisRuntimeConfig()
  const shouldConnect = opts.connect !== false

  if (!runtime.url) {
    return null
  }

  if (!state.client) {
    state.client = createRedisClientInstance()
  }

  if (!shouldConnect) {
    return state.client
  }

  if (isClientReady(state.client)) {
    setRedisUp(1)
    return state.client
  }

  if (state.connectPromise) {
    return state.connectPromise
  }

  const nextClient = state.client

  state.connectPromise = withTimeout(nextClient.connect(), REDIS_CONNECT_TIMEOUT_MS, 'connect')
    .then(() => {
      setRedisUp(1)
      state.lastError = null
      state.lastCheckAt = Date.now()
      return nextClient
    })
    .catch(async (error) => {
      rememberRedisFailure(error, 'connect')
      await safeCloseClient(nextClient)
      resetSingletonClient(nextClient)
      throw error
    })
    .finally(() => {
      state.connectPromise = null
    })

  return state.connectPromise
}

export async function runRedisCommand<T>(commandName: string, fn: (client: Redis) => Promise<T>): Promise<T> {
  const client = await getRedisClient({ connect: true })
  if (!client) {
    const { DependencyUnavailableError } = await import('../server/http')
    throw new DependencyUnavailableError('Redis', {
      message: 'Redis client is not configured — ensure Redis is running and REDIS_URL / REDIS_REQUIRED are set correctly.',
    })
  }

  const startedAt = process.hrtime.bigint()

  try {
    const result = await withTimeout(fn(client), REDIS_COMMAND_TIMEOUT_MS, commandName)
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000

    state.lastLatencyMs = latencyMs
    state.lastCheckAt = Date.now()
    state.lastError = null

    observeRedisLatency(commandName, latencyMs)
    return result
  } catch (error) {
    rememberRedisFailure(error, commandName)
    const { DependencyUnavailableError } = await import('../server/http')
    const message = error instanceof Error ? error.message : String(error)
    // Re-throw as DependencyUnavailableError for connection/timeout errors
    if (
      message.includes('ECONNREFUSED') ||
      message.includes('ETIMEDOUT') ||
      message.includes('ENOTFOUND') ||
      message.includes('Redis is unable') ||
      message.includes('Connection is closed') ||
      message.includes('CLUSTERDOWN') ||
      /ioredis.*(error|timeout|closed)/i.test(message) ||
      commandName === 'PING'
    ) {
      throw new DependencyUnavailableError('Redis', { message, details: { command: commandName } })
    }
    throw error
  }
}

export async function pingRedis(): Promise<RedisHealthSnapshot> {
  try {
    await runRedisCommand('PING', async (client) => {
      await client.ping()
    })

    const snapshot = buildBaseSnapshot({
      connected: true,
      ready: true,
      available: true,
      degraded: false,
    })

    state.lastHealth = snapshot
    return snapshot
  } catch {
    const runtime = getRedisRuntimeConfig()

    const snapshot = buildBaseSnapshot({
      connected: isClientConnected(state.client),
      ready: isClientReady(state.client),
      available: false,
      degraded: runtime.required,
    })

    state.lastHealth = snapshot
    return snapshot
  }
}

export async function getRedisHealth(opts: { forceRefresh?: boolean } = {}): Promise<RedisHealthSnapshot> {
  const forceRefresh = opts.forceRefresh === true

  if (
    !forceRefresh &&
    state.lastHealth &&
    state.lastCheckAt &&
    Date.now() - state.lastCheckAt < REDIS_HEALTH_CACHE_MS
  ) {
    return state.lastHealth
  }

  if (state.healthPromise) {
    return state.healthPromise
  }

  state.healthPromise = pingRedis().finally(() => {
    state.healthPromise = null
  })

  return state.healthPromise
}

export async function ensureRedisStartupReadiness() {
  const runtime = getRedisRuntimeConfig()

  if (!runtime.url) {
    if (runtime.required) {
      throw new Error('Redis is required but REDIS_URL is empty')
    }

    return buildBaseSnapshot({
      configured: false,
      available: false,
      degraded: false,
    })
  }

  try {
    const health = await getRedisHealth({ forceRefresh: true })

    if (runtime.required && !health.available) {
      throw new Error(
        `Redis is required but unavailable (url=${health.url ?? 'n/a'}, db=${health.db}, prefix=${health.keyPrefix}). ` +
          `Check REDIS_URL / REDIS_DB / REDIS_TLS and start platform services before booting API.`,
      )
    }

    if (!health.available) {
      console.warn(
        `[redis] optional dependency is unavailable; continuing boot in degraded mode ` +
          `(url=${health.url ?? 'n/a'}, db=${health.db}, prefix=${health.keyPrefix}).`,
      )
    }

    return health
  } catch (error) {
    if (!runtime.required) {
      console.warn(`[redis] startup probe failed but REDIS_REQUIRED=OFF: ${sanitizeError(error)}`)
      return buildBaseSnapshot({
        available: false,
        degraded: false,
      })
    }

    throw error
  }
}

export async function closeRedis() {
  const currentClient = state.client

  state.client = null
  state.connectPromise = null
  state.healthPromise = null
  state.listenersAttached = false
  state.lastHealth = null
  setRedisUp(0)

  await safeCloseClient(currentClient)
}

export default {
  buildRedisKey,
  getRedisClient,
  runRedisCommand,
  pingRedis,
  getRedisHealth,
  ensureRedisStartupReadiness,
  closeRedis,
}