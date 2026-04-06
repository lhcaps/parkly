import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import type { AuthRole } from '@parkly/contracts'

import {
  createAuthService,
  type AuthStore,
  type AuthSessionRecord,
  type AuthUserRecord,
  type AuthenticatedUserPrincipal,
} from '../modules/auth/application/auth-service'
import type { AuthSecurityStore, LoginAttemptRecord, LoginAttemptWrite, UserSessionSnapshot } from '../modules/auth/application/auth-security'
import { hashPassword } from '../modules/auth/application/password-hash'
import { config, type AppRole } from '../server/config'

class MemoryAuthStore implements AuthStore {
  readonly usersByUsername = new Map<string, AuthUserRecord>()
  readonly usersById = new Map<string, AuthUserRecord>()
  readonly passwordHashes = new Map<string, string>()
  readonly sessionsById = new Map<string, AuthSessionRecord>()
  readonly accessIndex = new Map<string, string>()
  readonly refreshIndex = new Map<string, string>()

  private readonly nowFn: () => Date

  constructor(now: () => Date) { this.nowFn = now }

  seedUser(args: { userId: string; username: string; role: AuthRole; password: string; status?: 'ACTIVE' | 'DISABLED' }) {
    const user: AuthUserRecord = {
      userId: args.userId,
      username: args.username,
      status: args.status ?? 'ACTIVE',
      roles: [args.role],
      siteScopes: [{ siteId: '1', siteCode: 'SITE_HCM_01', scopeLevel: args.role === 'GUARD' ? 'GUARD' : 'MANAGER' }],
    }
    this.usersByUsername.set(args.username, user)
    this.usersById.set(args.userId, user)
    this.passwordHashes.set(args.username, hashPassword(args.password, { salt: `${args.username}-salt` }))
  }

  removeSession(sessionId: string) {
    const record = this.sessionsById.get(sessionId)
    if (!record) return
    this.accessIndex.delete(record.accessTokenHash)
    this.refreshIndex.delete(record.refreshTokenHash)
    this.sessionsById.delete(sessionId)
  }

  async findUserByUsername(username: string) {
    return this.usersByUsername.get(username) ?? null
  }

  async findPasswordHashByUsername(username: string) {
    return this.passwordHashes.get(username) ?? null
  }

  async findUserById(userId: string) {
    return this.usersById.get(userId) ?? null
  }

  async findSessionByAccessTokenHash(tokenHash: string) {
    const sessionId = this.accessIndex.get(tokenHash)
    return sessionId ? (this.sessionsById.get(sessionId) ?? null) : null
  }

  async findSessionByRefreshTokenHash(tokenHash: string) {
    const sessionId = this.refreshIndex.get(tokenHash)
    return sessionId ? (this.sessionsById.get(sessionId) ?? null) : null
  }

  async createSession(args: { sessionId: string; userId: string; role: AuthRole; accessTokenHash: string; refreshTokenHash: string; accessExpiresAt: string; refreshExpiresAt: string }) {
    const user = this.usersById.get(args.userId)
    if (!user) throw new Error('user not found')
    const record: AuthSessionRecord = {
      sessionId: args.sessionId,
      userId: args.userId,
      role: args.role,
      accessTokenHash: args.accessTokenHash,
      refreshTokenHash: args.refreshTokenHash,
      accessExpiresAt: args.accessExpiresAt,
      refreshExpiresAt: args.refreshExpiresAt,
      revokedAt: null,
      revokeReason: null,
      createdAt: this.nowFn().toISOString(),
      user,
    }
    this.sessionsById.set(args.sessionId, record)
    this.accessIndex.set(args.accessTokenHash, args.sessionId)
    this.refreshIndex.set(args.refreshTokenHash, args.sessionId)
  }

  async rotateSessionTokens(args: { sessionId: string; accessTokenHash: string; refreshTokenHash: string; accessExpiresAt: string; refreshExpiresAt: string }) {
    const record = this.sessionsById.get(args.sessionId)
    if (!record) throw new Error('session not found')
    this.accessIndex.delete(record.accessTokenHash)
    this.refreshIndex.delete(record.refreshTokenHash)
    record.accessTokenHash = args.accessTokenHash
    record.refreshTokenHash = args.refreshTokenHash
    record.accessExpiresAt = args.accessExpiresAt
    record.refreshExpiresAt = args.refreshExpiresAt
    this.accessIndex.set(record.accessTokenHash, record.sessionId)
    this.refreshIndex.set(record.refreshTokenHash, record.sessionId)
  }

