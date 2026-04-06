import { randomUUID } from 'node:crypto'

import { config } from '../config'
import { buildRedisKey, runRedisCommand } from '../../lib/redis'
import { claimReplayGuard, isRevoked, revoke } from './auth-revocation.service'
import { apiLogger as logger } from '../logger'

function logMobilePairingError(context: string, error: unknown, details?: Record<string, unknown>) {
  if (String(process.env.MOBILE_PAIRING_VERBOSE_LOGS ?? '').trim().toUpperCase() === 'OFF') return
  const message = error instanceof Error ? error.message : String(error)
  const meta = error instanceof Error ? { stack: error.stack, ...details } : details
  logger.error({ msg: `[mobile-pairing] ${context}: ${message}`, ...meta })
}

function logMobilePairingInfo(context: string, message: string, details?: Record<string, unknown>) {
  if (String(process.env.MOBILE_PAIRING_VERBOSE_LOGS ?? '').trim().toUpperCase() === 'OFF') return
  logger.info({ msg: `[mobile-pairing] ${context}: ${message}`, ...details })
}

export { logMobilePairingInfo }

export type MobilePairingContext = {
  pairToken: string
  siteCode: string
  laneCode: string
  direction: 'ENTRY' | 'EXIT'
  deviceCode: string
  createdAt: string
  expiresAt: string
}

export type InvalidateMobilePairingResult = {
  revoked: boolean
  pairToken: string
  existed: boolean
  expiresAt: string | null
  pairing: MobilePairingContext | null
}

type GetMobilePairingOptions = {
  refreshTtlOnAccess?: boolean
}

const DEFAULT_PAIRING_TTL_SEC = 8 * 60 * 60
const DEFAULT_REFRESH_THRESHOLD_SEC = 15 * 60
const DEFAULT_REPLAY_GUARD_TTL_SEC = 60

type MobilePairingRuntimeConfig = {
  ttlSec: number
  refreshOnAccess: boolean
  refreshThresholdSec: number
  replayGuardTtlSec: number
}

function asObject<T extends object>(value: unknown): Partial<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Partial<T>
}

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseBooleanFlag(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'ON' || normalized === 'TRUE' || normalized === '1' || normalized === 'YES') return true
  if (normalized === 'OFF' || normalized === 'FALSE' || normalized === '0' || normalized === 'NO') return false
  return fallback
}

function getMobilePairingRuntimeConfig(): MobilePairingRuntimeConfig {
  const configAny = asObject<{ mobilePair: Partial<MobilePairingRuntimeConfig> }>(config as unknown)
  const mobilePairConfig = asObject<MobilePairingRuntimeConfig>(configAny.mobilePair)

  const ttlSec = positiveInteger(mobilePairConfig.ttlSec ?? process.env.MOBILE_PAIR_TTL_SEC, DEFAULT_PAIRING_TTL_SEC)
  const refreshOnAccess = parseBooleanFlag(
    mobilePairConfig.refreshOnAccess ?? process.env.MOBILE_PAIR_REFRESH_ON_ACCESS,
    true,
  )
  const desiredRefreshThreshold = positiveInteger(
    mobilePairConfig.refreshThresholdSec ?? process.env.MOBILE_PAIR_REFRESH_THRESHOLD_SEC,
    DEFAULT_REFRESH_THRESHOLD_SEC,
  )
  const refreshThresholdSec = Math.min(ttlSec, desiredRefreshThreshold)
  const replayGuardTtlSec = positiveInteger(
    mobilePairConfig.replayGuardTtlSec ?? process.env.MOBILE_PAIR_REPLAY_GUARD_TTL_SEC,
    DEFAULT_REPLAY_GUARD_TTL_SEC,
  )

  return { ttlSec, refreshOnAccess, refreshThresholdSec, replayGuardTtlSec }
}

function normalizePairToken(pairToken: string) {
  return String(pairToken ?? '').trim()
}

function buildPairingKey(pairToken: string) {
  return buildRedisKey('mobile-pair', 'token', pairToken)
}

