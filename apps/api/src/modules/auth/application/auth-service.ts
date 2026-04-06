import { createHash, randomBytes, randomUUID } from 'node:crypto'

import {
  normalizeAcceptedAuthRole,
  type AcceptedAuthRole,
  type AuthRole as CanonicalAuthRole,
  type SiteScopeInfo,
} from '@parkly/contracts'

import { prisma } from '../../../lib/prisma'
import { constantTimeSecretEquals } from '../../../lib/security/secret-rotation'
import { config, type AppRole } from '../../../server/config'
import { ApiError } from '../../../server/http'
import { buildAuditActorSnapshot, type AuditActorInput, writeAuditLog } from '../../../server/services/audit-service'
import {
  buildLoginAttemptBuckets,
  computeNextFailureRecord,
  isLockoutActive,
  pickSessionsToEvict,
  summarizeLoginAttempt,
  type AuthSecurityStore,
  type LoginAttemptRecord,
  type LoginAttemptWrite,
  type UserSessionSnapshot,
} from './auth-security'
import { describePasswordPolicy, validatePasswordPolicy } from './password-policy'
import { verifyPassword } from './password-hash'

export type AuthUserRecord = {
  userId: string
  username: string
  status: 'ACTIVE' | 'DISABLED'
  roles: CanonicalAuthRole[]
  siteScopes: SiteScopeInfo[]
}

export type AuthSessionRecord = {
  sessionId: string
  userId: string
  role: CanonicalAuthRole
  accessTokenHash: string
  refreshTokenHash: string
  accessExpiresAt: string
  refreshExpiresAt: string
  revokedAt: string | null
  revokeReason: string | null
  createdAt?: string
  lastSeenAt?: string | null
  lastRefreshedAt?: string | null
  user: AuthUserRecord
}

export type AuthenticatedUserPrincipal = {
  principalType: 'USER'
  role: CanonicalAuthRole
  actorUserId: bigint
  actorLabel: string
  userId: string
  username: string
  sessionId: string
  siteScopes: SiteScopeInfo[]
}

export type AuthenticatedServicePrincipal = {
  principalType: 'SERVICE'
  role: AppRole
  actorUserId?: undefined
  actorLabel: string
  userId?: undefined
  username?: undefined
  sessionId?: undefined
  serviceCode: string
  siteScopes: []
}

export type AuthenticatedPrincipal = AuthenticatedUserPrincipal | AuthenticatedServicePrincipal

export type AuthTokenBundle = {
  accessToken: string
  refreshToken: string
  accessExpiresAt: string
  refreshExpiresAt: string
}

export type LoginInput = {
  username: string
  password: string
  role?: AcceptedAuthRole | null
  ipAddress?: string | null
  userAgent?: string | null
}

export type RefreshInput = {
  refreshToken: string
  ipAddress?: string | null
  userAgent?: string | null
}

export type LogoutInput = {
  accessToken?: string | null
  refreshToken?: string | null
  reason?: string | null
}

export type LoginResult = AuthTokenBundle & {
  principal: AuthenticatedUserPrincipal
}

export type RefreshResult = AuthTokenBundle & {
  principal: AuthenticatedUserPrincipal
}

export type LogoutResult = {
  revoked: boolean
  principal: AuthenticatedPrincipal | null
}

export type RevokeAllSessionsInput = {
  targetUserId: string
  actor?: AuthenticatedPrincipal | AuditActorInput | null
  reason?: string | null
  exceptSessionId?: string | null
}

export type RevokeAllSessionsResult = {
  user: AuthUserRecord
  revokedSessionIds: string[]
}

export type SetUserStatusInput = {
  targetUserId: string
  status: 'ACTIVE' | 'DISABLED'
  actor?: AuthenticatedPrincipal | AuditActorInput | null
  reason?: string | null
}

export type CleanupAuthSessionsResult = {
  deletedExpired: number
  deletedRevoked: number
  retentionDays: {
    expired: number
    revoked: number
  }
}

export type PasswordPolicyDescriptor = {
  bootstrapProfile: 'DEMO' | 'PRODUCTION'
  demoSeedCredentialsEnabled: boolean
  description: string
  policy: {
    minLength: number
    requireUppercase: boolean
    requireLowercase: boolean
    requireDigit: boolean
    requireSpecial: boolean
  }
}

export type AuthStore = {
  findUserByUsername(username: string): Promise<AuthUserRecord | null>
  findPasswordHashByUsername(username: string): Promise<string | null>
  findUserById(userId: string): Promise<AuthUserRecord | null>
  findSessionByAccessTokenHash(tokenHash: string): Promise<AuthSessionRecord | null>
  findSessionByRefreshTokenHash(tokenHash: string): Promise<AuthSessionRecord | null>
  createSession(args: {
    sessionId: string
    userId: string
    role: CanonicalAuthRole
    accessTokenHash: string
    refreshTokenHash: string
    accessExpiresAt: string
    refreshExpiresAt: string
    ipAddress?: string | null
    userAgent?: string | null
  }): Promise<void>
  rotateSessionTokens(args: {
    sessionId: string
    accessTokenHash: string
    refreshTokenHash: string
    accessExpiresAt: string
    refreshExpiresAt: string
    ipAddress?: string | null
    userAgent?: string | null
  }): Promise<void>
  revokeSession(args: {
    sessionId: string
    revokedAt: string
    reason?: string | null
  }): Promise<void>
  touchSession(args: {
    sessionId: string
    lastSeenAt: string
    ipAddress?: string | null
    userAgent?: string | null
  }): Promise<void>
}

export type AuthAuditEvent = {
  action: string
  entityTable: string
  entityId: string
  beforeSnapshot?: unknown
  afterSnapshot?: unknown
  occurredAt: string
  actor?: AuthenticatedPrincipal | AuditActorInput | null
  actorUserId?: string | number | bigint | null
}

const ACCESS_TOKEN_PREFIX = 'atk'
const REFRESH_TOKEN_PREFIX = 'rtk'
const INTERNAL_SERVICE_CODE = 'INTERNAL_SERVICE'

function asCanonicalUserRole(value: unknown): CanonicalAuthRole | null {
  return normalizeAcceptedAuthRole(value)
}