  async revokeSession(args: { sessionId: string; revokedAt: string; reason?: string | null }) {
    const record = this.sessionsById.get(args.sessionId)
    if (!record) return
    record.revokedAt = args.revokedAt
    record.revokeReason = args.reason ?? null
  }

  async touchSession(_args: { sessionId: string; lastSeenAt: string }) {
    return
  }
}

class MemorySecurityStore implements AuthSecurityStore {
  readonly attempts = new Map<string, LoginAttemptRecord>()

  private readonly authStore: MemoryAuthStore

  constructor(authStore: MemoryAuthStore) { this.authStore = authStore }

  async findLoginAttempt(attemptKey: string) {
    return this.attempts.get(attemptKey) ?? null
  }

  async upsertLoginAttempt(record: LoginAttemptWrite) {
    const next: LoginAttemptRecord = { ...record }
    this.attempts.set(record.attemptKey, next)
    return next
  }

  async clearLoginAttempts(attemptKeys: string[]) {
    for (const key of attemptKeys) this.attempts.delete(key)
  }

  async listUserSessions(userId: string) {
    return [...this.authStore.sessionsById.values()]
      .filter((row) => row.userId === userId)
      .map<UserSessionSnapshot>((row) => ({
        sessionId: row.sessionId,
        userId: row.userId,
        role: row.role,
        createdAt: row.createdAt ?? new Date(0).toISOString(),
        revokedAt: row.revokedAt,
        accessExpiresAt: row.accessExpiresAt,
        refreshExpiresAt: row.refreshExpiresAt,
      }))
  }

  async revokeAllUserSessions(args: { userId: string; revokedAt: string; reason: string; exceptSessionId?: string | null }) {
    const ids = [...this.authStore.sessionsById.values()]
      .filter((row) => row.userId === args.userId && row.revokedAt == null)
      .filter((row) => !args.exceptSessionId || row.sessionId !== args.exceptSessionId)
      .map((row) => row.sessionId)
    await this.revokeSessionsById({ sessionIds: ids, revokedAt: args.revokedAt, reason: args.reason })
    return { revokedSessionIds: ids }
  }

  async revokeSessionsById(args: { sessionIds: string[]; revokedAt: string; reason: string }) {
    const set = new Set(args.sessionIds)
    for (const row of this.authStore.sessionsById.values()) {
      if (set.has(row.sessionId)) {
        row.revokedAt = args.revokedAt
        row.revokeReason = args.reason
      }
    }
  }

  async cleanupSessions(args: { now: string; expiredRetentionDays: number; revokedRetentionDays: number; batchLimit: number }) {
    const now = new Date(args.now)
    const expiredCutoff = new Date(now.getTime() - args.expiredRetentionDays * 86_400_000)
    const revokedCutoff = new Date(now.getTime() - args.revokedRetentionDays * 86_400_000)
    let deletedExpired = 0
    let deletedRevoked = 0
    for (const row of [...this.authStore.sessionsById.values()]) {
      if (deletedExpired >= args.batchLimit && deletedRevoked >= args.batchLimit) break
      if (new Date(row.refreshExpiresAt).getTime() < expiredCutoff.getTime()) {
        this.authStore.removeSession(row.sessionId)
        deletedExpired += 1
        continue
      }
      if (row.revokedAt && new Date(row.revokedAt).getTime() < revokedCutoff.getTime()) {
        this.authStore.removeSession(row.sessionId)
        deletedRevoked += 1
      }
    }
    return { deletedExpired, deletedRevoked }
  }

  async setUserStatus(args: { userId: string; status: 'ACTIVE' | 'DISABLED' }) {
    const user = this.authStore.usersById.get(args.userId)
    if (!user) return
    user.status = args.status
    this.authStore.usersByUsername.set(user.username, user)
  }
}

function resolveApiSrcRoot() {
  const cwd = process.cwd()
  const candidates = [
    path.resolve(cwd, 'src'),
    path.resolve(cwd, 'apps/api/src'),
    path.resolve(__dirname, '..'),
  ]
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error('Không resolve được apps/api/src cho PR26 test')
  return found
}

