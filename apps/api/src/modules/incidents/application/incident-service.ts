import { prisma } from '../../../lib/prisma'
import type { AppRole } from '../../../server/config'
import { ApiError } from '../../../server/http'
import { buildAuditActorSnapshot, writeAuditLog } from '../../../server/services/audit-service'
import { observeIncidentLifecycle } from '../../../server/metrics'
import { publishIncidentEnvelope } from './incident-bus'
import {
  buildProjectionIncidentSignal,
  computeNoiseHitCount,
  decorateIncidentSnapshot,
  readIncidentNoiseState,
  shouldReopenResolvedIncident,
  shouldSuppressRecurringSignal,
  withIncidentNoiseState,
  type IncidentNoiseControlConfig,
} from './incident-noise-policy'
import type { SpotProjectionRow } from '../../reconciliation/application/run-reconciliation'

export type IncidentStatus = 'OPEN' | 'ACKED' | 'RESOLVED' | 'IGNORED'
export type IncidentSeverity = 'INFO' | 'WARN' | 'CRITICAL'
export type IncidentResolveAction = 'WARNING_ACKNOWLEDGED' | 'WHEEL_LOCK_REQUESTED' | 'DISMISSED' | 'IGNORED' | 'RESOLVED'
export type IncidentActor = { role: AppRole | 'SYSTEM'; actorUserId?: bigint | number | null; actorLabel?: string | null }