function normalizeUsername(value: string) {
  return String(value ?? '').trim()
}

function hashToken(token: string) {
  return createHash('sha256').update(String(token ?? '')).digest('hex')
}

function buildOpaqueToken(prefix: string) {
  return `${prefix}_${randomBytes(32).toString('base64url')}`
}

function ensureActiveUser(user: AuthUserRecord | null, reason = 'Thông tin đăng nhập không hợp lệ'): AuthUserRecord {
  if (!user) throw new ApiError({ code: 'UNAUTHENTICATED', message: reason })
  if (user.status !== 'ACTIVE') {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Tài khoản đã bị vô hiệu hoá',
      details: { reasonCode: 'AUTH_USER_DISABLED' },
    })
  }
  if (user.roles.length === 0) throw new ApiError({ code: 'FORBIDDEN', message: 'Tài khoản chưa được gán role' })
  return user
}

function ensureExistingUser(user: AuthUserRecord | null, reason = 'Không tìm thấy user'): AuthUserRecord {
  if (!user) throw new ApiError({ code: 'NOT_FOUND', message: reason })
  return user
}

function pickRole(userRoles: CanonicalAuthRole[], requestedRole?: AcceptedAuthRole | null) {
  if (requestedRole) {
    const normalizedRequestedRole = normalizeAcceptedAuthRole(requestedRole)
    if (!normalizedRequestedRole || !userRoles.includes(normalizedRequestedRole)) {
      throw new ApiError({ code: 'FORBIDDEN', message: `Tài khoản không có role ${requestedRole}` })
    }
    return normalizedRequestedRole
  }
  if (userRoles.length === 0) {
    throw new ApiError({ code: 'FORBIDDEN', message: 'Tài khoản không có role nào, không thể đăng nhập' })
  }
  return userRoles[0]
}

function plusMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60_000)
}

function plusDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 86_400_000)
}

function serializeActorLabel(role: CanonicalAuthRole, userId: string) {
  return `${role}:${userId}`
}

function buildAuthSessionSnapshot(input: {
  sessionId: string
  userId: string
  role: CanonicalAuthRole
  username: string
  accessExpiresAt: string
  refreshExpiresAt: string
  revokedAt?: string | null
  revokeReason?: string | null
}) {
  return {
    sessionId: input.sessionId,
    userId: input.userId,
    username: input.username,
    role: input.role,
    accessExpiresAt: input.accessExpiresAt,
    refreshExpiresAt: input.refreshExpiresAt,
    revokedAt: input.revokedAt ?? null,
    revokeReason: input.revokeReason ?? null,
  }
}

function buildLoginSecurityDetails(args: { reasonCode: string; failureCount: number; delayMs?: number; lockoutUntil?: string | null }) {
  return {
    reasonCode: args.reasonCode,
    failureCount: args.failureCount,
    ...(args.delayMs && args.delayMs > 0 ? { delayMs: args.delayMs } : {}),
    ...(args.lockoutUntil ? { lockoutUntil: args.lockoutUntil } : {}),
  }
}

function principalToAuditActor(actor?: AuthenticatedPrincipal | AuditActorInput | null): AuditActorInput | null {
  if (!actor) return null
  if (typeof actor === 'object' && 'principalType' in actor) {
    if (actor.principalType === 'SERVICE') {
      return {
        principalType: actor.principalType,
        role: actor.role,
        actorLabel: actor.actorLabel,
        serviceCode: actor.serviceCode,
      }
    }

    return {
      principalType: actor.principalType,
      role: actor.role,
      actorUserId: actor.userId,
      actorLabel: actor.actorLabel,
      userId: actor.userId,
      username: actor.username,
      sessionId: actor.sessionId,
    }
  }
  return actor
}

async function defaultAuthAuditWriter(event: AuthAuditEvent) {
  await writeAuditLog({
    actor: buildAuditActorSnapshot(principalToAuditActor(event.actor)),
    actorUserId: event.actorUserId,
    action: event.action,
    entityTable: event.entityTable,
    entityId: event.entityId,
    beforeSnapshot: event.beforeSnapshot,
    afterSnapshot: event.afterSnapshot,
    occurredAt: event.occurredAt,
  })
}

function buildUserPrincipal(user: AuthUserRecord, sessionId: string, role: CanonicalAuthRole): AuthenticatedUserPrincipal {
  return {
    principalType: 'USER',
    role,
    actorUserId: BigInt(user.userId),
    actorLabel: serializeActorLabel(role, user.userId),
    userId: user.userId,
    username: user.username,
    sessionId,
    siteScopes: user.siteScopes,
  }
}

function buildServicePrincipal(): AuthenticatedServicePrincipal {
  const role = config.internalService.role
  return {
    principalType: 'SERVICE',
    role,
    actorLabel: `${INTERNAL_SERVICE_CODE}:${role}`,
    serviceCode: INTERNAL_SERVICE_CODE,
    siteScopes: [],
  }
}

function isExpired(value: string, now: Date) {
  const dt = new Date(value)
  return Number.isNaN(dt.getTime()) || dt.getTime() <= now.getTime()
}

async function loadRolesForUser(userId: string): Promise<CanonicalAuthRole[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ roleCode: string }>>(
    `
      SELECT r.role_code AS roleCode
      FROM user_roles ur
      JOIN roles r ON r.role_id = ur.role_id
      WHERE ur.user_id = ?
      ORDER BY r.role_code ASC
    `,
    userId,
  )
  const roles: CanonicalAuthRole[] = []
  for (const row of rows) {
    const normalizedRole = asCanonicalUserRole(row.roleCode)
    if (normalizedRole && !roles.includes(normalizedRole)) {
      roles.push(normalizedRole)
    }
  }
  return roles
}

async function loadSiteScopesForUser(userId: string): Promise<SiteScopeInfo[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ siteId: bigint | number | string; siteCode: string; scopeLevel: string }>>(
    `
      SELECT uss.site_id AS siteId, ps.site_code AS siteCode, uss.scope_level AS scopeLevel
      FROM user_site_scopes uss
      JOIN parking_sites ps ON ps.site_id = uss.site_id
      WHERE uss.user_id = ?
      ORDER BY ps.site_code ASC
    `,
    userId,
  )

  return rows.map((row) => ({
    siteId: String(row.siteId),
    siteCode: String(row.siteCode),
    scopeLevel: String(row.scopeLevel),
  }))
}