const srcRoot = resolveApiSrcRoot()
const repoRoot = path.resolve(srcRoot, '..', '..', '..')

function readSource(relPath: string) {
  return fs.readFileSync(path.join(srcRoot, relPath), 'utf8')
}

function withStableConfig(fn: () => Promise<void> | void) {
  const snapshot = JSON.parse(JSON.stringify({
    authMode: config.authMode,
    accessTtlMinutes: config.auth.accessTtlMinutes,
    refreshTtlDays: config.auth.refreshTtlDays,
    loginSecurity: config.auth.loginSecurity,
    passwordPolicy: config.auth.passwordPolicy,
    sessionHygiene: config.auth.sessionHygiene,
    bootstrapProfile: config.auth.bootstrapProfile,
    demoSeedCredentialsEnabled: config.auth.demoSeedCredentialsEnabled,
    internalToken: config.internalService.token,
    internalRole: config.internalService.role,
  }))
  config.authMode = 'ON'
  config.auth.accessTtlMinutes = 15
  config.auth.refreshTtlDays = 7
  config.auth.loginSecurity.windowSeconds = 300
  config.auth.loginSecurity.failureLockoutThreshold = 3
  config.auth.loginSecurity.lockoutSeconds = 60
  config.auth.loginSecurity.progressiveDelayMs = 200
  config.auth.loginSecurity.progressiveDelayMaxMs = 1000
  config.auth.passwordPolicy.minLength = 10
  config.auth.passwordPolicy.requireUppercase = true
  config.auth.passwordPolicy.requireLowercase = true
  config.auth.passwordPolicy.requireDigit = true
  config.auth.passwordPolicy.requireSpecial = true
  config.auth.sessionHygiene.sessionLimitPerUser = 2
  config.auth.sessionHygiene.cleanupExpiredRetentionDays = 3
  config.auth.sessionHygiene.cleanupRevokedRetentionDays = 30
  config.auth.sessionHygiene.cleanupBatchLimit = 100
  config.auth.bootstrapProfile = 'DEMO'
  config.auth.demoSeedCredentialsEnabled = true
  config.internalService.token = 'internal-service-test-token'
  config.internalService.role = 'WORKER'
  return Promise.resolve(fn()).finally(() => {
    config.authMode = snapshot.authMode
    config.auth.accessTtlMinutes = snapshot.accessTtlMinutes
    config.auth.refreshTtlDays = snapshot.refreshTtlDays
    Object.assign(config.auth.loginSecurity, snapshot.loginSecurity)
    Object.assign(config.auth.passwordPolicy, snapshot.passwordPolicy)
    Object.assign(config.auth.sessionHygiene, snapshot.sessionHygiene)
    config.auth.bootstrapProfile = snapshot.bootstrapProfile
    config.auth.demoSeedCredentialsEnabled = snapshot.demoSeedCredentialsEnabled
    config.internalService.token = snapshot.internalToken
    config.internalService.role = snapshot.internalRole
  })
}

test('repeated login failure bị progressive delay rồi lockout ngắn hạn', async () => {
  await withStableConfig(async () => {
    let nowValue = new Date('2026-03-13T10:00:00.000Z')
    const store = new MemoryAuthStore(() => nowValue)
    const securityStore = new MemorySecurityStore(store)
    const sleepCalls: number[] = []
    const auditEvents: string[] = []

    store.seedUser({ userId: '1', username: 'admin', role: 'SUPER_ADMIN', password: 'Parkly@123' })

    const service = createAuthService({
      store,
      securityStore,
      now: () => nowValue,
      sleep: async (ms) => { sleepCalls.push(ms) },
      auditWriter: async (event) => { auditEvents.push(event.action) },
      generateToken: (prefix) => `${prefix}_${Math.random().toString(36).slice(2)}`,
    })

    await assert.rejects(() => service.login({ username: 'admin', password: 'wrong-1', ipAddress: '10.0.0.8' }), /không hợp lệ/i)
    await assert.rejects(() => service.login({ username: 'admin', password: 'wrong-2', ipAddress: '10.0.0.8' }), /không hợp lệ/i)
    await assert.rejects(() => service.login({ username: 'admin', password: 'wrong-3', ipAddress: '10.0.0.8' }), /khoá tạm thời/i)
    await assert.rejects(() => service.login({ username: 'admin', password: 'Parkly@123', ipAddress: '10.0.0.8' }), /khoá tạm thời/i)

    assert.deepEqual(sleepCalls, [200, 400])
    assert.ok(auditEvents.includes('AUTH_LOGIN_THROTTLED'))
    assert.ok(auditEvents.includes('AUTH_LOGIN_LOCKED'))
  })
})