function normalizePairingContext(value: unknown): MobilePairingContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const record = value as Record<string, unknown>
  const pairToken = normalizePairToken(String(record.pairToken ?? ''))
  const siteCode = String(record.siteCode ?? '').trim().toUpperCase()
  const laneCode = String(record.laneCode ?? '').trim().toUpperCase()
  const deviceCode = String(record.deviceCode ?? '').trim().toUpperCase()
  const direction = String(record.direction ?? '').trim().toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY'
  const createdAt = String(record.createdAt ?? '').trim()
  const expiresAt = String(record.expiresAt ?? '').trim()

  if (!pairToken || !siteCode || !laneCode || !deviceCode || !createdAt || !expiresAt) {
    return null
  }

  return {
    pairToken,
    siteCode,
    laneCode,
    direction,
    deviceCode,
    createdAt,
    expiresAt,
  }
}

async function readStoredPairing(pairToken: string): Promise<MobilePairingContext | null> {
  const token = normalizePairToken(pairToken)
  if (!token) return null

  try {
    const raw = await runRedisCommand('GET', async (client) => {
      return await client.get(buildPairingKey(token))
    })

    if (!raw) return null

    try {
      const parsed = JSON.parse(raw)
      return normalizePairingContext(parsed)
    } catch (parseError) {
      logMobilePairingError('JSON parse failed for stored pairing', parseError, { token: token.slice(0, 8) + '...' })
      await runRedisCommand('DEL', async (client) => {
        await client.del(buildPairingKey(token))
      })
      return null
    }
  } catch (redisError) {
    logMobilePairingError('Redis error reading pairing', redisError, { token: token.slice(0, 8) + '...' })
    return null
  }
}

async function writeStoredPairing(pairing: MobilePairingContext, ttlSec: number, onlyIfExists = false) {
  await runRedisCommand('SET', async (client) => {
    if (onlyIfExists) {
      await client.set(buildPairingKey(pairing.pairToken), JSON.stringify(pairing), 'EX', ttlSec, 'XX')
      return
    }

    await client.set(buildPairingKey(pairing.pairToken), JSON.stringify(pairing), 'EX', ttlSec)
  })
}

async function getStoredTtlSec(pairToken: string) {
  return await runRedisCommand('TTL', async (client) => {
    return await client.ttl(buildPairingKey(pairToken))
  })
}

async function refreshStoredPairing(pairing: MobilePairingContext) {
  const runtime = getMobilePairingRuntimeConfig()
  const refreshed: MobilePairingContext = {
    ...pairing,
    expiresAt: new Date(Date.now() + runtime.ttlSec * 1000).toISOString(),
  }

  await writeStoredPairing(refreshed, runtime.ttlSec, true)
  return refreshed
}

export async function createMobilePairing(args: {
  siteCode: string
  laneCode: string
  direction: 'ENTRY' | 'EXIT'
  deviceCode: string
}): Promise<MobilePairingContext> {
  const runtime = getMobilePairingRuntimeConfig()
  const createdAt = new Date()

  const pairing: MobilePairingContext = {
    pairToken: randomUUID(),
    siteCode: String(args.siteCode ?? '').trim().toUpperCase(),
    laneCode: String(args.laneCode ?? '').trim().toUpperCase(),
    direction: args.direction === 'EXIT' ? 'EXIT' : 'ENTRY',
    deviceCode: String(args.deviceCode ?? '').trim().toUpperCase(),
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + runtime.ttlSec * 1000).toISOString(),
  }

  logMobilePairingInfo('createMobilePairing - created', 'New mobile pairing created', {
    pairToken: pairing.pairToken.slice(0, 8) + '...',
    siteCode: pairing.siteCode,
    laneCode: pairing.laneCode,
    deviceCode: pairing.deviceCode,
    direction: pairing.direction,
    expiresAt: pairing.expiresAt,
    ttlSec: runtime.ttlSec,
  })

  await writeStoredPairing(pairing, runtime.ttlSec)
  return pairing
}