async function hydrateUser(row: { userId: bigint | number | string; username: string; status: 'ACTIVE' | 'DISABLED' } | null): Promise<AuthUserRecord | null> {
  if (!row) return null
  const userId = String(row.userId)
  return {
    userId,
    username: String(row.username),
    status: row.status,
    roles: await loadRolesForUser(userId),
    siteScopes: await loadSiteScopesForUser(userId),
  }
}

async function hydrateUserById(userId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ userId: bigint | number | string; username: string; status: 'ACTIVE' | 'DISABLED' }>>(
    `SELECT user_id AS userId, username, status FROM users WHERE user_id = ? LIMIT 1`,
    userId,
  )
  return await hydrateUser(rows[0] ?? null)
}

function mapSessionRow(row: {
  sessionId: string
  userId: bigint | number | string
  roleCode: string
  accessTokenHash: string
  refreshTokenHash: string
  accessExpiresAt: Date | string
  refreshExpiresAt: Date | string
  revokedAt: Date | string | null
  revokeReason: string | null
  createdAt?: Date | string
  lastSeenAt?: Date | string | null
  lastRefreshedAt?: Date | string | null
}, user: AuthUserRecord): AuthSessionRecord | null {
  const role = asCanonicalUserRole(row.roleCode)
  if (!role) return null
  return {
    sessionId: String(row.sessionId),
    userId: String(row.userId),
    role,
    accessTokenHash: String(row.accessTokenHash),
    refreshTokenHash: String(row.refreshTokenHash),
    accessExpiresAt: new Date(row.accessExpiresAt).toISOString(),
    refreshExpiresAt: new Date(row.refreshExpiresAt).toISOString(),
    revokedAt: row.revokedAt == null ? null : new Date(row.revokedAt).toISOString(),
    revokeReason: row.revokeReason == null ? null : String(row.revokeReason),
    createdAt: row.createdAt == null ? undefined : new Date(row.createdAt).toISOString(),
    lastSeenAt: row.lastSeenAt == null ? null : new Date(row.lastSeenAt).toISOString(),
    lastRefreshedAt: row.lastRefreshedAt == null ? null : new Date(row.lastRefreshedAt).toISOString(),
    user,
  }
}

export function createSqlAuthStore(): AuthStore {
  return {
    async findUserByUsername(username: string) {
      const rows = await prisma.$queryRawUnsafe<Array<{ userId: bigint | number | string; username: string; status: 'ACTIVE' | 'DISABLED' }>>(
        `SELECT user_id AS userId, username, status FROM users WHERE username = ? LIMIT 1`,
        username,
      )
      return await hydrateUser(rows[0] ?? null)
    },

    async findPasswordHashByUsername(username: string) {
      const rows = await prisma.$queryRawUnsafe<Array<{ passwordHash: string }>>(
        `SELECT password_hash AS passwordHash FROM users WHERE username = ? LIMIT 1`,
        username,
      )
      return rows[0]?.passwordHash ? String(rows[0].passwordHash) : null
    },

    async findUserById(userId: string) {
      return await hydrateUserById(userId)
    },

    async findSessionByAccessTokenHash(tokenHash: string) {
      const rows = await prisma.$queryRawUnsafe<Array<{
        sessionId: string
        userId: bigint | number | string
        roleCode: string
        accessTokenHash: string
        refreshTokenHash: string
        accessExpiresAt: Date | string
        refreshExpiresAt: Date | string
        revokedAt: Date | string | null
        revokeReason: string | null
        createdAt: Date | string
        lastSeenAt: Date | string | null
        lastRefreshedAt: Date | string | null
      }>>(
        `
          SELECT session_id AS sessionId, user_id AS userId, role_code AS roleCode,
                 access_token_hash AS accessTokenHash, refresh_token_hash AS refreshTokenHash,
                 access_expires_at AS accessExpiresAt, refresh_expires_at AS refreshExpiresAt,
                 revoked_at AS revokedAt, revoke_reason AS revokeReason,
                 created_at AS createdAt, last_seen_at AS lastSeenAt, last_refreshed_at AS lastRefreshedAt
          FROM auth_user_sessions
          WHERE access_token_hash = ?
          LIMIT 1
        `,
        tokenHash,
      )
      const row = rows[0]
      if (!row) return null
      const user = await hydrateUserById(String(row.userId))
      if (!user) return null
      return mapSessionRow(row, user)
    },

    async findSessionByRefreshTokenHash(tokenHash: string) {
      const rows = await prisma.$queryRawUnsafe<Array<{
        sessionId: string
        userId: bigint | number | string
        roleCode: string
        accessTokenHash: string
        refreshTokenHash: string
        accessExpiresAt: Date | string
        refreshExpiresAt: Date | string
        revokedAt: Date | string | null
        revokeReason: string | null
        createdAt: Date | string
        lastSeenAt: Date | string | null
        lastRefreshedAt: Date | string | null
      }>>(
        `
          SELECT session_id AS sessionId, user_id AS userId, role_code AS roleCode,
                 access_token_hash AS accessTokenHash, refresh_token_hash AS refreshTokenHash,
                 access_expires_at AS accessExpiresAt, refresh_expires_at AS refreshExpiresAt,
                 revoked_at AS revokedAt, revoke_reason AS revokeReason,
                 created_at AS createdAt, last_seen_at AS lastSeenAt, last_refreshed_at AS lastRefreshedAt
          FROM auth_user_sessions
          WHERE refresh_token_hash = ?
          LIMIT 1
        `,
        tokenHash,
      )
      const row = rows[0]
      if (!row) return null
      const user = await hydrateUserById(String(row.userId))
      if (!user) return null
      return mapSessionRow(row, user)
    },

    async createSession(args) {
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO auth_user_sessions (
            session_id, user_id, role_code, access_token_hash, refresh_token_hash,
            access_expires_at, refresh_expires_at, last_seen_at, last_ip_address, last_user_agent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
        `,
        args.sessionId,
        args.userId,
        args.role,
        args.accessTokenHash,
        args.refreshTokenHash,
        args.accessExpiresAt.slice(0, 19).replace('T', ' '),
        args.refreshExpiresAt.slice(0, 19).replace('T', ' '),
        args.ipAddress ?? null,
        args.userAgent ?? null,
      )
    },

    async rotateSessionTokens(args) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE auth_user_sessions
          SET access_token_hash = ?,
              refresh_token_hash = ?,
              access_expires_at = ?,
              refresh_expires_at = ?,
              last_refreshed_at = CURRENT_TIMESTAMP,
              last_seen_at = CURRENT_TIMESTAMP,
              last_ip_address = ?,
              last_user_agent = ?
          WHERE session_id = ?
        `,
        args.accessTokenHash,
        args.refreshTokenHash,
        args.accessExpiresAt.slice(0, 19).replace('T', ' '),
        args.refreshExpiresAt.slice(0, 19).replace('T', ' '),
        args.ipAddress ?? null,
        args.userAgent ?? null,
        args.sessionId,
      )
    },

    async revokeSession(args) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE auth_user_sessions
          SET revoked_at = ?, revoke_reason = COALESCE(?, revoke_reason)
          WHERE session_id = ?
        `,
        args.revokedAt.slice(0, 19).replace('T', ' '),
        args.reason ?? null,
        args.sessionId,
      )
    },

    async touchSession(args) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE auth_user_sessions
          SET last_seen_at = ?,
              last_ip_address = COALESCE(?, last_ip_address),
              last_user_agent = COALESCE(?, last_user_agent)
          WHERE session_id = ?
        `,
        args.lastSeenAt.slice(0, 19).replace('T', ' '),
        args.ipAddress ?? null,
        args.userAgent ?? null,
        args.sessionId,
      )
    },
  }
}