test('password policy rõ ràng và demo seed password pass còn weak password fail', async () => {
  await withStableConfig(async () => {
    const store = new MemoryAuthStore(() => new Date('2026-03-13T10:00:00.000Z'))
    const securityStore = new MemorySecurityStore(store)
    const service = createAuthService({ store, securityStore, auditWriter: async () => {} })

    const descriptor = service.getPasswordPolicy()
    assert.equal(descriptor.bootstrapProfile, 'DEMO')
    assert.equal(descriptor.demoSeedCredentialsEnabled, true)
    assert.equal(service.validatePassword('Parkly@123').ok, true)
    assert.equal(service.validatePassword('weakpass').ok, false)
    assert.match(descriptor.description, /min 10 ký tự/i)
  })
})

test('session limit evict session cũ nhất và revoke-all làm token cũ mất hiệu lực', async () => {
  await withStableConfig(async () => {
    let tick = 0
    let nowValue = new Date('2026-03-13T10:00:00.000Z')
    const store = new MemoryAuthStore(() => new Date(nowValue.getTime() + tick++ * 1000))
    const securityStore = new MemorySecurityStore(store)
    const auditEvents: string[] = []
    store.seedUser({ userId: '1', username: 'ops', role: 'OPERATOR', password: 'Parkly@123' })

    const service = createAuthService({
      store,
      securityStore,
      now: () => new Date(nowValue.getTime() + tick * 1000),
      auditWriter: async (event) => { auditEvents.push(event.action) },
      generateToken: (() => { let seq = 0; return (prefix: string) => `${prefix}_${++seq}` })(),
    })

    const first = await service.login({ username: 'ops', password: 'Parkly@123', ipAddress: '10.0.0.9' })
    const second = await service.login({ username: 'ops', password: 'Parkly@123', ipAddress: '10.0.0.9' })
    const third = await service.login({ username: 'ops', password: 'Parkly@123', ipAddress: '10.0.0.9' })

    await assert.rejects(() => service.authenticateAccessToken(first.accessToken), /thu hồi/i)
    assert.equal((await service.authenticateAccessToken(second.accessToken)).principalType, 'USER')
    assert.equal((await service.authenticateAccessToken(third.accessToken)).principalType, 'USER')
    assert.ok(auditEvents.includes('AUTH_SESSION_LIMIT_EVICT'))

    const actor = await service.authenticateAccessToken(third.accessToken) as AuthenticatedUserPrincipal
    const revoked = await service.revokeAllUserSessions({ targetUserId: actor.userId, actor })
    assert.equal(revoked.revokedSessionIds.length >= 2, true)
    await assert.rejects(() => service.authenticateAccessToken(second.accessToken), /thu hồi/i)
    await assert.rejects(() => service.authenticateAccessToken(third.accessToken), /thu hồi/i)
    assert.ok(auditEvents.includes('AUTH_SESSION_FORCED_LOGOUT'))
    assert.ok(auditEvents.includes('AUTH_SESSION_REVOKE_ALL'))
  })
})

