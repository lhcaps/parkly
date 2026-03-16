import { buildRedisKey, runRedisCommand } from '../../lib/redis'

export type AuthRevocationRecord = {
  tokenId: string
  revokedAt: string
  expiresAt: string
  reason: string | null
  context: Record<string, unknown> | null
}

type ReplayGuardClaimArgs = {
  namespace: string
  nonce: string
  ttlSeconds?: number
  payload?: Record<string, unknown> | null
}

const DEFAULT_REPLAY_GUARD_TTL_SEC = 60

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeTokenId(tokenId: string) {
  return String(tokenId ?? '').trim()
}

function normalizeNamespace(namespace: string) {
  return String(namespace ?? '').trim().replace(/:+/g, ':')
}

function normalizeDate(expiresAt: string | Date | number) {
  if (expiresAt instanceof Date) return expiresAt
  return new Date(expiresAt)
}

function secondsUntil(expiresAt: Date) {
  const diffMs = expiresAt.getTime() - Date.now()
  return Math.max(0, Math.ceil(diffMs / 1000))
}

function buildRevocationKey(tokenId: string) {
  return buildRedisKey('auth', 'revoked', tokenId)
}

function buildReplayGuardKey(namespace: string, nonce: string) {
  return buildRedisKey('auth', 'replay-guard', namespace, nonce)
}

function getReplayGuardDefaultTtl() {
  return positiveInteger(process.env.AUTH_REPLAY_GUARD_TTL_SEC, DEFAULT_REPLAY_GUARD_TTL_SEC)
}

export async function revoke(
  tokenId: string,
  expiresAt: string | Date | number,
  opts: { reason?: string | null; context?: Record<string, unknown> | null } = {},
): Promise<AuthRevocationRecord | null> {
  const normalizedTokenId = normalizeTokenId(tokenId)
  if (!normalizedTokenId) return null

  const normalizedExpiry = normalizeDate(expiresAt)
  if (Number.isNaN(normalizedExpiry.getTime())) {
    throw new Error(`Invalid expiresAt for revoke(tokenId=${normalizedTokenId})`)
  }

  const record: AuthRevocationRecord = {
    tokenId: normalizedTokenId,
    revokedAt: new Date().toISOString(),
    expiresAt: normalizedExpiry.toISOString(),
    reason: opts.reason ?? null,
    context: opts.context ?? null,
  }

  const ttlSeconds = secondsUntil(normalizedExpiry)
  if (ttlSeconds <= 0) {
    return record
  }

  await runRedisCommand('SET', async (client) => {
    await client.set(buildRevocationKey(normalizedTokenId), JSON.stringify(record), 'EX', ttlSeconds)
  })

  return record
}

export async function isRevoked(tokenId: string): Promise<boolean> {
  const normalizedTokenId = normalizeTokenId(tokenId)
  if (!normalizedTokenId) return false

  const raw = await runRedisCommand('GET', async (client) => {
    return await client.get(buildRevocationKey(normalizedTokenId))
  })

  return Boolean(raw)
}

export async function getRevocation(tokenId: string): Promise<AuthRevocationRecord | null> {
  const normalizedTokenId = normalizeTokenId(tokenId)
  if (!normalizedTokenId) return null

  const raw = await runRedisCommand('GET', async (client) => {
    return await client.get(buildRevocationKey(normalizedTokenId))
  })

  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthRevocationRecord
  } catch {
    return null
  }
}

export async function claimReplayGuard(args: ReplayGuardClaimArgs): Promise<boolean> {
  const namespace = normalizeNamespace(args.namespace)
  const nonce = String(args.nonce ?? '').trim()
  if (!namespace || !nonce) return false

  const ttlSeconds = positiveInteger(args.ttlSeconds, getReplayGuardDefaultTtl())
  const payload = {
    namespace,
    nonce,
    claimedAt: new Date().toISOString(),
    payload: args.payload ?? null,
  }

  const result = await runRedisCommand('SET', async (client) => {
    return await client.set(buildReplayGuardKey(namespace, nonce), JSON.stringify(payload), 'EX', ttlSeconds, 'NX')
  })

  return result === 'OK'
}

export default {
  revoke,
  isRevoked,
  getRevocation,
  claimReplayGuard,
}