export type IncidentSummary = {
  incidentId: string
  siteId: string
  siteCode: string | null
  laneId: string | null
  laneCode: string | null
  deviceId: string | null
  deviceCode: string | null
  sessionId: string | null
  severity: IncidentSeverity
  status: IncidentStatus
  incidentType: string
  title: string
  detail: string | null
  sourceKey: string | null
  resolutionAction: string | null
  resolvedByUserId: string | null
  resolvedByRole: string | null
  evidenceMediaId: string | null
  lastSignalAt: string | null
  snapshot: Record<string, unknown>
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

export type IncidentHistoryEntry = {
  historyId: string
  incidentId: string
  actionCode: string
  previousStatus: IncidentStatus | null
  nextStatus: IncidentStatus | null
  actorRole: string | null
  actorUserId: string | null
  note: string | null
  evidenceMediaId: string | null
  snapshotBefore: Record<string, unknown>
  snapshotAfter: Record<string, unknown>
  createdAt: string
}

export type IncidentDetail = IncidentSummary & { history: IncidentHistoryEntry[] }

type IncidentStore = {
  findActiveBySourceKey(sourceKey: string): Promise<IncidentSummary | null>
  findById(incidentId: string): Promise<IncidentSummary | null>
  findLatestBySourceKey?(sourceKey: string): Promise<IncidentSummary | null>
  createIncident(input: {
    sessionId?: string | null
    siteId: string
    laneId?: string | null
    deviceId?: string | null
    severity: IncidentSeverity
    status: IncidentStatus
    incidentType: string
    title: string
    detail?: string | null
    sourceKey?: string | null
    snapshot?: Record<string, unknown>
    lastSignalAt?: string | null
  }): Promise<IncidentSummary>
  updateIncident(incidentId: string, patch: {
    status?: IncidentStatus
    severity?: IncidentSeverity
    incidentType?: string
    title?: string
    detail?: string | null
    sourceKey?: string | null
    snapshot?: Record<string, unknown>
    resolutionAction?: string | null
    resolvedByUserId?: string | null
    resolvedByRole?: string | null
    evidenceMediaId?: string | null
    lastSignalAt?: string | null
    resolvedAt?: string | null
  }): Promise<IncidentSummary>
  listIncidents(args: {
    siteCode?: string | null
    status?: string | null
    severity?: string | null
    incidentType?: string | null
    sourceKey?: string | null
    cursor?: string | null
    limit?: number
  }): Promise<{ rows: IncidentSummary[]; nextCursor: string | null; hasMore: boolean }>
  listIncidentHistory(incidentId: string): Promise<IncidentHistoryEntry[]>
  appendHistory(args: {
    incidentId: string
    actionCode: string
    previousStatus?: IncidentStatus | null
    nextStatus?: IncidentStatus | null
    actorRole?: string | null
    actorUserId?: string | null
    note?: string | null
    evidenceMediaId?: string | null
    snapshotBefore?: Record<string, unknown>
    snapshotAfter?: Record<string, unknown>
  }): Promise<IncidentHistoryEntry>
}

type IncidentDeps = {
  store: IncidentStore
  publish: typeof publishIncidentEnvelope
  now: () => Date
  noiseControl?: Partial<IncidentNoiseControlConfig>
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    } catch { return {} }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function toId(value: unknown) { return value == null ? null : String(value) }
function toIso(value: unknown) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function mapIncidentRow(row: any): IncidentSummary {
  return {
    incidentId: String(row.incidentId),
    siteId: String(row.siteId),
    siteCode: row.siteCode == null ? null : String(row.siteCode),
    laneId: toId(row.laneId),
    laneCode: row.laneCode == null ? null : String(row.laneCode),
    deviceId: toId(row.deviceId),
    deviceCode: row.deviceCode == null ? null : String(row.deviceCode),
    sessionId: toId(row.sessionId),
    severity: String(row.severity) as IncidentSeverity,
    status: String(row.status) as IncidentStatus,
    incidentType: String(row.incidentType),
    title: String(row.title),
    detail: row.detail == null ? null : String(row.detail),
    sourceKey: row.sourceKey == null ? null : String(row.sourceKey),
    resolutionAction: row.resolutionAction == null ? null : String(row.resolutionAction),
    resolvedByUserId: toId(row.resolvedByUserId),
    resolvedByRole: row.resolvedByRole == null ? null : String(row.resolvedByRole),
    evidenceMediaId: toId(row.evidenceMediaId),
    lastSignalAt: toIso(row.lastSignalAt),
    snapshot: parseJsonObject(row.snapshotJson),
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date(0).toISOString(),
    resolvedAt: toIso(row.resolvedAt),
  }
}

function mapHistoryRow(row: any): IncidentHistoryEntry {
  return {
    historyId: String(row.historyId),
    incidentId: String(row.incidentId),
    actionCode: String(row.actionCode),
    previousStatus: row.previousStatus == null ? null : String(row.previousStatus) as IncidentStatus,
    nextStatus: row.nextStatus == null ? null : String(row.nextStatus) as IncidentStatus,
    actorRole: row.actorRole == null ? null : String(row.actorRole),
    actorUserId: toId(row.actorUserId),
    note: row.note == null ? null : String(row.note),
    evidenceMediaId: toId(row.evidenceMediaId),
    snapshotBefore: parseJsonObject(row.snapshotBeforeJson),
    snapshotAfter: parseJsonObject(row.snapshotAfterJson),
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
  }
}

function rowSelectSql() {
  return `
    SELECT
      gi.incident_id AS incidentId,
      gi.site_id AS siteId,
      ps.site_code AS siteCode,
      gi.lane_id AS laneId,
      gl.lane_code AS laneCode,
      gi.device_id AS deviceId,
      gd.device_code AS deviceCode,
      gi.session_id AS sessionId,
      gi.severity AS severity,
      gi.status AS status,
      gi.incident_type AS incidentType,
      gi.title AS title,
      gi.detail AS detail,
      gi.source_key AS sourceKey,
      gi.resolution_action AS resolutionAction,
      gi.resolved_by_user_id AS resolvedByUserId,
      gi.resolved_by_role AS resolvedByRole,
      gi.evidence_media_id AS evidenceMediaId,
      gi.last_signal_at AS lastSignalAt,
      gi.snapshot_json AS snapshotJson,
      gi.created_at AS createdAt,
      gi.updated_at AS updatedAt,
      gi.resolved_at AS resolvedAt
    FROM gate_incidents gi
    JOIN parking_sites ps ON ps.site_id = gi.site_id
    LEFT JOIN gate_lanes gl ON gl.lane_id = gi.lane_id
    LEFT JOIN gate_devices gd ON gd.device_id = gi.device_id
  `
}

export function getDefaultIncidentDeps(): IncidentDeps {
  const store: IncidentStore = {
    findActiveBySourceKey: async (sourceKey) => {
      const rows = await prisma.$queryRawUnsafe<any[]>(`${rowSelectSql()} WHERE gi.source_key = ? AND gi.status IN ('OPEN','ACKED') ORDER BY gi.incident_id DESC LIMIT 1`, sourceKey)
      return rows[0] ? mapIncidentRow(rows[0]) : null
    },
    findById: async (incidentId) => {
      const rows = await prisma.$queryRawUnsafe<any[]>(`${rowSelectSql()} WHERE gi.incident_id = ? LIMIT 1`, incidentId)
      return rows[0] ? mapIncidentRow(rows[0]) : null
    },
    findLatestBySourceKey: async (sourceKey) => {
      const rows = await prisma.$queryRawUnsafe<any[]>(`${rowSelectSql()} WHERE gi.source_key = ? ORDER BY gi.incident_id DESC LIMIT 1`, sourceKey)
      return rows[0] ? mapIncidentRow(rows[0]) : null
    },
    createIncident: async (input) => {
      const created = await (prisma as any).gate_incidents.create({
        data: {
          session_id: input.sessionId == null ? null : BigInt(input.sessionId),
          site_id: BigInt(input.siteId),
          lane_id: input.laneId == null ? null : BigInt(input.laneId),
          device_id: input.deviceId == null ? null : BigInt(input.deviceId),
          severity: input.severity,
          status: input.status,
          incident_type: input.incidentType,
          title: input.title,
          detail: input.detail ?? null,
          source_key: input.sourceKey ?? null,
          snapshot_json: input.snapshot ?? {},
          last_signal_at: input.lastSignalAt == null ? null : new Date(input.lastSignalAt),
        },
      })
      return (await store.findById(String(created.incident_id))) as IncidentSummary
    },
    updateIncident: async (incidentId, patch) => {
      await (prisma as any).gate_incidents.update({
        where: { incident_id: BigInt(incidentId) },
        data: {
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.severity !== undefined ? { severity: patch.severity } : {}),
          ...(patch.incidentType !== undefined ? { incident_type: patch.incidentType } : {}),
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.detail !== undefined ? { detail: patch.detail } : {}),
          ...(patch.sourceKey !== undefined ? { source_key: patch.sourceKey } : {}),
          ...(patch.snapshot !== undefined ? { snapshot_json: patch.snapshot } : {}),
          ...(patch.resolutionAction !== undefined ? { resolution_action: patch.resolutionAction } : {}),
          ...(patch.resolvedByUserId !== undefined ? { resolved_by_user_id: patch.resolvedByUserId == null ? null : BigInt(patch.resolvedByUserId) } : {}),
          ...(patch.resolvedByRole !== undefined ? { resolved_by_role: patch.resolvedByRole } : {}),
          ...(patch.evidenceMediaId !== undefined ? { evidence_media_id: patch.evidenceMediaId == null ? null : BigInt(patch.evidenceMediaId) } : {}),
          ...(patch.lastSignalAt !== undefined ? { last_signal_at: patch.lastSignalAt == null ? null : new Date(patch.lastSignalAt) } : {}),
          ...(patch.resolvedAt !== undefined ? { resolved_at: patch.resolvedAt == null ? null : new Date(patch.resolvedAt) } : {}),
        },
      })
      return (await store.findById(incidentId)) as IncidentSummary
    },
    listIncidents: async ({ siteCode, status, severity, incidentType, sourceKey, cursor, limit }) => {
      const pageSize = Math.min(200, Math.max(1, Number(limit ?? 50)))
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `${rowSelectSql()}
         WHERE (? IS NULL OR ps.site_code = ?)
           AND (? IS NULL OR gi.status = ?)
           AND (? IS NULL OR gi.severity = ?)
           AND (? IS NULL OR gi.incident_type = ?)
           AND (? IS NULL OR gi.source_key = ?)
           AND (? IS NULL OR gi.incident_id < ?)
         ORDER BY gi.incident_id DESC
         LIMIT ?`,
        siteCode ?? null, siteCode ?? null,
        status ?? null, status ?? null,
        severity ?? null, severity ?? null,
        incidentType ?? null, incidentType ?? null,
        sourceKey ?? null, sourceKey ?? null,
        cursor ?? null, cursor ?? null,
        pageSize + 1,
      )
      const hasMore = rows.length > pageSize
      const page = rows.slice(0, pageSize).map(mapIncidentRow)
      return { rows: page, hasMore, nextCursor: hasMore && page.length > 0 ? page[page.length - 1].incidentId : null }
    },
    listIncidentHistory: async (incidentId) => {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT h.history_id AS historyId, h.incident_id AS incidentId, h.action_code AS actionCode, h.previous_status AS previousStatus, h.next_status AS nextStatus, h.actor_role AS actorRole, h.actor_user_id AS actorUserId, h.note AS note, h.evidence_media_id AS evidenceMediaId, h.snapshot_before_json AS snapshotBeforeJson, h.snapshot_after_json AS snapshotAfterJson, h.created_at AS createdAt FROM gate_incident_history h WHERE h.incident_id = ? ORDER BY h.history_id ASC`,
        incidentId,
      )
      return rows.map(mapHistoryRow)
    },
    appendHistory: async (args) => {
      const created = await (prisma as any).gate_incident_history.create({
        data: {
          incident_id: BigInt(args.incidentId),
          action_code: args.actionCode,
          previous_status: args.previousStatus ?? null,
          next_status: args.nextStatus ?? null,
          actor_role: args.actorRole ?? null,
          actor_user_id: args.actorUserId == null ? null : BigInt(args.actorUserId),
          note: args.note ?? null,
          evidence_media_id: args.evidenceMediaId == null ? null : BigInt(args.evidenceMediaId),
          snapshot_before_json: args.snapshotBefore ?? {},
          snapshot_after_json: args.snapshotAfter ?? {},
        },
      })
      const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT h.history_id AS historyId, h.incident_id AS incidentId, h.action_code AS actionCode, h.previous_status AS previousStatus, h.next_status AS nextStatus, h.actor_role AS actorRole, h.actor_user_id AS actorUserId, h.note AS note, h.evidence_media_id AS evidenceMediaId, h.snapshot_before_json AS snapshotBeforeJson, h.snapshot_after_json AS snapshotAfterJson, h.created_at AS createdAt FROM gate_incident_history h WHERE h.history_id = ? LIMIT 1`, String(created.history_id))
      return mapHistoryRow(rows[0])
    },
  }
  return { store, publish: publishIncidentEnvelope, now: () => new Date() }
}