test('cleanup expired sessions và revoked stale sessions không để bảng session phình vô hạn', async () => {
  await withStableConfig(async () => {
    const nowValue = new Date('2026-03-13T10:00:00.000Z')
    const store = new MemoryAuthStore(() => nowValue)
    const securityStore = new MemorySecurityStore(store)
    store.seedUser({ userId: '1', username: 'guard', role: 'GUARD', password: 'Parkly@123' })
    store.seedUser({ userId: '2', username: 'cashier', role: 'CASHIER', password: 'Parkly@123' })
    const user1 = store.usersById.get('1')!
    const user2 = store.usersById.get('2')!
    store.sessionsById.set('expired-session', {
      sessionId: 'expired-session',
      userId: '1',
      role: 'GUARD',
      accessTokenHash: 'a',
      refreshTokenHash: 'b',
      accessExpiresAt: '2026-03-01T00:00:00.000Z',
      refreshExpiresAt: '2026-03-01T00:00:00.000Z',
      revokedAt: null,
      revokeReason: null,
      createdAt: '2026-02-20T00:00:00.000Z',
      user: user1,
    })
    store.sessionsById.set('revoked-stale', {
      sessionId: 'revoked-stale',
      userId: '2',
      role: 'CASHIER',
      accessTokenHash: 'c',
      refreshTokenHash: 'd',
      accessExpiresAt: '2026-04-01T00:00:00.000Z',
      refreshExpiresAt: '2026-04-01T00:00:00.000Z',
      revokedAt: '2026-01-01T00:00:00.000Z',
      revokeReason: 'LOGOUT',
      createdAt: '2026-01-01T00:00:00.000Z',
      user: user2,
    })
    store.accessIndex.set('a', 'expired-session')
    store.refreshIndex.set('b', 'expired-session')
    store.accessIndex.set('c', 'revoked-stale')
    store.refreshIndex.set('d', 'revoked-stale')

    const service = createAuthService({ store, securityStore, now: () => nowValue, auditWriter: async () => {} })
    const result = await service.cleanupExpiredSessions()
    assert.equal(result.deletedExpired, 1)
    assert.equal(result.deletedRevoked, 1)
    assert.equal(store.sessionsById.size, 0)
  })
})

test('source regression: route docs env grants migration và script cleanup đã chốt', () => {
  const authRouteSource = readSource('modules/auth/interfaces/http/register-auth-routes.ts')
  const authServiceSource = readSource('modules/auth/application/auth-service.ts')
  const apiDocs = fs.readFileSync(path.join(repoRoot, 'docs/API.md'), 'utf8')
  const envExample = fs.readFileSync(path.join(repoRoot, 'apps/api/.env.example'), 'utf8')
  const runbook = fs.readFileSync(path.join(repoRoot, 'apps/api/docs/RUNBOOK.md'), 'utf8')
  const grantsSource = fs.readFileSync(path.join(repoRoot, 'apps/api/db/scripts/grants_parking_app.mvp.sql'), 'utf8')
  const migrationSource = fs.readFileSync(path.join(repoRoot, 'apps/api/db/migrations/V24__auth_security_layer2.sql'), 'utf8')
  const packageSource = fs.readFileSync(path.join(repoRoot, 'apps/api/package.json'), 'utf8')

  assert.match(authRouteSource, /api\.get\('\/auth\/password-policy'/)
  assert.match(authRouteSource, /api\.post\('\/auth\/revoke-all'/)
  assert.match(authRouteSource, /api\.post\('\/auth\/admin\/users\/:userId\/revoke-all'/)
  assert.match(authRouteSource, /api\.post\('\/auth\/admin\/users\/:userId\/disable'/)
  assert.match(authRouteSource, /api\.post\('\/auth\/admin\/users\/:userId\/enable'/)

  assert.match(authServiceSource, /AUTH_LOGIN_LOCKED/)
  assert.match(authServiceSource, /AUTH_SESSION_REVOKE_ALL/)
  assert.match(authServiceSource, /AUTH_SESSION_FORCED_LOGOUT/)
  assert.match(authServiceSource, /AUTH_SESSION_LIMIT_EVICT/)
  assert.match(authServiceSource, /cleanupExpiredSessions/)

  assert.match(apiDocs, /GET \/api\/auth\/password-policy/)
  assert.match(apiDocs, /POST \/api\/auth\/revoke-all/)
  assert.match(apiDocs, /AUTH_SESSION_REVOKE_ALL/)
  assert.match(apiDocs, /ops \/ Parkly@123.*local\/demo/i)

  assert.match(envExample, /API_AUTH_LOGIN_FAILURE_LOCKOUT_THRESHOLD=5/)
  assert.match(envExample, /API_AUTH_SESSION_LIMIT_PER_USER=5/)
  assert.match(envExample, /API_AUTH_BOOTSTRAP_PROFILE=DEMO/)

  assert.match(runbook, /auth:sessions:cleanup/)
  assert.match(runbook, /Parkly@123.*local\/demo/i)

  assert.match(grantsSource, /auth_login_attempts/)
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS auth_login_attempts/)
  assert.match(packageSource, /"test:pr26"/)
  assert.match(packageSource, /"auth:sessions:cleanup"/)
})
