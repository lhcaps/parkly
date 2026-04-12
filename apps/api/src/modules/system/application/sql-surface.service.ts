import path from 'node:path'
import * as mariadb from 'mariadb'

import { prisma } from '../../../lib/prisma'
import { resolveSiteIdByCode } from '../../../lib/ids'
import { ApiError } from '../../../server/http'
import { resolveAuthorizedSiteScope } from '../../../server/services/read-models/site-scope'
import { createAuthService, type AuthenticatedPrincipal } from '../../auth/application/auth-service'

const MINIMUM_PER_TYPE = 20
const REQUIRED_TRIGGER_NAME = 'trg_vehicles_sync_subscription_plate'
const TRIGGER_SCRIPT_PATH = path.resolve(__dirname, '../../../../db/scripts/v34_enable_trigger_root.sql')

const MODULE_LABELS: Record<string, string> = {
  auth: 'Auth',
  dashboard: 'Dashboard',
  gate: 'Gate',
  subscription: 'Subscription',
  pricing: 'Pricing',
  incident: 'Incident',
  payment: 'Payment',
  system: 'System',
}

type SqlCatalogObject = {
  name: string
  moduleKey: string
  moduleLabel: string
  objectType?: string | null
  detail?: string | null
  objectCount?: number | null
}

type SiteOption = {
  siteId: string
  siteCode: string
  name: string
}

type DbConnOptions = {
  host: string
  port: number
  user: string
  password?: string
  database: string
}

type SqlMetadataSnapshot = {
  versionRows: Array<{ version: string | number | null }>
  viewRows: Array<{ name: string }>
  procedureRows: Array<{ name: string }>
  triggerRows: Array<{ name: string }>
  constraintRows: Array<{ name: string; objectType: string | null; detail: string | null }>
  trustFunctionCreatorsEnabled: boolean | null
}

function toNumber(value: unknown) {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : 0
}

function toId(value: unknown) {
  return value == null ? null : String(value)
}