function buildProjectionSignal(projection: SpotProjectionRow, deps: IncidentDeps, hitCount?: number) {
  return buildProjectionIncidentSignal(projection, { config: deps.noiseControl, hitCount })
}

type PendingNoiseState = {
  snapshot: Record<string, unknown>
  lastSignalAt: string | null
}

const pendingNoiseStateBySourceKey = new Map<string, PendingNoiseState>()

function getPendingNoiseState(sourceKey: string) {
  return pendingNoiseStateBySourceKey.get(sourceKey) ?? null
}

function setPendingNoiseState(sourceKey: string, state: PendingNoiseState) {
  pendingNoiseStateBySourceKey.set(sourceKey, state)
}

function clearPendingNoiseState(sourceKey: string) {
  pendingNoiseStateBySourceKey.delete(sourceKey)
}

function buildResolvedSnapshotKeepingNoiseFingerprint(snapshot: Record<string, unknown>, previousSnapshot: unknown, nowIso: string) {
  const previousNoise = readIncidentNoiseState(previousSnapshot)
  return withIncidentNoiseState(snapshot, {
    fingerprint: previousNoise.fingerprint,
    noiseClass: previousNoise.noiseClass,
    hitCount: previousNoise.hitCount,
    suppressedCount: previousNoise.suppressedCount,
    firstSeenAt: previousNoise.firstSeenAt,
    lastSeenAt: nowIso,
    lastMeaningfulAt: previousNoise.lastMeaningfulAt,
    lastPublishedAt: nowIso,
  })
}