export async function getMobilePairing(
  pairToken: string,
  opts: GetMobilePairingOptions = {},
): Promise<MobilePairingContext | null> {
  const token = normalizePairToken(pairToken)
  if (!token) {
    logMobilePairingError('getMobilePairing - invalid token', new Error('empty token'), { hasToken: !!pairToken })
    return null
  }

  if (await isRevoked(token)) {
    logMobilePairingError('getMobilePairing - token revoked', new Error('revoked'), { token: token.slice(0, 8) + '...' })
    return null
  }

  const pairing = await readStoredPairing(token)
  if (!pairing) {
    logMobilePairingError('getMobilePairing - pairing not found', new Error('not found'), { token: token.slice(0, 8) + '...' })
    return null
  }

  const expiryTime = new Date(pairing.expiresAt).getTime()
  const now = Date.now()
  
  if (expiryTime <= now) {
    logMobilePairingError('getMobilePairing - token expired', new Error('expired'), { 
      token: token.slice(0, 8) + '...',
      expiresAt: pairing.expiresAt,
      now: new Date(now).toISOString(),
    })
    await runRedisCommand('DEL', async (client) => {
      await client.del(buildPairingKey(token))
    })
    return null
  }

  const runtime = getMobilePairingRuntimeConfig()
  const shouldRefresh = opts.refreshTtlOnAccess !== false && runtime.refreshOnAccess

  if (!shouldRefresh) {
    const timeUntilExpiry = Math.floor((expiryTime - now) / 1000 / 60)
    if (timeUntilExpiry <= 5) {
      logMobilePairingInfo('getMobilePairing - expiring soon', 'Token will expire soon', { 
        token: token.slice(0, 8) + '...',
        minutesUntilExpiry: timeUntilExpiry,
      })
    }
    return pairing
  }

  const ttlSec = Number(await getStoredTtlSec(token))
  if (!Number.isFinite(ttlSec) || ttlSec <= 0) {
    return pairing
  }

  if (ttlSec > runtime.refreshThresholdSec) {
    return pairing
  }

  logMobilePairingInfo('getMobilePairing - refreshing TTL', 'Extending session TTL', { 
    token: token.slice(0, 8) + '...',
    currentTtlSec: ttlSec,
    newTtlSec: runtime.ttlSec,
  })
  
  return await refreshStoredPairing(pairing)
}

export async function invalidateMobilePairing(
  pairToken: string,
  opts: { reason?: string | null } = {},
): Promise<InvalidateMobilePairingResult> {
  const token = normalizePairToken(pairToken)
  if (!token) {
    return {
      revoked: false,
      pairToken: '',
      existed: false,
      expiresAt: null,
      pairing: null,
    }
  }

  const pairing = await readStoredPairing(token)
  if (!pairing) {
    return {
      revoked: false,
      pairToken: token,
      existed: false,
      expiresAt: null,
      pairing: null,
    }
  }

  await revoke(token, pairing.expiresAt, {
    reason: opts.reason ?? 'mobile-pairing-invalidated',
    context: {
      siteCode: pairing.siteCode,
      laneCode: pairing.laneCode,
      deviceCode: pairing.deviceCode,
      direction: pairing.direction,
      kind: 'MOBILE_PAIRING',
    },
  })

  await runRedisCommand('DEL', async (client) => {
    await client.del(buildPairingKey(token))
  })

  return {
    revoked: true,
    pairToken: token,
    existed: true,
    expiresAt: pairing.expiresAt,
    pairing,
  }
}

export async function claimMobilePairingReplayNonce(pairToken: string, nonce: string, ttlSeconds?: number) {
  const token = normalizePairToken(pairToken)
  const normalizedNonce = String(nonce ?? '').trim()
  if (!token || !normalizedNonce) return false

  const runtime = getMobilePairingRuntimeConfig()

  return await claimReplayGuard({
    namespace: `mobile-pair:${token}`,
    nonce: normalizedNonce,
    ttlSeconds: ttlSeconds ?? runtime.replayGuardTtlSec,
    payload: { pairToken: token },
  })
}

export default {
  createMobilePairing,
  getMobilePairing,
  invalidateMobilePairing,
  claimMobilePairingReplayNonce,
}