function toIso(value: unknown) {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function stripQuotes(value: string) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function normalizeMySqlHost(host: string) {
  const trimmed = host.trim()
  if (!trimmed) return trimmed
  const preferLiteralLocalhost = String(process.env.DB_PREFER_LITERAL_LOCALHOST ?? '').trim().toUpperCase() === 'ON'
  if (!preferLiteralLocalhost && trimmed.toLowerCase() === 'localhost') return '127.0.0.1'
  return trimmed
}

function envFlag(name: string, fallback = false) {
  const raw = String(process.env[name] ?? '').trim().toUpperCase()
  if (!raw) return fallback
  return ['1', 'ON', 'TRUE', 'YES'].includes(raw)
}

function parseSplitConn(prefix: 'DATABASE' | 'DATABASE_ADMIN'): DbConnOptions | null {
  const host = process.env[`${prefix}_HOST`] ?? (prefix === 'DATABASE' ? process.env.MYSQL_HOST : undefined)
  const portRaw = process.env[`${prefix}_PORT`] ?? (prefix === 'DATABASE' ? process.env.MYSQL_PORT : undefined)
  const user = process.env[`${prefix}_USER`] ?? (prefix === 'DATABASE' ? process.env.MYSQL_USER : undefined)
  const password = process.env[`${prefix}_PASSWORD`] ?? (prefix === 'DATABASE' ? process.env.MYSQL_PASSWORD : undefined)
  const database = process.env[`${prefix}_NAME`] ?? (prefix === 'DATABASE' ? process.env.MYSQL_DB : undefined)
  if (!host || !user || !database) return null
  return {
    host: normalizeMySqlHost(host),
    port: portRaw ? Number(portRaw) : 3306,
    user,
    password,
    database,
  }
}

function parseUrlConn(rawUrl?: string): DbConnOptions | null {
  const normalized = rawUrl ? stripQuotes(rawUrl) : ''
  if (!normalized) return null
  const url = new URL(normalized)
  const database = url.pathname.replace(/^\//, '')
  if (!database) return null
  return {
    host: normalizeMySqlHost(url.hostname),
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  }
}

function resolveMetadataConnConfig() {
  return parseSplitConn('DATABASE_ADMIN') ?? parseUrlConn(process.env.DATABASE_URL_ADMIN)
}

function resolveRuntimeConnConfig() {
  const appConn = parseSplitConn('DATABASE') ?? parseUrlConn(process.env.DATABASE_URL)
  const adminConn = resolveMetadataConnConfig()
  const devFallbackDefault = process.env.NODE_ENV === 'production' ? false : true
  const useAdminFallback = envFlag('DB_RUNTIME_FALLBACK_TO_ADMIN', devFallbackDefault)
  return (useAdminFallback && adminConn) ? adminConn : (appConn ?? adminConn)
}

async function queryRuntimeProcedureRows(
  sql: string,
  params: unknown[],
): Promise<Array<Record<string, unknown>>> {
  const connConfig = resolveRuntimeConnConfig()
  if (!connConfig) {
    throw new ApiError({
      code: 'DEP_UNAVAILABLE',
      message: 'Thiếu cấu hình kết nối database để chạy SQL surface runtime',
    })
  }

  const conn = await mariadb.createConnection({
    host: connConfig.host,
    port: connConfig.port,
    user: connConfig.user,
    password: connConfig.password,
    database: connConfig.database,
    charset: 'utf8mb4',
    allowPublicKeyRetrieval: true,
    ssl: false,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5000),
  } as any)

  try {
    await conn.query(`SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci`)
    await conn.query(`SET collation_connection = 'utf8mb4_unicode_ci'`)
    const rawRows = await conn.query(sql, params)
    if (Array.isArray(rawRows) && Array.isArray(rawRows[0])) {
      return rawRows[0] as Array<Record<string, unknown>>
    }
    return rawRows as Array<Record<string, unknown>>
  } finally {
    await conn.end()
  }
}

async function loadSqlMetadataViaAdmin(): Promise<SqlMetadataSnapshot | null> {
  const connConfig = resolveMetadataConnConfig()
  if (!connConfig) return null

  const conn = await mariadb.createConnection({
    host: connConfig.host,
    port: connConfig.port,
    user: connConfig.user,
    password: connConfig.password,
    database: connConfig.database,
    allowPublicKeyRetrieval: true,
    ssl: false,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5000),
  } as any)

  try {
    const versionRows = await conn.query(
      `
        SELECT version
        FROM flyway_schema_history
        WHERE success = 1
        ORDER BY installed_rank DESC
        LIMIT 1
      `,
    )
    const viewRows = await conn.query(
      `
        SELECT table_name AS name
        FROM information_schema.views
        WHERE table_schema = DATABASE()
        ORDER BY table_name ASC
      `,
    )
    const procedureRows = await conn.query(
      `
        SELECT routine_name AS name
        FROM information_schema.routines
        WHERE routine_schema = DATABASE()
          AND routine_type = 'PROCEDURE'
        ORDER BY routine_name ASC
      `,
    )
    const triggerRows = await conn.query(
      `
        SELECT trigger_name AS name
        FROM information_schema.triggers
        WHERE trigger_schema = DATABASE()
        ORDER BY trigger_name ASC
      `,
    )
    const constraintRows = await conn.query(
      `
        SELECT
          constraint_name AS name,
          constraint_type AS objectType,
          table_name AS detail
        FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
        ORDER BY
          CASE constraint_type
            WHEN 'FOREIGN KEY' THEN 0
            WHEN 'PRIMARY KEY' THEN 1
            WHEN 'UNIQUE' THEN 2
            ELSE 3
          END,
          table_name ASC,
          constraint_name ASC
      `,
    )

    let trustFunctionCreatorsEnabled: boolean | null = null
    try {
      const trustRows = await conn.query(`SELECT @@GLOBAL.log_bin_trust_function_creators AS enabled`)
      trustFunctionCreatorsEnabled = toNumber(trustRows[0]?.enabled) === 1
    } catch {
      trustFunctionCreatorsEnabled = null
    }

    return {
      versionRows,
      viewRows,
      procedureRows,
      triggerRows,
      constraintRows,
      trustFunctionCreatorsEnabled,
    }
  } finally {
    await conn.end()
  }
}

function sqlDateTime(value: Date) {
  return value.toISOString().slice(0, 19).replace('T', ' ')
}