function mapAttemptRow(row: {
  attemptKey: string
  bucketKind: string
  username: string
  ipAddress: string | null
  failureCount: number
  firstFailureAt: Date | string | null
  lastFailureAt: Date | string | null
  lockoutUntil: Date | string | null
  lastDelayMs: number | null
}): LoginAttemptRecord | null {
  const bucketKind = String(row.bucketKind ?? '').trim().toUpperCase()
  if (bucketKind !== 'USERNAME' && bucketKind !== 'USERNAME_IP') return null
  return {
    attemptKey: String(row.attemptKey),
    bucketKind,
    username: String(row.username),
    ipAddress: row.ipAddress == null ? null : String(row.ipAddress),
    failureCount: Math.max(0, Math.trunc(Number(row.failureCount) || 0)),
    firstFailureAt: row.firstFailureAt == null ? null : new Date(row.firstFailureAt).toISOString(),
    lastFailureAt: row.lastFailureAt == null ? null : new Date(row.lastFailureAt).toISOString(),
    lockoutUntil: row.lockoutUntil == null ? null : new Date(row.lockoutUntil).toISOString(),
    lastDelayMs: Math.max(0, Math.trunc(Number(row.lastDelayMs) || 0)),
  }
}

export function createSqlAuthSecurityStore(): AuthSecurityStore {
  return {
    async findLoginAttempt(attemptKey: string) {
      const rows = await prisma.$queryRawUnsafe<Array<{
        attemptKey: string
        bucketKind: string
        username: string
        ipAddress: string | null
        failureCount: number
        firstFailureAt: Date | string | null
        lastFailureAt: Date | string | null
        lockoutUntil: Date | string | null
        lastDelayMs: number | null
      }>>(
        `
          SELECT attempt_key AS attemptKey,
                 bucket_kind AS bucketKind,
                 username,
                 ip_address AS ipAddress,
                 failure_count AS failureCount,
                 first_failure_at AS firstFailureAt,
                 last_failure_at AS lastFailureAt,
                 lockout_until AS lockoutUntil,
                 last_delay_ms AS lastDelayMs
          FROM auth_login_attempts
          WHERE attempt_key = ?
          LIMIT 1
        `,
        attemptKey,
      )
      return rows[0] ? mapAttemptRow(rows[0]) : null
    },

    async upsertLoginAttempt(record: LoginAttemptWrite) {
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO auth_login_attempts (
            attempt_key, bucket_kind, username, ip_address, failure_count,
            first_failure_at, last_failure_at, lockout_until, last_delay_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            bucket_kind = VALUES(bucket_kind),
            username = VALUES(username),
            ip_address = VALUES(ip_address),
            failure_count = VALUES(failure_count),
            first_failure_at = VALUES(first_failure_at),
            last_failure_at = VALUES(last_failure_at),
            lockout_until = VALUES(lockout_until),
            last_delay_ms = VALUES(last_delay_ms)
        `,
        record.attemptKey,
        record.bucketKind,
        record.username,
        record.ipAddress,
        record.failureCount,
        record.firstFailureAt.slice(0, 19).replace('T', ' '),
        record.lastFailureAt.slice(0, 19).replace('T', ' '),
        record.lockoutUntil == null ? null : record.lockoutUntil.slice(0, 19).replace('T', ' '),
        record.lastDelayMs,
      )
      return (await this.findLoginAttempt(record.attemptKey)) as LoginAttemptRecord
    },

    async clearLoginAttempts(attemptKeys: string[]) {
      const keys = attemptKeys.map((item) => String(item).trim()).filter(Boolean)
      if (keys.length === 0) return
      const placeholders = keys.map(() => '?').join(', ')
      await prisma.$executeRawUnsafe(`DELETE FROM auth_login_attempts WHERE attempt_key IN (${placeholders})`, ...keys)
    },

    async listUserSessions(userId: string) {
      const rows = await prisma.$queryRawUnsafe<Array<{
        sessionId: string
        userId: bigint | number | string
        roleCode: string
        createdAt: Date | string
        revokedAt: Date | string | null
        accessExpiresAt: Date | string
        refreshExpiresAt: Date | string
      }>>(
        `
          SELECT session_id AS sessionId, user_id AS userId, role_code AS roleCode,
                 created_at AS createdAt, revoked_at AS revokedAt,
                 access_expires_at AS accessExpiresAt, refresh_expires_at AS refreshExpiresAt
          FROM auth_user_sessions
          WHERE user_id = ?
          ORDER BY created_at ASC
        `,
        userId,
      )
      return rows
        .map((row): UserSessionSnapshot | null => {
          const role = asCanonicalUserRole(row.roleCode)
          if (!role) return null
          return {
            sessionId: String(row.sessionId),
            userId: String(row.userId),
            role,
            createdAt: new Date(row.createdAt).toISOString(),
            revokedAt: row.revokedAt == null ? null : new Date(row.revokedAt).toISOString(),
            accessExpiresAt: new Date(row.accessExpiresAt).toISOString(),
            refreshExpiresAt: new Date(row.refreshExpiresAt).toISOString(),
          }
        })
        .filter((row): row is UserSessionSnapshot => row != null)
    },

    async revokeAllUserSessions(args) {
      const sessions = await this.listUserSessions(args.userId)
      const targetIds = sessions
        .filter((row) => row.revokedAt == null)
        .filter((row) => !args.exceptSessionId || row.sessionId !== args.exceptSessionId)
        .map((row) => row.sessionId)
      await this.revokeSessionsById({ sessionIds: targetIds, revokedAt: args.revokedAt, reason: args.reason })
      return { revokedSessionIds: targetIds }
    },

    async revokeSessionsById(args) {
      const ids = args.sessionIds.map((item) => String(item).trim()).filter(Boolean)
      if (ids.length === 0) return
      const placeholders = ids.map(() => '?').join(', ')
      await prisma.$executeRawUnsafe(
        `
          UPDATE auth_user_sessions
          SET revoked_at = ?,
              revoke_reason = COALESCE(?, revoke_reason)
          WHERE session_id IN (${placeholders}) AND revoked_at IS NULL
        `,
        args.revokedAt.slice(0, 19).replace('T', ' '),
        args.reason,
        ...ids,
      )
    },

    async cleanupSessions(args) {
      const now = new Date(args.now)
      const expiredCutoff = new Date(now.getTime() - Math.max(1, Math.trunc(args.expiredRetentionDays || 1)) * 86_400_000)
      const revokedCutoff = new Date(now.getTime() - Math.max(1, Math.trunc(args.revokedRetentionDays || 1)) * 86_400_000)
      const limit = Math.max(1, Math.trunc(args.batchLimit || 1))

      const deletedExpired = await prisma.$executeRawUnsafe(
        `
          DELETE FROM auth_user_sessions
          WHERE refresh_expires_at < ?
          ORDER BY refresh_expires_at ASC
          LIMIT ?
        `,
        expiredCutoff.toISOString().slice(0, 19).replace('T', ' '),
        limit,
      )

      const deletedRevoked = await prisma.$executeRawUnsafe(
        `
          DELETE FROM auth_user_sessions
          WHERE revoked_at IS NOT NULL AND revoked_at < ?
          ORDER BY revoked_at ASC
          LIMIT ?
        `,
        revokedCutoff.toISOString().slice(0, 19).replace('T', ' '),
        limit,
      )

      return {
        deletedExpired: Number(deletedExpired) || 0,
        deletedRevoked: Number(deletedRevoked) || 0,
      }
    },

    async setUserStatus(args) {
      await prisma.$executeRawUnsafe(
        `UPDATE users SET status = ? WHERE user_id = ?`,
        args.status,
        args.userId,
      )
    },
  }
}

function createNoopAuthSecurityStore(): AuthSecurityStore {
  const attempts = new Map<string, LoginAttemptRecord>()
  const sessionsByUser = new Map<string, UserSessionSnapshot[]>()
  return {
    async findLoginAttempt(attemptKey: string) {
      return attempts.get(attemptKey) ?? null
    },
    async upsertLoginAttempt(record: LoginAttemptWrite) {
      const next: LoginAttemptRecord = { ...record }
      attempts.set(record.attemptKey, next)
      return next
    },
    async clearLoginAttempts(attemptKeys: string[]) {
      for (const key of attemptKeys) attempts.delete(String(key))
    },
    async listUserSessions(userId: string) {
      return sessionsByUser.get(userId)?.slice() ?? []
    },
    async revokeAllUserSessions(args) {
      const list = sessionsByUser.get(args.userId) ?? []
      const revoked = list
        .filter((row) => row.revokedAt == null)
        .filter((row) => !args.exceptSessionId || row.sessionId !== args.exceptSessionId)
      revoked.forEach((row) => { row.revokedAt = args.revokedAt })
      sessionsByUser.set(args.userId, list)
      return { revokedSessionIds: revoked.map((row) => row.sessionId) }
    },
    async revokeSessionsById(args) {
      const set = new Set(args.sessionIds)
      for (const rows of sessionsByUser.values()) {
        rows.forEach((row) => {
          if (set.has(row.sessionId)) row.revokedAt = args.revokedAt
        })
      }
    },
    async cleanupSessions() {
      return { deletedExpired: 0, deletedRevoked: 0 }
    },
    async setUserStatus() {
      return
    },
  }
}

export function createAuthService(deps: {
  store?: AuthStore
  securityStore?: AuthSecurityStore
  now?: () => Date
  generateToken?: (prefix: string) => string
  sleep?: (ms: number) => Promise<void>
  auditWriter?: (event: AuthAuditEvent) => Promise<void>
} = {}) {
  const store = deps.store ?? createSqlAuthStore()
  const securityStore = deps.securityStore ?? (deps.store ? createNoopAuthSecurityStore() : createSqlAuthSecurityStore())
  const now = deps.now ?? (() => new Date())
  const generateToken = deps.generateToken ?? buildOpaqueToken
  const sleep = deps.sleep ?? (async (ms: number) => {
    if (ms <= 0) return
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
  const auditWriter = deps.auditWriter ?? defaultAuthAuditWriter

  async function recordFailureAndBuildError(args: { username: string; ipAddress?: string | null; userAgent?: string | null; user?: AuthUserRecord | null }) {
    const currentTime = now()
    const buckets = buildLoginAttemptBuckets(args.username, args.ipAddress)
    const existing = await Promise.all(buckets.map((bucket) => securityStore.findLoginAttempt(bucket.attemptKey)))
    const records: LoginAttemptRecord[] = []
    for (let idx = 0; idx < buckets.length; idx += 1) {
      const nextRecord = computeNextFailureRecord(buckets[idx], existing[idx], currentTime, config.auth.loginSecurity)
      records.push(await securityStore.upsertLoginAttempt(nextRecord))
    }

    const effective = summarizeLoginAttempt(records, currentTime, config.auth.loginSecurity)
    if (effective.delayMs > 0) await sleep(effective.delayMs)

    const primaryBucket = records.find((row) => row.bucketKind === 'USERNAME') ?? records[0]

    if (effective.active && effective.lockoutUntil) {
      await auditWriter({
        action: 'AUTH_LOGIN_LOCKED',
        entityTable: 'auth_login_attempts',
        entityId: primaryBucket.attemptKey,
        afterSnapshot: primaryBucket,
        occurredAt: currentTime.toISOString(),
      })
      return new ApiError({
        code: 'FORBIDDEN',
        message: 'Tài khoản đang bị khoá tạm thời do đăng nhập sai nhiều lần',
        details: buildLoginSecurityDetails({
          reasonCode: 'AUTH_LOGIN_LOCKED',
          failureCount: effective.failureCount,
          delayMs: effective.delayMs,
          lockoutUntil: effective.lockoutUntil,
        }),
      })
    }

    if (effective.delayMs > 0) {
      await auditWriter({
        action: 'AUTH_LOGIN_THROTTLED',
        entityTable: 'auth_login_attempts',
        entityId: primaryBucket.attemptKey,
        afterSnapshot: primaryBucket,
        occurredAt: currentTime.toISOString(),
      })
    }

    if (args.user?.status === 'DISABLED') {
      return new ApiError({
        code: 'FORBIDDEN',
        message: 'Tài khoản đã bị vô hiệu hoá',
        details: buildLoginSecurityDetails({
          reasonCode: 'AUTH_USER_DISABLED',
          failureCount: effective.failureCount,
          delayMs: effective.delayMs,
        }),
      })
    }

    return new ApiError({
      code: 'UNAUTHENTICATED',
      message: 'Thông tin đăng nhập không hợp lệ',
      details: buildLoginSecurityDetails({
        reasonCode: effective.delayMs > 0 ? 'AUTH_LOGIN_THROTTLED' : 'AUTH_INVALID_CREDENTIALS',
        failureCount: effective.failureCount,
        delayMs: effective.delayMs,
      }),
    })
  }

  async function clearLoginAttempts(username: string, ipAddress?: string | null) {
    const buckets = buildLoginAttemptBuckets(username, ipAddress)
    await securityStore.clearLoginAttempts(buckets.map((bucket) => bucket.attemptKey))
  }

  async function ensureNotLockedOut(username: string, ipAddress?: string | null) {
    const currentTime = now()
    const buckets = buildLoginAttemptBuckets(username, ipAddress)
    const existing = await Promise.all(buckets.map((bucket) => securityStore.findLoginAttempt(bucket.attemptKey)))
    const effective = summarizeLoginAttempt(existing, currentTime, config.auth.loginSecurity)
    if (effective.active && effective.lockoutUntil && isLockoutActive(effective.lockoutUntil, currentTime)) {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Tài khoản đang bị khoá tạm thời do đăng nhập sai nhiều lần',
        details: buildLoginSecurityDetails({
          reasonCode: 'AUTH_LOGIN_LOCKED',
          failureCount: effective.failureCount,
          delayMs: effective.delayMs,
          lockoutUntil: effective.lockoutUntil,
        }),
      })
    }
  }

  async function enforceSessionHygieneOnLogin(user: AuthUserRecord, principal: AuthenticatedUserPrincipal, occurredAt: string) {
    const limit = config.auth.sessionHygiene.sessionLimitPerUser
    if (limit == null || limit <= 0) return

    const sessions = await securityStore.listUserSessions(user.userId)
    const evicted = pickSessionsToEvict(sessions, limit)
    if (evicted.length === 0) return

    await securityStore.revokeSessionsById({
      sessionIds: evicted.map((row) => row.sessionId),
      revokedAt: occurredAt,
      reason: 'SESSION_LIMIT_EXCEEDED',
    })

    for (const session of evicted) {
      await auditWriter({
        action: 'AUTH_SESSION_LIMIT_EVICT',
        entityTable: 'auth_user_sessions',
        entityId: session.sessionId,
        actor: principal,
        afterSnapshot: {
          sessionId: session.sessionId,
          userId: session.userId,
          role: session.role,
          revokedAt: occurredAt,
          revokeReason: 'SESSION_LIMIT_EXCEEDED',
        },
        occurredAt,
      })
    }
  }

  async function authenticateAccessToken(token: string, meta: { ipAddress?: string | null; userAgent?: string | null } = {}): Promise<AuthenticatedPrincipal> {
    if (config.authMode === 'OFF') {
      if (process.env.NODE_ENV === 'production') {
        throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Auth disabled in production — set NODE_ENV to development or AUTH_MODE to ON' })
      }
      const fallbackActor = config.actors.ADMIN ?? 1n
      return {
        principalType: 'USER',
        role: 'SUPER_ADMIN',
        actorUserId: fallbackActor,
        actorLabel: `SUPER_ADMIN:${fallbackActor.toString()}`,
        userId: fallbackActor.toString(),
        username: 'local-dev-admin',
        sessionId: 'auth-off',
        siteScopes: [],
      }
    }

    const acceptedInternalTokens = [config.internalService.token, config.internalService.nextToken].filter((value): value is string => Boolean(value))
    if (acceptedInternalTokens.some((configuredToken) => constantTimeSecretEquals(configuredToken, token))) {
      return buildServicePrincipal()
    }

    const session = await store.findSessionByAccessTokenHash(hashToken(token))
    if (!session) {
      throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Access token không hợp lệ' })
    }

    const currentTime = now()
    if (session.revokedAt) {
      throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Phiên đăng nhập đã bị thu hồi' })
    }
    if (isExpired(session.accessExpiresAt, currentTime)) {
      throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Access token đã hết hạn' })
    }

    const user = ensureActiveUser(session.user)
    if (!user.roles.includes(session.role)) {
      throw new ApiError({ code: 'FORBIDDEN', message: `Role ${session.role} không còn hiệu lực trên tài khoản` })
    }

    await store.touchSession({ sessionId: session.sessionId, lastSeenAt: currentTime.toISOString(), ipAddress: meta.ipAddress, userAgent: meta.userAgent })
    return buildUserPrincipal(user, session.sessionId, session.role)
  }

  async function login(input: LoginInput): Promise<LoginResult> {
    const username = normalizeUsername(input.username)
    const password = String(input.password ?? '')
    if (!username || !password) {
      throw new ApiError({ code: 'BAD_REQUEST', message: 'username và password là bắt buộc' })
    }

    await ensureNotLockedOut(username, input.ipAddress)

    const user = await store.findUserByUsername(username)
    const passwordHash = user ? await store.findPasswordHashByUsername(username) : null
    if (!user || !passwordHash || !verifyPassword(password, passwordHash) || user.status !== 'ACTIVE') {
      throw await recordFailureAndBuildError({ username, ipAddress: input.ipAddress, userAgent: input.userAgent, user })
    }

    await clearLoginAttempts(username, input.ipAddress)

    const role = pickRole(user.roles, input.role ?? null)
    const currentTime = now()
    const accessExpiresAt = plusMinutes(currentTime, config.auth.accessTtlMinutes).toISOString()
    const refreshExpiresAt = plusDays(currentTime, config.auth.refreshTtlDays).toISOString()
    const accessToken = generateToken(ACCESS_TOKEN_PREFIX)
    const refreshToken = generateToken(REFRESH_TOKEN_PREFIX)
    const sessionId = randomUUID()

    await store.createSession({
      sessionId,
      userId: user.userId,
      role,
      accessTokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(refreshToken),
      accessExpiresAt,
      refreshExpiresAt,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })

    const principal = buildUserPrincipal(user, sessionId, role)
    await enforceSessionHygieneOnLogin(user, principal, currentTime.toISOString())

    await auditWriter({
      action: 'AUTH_LOGIN',
      entityTable: 'auth_user_sessions',
      entityId: sessionId,
      actor: principal,
      afterSnapshot: buildAuthSessionSnapshot({
        sessionId,
        userId: user.userId,
        username: user.username,
        role,
        accessExpiresAt,
        refreshExpiresAt,
      }),
      occurredAt: currentTime.toISOString(),
    })

    return {
      accessToken,
      refreshToken,
      accessExpiresAt,
      refreshExpiresAt,
      principal,
    }
  }

  async function refresh(input: RefreshInput): Promise<RefreshResult> {
    const refreshToken = String(input.refreshToken ?? '').trim()
    if (!refreshToken) throw new ApiError({ code: 'BAD_REQUEST', message: 'refreshToken là bắt buộc' })

    const session = await store.findSessionByRefreshTokenHash(hashToken(refreshToken))
    if (!session) throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Refresh token không hợp lệ' })

    const currentTime = now()
    if (session.revokedAt) throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Phiên đăng nhập đã bị thu hồi' })
    if (isExpired(session.refreshExpiresAt, currentTime)) throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Refresh token đã hết hạn' })

    const user = ensureActiveUser(session.user)
    if (!user.roles.includes(session.role)) {
      throw new ApiError({ code: 'FORBIDDEN', message: `Role ${session.role} không còn hiệu lực trên tài khoản` })
    }

    const beforeSnapshot = buildAuthSessionSnapshot({
      sessionId: session.sessionId,
      userId: session.userId,
      username: user.username,
      role: session.role,
      accessExpiresAt: session.accessExpiresAt,
      refreshExpiresAt: session.refreshExpiresAt,
      revokedAt: session.revokedAt,
      revokeReason: session.revokeReason,
    })

    const accessToken = generateToken(ACCESS_TOKEN_PREFIX)
    const nextRefreshToken = generateToken(REFRESH_TOKEN_PREFIX)
    const accessExpiresAt = plusMinutes(currentTime, config.auth.accessTtlMinutes).toISOString()
    const refreshExpiresAt = plusDays(currentTime, config.auth.refreshTtlDays).toISOString()

    await store.rotateSessionTokens({
      sessionId: session.sessionId,
      accessTokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(nextRefreshToken),
      accessExpiresAt,
      refreshExpiresAt,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })

    await auditWriter({
      action: 'AUTH_REFRESH',
      entityTable: 'auth_user_sessions',
      entityId: session.sessionId,
      actor: buildUserPrincipal(user, session.sessionId, session.role),
      beforeSnapshot,
      afterSnapshot: buildAuthSessionSnapshot({
        sessionId: session.sessionId,
        userId: session.userId,
        username: user.username,
        role: session.role,
        accessExpiresAt,
        refreshExpiresAt,
      }),
      occurredAt: currentTime.toISOString(),
    })

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      accessExpiresAt,
      refreshExpiresAt,
      principal: buildUserPrincipal(user, session.sessionId, session.role),
    }
  }

  async function logout(input: LogoutInput): Promise<LogoutResult> {
    const accessToken = String(input.accessToken ?? '').trim()
    const refreshToken = String(input.refreshToken ?? '').trim()
    if (!accessToken && !refreshToken) {
      throw new ApiError({ code: 'BAD_REQUEST', message: 'Cần accessToken hoặc refreshToken để logout' })
    }

    const session = refreshToken
      ? await store.findSessionByRefreshTokenHash(hashToken(refreshToken))
      : await store.findSessionByAccessTokenHash(hashToken(accessToken))

    if (!session) return { revoked: false, principal: null }

    const principal = buildUserPrincipal(session.user, session.sessionId, session.role)
    const revokedAt = now().toISOString()
    const beforeSnapshot = buildAuthSessionSnapshot({
      sessionId: session.sessionId,
      userId: session.userId,
      username: session.user.username,
      role: session.role,
      accessExpiresAt: session.accessExpiresAt,
      refreshExpiresAt: session.refreshExpiresAt,
      revokedAt: session.revokedAt,
      revokeReason: session.revokeReason,
    })
    await store.revokeSession({ sessionId: session.sessionId, revokedAt, reason: input.reason ?? 'LOGOUT' })
    await auditWriter({
      action: 'AUTH_LOGOUT',
      entityTable: 'auth_user_sessions',
      entityId: session.sessionId,
      actor: principal,
      beforeSnapshot,
      afterSnapshot: buildAuthSessionSnapshot({
        sessionId: session.sessionId,
        userId: session.userId,
        username: session.user.username,
        role: session.role,
        accessExpiresAt: session.accessExpiresAt,
        refreshExpiresAt: session.refreshExpiresAt,
        revokedAt,
        revokeReason: input.reason ?? 'LOGOUT',
      }),
      occurredAt: revokedAt,
    })
    return { revoked: true, principal }
  }

  async function revokeAllUserSessions(input: RevokeAllSessionsInput): Promise<RevokeAllSessionsResult> {
    const user = ensureExistingUser(await store.findUserById(String(input.targetUserId)), 'Không tìm thấy user để revoke session')
    const revokedAt = now().toISOString()
    const beforeSessions = await securityStore.listUserSessions(user.userId)
    const result = await securityStore.revokeAllUserSessions({
      userId: user.userId,
      revokedAt,
      reason: input.reason ?? 'FORCED_LOGOUT_ALL',
      exceptSessionId: input.exceptSessionId ?? null,
    })
    const afterSessions = await securityStore.listUserSessions(user.userId)

    for (const sessionId of result.revokedSessionIds) {
      await auditWriter({
        action: 'AUTH_SESSION_FORCED_LOGOUT',
        entityTable: 'auth_user_sessions',
        entityId: sessionId,
        actor: input.actor ?? null,
        afterSnapshot: {
          sessionId,
          userId: user.userId,
          revokedAt,
          revokeReason: input.reason ?? 'FORCED_LOGOUT_ALL',
        },
        occurredAt: revokedAt,
      })
    }

    await auditWriter({
      action: 'AUTH_SESSION_REVOKE_ALL',
      entityTable: 'users',
      entityId: user.userId,
      actor: input.actor ?? null,
      beforeSnapshot: { activeSessionCount: beforeSessions.filter((row) => row.revokedAt == null).length },
      afterSnapshot: { activeSessionCount: afterSessions.filter((row) => row.revokedAt == null).length },
      occurredAt: revokedAt,
    })

    return {
      user,
      revokedSessionIds: result.revokedSessionIds,
    }
  }

  async function setUserStatus(input: SetUserStatusInput): Promise<AuthUserRecord> {
    const existing = await store.findUserById(String(input.targetUserId))
    if (!existing) throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy user' })

    const occurredAt = now().toISOString()
    await securityStore.setUserStatus({ userId: existing.userId, status: input.status })
    if (input.status === 'DISABLED') {
      await revokeAllUserSessions({
        targetUserId: existing.userId,
        actor: input.actor ?? null,
        reason: input.reason ?? 'USER_DISABLED',
      })
    }

    const updated = await store.findUserById(existing.userId)
    if (!updated) throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy user sau khi cập nhật trạng thái' })

    await auditWriter({
      action: input.status === 'DISABLED' ? 'AUTH_USER_DISABLED' : 'AUTH_USER_ENABLED',
      entityTable: 'users',
      entityId: existing.userId,
      actor: input.actor ?? null,
      beforeSnapshot: { status: existing.status },
      afterSnapshot: { status: input.status, reason: input.reason ?? null },
      occurredAt,
    })

    return {
      ...updated,
      status: input.status,
    }
  }

  async function cleanupExpiredSessions(): Promise<CleanupAuthSessionsResult> {
    const currentTime = now().toISOString()
    const result = await securityStore.cleanupSessions({
      now: currentTime,
      expiredRetentionDays: config.auth.sessionHygiene.cleanupExpiredRetentionDays,
      revokedRetentionDays: config.auth.sessionHygiene.cleanupRevokedRetentionDays,
      batchLimit: config.auth.sessionHygiene.cleanupBatchLimit,
    })

    await auditWriter({
      action: 'AUTH_SESSION_CLEANUP',
      entityTable: 'auth_user_sessions',
      entityId: 'cleanup',
      actor: { principalType: 'SYSTEM', actorLabel: 'AUTH_SESSION_CLEANUP', role: null },
      afterSnapshot: result,
      occurredAt: currentTime,
    })

    return {
      ...result,
      retentionDays: {
        expired: config.auth.sessionHygiene.cleanupExpiredRetentionDays,
        revoked: config.auth.sessionHygiene.cleanupRevokedRetentionDays,
      },
    }
  }

  function getPasswordPolicy(): PasswordPolicyDescriptor {
    return {
      bootstrapProfile: config.auth.bootstrapProfile,
      demoSeedCredentialsEnabled: config.auth.demoSeedCredentialsEnabled,
      description: describePasswordPolicy(config.auth.passwordPolicy),
      policy: { ...config.auth.passwordPolicy },
    }
  }

  function validatePassword(password: string) {
    return validatePasswordPolicy(password, config.auth.passwordPolicy)
  }

  return {
    authenticateAccessToken,
    login,
    refresh,
    logout,
    revokeAllUserSessions,
    setUserStatus,
    cleanupExpiredSessions,
    getPasswordPolicy,
    validatePassword,
  }
}

export const authService = createAuthService()

export function serializePrincipal(principal: AuthenticatedPrincipal) {
  if (principal.principalType === 'SERVICE') {
    return {
      principalType: principal.principalType,
      role: principal.role,
      actorLabel: principal.actorLabel,
      serviceCode: principal.serviceCode,
      siteScopes: [],
    }
  }

  return {
    principalType: principal.principalType,
    role: principal.role,
    actorLabel: principal.actorLabel,
    userId: principal.userId,
    username: principal.username,
    sessionId: principal.sessionId,
    siteScopes: principal.siteScopes,
  }
}
