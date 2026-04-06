import { resolveSiteIdByCode } from '../../../lib/ids'
import { prisma } from '../../../lib/prisma'
import { ApiError } from '../../../server/http'
import { writeAuditLog } from '../../../server/services/audit-service'
import { stringifyBigint } from '../../../server/utils'

// ─── Types ─────────────────────────────────────────────────────────────────

export type UserSummary = {
  userId: string
  username: string
  status: 'ACTIVE' | 'DISABLED'
  roles: string[]
  siteScopes: Array<{ siteCode: string; scopeLevel: string }>
  createdAt: string | null
  updatedAt: string | null
  lastLoginAt: string | null
  activeSessionCount: number
}

export type UserDetail = UserSummary & {
  sessions: Array<{
    sessionId: string
    role: string
    createdAt: string | null
    lastSeenAt: string | null
    expiresAt: string
  }>
}

function toBigInt(value: string | number | bigint): bigint {
  return BigInt(value)
}

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  return stringifyBigint(row) as Record<string, unknown>
}

// ─── Password helpers ───────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const { hashPassword: _hash } = await import('../../auth/application/password-hash')
  return _hash(password)
}

// ─── List Users ─────────────────────────────────────────────────────────────

export type ListUsersOptions = {
  siteCode?: string
  role?: string
  status?: 'ACTIVE' | 'DISABLED'
  search?: string
  cursor?: string
  limit: number
}