function buildInClause(values: string[]) {
  if (values.length === 0) {
    return {
      clause: "('')",
      params: [] as string[],
    }
  }

  return {
    clause: `(${values.map(() => '?').join(', ')})`,
    params: [...values],
  }
}

function titleCase(value: string) {
  if (!value) return 'System'
  return value.slice(0, 1).toUpperCase() + value.slice(1)
}

function deriveModuleKey(name: string) {
  const normalized = String(name ?? '').trim().toLowerCase()
  const pkgMatch = normalized.match(/^pkg_([^_]+)/)
  if (pkgMatch) return pkgMatch[1]
  if (normalized.includes('subscription')) return 'subscription'
  if (normalized.includes('pricing') || normalized.includes('tariff')) return 'pricing'
  if (normalized.includes('payment')) return 'payment'
  if (normalized.includes('incident')) return 'incident'
  if (normalized.includes('gate') || normalized.includes('lane') || normalized.includes('barrier')) return 'gate'
  if (normalized.includes('auth') || normalized.includes('session') || normalized.includes('user')) return 'auth'
  return 'system'
}

function toCatalogObjects(rows: Array<{ name: string; objectType?: string | null; detail?: string | null; objectCount?: number | null }>): SqlCatalogObject[] {
  return rows.map((row) => {
    const moduleKey = deriveModuleKey(`${row.name} ${row.detail ?? ''}`)
    return {
      name: String(row.name),
      moduleKey,
      moduleLabel: MODULE_LABELS[moduleKey] ?? titleCase(moduleKey),
      objectType: row.objectType ?? null,
      detail: row.detail ?? null,
      objectCount: row.objectCount ?? null,
    }
  })
}

async function listAllowedSites(siteCodes: string[]): Promise<SiteOption[]> {
  if (siteCodes.length === 0) return []
  const { clause, params } = buildInClause(siteCodes)
  const rows = await prisma.$queryRawUnsafe<Array<{ siteId: bigint | number | string; siteCode: string; name: string | null }>>(
    `
      SELECT site_id AS siteId, site_code AS siteCode, name
      FROM parking_sites
      WHERE site_code IN ${clause}
      ORDER BY site_code ASC
    `,
    ...params,
  )

  return rows.map((row) => ({
    siteId: String(row.siteId),
    siteCode: String(row.siteCode),
    name: row.name == null ? String(row.siteCode) : String(row.name),
  }))
}

async function listLaneHealthPreview(siteCodes: string[]) {
  if (siteCodes.length === 0) return []
  const { clause, params } = buildInClause(siteCodes)
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        lane_id AS laneId,
        siteCode,
        gateCode,
        laneCode,
        laneOperationalStatus,
        aggregateHealth,
        lastBarrierStatus,
        activePresenceCount
      FROM pkg_gate_lane_health_v
      WHERE siteCode IN ${clause}
      ORDER BY
        CASE CONVERT(aggregateHealth USING utf8mb4) COLLATE utf8mb4_unicode_ci
          WHEN _utf8mb4'BARRIER_FAULT' COLLATE utf8mb4_unicode_ci THEN 0
          WHEN _utf8mb4'OFFLINE' COLLATE utf8mb4_unicode_ci THEN 1
          WHEN _utf8mb4'DEGRADED_CAMERA' COLLATE utf8mb4_unicode_ci THEN 2
          WHEN _utf8mb4'DEGRADED_RFID' COLLATE utf8mb4_unicode_ci THEN 3
          WHEN _utf8mb4'DEGRADED_SENSOR' COLLATE utf8mb4_unicode_ci THEN 4
          WHEN _utf8mb4'DEGRADED' COLLATE utf8mb4_unicode_ci THEN 5
          ELSE 6
        END,
        siteCode ASC,
        gateCode ASC,
        laneCode ASC
      LIMIT 8
    `,
    ...params,
  )

  return rows.map((row) => ({
    laneId: String(row.laneId ?? ''),
    siteCode: String(row.siteCode ?? ''),
    gateCode: String(row.gateCode ?? ''),
    laneCode: String(row.laneCode ?? ''),
    laneOperationalStatus: String(row.laneOperationalStatus ?? ''),
    aggregateHealth: String(row.aggregateHealth ?? ''),
    lastBarrierStatus: row.lastBarrierStatus == null ? null : String(row.lastBarrierStatus),
    activePresenceCount: toNumber(row.activePresenceCount),
  }))
}

async function listQueuePreview(siteCodes: string[]) {
  if (siteCodes.length === 0) return []
  const { clause, params } = buildInClause(siteCodes)
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        sessionId,
        siteId,
        siteCode,
        laneId,
        laneCode,
        status,
        plateCompact,
        reviewRequired,
        activePresenceCount,
        openManualReviewCount,
        openedAt
      FROM pkg_gate_active_queue_v
      WHERE siteCode IN ${clause}
        AND status IN ('OPEN', 'WAITING_READ', 'WAITING_DECISION', 'APPROVED', 'WAITING_PAYMENT')
      ORDER BY openedAt DESC, sessionId DESC
      LIMIT 8
    `,
    ...params,
  )

  return rows.map((row) => ({
    sessionId: String(row.sessionId ?? ''),
    siteId: String(row.siteId ?? ''),
    siteCode: String(row.siteCode ?? ''),
    laneId: String(row.laneId ?? ''),
    laneCode: String(row.laneCode ?? ''),
    status: String(row.status ?? ''),
    plateCompact: row.plateCompact == null ? null : String(row.plateCompact),
    reviewRequired: Boolean(row.reviewRequired),
    activePresenceCount: toNumber(row.activePresenceCount),
    openManualReviewCount: toNumber(row.openManualReviewCount),
    openedAt: toIso(row.openedAt),
  }))
}

