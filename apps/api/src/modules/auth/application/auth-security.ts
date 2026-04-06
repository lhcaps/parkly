import type { AuthRole as CanonicalAuthRole } from '@parkly/contracts'

export type LoginAttemptBucketKind = 'USERNAME' | 'USERNAME_IP'

export type LoginAttemptBucket = {
  attemptKey: string
  bucketKind: LoginAttemptBucketKind
  username: string
  ipAddress: string | null
}

export type LoginAttemptRecord = LoginAttemptBucket & {
  failureCount: number
  firstFailureAt: string | null
  lastFailureAt: string | null
  lockoutUntil: string | null
  lastDelayMs: number
}

export type LoginAttemptWrite = LoginAttemptBucket & {
  failureCount: number
  firstFailureAt: string
  lastFailureAt: string
  lockoutUntil: string | null
  lastDelayMs: number
}

export type LoginAttemptCheck = {
  failureCount: number
  delayMs: number
  lockoutUntil: string | null
  active: boolean
}

export type AuthLoginThrottlePolicy = {
  windowSeconds: number
  failureLockoutThreshold: number
  lockoutSeconds: number
  progressiveDelayMs: number
  progressiveDelayMaxMs: number
}

export type AuthSessionHygienePolicy = {
  sessionLimitPerUser: number | null
  cleanupExpiredRetentionDays: number
  cleanupRevokedRetentionDays: number
  cleanupBatchLimit: number
}

export type UserSessionSnapshot = {
  sessionId: string
  userId: string
  role: CanonicalAuthRole
  createdAt: string
  revokedAt: string | null
  accessExpiresAt: string
  refreshExpiresAt: string
}

export type CleanupSessionsInput = {
  now: string
  expiredRetentionDays: number
  revokedRetentionDays: number
  batchLimit: number
}

export type CleanupSessionsResult = {
  deletedExpired: number
  deletedRevoked: number
}

export type AuthSecurityStore = {
  findLoginAttempt(attemptKey: string): Promise<LoginAttemptRecord | null>
  upsertLoginAttempt(record: LoginAttemptWrite): Promise<LoginAttemptRecord>
  clearLoginAttempts(attemptKeys: string[]): Promise<void>
  listUserSessions(userId: string): Promise<UserSessionSnapshot[]>
  revokeAllUserSessions(args: { userId: string; revokedAt: string; reason: string; exceptSessionId?: string | null }): Promise<{ revokedSessionIds: string[] }>
  revokeSessionsById(args: { sessionIds: string[]; revokedAt: string; reason: string }): Promise<void>
  cleanupSessions(args: CleanupSessionsInput): Promise<CleanupSessionsResult>
  setUserStatus(args: { userId: string; status: 'ACTIVE' | 'DISABLED' }): Promise<void>
}

export type AuthSecurityAction =
  | 'AUTH_LOGIN_THROTTLED'
  | 'AUTH_LOGIN_LOCKED'
  | 'AUTH_SESSION_REVOKE_ALL'
  | 'AUTH_SESSION_FORCED_LOGOUT'
  | 'AUTH_SESSION_LIMIT_EVICT'
  | 'AUTH_USER_DISABLED'
  | 'AUTH_USER_ENABLED'
  | 'AUTH_SESSION_CLEANUP'

function normalizeToken(value: string) {
  return String(value ?? '').trim().toLowerCase()
}

export function normalizeSecurityUsername(username: string) {
  return normalizeToken(username)
}

export function normalizeIpAddress(ipAddress?: string | null) {
  const normalized = String(ipAddress ?? '').trim()
  return normalized || null
}

export function buildLoginAttemptKey(bucketKind: LoginAttemptBucketKind, username: string, ipAddress?: string | null) {
  const normalizedUsername = normalizeSecurityUsername(username)
  const normalizedIp = normalizeIpAddress(ipAddress) ?? 'unknown'
  return bucketKind === 'USERNAME'
    ? `USERNAME:${normalizedUsername}`
    : `USERNAME_IP:${normalizedUsername}|${normalizedIp}`
}