export async function listUsers(options: ListUsersOptions) {
  const { siteCode, role, status, search, cursor, limit } = options

  const siteParams: unknown[] = siteCode ? [siteCode, siteCode] : []

  const conditions: string[] = []
  const filterParams: unknown[] = []

  if (status) {
    conditions.push('u.status = ?')
    filterParams.push(status)
  }
  if (role) {
    conditions.push(
      `EXISTS (
        SELECT 1 FROM user_roles urf
        INNER JOIN roles rf ON rf.role_id = urf.role_id
        WHERE urf.user_id = u.user_id AND rf.role_code = ?
      )`,
    )
    filterParams.push(role)
  }
  if (search) {
    const escaped = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
    conditions.push(`u.username LIKE ? ESCAPE '\\\\'`)
    filterParams.push(`%${escaped}%`)
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const cursorSql = cursor
    ? whereSql
      ? ' AND u.user_id < ?'
      : 'WHERE u.user_id < ?'
    : ''
  if (cursor) filterParams.push(toBigInt(cursor))

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        u.user_id         AS userId,
        u.username,
        u.status,
        u.created_at      AS createdAt,
        CAST(NULL AS DATETIME) AS updatedAt,
        (
          SELECT MAX(s.created_at)
          FROM auth_user_sessions s
          WHERE s.user_id = u.user_id
            AND s.revoked_at IS NULL
            AND s.access_expires_at > NOW()
        ) AS lastLoginAt,
        (
          SELECT COUNT(*)
          FROM auth_user_sessions s
          WHERE s.user_id = u.user_id
            AND s.revoked_at IS NULL
            AND s.access_expires_at > NOW()
        ) AS activeSessionCount,
        (
          SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT(
            'role', r.role_code
          )), '[]')
          FROM user_roles ur
          JOIN roles r ON r.role_id = ur.role_id
          WHERE ur.user_id = u.user_id
        ) AS rolesJson,
        (
          SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT(
            'siteCode', ps.site_code,
            'scopeLevel', uss.scope_level
          )), '[]')
          FROM user_site_scopes uss
          JOIN parking_sites ps ON ps.site_id = uss.site_id
          WHERE uss.user_id = u.user_id
          ${siteCode ? 'AND ps.site_code = ?' : ''}
        ) AS siteScopesJson
      FROM users u
      ${siteCode ? 'JOIN user_site_scopes uss ON uss.user_id = u.user_id JOIN parking_sites ps ON ps.site_id = uss.site_id AND ps.site_code = ?' : ''}
      ${whereSql}
      ${cursorSql}
      ORDER BY u.user_id DESC
      LIMIT ?
    `,
    ...siteParams,
    ...filterParams,
    limit + 1,
  )

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  const items: UserSummary[] = page.map((row) => {
    let roles: string[] = []
    let siteScopes: Array<{ siteCode: string; scopeLevel: string }> = []
    try {
      const rawRoles = (row.rolesJson as string | null) ?? '[]'
      roles = JSON.parse(rawRoles).map((r: { role: string }) => r.role)
    } catch { /* noop */ }
    try {
      const rawScopes = (row.siteScopesJson as string | null) ?? '[]'
      siteScopes = JSON.parse(rawScopes)
    } catch { /* noop */ }

    return {
      userId: String(row.userId ?? ''),
      username: String(row.username ?? ''),
      status: String(row.status ?? 'ACTIVE') as 'ACTIVE' | 'DISABLED',
      roles,
      siteScopes,
      createdAt: row.createdAt ? String(row.createdAt) : null,
      updatedAt: row.updatedAt ? String(row.updatedAt) : null,
      lastLoginAt: row.lastLoginAt ? String(row.lastLoginAt) : null,
      activeSessionCount: Number(row.activeSessionCount ?? 0),
    }
  })

  const nextCursor = hasMore ? items[items.length - 1]?.userId : null

  return { rows: items, nextCursor, hasMore }
}

// ─── Get User Detail ─────────────────────────────────────────────────────────

export async function getUserDetail(userId: string): Promise<UserDetail> {
  const id = toBigInt(userId)

  const userRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM users WHERE user_id = ?`,
    id,
  )
  if (!userRows[0]) throw new ApiError({ code: 'NOT_FOUND', message: `User ${userId} not found` })
  const user = userRows[0]

  const roleRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT r.role_code FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = ?`,
    id,
  )
  const roles = roleRows.map((r) => String(r.role_code ?? ''))

  const scopeRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT ps.site_code, uss.scope_level FROM user_site_scopes uss JOIN parking_sites ps ON ps.site_id = uss.site_id WHERE uss.user_id = ?`,
    id,
  )
  const siteScopes = scopeRows.map((r) => ({
    siteCode: String(r.site_code ?? ''),
    scopeLevel: String(r.scope_level ?? 'VIEWER'),
  }))

  const sessionRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT session_id, role_code, created_at, last_seen_at, access_expires_at FROM auth_user_sessions WHERE user_id = ? AND revoked_at IS NULL AND access_expires_at > NOW() ORDER BY created_at DESC LIMIT 10`,
    id,
  )
  const sessions = sessionRows.map((s) => ({
    sessionId: String(s.session_id ?? ''),
    role: String(s.role_code ?? ''),
    createdAt: s.created_at ? String(s.created_at) : null,
    lastSeenAt: s.last_seen_at ? String(s.last_seen_at) : null,
    expiresAt: String(s.access_expires_at ?? ''),
  }))

  const lastLoginRow = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT MAX(created_at) AS lastLoginAt FROM auth_user_sessions WHERE user_id = ? AND revoked_at IS NULL AND access_expires_at > NOW()`,
    id,
  )

  const activeSessionCount = sessions.length

  return {
    userId: String(user.user_id ?? ''),
    username: String(user.username ?? ''),
    status: String(user.status ?? 'ACTIVE') as 'ACTIVE' | 'DISABLED',
    roles,
    siteScopes,
    createdAt: user.created_at ? String(user.created_at) : null,
    updatedAt: user.updated_at != null ? String(user.updated_at) : null,
    lastLoginAt: lastLoginRow[0]?.lastLoginAt ? String(lastLoginRow[0].lastLoginAt) : null,
    activeSessionCount,
    sessions,
  }
}

// ─── Create User ────────────────────────────────────────────────────────────

export type CreateUserInput = {
  username: string
  password: string
  role: string
  siteScopes?: Array<{ siteCode: string; scopeLevel: string }>
  mustChangePassword?: boolean
  actorUserId?: string | bigint
}