export function canRoleResolveIncident(role: AppRole | 'SYSTEM', action: IncidentResolveAction) {
  if (role === 'ADMIN' || role === 'OPS' || role === 'SYSTEM') return true
  if (role === 'GUARD') return action === 'WARNING_ACKNOWLEDGED' || action === 'WHEEL_LOCK_REQUESTED'
  return false
}

function statusForAction(action: IncidentResolveAction): IncidentStatus {
  if (action === 'WARNING_ACKNOWLEDGED' || action === 'WHEEL_LOCK_REQUESTED') return 'ACKED'
  if (action === 'IGNORED') return 'IGNORED'
  return 'RESOLVED'
}

async function writeIncidentAuditLog(args: {
  action: string
  incident: IncidentSummary
  actor?: Parameters<typeof buildAuditActorSnapshot>[0] | null
  beforeSnapshot?: unknown
  afterSnapshot?: unknown
  occurredAt: string
}) {
  await writeAuditLog({
    siteId: args.incident.siteId,
    actor: args.actor == null ? null : buildAuditActorSnapshot(args.actor as any),
    actorUserId: (args.actor as any)?.actorUserId ?? null,
    action: args.action,
    entityTable: 'gate_incidents',
    entityId: args.incident.incidentId,
    beforeSnapshot: args.beforeSnapshot,
    afterSnapshot: args.afterSnapshot,
    correlationId: args.incident.sourceKey ?? null,
    occurredAt: args.occurredAt,
  })
}

