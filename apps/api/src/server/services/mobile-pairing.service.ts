import { randomUUID } from 'node:crypto'

import { config } from '../config'
import { buildRedisKey, runRedisCommand } from '../../lib/redis'
import { claimReplayGuard, isRevoked, revoke } from './auth-revocation.service'

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

  const raw = await runRedisCommand('GET', async (client) => {
    return await client.get(buildPairingKey(token))
  })

  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return normalizePairingContext(parsed)
  } catch {
    await runRedisCommand('DEL', async (client) => {
      await client.del(buildPairingKey(token))
    })
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

  await writeStoredPairing(pairing, runtime.ttlSec)
  return pairing
}

export async function getMobilePairing(
  pairToken: string,
  opts: GetMobilePairingOptions = {},
): Promise<MobilePairingContext | null> {
  const token = normalizePairToken(pairToken)
  if (!token) return null

  if (await isRevoked(token)) {
    return null
  }

  const pairing = await readStoredPairing(token)
  if (!pairing) {
    return null
  }

  if (new Date(pairing.expiresAt).getTime() <= Date.now()) {
    await runRedisCommand('DEL', async (client) => {
      await client.del(buildPairingKey(token))
    })
    return null
  }

  const runtime = getMobilePairingRuntimeConfig()
  const shouldRefresh = opts.refreshTtlOnAccess !== false && runtime.refreshOnAccess

  if (!shouldRefresh) {
    return pairing
  }

  const ttlSec = Number(await getStoredTtlSec(token))
  if (!Number.isFinite(ttlSec) || ttlSec <= 0) {
    return pairing
  }

  if (ttlSec > runtime.refreshThresholdSec) {
    return pairing
  }

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