export async function createUser(input: CreateUserInput) {
  const passwordHash = await hashPassword(input.password)

  const existing = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT user_id FROM users WHERE username = ? LIMIT 1`,
    input.username,
  )
  if (existing.length > 0) {
    throw new ApiError({
      code: 'CONFLICT',
      message: `Username '${input.username}' is already taken`,
      details: { username: input.username },
    })
  }

  const roleRow = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT role_id FROM roles WHERE role_code = ? LIMIT 1`,
    input.role,
  )
  if (!roleRow[0]) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: `Role '${input.role}' does not exist`,
      details: { role: input.role },
    })
  }
  const roleId = toBigInt(roleRow[0].role_id as string | number | bigint)

  const userId = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO users (username, password_hash, status) VALUES (?, ?, 'ACTIVE')`,
      input.username,
      passwordHash,
    )
    const idRows = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(`SELECT LAST_INSERT_ID() AS id`)
    const rawId = idRows[0]?.id
    if (rawId === undefined || rawId === null) {
      throw new ApiError({ code: 'INTERNAL_ERROR', message: 'Failed to resolve new user id after insert' })
    }
    const uid = toBigInt(rawId as string | number | bigint)

    await tx.$queryRawUnsafe(
      `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`,
      uid,
      roleId,
    )

    if (input.siteScopes && input.siteScopes.length > 0) {
      for (const scope of input.siteScopes) {
        const siteId = await resolveSiteIdByCode(scope.siteCode)
        await tx.$queryRawUnsafe(
          `INSERT INTO user_site_scopes (user_id, site_id, scope_level) VALUES (?, ?, ?)`,
          uid,
          siteId,
          scope.scopeLevel,
        )
      }
    }

    return uid
  })

  const actorId = typeof input.actorUserId === 'bigint' ? input.actorUserId : input.actorUserId ? toBigInt(input.actorUserId) : null

  await writeAuditLog({
    siteId: null,
    actorUserId: actorId,
    action: 'USER.CREATE',
    entityTable: 'users',
    entityId: userId,
    afterSnapshot: { userId: String(userId), username: input.username, role: input.role },
  })

  return { userId: String(userId), username: input.username }
}

// ─── Update User ─────────────────────────────────────────────────────────────

export type UpdateUserInput = {
  username?: string
  password?: string
  role?: string
  mustChangePassword?: boolean
  reason?: string
  actorUserId?: string | bigint
}

export async function updateUser(userId: string, input: UpdateUserInput) {
  const id = toBigInt(userId)

  const beforeRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM users WHERE user_id = ? LIMIT 1`,
    id,
  )
  if (!beforeRows[0]) throw new ApiError({ code: 'NOT_FOUND', message: `User ${userId} not found` })
  const before = beforeRows[0]

  if (input.username !== undefined) {
    const dup = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT user_id FROM users WHERE username = ? AND user_id != ? LIMIT 1`,
      input.username,
      id,
    )
    if (dup.length > 0) {
      throw new ApiError({
        code: 'CONFLICT',
        message: `Username '${input.username}' is already taken`,
        details: { username: input.username },
      })
    }
  }

  if (input.role !== undefined) {
    const roleRow = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT role_id FROM roles WHERE role_code = ? LIMIT 1`,
      input.role,
    )
    if (!roleRow[0]) {
      throw new ApiError({ code: 'BAD_REQUEST', message: `Role '${input.role}' does not exist` })
    }
    const roleId = toBigInt(roleRow[0].role_id as string | number | bigint)

    await prisma.$queryRawUnsafe(
      `DELETE FROM user_roles WHERE user_id = ?`,
      id,
    )
    await prisma.$queryRawUnsafe(
      `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`,
      id,
      roleId,
    )
  }

  if (input.password !== undefined) {
    const passwordHash = await hashPassword(input.password)
    await prisma.$queryRawUnsafe(
      `UPDATE users SET password_hash = ? WHERE user_id = ?`,
      passwordHash,
      id,
    )
  }

  if (input.username !== undefined) {
    await prisma.$queryRawUnsafe(
      `UPDATE users SET username = ? WHERE user_id = ?`,
      input.username,
      id,
    )
  }

  const afterRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM users WHERE user_id = ? LIMIT 1`,
    id,
  )

  const actorId = typeof input.actorUserId === 'bigint' ? input.actorUserId : input.actorUserId ? toBigInt(input.actorUserId) : null

  await writeAuditLog({
    siteId: null,
    actorUserId: actorId,
    action: 'USER.UPDATE',
    entityTable: 'users',
    entityId: id,
    beforeSnapshot: serializeRow(before as Record<string, unknown>),
    afterSnapshot: serializeRow(afterRows[0] as Record<string, unknown>),
  })

  return { userId: String(id), username: input.username ?? String(before.username) }
}

// ─── Set Site Scopes ────────────────────────────────────────────────────────

export async function setUserSiteScopes(
  userId: string,
  siteScopes: Array<{ siteCode: string; scopeLevel: string }>,
  actorUserId?: string | bigint,
) {
  const id = toBigInt(userId)

  const userRow = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT user_id FROM users WHERE user_id = ? LIMIT 1`,
    id,
  )
  if (!userRow[0]) throw new ApiError({ code: 'NOT_FOUND', message: `User ${userId} not found` })

  const beforeScopes = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT ps.site_code, uss.scope_level FROM user_site_scopes uss JOIN parking_sites ps ON ps.site_id = uss.site_id WHERE uss.user_id = ?`,
    id,
  )

  await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(`DELETE FROM user_site_scopes WHERE user_id = ?`, id)

    for (const scope of siteScopes) {
      const siteId = await resolveSiteIdByCode(scope.siteCode)
      await tx.$queryRawUnsafe(
        `INSERT INTO user_site_scopes (user_id, site_id, scope_level) VALUES (?, ?, ?)`,
        id,
        siteId,
        scope.scopeLevel,
      )
    }
  })

  const actorId = typeof actorUserId === 'bigint' ? actorUserId : actorUserId ? toBigInt(actorUserId) : null

  await writeAuditLog({
    siteId: null,
    actorUserId: actorId,
    action: 'USER.SITE_SCOPES_SET',
    entityTable: 'user_site_scopes',
    entityId: id,
    beforeSnapshot: beforeScopes,
    afterSnapshot: siteScopes,
  })

  return { userId: String(id), siteScopes }
}

// ─── Get My Profile ──────────────────────────────────────────────────────────

export type MyProfile = {
  userId: string
  username: string
  status: 'ACTIVE' | 'DISABLED'
  roles: string[]
  siteScopes: Array<{ siteCode: string; scopeLevel: string }>
  createdAt: string | null
}

export async function getMyProfile(userId: string | bigint): Promise<MyProfile> {
  const id = toBigInt(userId)

  const userRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM users WHERE user_id = ? LIMIT 1`,
    id,
  )
  if (!userRows[0]) throw new ApiError({ code: 'NOT_FOUND', message: 'User not found' })
  const user = userRows[0]

  const roleRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT r.role_code FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = ?`,
    id,
  )
  const roles = roleRows.map((r) => String(r.role_code ?? ''))

  const scopeRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT ps.site_code, uss.scope_level FROM user_site_scopes uss JOIN parking_sites ps ON ps.site_id = uss.site_id WHERE uss.user_id = ?`,
    id,
  )
  const siteScopes = scopeRows.map((r) => ({
    siteCode: String(r.site_code ?? ''),
    scopeLevel: String(r.scope_level ?? 'VIEWER'),
  }))

  return {
    userId: String(user.user_id ?? ''),
    username: String(user.username ?? ''),
    status: String(user.status ?? 'ACTIVE') as 'ACTIVE' | 'DISABLED',
    roles,
    siteScopes,
    createdAt: user.created_at ? String(user.created_at) : null,
  }
}