export async function syncIncidentFromSpotProjection(projection: SpotProjectionRow, deps: IncidentDeps = getDefaultIncidentDeps()) {
  const sourceKey = `reconciliation:${projection.siteId}:${projection.spotId}`
  const active = await deps.store.findActiveBySourceKey(sourceKey)
  const latestFromStore = deps.store.findLatestBySourceKey ? await deps.store.findLatestBySourceKey(sourceKey) : null
  const latest = active ?? latestFromStore ?? null
  const pending = active ? null : getPendingNoiseState(sourceKey)
  const previousSnapshot = latest?.snapshot ?? pending?.snapshot
  const previousLastSignalAt = latest?.lastSignalAt ?? pending?.lastSignalAt ?? null
  const nowIso = deps.now().toISOString()

  const hitCount = computeNoiseHitCount({
    signal: buildProjectionSignal(projection, deps, 1),
    previousSnapshot,
    existingLastSignalAt: previousLastSignalAt,
    nowIso,
  })
  const signal = buildProjectionSignal(projection, deps, hitCount)
  const nextSnapshot = decorateIncidentSnapshot(signal.snapshot, {
    signal,
    nowIso,
    hitCount,
    previousSnapshot,
    published: true,
  })
  const suppressedSnapshot = decorateIncidentSnapshot(signal.snapshot, {
    signal,
    nowIso,
    hitCount,
    previousSnapshot,
    published: false,
  })

  if (!signal.active) {
    clearPendingNoiseState(sourceKey)
    if (!active) return null
    const resolvedSnapshot = buildResolvedSnapshotKeepingNoiseFingerprint(signal.snapshot, active.snapshot, nowIso)
    const updated = await deps.store.updateIncident(active.incidentId, { status: 'RESOLVED', resolutionAction: 'AUTO_RESOLVED', resolvedByRole: 'SYSTEM', resolvedAt: nowIso, lastSignalAt: nowIso, detail: signal.detail, snapshot: resolvedSnapshot })
    await deps.store.appendHistory({ incidentId: updated.incidentId, actionCode: 'AUTO_RESOLVED', previousStatus: active.status, nextStatus: updated.status, actorRole: 'SYSTEM', snapshotBefore: active.snapshot, snapshotAfter: updated.snapshot })
    await writeIncidentAuditLog({
      action: 'INCIDENT_AUTO_RESOLVED',
      incident: updated,
      actor: { principalType: 'SYSTEM', role: 'SYSTEM', actorLabel: 'SYSTEM' },
      beforeSnapshot: active.snapshot,
      afterSnapshot: updated.snapshot,
      occurredAt: nowIso,
    })
    observeIncidentLifecycle('AUTO_RESOLVE')
    await deps.publish({ eventType: 'incident.resolved', siteCode: updated.siteCode, laneCode: updated.laneCode, correlationId: updated.sourceKey, occurredAt: nowIso, payload: updated })
    return updated
  }

  if (hitCount < signal.suppressionThreshold) {
    if (!active) {
      observeIncidentLifecycle('SUPPRESS')
      setPendingNoiseState(sourceKey, { snapshot: suppressedSnapshot, lastSignalAt: nowIso })
      return null
    }
    return deps.store.updateIncident(active.incidentId, {
      severity: signal.severity as IncidentSeverity,
      incidentType: signal.incidentType as string,
      title: signal.title as string,
      detail: signal.detail,
      snapshot: suppressedSnapshot,
      lastSignalAt: nowIso,
    })
  }

  if (!latest) {
    clearPendingNoiseState(sourceKey)
    const created = await deps.store.createIncident({ siteId: projection.siteId, severity: signal.severity as IncidentSeverity, status: 'OPEN', incidentType: signal.incidentType as string, title: signal.title as string, detail: signal.detail, sourceKey: signal.sourceKey, snapshot: nextSnapshot, lastSignalAt: nowIso })
    observeIncidentLifecycle('AUTO_OPEN')
    await deps.store.appendHistory({ incidentId: created.incidentId, actionCode: 'AUTO_OPENED', previousStatus: null, nextStatus: created.status, actorRole: 'SYSTEM', snapshotBefore: {}, snapshotAfter: created.snapshot })
    await writeIncidentAuditLog({
      action: 'INCIDENT_AUTO_OPENED',
      incident: created,
      actor: { principalType: 'SYSTEM', role: 'SYSTEM', actorLabel: 'SYSTEM' },
      beforeSnapshot: {},
      afterSnapshot: created.snapshot,
      occurredAt: nowIso,
    })
    await deps.publish({ eventType: 'incident.opened', siteCode: created.siteCode, laneCode: created.laneCode, correlationId: created.sourceKey, occurredAt: nowIso, payload: created })
    return created
  }

  if (!active && shouldReopenResolvedIncident({
    signal,
    latestStatus: latest.status,
    latestLastSignalAt: latest.lastSignalAt,
    latestResolvedAt: latest.resolvedAt,
    previousSnapshot: latest.snapshot,
    nowIso,
  })) {
    clearPendingNoiseState(sourceKey)
    const reopened = await deps.store.updateIncident(latest.incidentId, {
      status: 'OPEN',
      severity: signal.severity as IncidentSeverity,
      incidentType: signal.incidentType as string,
      title: signal.title as string,
      detail: signal.detail,
      snapshot: nextSnapshot,
      resolutionAction: null,
      resolvedByUserId: null,
      resolvedByRole: null,
      evidenceMediaId: null,
      lastSignalAt: nowIso,
      resolvedAt: null,
    })
    observeIncidentLifecycle('AUTO_REOPEN')
    await deps.store.appendHistory({ incidentId: reopened.incidentId, actionCode: 'AUTO_REOPENED', previousStatus: latest.status, nextStatus: reopened.status, actorRole: 'SYSTEM', snapshotBefore: latest.snapshot, snapshotAfter: reopened.snapshot })
    await writeIncidentAuditLog({
      action: 'INCIDENT_AUTO_REOPENED',
      incident: reopened,
      actor: { principalType: 'SYSTEM', role: 'SYSTEM', actorLabel: 'SYSTEM' },
      beforeSnapshot: latest.snapshot,
      afterSnapshot: reopened.snapshot,
      occurredAt: nowIso,
    })
    await deps.publish({ eventType: 'incident.reopened', siteCode: reopened.siteCode, laneCode: reopened.laneCode, correlationId: reopened.sourceKey, occurredAt: nowIso, payload: reopened })
    return reopened
  }

  if (!active) {
    clearPendingNoiseState(sourceKey)
    const created = await deps.store.createIncident({ siteId: projection.siteId, severity: signal.severity as IncidentSeverity, status: 'OPEN', incidentType: signal.incidentType as string, title: signal.title as string, detail: signal.detail, sourceKey: signal.sourceKey, snapshot: nextSnapshot, lastSignalAt: nowIso })
    observeIncidentLifecycle('AUTO_OPEN')
    await deps.store.appendHistory({ incidentId: created.incidentId, actionCode: 'AUTO_OPENED', previousStatus: latest.status, nextStatus: created.status, actorRole: 'SYSTEM', snapshotBefore: latest.snapshot, snapshotAfter: created.snapshot })
    await writeIncidentAuditLog({
      action: 'INCIDENT_AUTO_OPENED',
      incident: created,
      actor: { principalType: 'SYSTEM', role: 'SYSTEM', actorLabel: 'SYSTEM' },
      beforeSnapshot: latest.snapshot,
      afterSnapshot: created.snapshot,
      occurredAt: nowIso,
    })
    await deps.publish({ eventType: 'incident.opened', siteCode: created.siteCode, laneCode: created.laneCode, correlationId: created.sourceKey, occurredAt: nowIso, payload: created })
    return created
  }

  const shouldSuppress = shouldSuppressRecurringSignal({
    signal,
    previousSnapshot: active.snapshot,
    existingLastSignalAt: active.lastSignalAt,
    previousSeverity: active.severity,
    nowIso,
  })

  if (shouldSuppress) {
    observeIncidentLifecycle('SUPPRESS')
    return deps.store.updateIncident(active.incidentId, {
      severity: signal.severity as IncidentSeverity,
      incidentType: signal.incidentType as string,
      title: signal.title as string,
      detail: signal.detail,
      snapshot: suppressedSnapshot,
      lastSignalAt: nowIso,
    })
  }

  const updated = await deps.store.updateIncident(active.incidentId, { severity: signal.severity as IncidentSeverity, incidentType: signal.incidentType as string, title: signal.title as string, detail: signal.detail, snapshot: nextSnapshot, lastSignalAt: nowIso })
  await deps.store.appendHistory({ incidentId: updated.incidentId, actionCode: 'AUTO_UPDATED', previousStatus: active.status, nextStatus: updated.status, actorRole: 'SYSTEM', snapshotBefore: active.snapshot, snapshotAfter: updated.snapshot })
  await writeIncidentAuditLog({
    action: 'INCIDENT_AUTO_UPDATED',
    incident: updated,
    actor: { principalType: 'SYSTEM', role: 'SYSTEM', actorLabel: 'SYSTEM' },
    beforeSnapshot: active.snapshot,
    afterSnapshot: updated.snapshot,
    occurredAt: nowIso,
  })
  await deps.publish({ eventType: 'incident.updated', siteCode: updated.siteCode, laneCode: updated.laneCode, correlationId: updated.sourceKey, occurredAt: nowIso, payload: updated })
  return updated
}