async function listActiveSessionPreview() {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        session_id AS sessionId,
        user_id AS userId,
        username,
        role_code AS roleCode,
        session_state AS sessionState,
        last_seen_at AS lastSeenAt,
        created_at AS createdAt
      FROM pkg_auth_active_sessions_v
      WHERE active_flag = 1
      ORDER BY COALESCE(last_seen_at, created_at) DESC, created_at DESC
      LIMIT 8
    `,
  )

  return rows.map((row) => ({
    sessionId: String(row.sessionId ?? ''),
    userId: String(row.userId ?? ''),
    username: String(row.username ?? ''),
    roleCode: String(row.roleCode ?? ''),
    sessionState: String(row.sessionState ?? ''),
    lastSeenAt: toIso(row.lastSeenAt),
    createdAt: toIso(row.createdAt),
  }))
}

async function readSingleLane(laneId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        lane_id AS laneId,
        siteCode,
        gateCode,
        laneCode,
        laneOperationalStatus,
        aggregateHealth,
        lastBarrierStatus,
        activePresenceCount
      FROM pkg_gate_lane_health_v
      WHERE lane_id = ?
      LIMIT 1
    `,
    laneId,
  )
  return rows[0] ?? null
}

async function readSingleQueueSession(sessionId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        sessionId,
        siteId,
        siteCode,
        laneId,
        laneCode,
        status,
        plateCompact,
        reviewRequired,
        activePresenceCount,
        openManualReviewCount,
        openedAt
      FROM pkg_gate_active_queue_v
      WHERE sessionId = ?
      LIMIT 1
    `,
    sessionId,
  )
  return rows[0] ?? null
}

function ensureSiteAccess(principal: AuthenticatedPrincipal, allowedSiteCodes: string[], targetSiteCode: string, label: string) {
  if (principal.principalType === 'SERVICE') return
  if (allowedSiteCodes.includes(targetSiteCode)) return
  throw new ApiError({
    code: 'FORBIDDEN',
    message: `Không có quyền thao tác ${label} tại site ${targetSiteCode}`,
  })
}

export async function getSqlSurfaceSnapshot(args: {
  principal: AuthenticatedPrincipal
  requestedSiteCode?: string | null
}) {
  const scope = await resolveAuthorizedSiteScope({
    principal: args.principal,
    requestedSiteCode: args.requestedSiteCode ?? null,
    resourceLabel: 'sql surface',
    allowEmpty: true,
  })

  const [
    metadata,
    siteOptions,
    activeSessions,
    laneHealth,
    activeQueue,
  ] = await Promise.all([
    loadSqlMetadataViaAdmin().catch(() => null),
    listAllowedSites(scope.siteCodes),
    listActiveSessionPreview(),
    listLaneHealthPreview(scope.siteCodes),
    listQueuePreview(scope.siteCodes),
  ])

  const versionRows = metadata?.versionRows ?? await prisma.$queryRawUnsafe<Array<{ version: string | number | null }>>(
    `
      SELECT version
      FROM flyway_schema_history
      WHERE success = 1
      ORDER BY installed_rank DESC
      LIMIT 1
    `,
  ).catch(() => [])

  const viewRows = metadata?.viewRows ?? await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `
      SELECT table_name AS name
      FROM information_schema.views
      WHERE table_schema = DATABASE()
      ORDER BY table_name ASC
    `,
  )

  const procedureRows = metadata?.procedureRows ?? await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `
      SELECT routine_name AS name
      FROM information_schema.routines
      WHERE routine_schema = DATABASE()
        AND routine_type = 'PROCEDURE'
      ORDER BY routine_name ASC
    `,
  )

  const triggerRows = metadata?.triggerRows ?? await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `
      SELECT trigger_name AS name
      FROM information_schema.triggers
      WHERE trigger_schema = DATABASE()
      ORDER BY trigger_name ASC
    `,
  )

  const constraintRows = metadata?.constraintRows ?? await prisma.$queryRawUnsafe<Array<{ name: string; objectType: string | null; detail: string | null }>>(
    `
      SELECT
        constraint_name AS name,
        constraint_type AS objectType,
        table_name AS detail
      FROM information_schema.table_constraints
      WHERE constraint_schema = DATABASE()
      ORDER BY
        CASE constraint_type
          WHEN 'FOREIGN KEY' THEN 0
          WHEN 'PRIMARY KEY' THEN 1
          WHEN 'UNIQUE' THEN 2
          ELSE 3
        END,
        table_name ASC,
        constraint_name ASC
    `,
  )

  let trustFunctionCreatorsEnabled: boolean | null = metadata?.trustFunctionCreatorsEnabled ?? null
  if (trustFunctionCreatorsEnabled == null) {
    try {
      const trustRows = await prisma.$queryRawUnsafe<Array<{ enabled: bigint | number | string | null }>>(
        `SELECT @@GLOBAL.log_bin_trust_function_creators AS enabled`,
      )
      trustFunctionCreatorsEnabled = toNumber(trustRows[0]?.enabled) === 1
    } catch {
      trustFunctionCreatorsEnabled = null
    }
  }

  const views = toCatalogObjects(viewRows.map((row) => ({ ...row, objectType: 'VIEW' })))
  const procedures = toCatalogObjects(procedureRows.map((row) => ({ ...row, objectType: 'PROCEDURE' })))
  const triggers = toCatalogObjects(triggerRows.map((row) => ({ ...row, objectType: 'TRIGGER' })))
  const constraints = toCatalogObjects(constraintRows.map((row) => ({ ...row, objectType: row.objectType ?? 'CONSTRAINT' })))

  const moduleMap = new Map<string, {
    moduleKey: string
    moduleLabel: string
    views: string[]
    procedures: string[]
    triggers: string[]
    constraints: string[]
    total: number
  }>()

  for (const item of views) {
    const current = moduleMap.get(item.moduleKey) ?? {
      moduleKey: item.moduleKey,
      moduleLabel: item.moduleLabel,
      views: [],
      procedures: [],
      triggers: [],
      constraints: [],
      total: 0,
    }
    current.views.push(item.name)
    current.total += 1
    moduleMap.set(item.moduleKey, current)
  }

  for (const item of procedures) {
    const current = moduleMap.get(item.moduleKey) ?? {
      moduleKey: item.moduleKey,
      moduleLabel: item.moduleLabel,
      views: [],
      procedures: [],
      triggers: [],
      constraints: [],
      total: 0,
    }
    current.procedures.push(item.name)
    current.total += 1
    moduleMap.set(item.moduleKey, current)
  }

  for (const item of triggers) {
    const current = moduleMap.get(item.moduleKey) ?? {
      moduleKey: item.moduleKey,
      moduleLabel: item.moduleLabel,
      views: [],
      procedures: [],
      triggers: [],
      constraints: [],
      total: 0,
    }
    current.triggers.push(item.name)
    current.total += 1
    moduleMap.set(item.moduleKey, current)
  }

  for (const item of constraints) {
    const current = moduleMap.get(item.moduleKey) ?? {
      moduleKey: item.moduleKey,
      moduleLabel: item.moduleLabel,
      views: [],
      procedures: [],
      triggers: [],
      constraints: [],
      total: 0,
    }
    current.constraints.push(item.name)
    current.total += 1
    moduleMap.set(item.moduleKey, current)
  }

  const moduleGroups = [...moduleMap.values()]
    .map((group) => ({
      ...group,
      views: [...group.views].sort((left, right) => left.localeCompare(right)),
      procedures: [...group.procedures].sort((left, right) => left.localeCompare(right)),
      triggers: [...group.triggers].sort((left, right) => left.localeCompare(right)),
      constraints: [...group.constraints].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => {
      if (right.total !== left.total) return right.total - left.total
      return left.moduleLabel.localeCompare(right.moduleLabel)
    })

  const counts = {
    views: views.length,
    procedures: procedures.length,
    triggers: triggers.length,
    constraints: constraints.length,
  }

  const missingRequiredTriggers = [REQUIRED_TRIGGER_NAME].filter(
    (name) => !triggers.some((trigger) => trigger.name === name),
  )

  return {
    schemaVersion: toNumber(versionRows[0]?.version) || null,
    minimumPerType: MINIMUM_PER_TYPE,
    counts,
    readiness: {
      viewsReady: counts.views >= MINIMUM_PER_TYPE,
      proceduresReady: counts.procedures >= MINIMUM_PER_TYPE,
      triggersReady: counts.triggers >= MINIMUM_PER_TYPE,
    },
    triggerGap: {
      requiredTriggerName: REQUIRED_TRIGGER_NAME,
      missingCount: Math.max(0, MINIMUM_PER_TYPE - counts.triggers),
      missingRequiredTriggers,
      trustFunctionCreatorsEnabled,
      scriptPath: TRIGGER_SCRIPT_PATH,
      commands: [
        `mysql -u root -p < "${TRIGGER_SCRIPT_PATH}"`,
        `mysql -u root -p -D parking_mgmt -e "SELECT COUNT(*) AS trigger_count FROM information_schema.triggers WHERE trigger_schema = 'parking_mgmt';"`,
      ],
    },
    siteScope: {
      requestedSiteCode: scope.requestedSiteCode,
      siteCodes: scope.siteCodes,
      siteCount: scope.siteCount,
      isAllSites: scope.isAllSites,
      sites: siteOptions,
    },
    objects: {
      views,
      procedures,
      triggers,
      constraints,
    },
    moduleGroups,
    previews: {
      activeSessions,
      laneHealth,
      activeQueue,
    },
  }
}

export async function cleanupSqlAuthSessions() {
  const authService = createAuthService()
  return authService.cleanupExpiredSessions()
}

export async function revokeSqlUserSessions(args: {
  principal: AuthenticatedPrincipal
  targetUserId: string
  exceptSessionId?: string | null
  reason?: string | null
}) {
  const authService = createAuthService()
  return authService.revokeAllUserSessions({
    targetUserId: args.targetUserId,
    actor: args.principal,
    exceptSessionId: args.exceptSessionId ?? null,
    reason: args.reason ?? 'SQL_SURFACE_REVOKE',
  })
}

export async function forceSqlLaneRecovery(args: {
  principal: AuthenticatedPrincipal
  laneId: string
}) {
  const scope = await resolveAuthorizedSiteScope({
    principal: args.principal,
    resourceLabel: 'lane recovery',
  })

  const existing = await readSingleLane(args.laneId)
  if (!existing) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Lane không tồn tại trong SQL surface hiện tại' })
  }

  ensureSiteAccess(args.principal, scope.siteCodes, String(existing.siteCode ?? ''), 'lane recovery')

  await prisma.$executeRawUnsafe(`CALL pkg_gate_force_lane_recovery(?)`, args.laneId)

  const updated = await readSingleLane(args.laneId)
  return {
    laneId: String(existing.laneId ?? args.laneId),
    siteCode: String(existing.siteCode ?? ''),
    gateCode: String(existing.gateCode ?? ''),
    laneCode: String(existing.laneCode ?? ''),
    before: {
      aggregateHealth: String(existing.aggregateHealth ?? ''),
      laneOperationalStatus: String(existing.laneOperationalStatus ?? ''),
      lastBarrierStatus: existing.lastBarrierStatus == null ? null : String(existing.lastBarrierStatus),
    },
    after: updated == null ? null : {
      aggregateHealth: String(updated.aggregateHealth ?? ''),
      laneOperationalStatus: String(updated.laneOperationalStatus ?? ''),
      lastBarrierStatus: updated.lastBarrierStatus == null ? null : String(updated.lastBarrierStatus),
    },
  }
}

export async function createSqlManualReview(args: {
  principal: AuthenticatedPrincipal
  sessionId: string
  queueReasonCode?: string | null
  note?: string | null
}) {
  const scope = await resolveAuthorizedSiteScope({
    principal: args.principal,
    resourceLabel: 'manual review',
  })

  const existing = await readSingleQueueSession(args.sessionId)
  if (!existing) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Session không còn nằm trong hàng đợi hoạt động' })
  }
  if (toNumber(existing.openManualReviewCount) > 0) {
    throw new ApiError({
      code: 'CONFLICT',
      message: 'Session đã có manual review đang mở',
      details: {
        sessionId: String(existing.sessionId ?? args.sessionId),
        openManualReviewCount: toNumber(existing.openManualReviewCount),
      },
    })
  }

  ensureSiteAccess(args.principal, scope.siteCodes, String(existing.siteCode ?? ''), 'manual review')

  await prisma.$executeRawUnsafe(
    `CALL pkg_gate_create_manual_review(?, ?, ?, ?, ?)`,
    args.sessionId,
    String(existing.siteId ?? ''),
    String(existing.laneId ?? ''),
    args.queueReasonCode ?? 'SQL_SURFACE_REVIEW',
    args.note ?? 'Manual review opened from SQL surface',
  )

  const updated = await readSingleQueueSession(args.sessionId)
  return {
    sessionId: String(existing.sessionId ?? args.sessionId),
    siteCode: String(existing.siteCode ?? ''),
    laneCode: String(existing.laneCode ?? ''),
    plateCompact: existing.plateCompact == null ? null : String(existing.plateCompact),
    openManualReviewCount: toNumber(updated?.openManualReviewCount ?? existing.openManualReviewCount),
  }
}

export async function quoteSqlTicketPrice(args: {
  principal: AuthenticatedPrincipal
  siteCode: string
  vehicleType: 'CAR' | 'MOTORBIKE'
  entryTime: Date
  exitTime: Date
}) {
  if (Number.isNaN(args.entryTime.getTime()) || Number.isNaN(args.exitTime.getTime())) {
    throw new ApiError({ code: 'BAD_REQUEST', message: 'entryTime hoặc exitTime không hợp lệ' })
  }
  if (args.exitTime.getTime() < args.entryTime.getTime()) {
    throw new ApiError({ code: 'BAD_REQUEST', message: 'exitTime phải lớn hơn hoặc bằng entryTime' })
  }

  await resolveAuthorizedSiteScope({
    principal: args.principal,
    requestedSiteCode: args.siteCode,
    resourceLabel: 'pricing quote',
  })

  const siteId = await resolveSiteIdByCode(args.siteCode)
  const rows = await queryRuntimeProcedureRows(
    `CALL pkg_pricing_quote_ticket(?, ?, ?, ?)`,
    [
      siteId.toString(),
      args.vehicleType,
      sqlDateTime(args.entryTime),
      sqlDateTime(args.exitTime),
    ],
  )

  const row = rows[0] ?? {}
  return {
    siteCode: args.siteCode,
    vehicleType: args.vehicleType,
    tariffId: toId(row.tariff_id ?? row.tariffId),
    minutes: toNumber(row.minutes),
    freeMinutes: toNumber(row.free_minutes ?? row.freeMinutes),
    perHour: toNumber(row.per_hour ?? row.perHour),
    dailyCap: row.daily_cap == null && row.dailyCap == null ? null : toNumber(row.daily_cap ?? row.dailyCap),
    subtotal: toNumber(row.subtotal),
    total: toNumber(row.total),
  }
}
