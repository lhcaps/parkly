import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { createAuthService, serializePrincipal, type AuthStore, type AuthSessionRecord, type AuthUserRecord } from '../modules/auth/application/auth-service'
import { hashPassword } from '../modules/auth/application/password-hash'
import { getRequestActor } from '../server/auth'
import { config, type AppRole } from '../server/config'

class MemoryAuthStore implements AuthStore {
  private readonly usersByUsername = new Map<string, AuthUserRecord>()
  private readonly usersById = new Map<string, AuthUserRecord>()
  private readonly passwordHashes = new Map<string, string>()
  private readonly sessionsById = new Map<string, AuthSessionRecord>()
  private readonly accessIndex = new Map<string, string>()
  private readonly refreshIndex = new Map<string, string>()

  seedUser(args: { userId: string; username: string; role: AppRole; password: string }) {
    const user: AuthUserRecord = {
      userId: args.userId,
      username: args.username,
      status: 'ACTIVE',
      roles: [args.role],
      siteScopes: [{ siteId: '1', siteCode: 'SITE_HCM_01', scopeLevel: args.role === 'GUARD' ? 'GUARD' : 'MANAGER' }],
    }
    this.usersByUsername.set(args.username, user)
    this.usersById.set(args.userId, user)
    this.passwordHashes.set(args.username, hashPassword(args.password, { salt: `${args.username}-salt` }))
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

  async createSession(args: { sessionId: string; userId: string; role: AppRole; accessTokenHash: string; refreshTokenHash: string; accessExpiresAt: string; refreshExpiresAt: string }) {
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

function withStableConfig(fn: () => Promise<void> | void) {
  const snapshot = {
    authMode: config.authMode,
    accessTtlMinutes: config.auth.accessTtlMinutes,
    refreshTtlDays: config.auth.refreshTtlDays,
    internalToken: config.internalService.token,
    internalRole: config.internalService.role,
  }
  config.authMode = 'ON'
  config.auth.accessTtlMinutes = 15
  config.auth.refreshTtlDays = 7
  config.internalService.token = 'internal-service-test-token'
  config.internalService.role = 'WORKER'
  return Promise.resolve(fn()).finally(() => {
    config.authMode = snapshot.authMode
    config.auth.accessTtlMinutes = snapshot.accessTtlMinutes
    config.auth.refreshTtlDays = snapshot.refreshTtlDays
    config.internalService.token = snapshot.internalToken
    config.internalService.role = snapshot.internalRole
  })
}

test('login -> me -> refresh -> logout hoạt động và access token cũ bị xoá hiệu lực', async () => {
  await withStableConfig(async () => {
    const store = new MemoryAuthStore()
    store.seedUser({ userId: '101', username: 'admin', role: 'ADMIN', password: 'Parkly@123' })

    let seq = 0
    const service = createAuthService({
      store,
      now: () => new Date('2026-03-12T10:00:00.000Z'),
      generateToken: (prefix) => `${prefix}_token_${++seq}`,
    })

    const login = await service.login({ username: 'admin', password: 'Parkly@123' })
    assert.equal(login.principal.role, 'ADMIN')
    assert.match(login.accessToken, /^atk_token_1$/)
    assert.match(login.refreshToken, /^rtk_token_2$/)

    const me = await service.authenticateAccessToken(login.accessToken)
    assert.equal(me.principalType, 'USER')
    assert.deepEqual(serializePrincipal(me), {
      principalType: 'USER',
      role: 'ADMIN',
      actorLabel: 'ADMIN:101',
      userId: '101',
      username: 'admin',
      sessionId: login.principal.sessionId,
      siteScopes: [{ siteId: '1', siteCode: 'SITE_HCM_01', scopeLevel: 'MANAGER' }],
    })

    const refreshed = await service.refresh({ refreshToken: login.refreshToken })
    assert.match(refreshed.accessToken, /^atk_token_3$/)
    assert.match(refreshed.refreshToken, /^rtk_token_4$/)
    await assert.rejects(() => service.authenticateAccessToken(login.accessToken), /không hợp lệ|hết hạn|thu hồi/i)

    const logout = await service.logout({ refreshToken: refreshed.refreshToken })
    assert.equal(logout.revoked, true)
    await assert.rejects(() => service.authenticateAccessToken(refreshed.accessToken), /thu hồi/i)
  })
})

test('role matrix và internal service principal được tách riêng', async () => {
  await withStableConfig(async () => {
    const store = new MemoryAuthStore()
    const roles: AppRole[] = ['ADMIN', 'OPS', 'GUARD', 'CASHIER', 'WORKER']
    roles.forEach((role, idx) => store.seedUser({ userId: String(idx + 1), username: role.toLowerCase(), role, password: 'Parkly@123' }))

    let seq = 0
    const service = createAuthService({
      store,
      now: () => new Date('2026-03-12T10:00:00.000Z'),
      generateToken: (prefix) => `${prefix}_token_${++seq}`,
    })

    for (const role of roles) {
      const result = await service.login({ username: role.toLowerCase(), password: 'Parkly@123' })
      const principal = await service.authenticateAccessToken(result.accessToken)
      assert.equal(principal.role, role)
      assert.equal(principal.principalType, 'USER')
    }

    const internal = await service.authenticateAccessToken('internal-service-test-token')
    assert.equal(internal.principalType, 'SERVICE')
    assert.equal(internal.role, 'WORKER')
    assert.deepEqual(serializePrincipal(internal), {
      principalType: 'SERVICE',
      role: 'WORKER',
      actorLabel: 'INTERNAL_SERVICE:WORKER',
      serviceCode: 'INTERNAL_SERVICE',
      siteScopes: [],
    })
  })
})

test('actor identity được resolve từ principal thay vì env shortcut', async () => {
  const actor = getRequestActor({
    auth: {
      principalType: 'USER',
      role: 'OPS',
      actorUserId: 77n,
      actorLabel: 'OPS:77',
      userId: '77',
      username: 'ops',
      sessionId: 'session-ops',
      siteScopes: [],
    },
  } as any)

  assert.equal(actor.role, 'OPS')
  assert.equal(actor.actorUserId, 77n)
  assert.equal(actor.actorLabel, 'OPS:77')
})

function resolveApiSrcRoot() {
  const cwd = process.cwd()
  const candidates = [
    path.resolve(cwd, 'src'),
    path.resolve(cwd, 'apps/api/src'),
    path.resolve(__dirname, '..'),
  ]
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error('Không resolve được apps/api/src cho source-regression test')
  return found
}

test('source regression: admin CRUD và incident resolution đều forward actor identity', async () => {
  const srcRoot = resolveApiSrcRoot()
  const subRoutePath = path.join(srcRoot, 'modules/subscriptions/interfaces/http/register-subscription-admin-routes.ts')
  const incidentRoutePath = path.join(srcRoot, 'modules/incidents/interfaces/http/register-gate-incident-routes.ts')
  const subRouteSource = fs.readFileSync(subRoutePath, 'utf8')
  const incidentRouteSource = fs.readFileSync(incidentRoutePath, 'utf8')

  assert.match(subRouteSource, /createAdminSubscription\(parsed\.data, \{ actorUserId: getRequestActor\(req\)\.actorUserId \}\)/)
  assert.match(subRouteSource, /updateAdminSubscription\(String\(req\.params\.subscriptionId\), parsed\.data, \{ actorUserId: getRequestActor\(req\)\.actorUserId \}\)/)
  assert.match(subRouteSource, /createAdminSubscriptionSpot\(parsed\.data, \{ actorUserId: getRequestActor\(req\)\.actorUserId \}\)/)
  assert.match(subRouteSource, /updateAdminSubscriptionVehicle\(String\(req\.params\.subscriptionVehicleId\), parsed\.data, \{ actorUserId: getRequestActor\(req\)\.actorUserId \}\)/)
  assert.match(incidentRouteSource, /const actor = getRequestActor\(req\)/)
})