// ─── Update My Profile ────────────────────────────────────────────────────────

export type UpdateMyProfileInput = {
  password?: string
  actorUserId?: string | bigint
}

export async function updateMyProfile(userId: string, input: UpdateMyProfileInput) {
  const id = toBigInt(userId)

  const beforeRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM users WHERE user_id = ? LIMIT 1`,
    id,
  )
  if (!beforeRows[0]) throw new ApiError({ code: 'NOT_FOUND', message: 'User not found' })
  const before = beforeRows[0]

  if (input.password !== undefined) {
    const passwordHash = await hashPassword(input.password)
    await prisma.$queryRawUnsafe(
      `UPDATE users SET password_hash = ? WHERE user_id = ?`,
      passwordHash,
      id,
    )
  }

  const afterRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM users WHERE user_id = ? LIMIT 1`,
    id,
  )

  const actorId = typeof input.actorUserId === 'bigint' ? input.actorUserId : input.actorUserId ? toBigInt(input.actorUserId) : null

  await writeAuditLog({
    siteId: null,
    actorUserId: actorId,
    action: 'USER.SELF_UPDATE',
    entityTable: 'users',
    entityId: id,
    beforeSnapshot: serializeRow(before as Record<string, unknown>),
    afterSnapshot: serializeRow(afterRows[0] as Record<string, unknown>),
  })

  return { userId: String(id) }
}
