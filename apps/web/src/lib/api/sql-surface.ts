import { apiFetch, postJson } from '@/lib/http/client'

export type SqlCatalogObject = {
  name: string
  moduleKey: string
  moduleLabel: string
  objectType?: string | null
  detail?: string | null
  objectCount?: number | null
}

export type SqlSurfaceSnapshot = {
  schemaVersion: number | null
  minimumPerType: number
  counts: {
    views: number
    procedures: number
    triggers: number
    constraints: number
  }
  readiness: {
    viewsReady: boolean
    proceduresReady: boolean
    triggersReady: boolean
  }
  triggerGap: {
    requiredTriggerName: string
    missingCount: number
    missingRequiredTriggers: string[]
    trustFunctionCreatorsEnabled: boolean | null
    scriptPath: string
    commands: string[]
  }
  siteScope: {
    requestedSiteCode: string | null
    siteCodes: string[]
    siteCount: number
    isAllSites: boolean
    sites: Array<{
      siteId: string
      siteCode: string
      name: string
    }>
  }
  objects: {
    views: SqlCatalogObject[]
    procedures: SqlCatalogObject[]
    triggers: SqlCatalogObject[]
    constraints: SqlCatalogObject[]
  }
  moduleGroups: Array<{
    moduleKey: string
    moduleLabel: string
    views: string[]
    procedures: string[]
    triggers: string[]
    constraints: string[]
    total: number
  }>
  previews: {
    activeSessions: Array<{
      sessionId: string
      userId: string
      username: string
      roleCode: string
      sessionState: string
      lastSeenAt: string | null
      createdAt: string | null
    }>
    laneHealth: Array<{
      laneId: string
      siteCode: string
      gateCode: string
      laneCode: string
      laneOperationalStatus: string
      aggregateHealth: string
      lastBarrierStatus: string | null
      activePresenceCount: number
    }>
    activeQueue: Array<{
      sessionId: string
      siteId: string
      siteCode: string
      laneId: string
      laneCode: string
      status: string
      plateCompact: string | null
      reviewRequired: boolean
      activePresenceCount: number
      openManualReviewCount: number
      openedAt: string | null
    }>
  }
}

export type SqlAuthCleanupResult = {
  deletedExpired: number
  deletedRevoked: number
  retentionDays: {
    expired: number
    revoked: number
  }
}

export type SqlRevokeSessionsResult = {
  user: {
    userId: string
    username: string
  }
  revokedSessionIds: string[]
}

export type SqlLaneRecoveryResult = {
  laneId: string
  siteCode: string
  gateCode: string
  laneCode: string
  before: {
    aggregateHealth: string
    laneOperationalStatus: string
    lastBarrierStatus: string | null
  }
  after: {
    aggregateHealth: string
    laneOperationalStatus: string
    lastBarrierStatus: string | null
  } | null
}

export type SqlManualReviewResult = {
  sessionId: string
  siteCode: string
  laneCode: string
  plateCompact: string | null
  openManualReviewCount: number
}

export type SqlPricingQuoteResult = {
  siteCode: string
  vehicleType: 'CAR' | 'MOTORBIKE'
  tariffId: string | null
  minutes: number
  freeMinutes: number
  perHour: number
  dailyCap: number | null
  subtotal: number
  total: number
}

function normalizeCatalogObjects(items: unknown, fallbackObjectType?: string) {
  if (!Array.isArray(items)) return [] as SqlCatalogObject[]

  return items.map((item) => {
    const row = (item ?? {}) as Partial<SqlCatalogObject>
    return {
      name: String(row.name ?? ''),
      moduleKey: String(row.moduleKey ?? 'system'),
      moduleLabel: String(row.moduleLabel ?? 'System'),
      objectType: row.objectType ?? fallbackObjectType ?? null,
      detail: row.detail ?? null,
      objectCount: typeof row.objectCount === 'number' ? row.objectCount : null,
    } satisfies SqlCatalogObject
  })
}

function normalizeModuleGroups(items: unknown) {
  if (!Array.isArray(items)) return [] as SqlSurfaceSnapshot['moduleGroups']

  return items.map((item) => {
    const row = (item ?? {}) as Partial<SqlSurfaceSnapshot['moduleGroups'][number]>
    const views = Array.isArray(row.views) ? row.views.map((value) => String(value)) : []
    const procedures = Array.isArray(row.procedures) ? row.procedures.map((value) => String(value)) : []
    const triggers = Array.isArray(row.triggers) ? row.triggers.map((value) => String(value)) : []
    const constraints = Array.isArray(row.constraints) ? row.constraints.map((value) => String(value)) : []
    const total =
      typeof row.total === 'number'
        ? row.total
        : views.length + procedures.length + triggers.length + constraints.length

    return {
      moduleKey: String(row.moduleKey ?? 'system'),
      moduleLabel: String(row.moduleLabel ?? 'System'),
      views,
      procedures,
      triggers,
      constraints,
      total,
    }
  })
}

function normalizeSqlSurfaceSnapshot(snapshot: SqlSurfaceSnapshot) {
  const objects = snapshot.objects ?? ({} as SqlSurfaceSnapshot['objects'])
  const views = normalizeCatalogObjects(objects.views, 'VIEW')
  const procedures = normalizeCatalogObjects(objects.procedures, 'PROCEDURE')
  const triggers = normalizeCatalogObjects(objects.triggers, 'TRIGGER')
  const constraints = normalizeCatalogObjects(objects.constraints, 'CONSTRAINT')

  return {
    ...snapshot,
    counts: {
      ...snapshot.counts,
      constraints:
        typeof snapshot.counts?.constraints === 'number'
          ? snapshot.counts.constraints
          : constraints.length,
    },
    objects: {
      views,
      procedures,
      triggers,
      constraints,
    },
    moduleGroups: normalizeModuleGroups(snapshot.moduleGroups),
  } satisfies SqlSurfaceSnapshot
}

export function getSqlSurfaceSnapshot() {
  return apiFetch<SqlSurfaceSnapshot>('/api/ops/sql-surface').then(normalizeSqlSurfaceSnapshot)
}

export function runSqlAuthCleanup() {
  return postJson<SqlAuthCleanupResult>('/api/ops/sql-surface/actions/auth-cleanup', {})
}

export function revokeSqlUserSessions(body: {
  targetUserId: string
  exceptSessionId?: string | null
  reason?: string | null
}) {
  return postJson<SqlRevokeSessionsResult>('/api/ops/sql-surface/actions/revoke-user-sessions', body)
}

export function forceSqlLaneRecovery(body: { laneId: string }) {
  return postJson<SqlLaneRecoveryResult>('/api/ops/sql-surface/actions/force-lane-recovery', body)
}

export function createSqlManualReview(body: {
  sessionId: string
  queueReasonCode?: string | null
  note?: string | null
}) {
  return postJson<SqlManualReviewResult>('/api/ops/sql-surface/actions/create-manual-review', body)
}

export function quoteSqlTicketPrice(body: {
  siteCode: string
  vehicleType: 'CAR' | 'MOTORBIKE'
  entryTime: string
  exitTime: string
}) {
  return postJson<SqlPricingQuoteResult>('/api/ops/sql-surface/actions/pricing-quote', body)
}