export async function listGateIncidents(args: { siteCode?: string | null; status?: string | null; severity?: string | null; incidentType?: string | null; sourceKey?: string | null; cursor?: string | null; limit?: number }, deps: IncidentDeps = getDefaultIncidentDeps()) {
  return deps.store.listIncidents(args)
}

export async function getGateIncidentDetail(incidentId: string, deps: IncidentDeps = getDefaultIncidentDeps()): Promise<IncidentDetail | null> {
  const incident = await deps.store.findById(incidentId)
  if (!incident) return null
  const history = await deps.store.listIncidentHistory(incidentId)
  return { ...incident, history }
}

export async function resolveGateIncident(args: { incidentId: string; action: IncidentResolveAction; note?: string | null; evidenceMediaId?: string | null; actor: IncidentActor }, deps: IncidentDeps = getDefaultIncidentDeps()) {
  if (!canRoleResolveIncident(args.actor.role, args.action)) {
    throw new ApiError({ code: 'FORBIDDEN', message: `Role ${args.actor.role} không được phép action ${args.action}` })
  }
  const existing = await deps.store.findById(args.incidentId)
  if (!existing) throw new ApiError({ code: 'NOT_FOUND', message: 'Incident không tồn tại' })
  if (existing.status === 'RESOLVED' || existing.status === 'IGNORED') {
    throw new ApiError({ code: 'CONFLICT', message: 'Incident đã được chốt, không thể action lại' })
  }
  const nextStatus = statusForAction(args.action)
  const nowIso = deps.now().toISOString()
  const updated = await deps.store.updateIncident(args.incidentId, { status: nextStatus, resolutionAction: args.action, resolvedByUserId: args.actor.actorUserId == null ? null : String(args.actor.actorUserId), resolvedByRole: args.actor.role, evidenceMediaId: args.evidenceMediaId ?? null, resolvedAt: nowIso })
  await deps.store.appendHistory({ incidentId: updated.incidentId, actionCode: args.action, previousStatus: existing.status, nextStatus: updated.status, actorRole: args.actor.role, actorUserId: args.actor.actorUserId == null ? null : String(args.actor.actorUserId), note: args.note ?? null, evidenceMediaId: args.evidenceMediaId ?? null, snapshotBefore: existing.snapshot, snapshotAfter: updated.snapshot })
  await writeIncidentAuditLog({
    action: `INCIDENT_${args.action}`,
    incident: updated,
    actor: {
      principalType: args.actor.actorUserId == null ? 'SYSTEM' : 'USER',
      role: args.actor.role,
      actorUserId: args.actor.actorUserId == null ? null : String(args.actor.actorUserId),
      actorLabel: args.actor.actorLabel ?? null,
    },
    beforeSnapshot: existing.snapshot,
    afterSnapshot: updated.snapshot,
    occurredAt: nowIso,
  })
  observeIncidentLifecycle(nextStatus === 'ACKED' ? 'ACK' : nextStatus === 'IGNORED' ? 'IGNORE' : 'RESOLVE')
  await deps.publish({ eventType: updated.status === 'ACKED' ? 'incident.updated' : 'incident.resolved', siteCode: updated.siteCode, laneCode: updated.laneCode, correlationId: updated.sourceKey, occurredAt: nowIso, payload: updated })
  return (await getGateIncidentDetail(updated.incidentId, deps)) as IncidentDetail
}