export function buildLoginAttemptBuckets(username: string, ipAddress?: string | null): LoginAttemptBucket[] {
  const normalizedUsername = normalizeSecurityUsername(username)
  const normalizedIp = normalizeIpAddress(ipAddress)
  return [
    {
      attemptKey: buildLoginAttemptKey('USERNAME', normalizedUsername, normalizedIp),
      bucketKind: 'USERNAME',
      username: normalizedUsername,
      ipAddress: null,
    },
    {
      attemptKey: buildLoginAttemptKey('USERNAME_IP', normalizedUsername, normalizedIp),
      bucketKind: 'USERNAME_IP',
      username: normalizedUsername,
      ipAddress: normalizedIp,
    },
  ]
}

export function isLockoutActive(lockoutUntil: string | null | undefined, now: Date) {
  if (!lockoutUntil) return false
  const dt = new Date(lockoutUntil)
  return !Number.isNaN(dt.getTime()) && dt.getTime() > now.getTime()
}

export function computeProgressiveDelayMs(failureCount: number, policy: AuthLoginThrottlePolicy) {
  const normalizedCount = Math.max(0, Math.trunc(failureCount))
  if (normalizedCount <= 1) return 0
  const raw = (normalizedCount - 1) * Math.max(0, Math.trunc(policy.progressiveDelayMs))
  const max = Math.max(0, Math.trunc(policy.progressiveDelayMaxMs))
  return Math.min(raw, max || raw)
}

export function summarizeLoginAttempt(records: Array<LoginAttemptRecord | null | undefined>, now: Date, policy: AuthLoginThrottlePolicy): LoginAttemptCheck {
  let failureCount = 0
  let delayMs = 0
  let lockoutUntil: string | null = null

  for (const record of records) {
    if (!record) continue
    failureCount = Math.max(failureCount, Math.max(0, Math.trunc(record.failureCount || 0)))
    delayMs = Math.max(delayMs, Math.max(0, Math.trunc(record.lastDelayMs || computeProgressiveDelayMs(record.failureCount, policy))))
    if (isLockoutActive(record.lockoutUntil, now)) {
      if (!lockoutUntil || new Date(record.lockoutUntil!).getTime() > new Date(lockoutUntil).getTime()) {
        lockoutUntil = record.lockoutUntil
      }
    }
  }

  return {
    failureCount,
    delayMs,
    lockoutUntil,
    active: lockoutUntil != null,
  }
}

export function computeNextFailureRecord(bucket: LoginAttemptBucket, existing: LoginAttemptRecord | null, now: Date, policy: AuthLoginThrottlePolicy): LoginAttemptWrite {
  const windowSeconds = Math.max(1, Math.trunc(policy.windowSeconds || 1))
  const nowIso = now.toISOString()
  const lastFailureAt = existing?.lastFailureAt ? new Date(existing.lastFailureAt) : null
  const withinWindow = !!lastFailureAt && !Number.isNaN(lastFailureAt.getTime()) && (now.getTime() - lastFailureAt.getTime()) <= windowSeconds * 1000
  const failureCount = withinWindow ? Math.max(0, Math.trunc(existing?.failureCount || 0)) + 1 : 1
  const firstFailureAt = withinWindow && existing?.firstFailureAt ? existing.firstFailureAt : nowIso
  const lockoutThreshold = Math.max(1, Math.trunc(policy.failureLockoutThreshold || 1))
  const lockoutUntil = failureCount >= lockoutThreshold
    ? new Date(now.getTime() + Math.max(1, Math.trunc(policy.lockoutSeconds || 1)) * 1000).toISOString()
    : null

  return {
    ...bucket,
    failureCount,
    firstFailureAt,
    lastFailureAt: nowIso,
    lockoutUntil,
    lastDelayMs: computeProgressiveDelayMs(failureCount, policy),
  }
}

export function pickSessionsToEvict(sessions: UserSessionSnapshot[], sessionLimitPerUser: number | null) {
  const limit = sessionLimitPerUser == null ? null : Math.max(1, Math.trunc(sessionLimitPerUser))
  if (limit == null) return []

  return sessions
    .filter((row) => row.revokedAt == null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, Math.max(0, sessions.filter((row) => row.revokedAt == null).length - limit))
}
