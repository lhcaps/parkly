import { AsyncLocalStorage } from 'node:async_hooks'

import { prisma } from '../../lib/prisma'
import { stringifyBigint } from '../utils'
import { ApiError } from '../http'

export type AuditActorSnapshot = {
  principalType: 'USER' | 'SERVICE' | 'SYSTEM'
  role: string | null
  actorUserId: string | null
  actorLabel: string | null
  userId: string | null
  username: string | null
  sessionId: string | null
  serviceCode: string | null
}

export type AuditActorInput = Partial<Omit<AuditActorSnapshot, 'actorUserId' | 'userId'>> & {
  actorUserId?: string | number | bigint | null
  userId?: string | number | bigint | null
}

export type AuditRequestContext = {
  requestId: string | null
  correlationId: string | null
  occurredAt: string | null
  actor: AuditActorSnapshot | null
}

export type AuditRequestContextInput = {
  requestId?: string | null
  correlationId?: string | null
  occurredAt?: string | Date | null
  actor?: AuditActorInput | null
}

export type AuditWriteInput = {
  siteId?: string | number | bigint | null
  actor?: AuditActorInput | null
  actorUserId?: string | number | bigint | null
  action: string
  entityTable: string
  entityId: string | number | bigint
  beforeSnapshot?: unknown
  afterSnapshot?: unknown
  requestId?: string | null
  correlationId?: string | null
  occurredAt?: string | Date | null
}

export type AuditListQuery = {
  siteCode?: string | null
  actorUserId?: string | null
  action?: string | null
  entityTable?: string | null
  entityId?: string | null
  requestId?: string | null
  correlationId?: string | null
  from?: string | null
  to?: string | null
  cursor?: string | null
  limit?: number
}

export type AuditRecord = {
  auditId: string
  siteId: string | null
  siteCode: string | null
  actorUserId: string | null
  action: string
  entityTable: string
  entityId: string
  beforeSnapshot: unknown
  afterSnapshot: unknown
  actor: AuditActorSnapshot | null
  requestId: string | null
  correlationId: string | null
  occurredAt: string
  createdAt: string
}

const auditContextStorage = new AsyncLocalStorage<AuditRequestContext>()

function toNullableTrimmedString(value: unknown): string | null {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function toNullableIdString(value: unknown): string | null {
  if (value == null) return null
  const normalized = String(value).trim()
  return normalized || null
}

function toIsoString(value: unknown, fallbackNow = false): string | null {
  if (value == null) return fallbackNow ? new Date().toISOString() : null
  const parsed = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return fallbackNow ? new Date().toISOString() : null
  return parsed.toISOString()
}

function encodeJson(value: unknown) {
  if (value === undefined) return null
  return JSON.stringify(stringifyBigint(value))
}

function toSqlDateTime(value: unknown) {
  const iso = toIsoString(value)
  return iso == null ? null : iso.slice(0, 19).replace('T', ' ')
}

function safeParseJson<T = unknown>(value: unknown): T | null {
  if (value == null) return null
  if (typeof value === 'object') return value as T
  const raw = String(value).trim()
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function buildAuditActorSnapshot(actor?: AuditActorInput | null): AuditActorSnapshot | null {
  if (!actor) return null

  const principalType = String(actor.principalType ?? '').trim().toUpperCase()
  const actorUserId = toNullableIdString(actor.actorUserId ?? actor.userId)
  const resolvedPrincipalType = principalType === 'SERVICE' || principalType === 'SYSTEM' || principalType === 'USER'
    ? principalType as AuditActorSnapshot['principalType']
    : actor.serviceCode
      ? 'SERVICE'
      : actorUserId
        ? 'USER'
        : 'SYSTEM'

  return {
    principalType: resolvedPrincipalType,
    role: toNullableTrimmedString(actor.role),
    actorUserId,
    actorLabel: toNullableTrimmedString(actor.actorLabel),
    userId: toNullableIdString(actor.userId ?? actor.actorUserId),
    username: toNullableTrimmedString(actor.username),
    sessionId: toNullableTrimmedString(actor.sessionId),
    serviceCode: toNullableTrimmedString(actor.serviceCode),
  }
}

export function runWithAuditContext<T>(context: AuditRequestContextInput, fn: () => T): T {
  const merged: AuditRequestContext = {
    requestId: toNullableTrimmedString(context.requestId),
    correlationId: toNullableTrimmedString(context.correlationId),
    occurredAt: toIsoString(context.occurredAt, true),
    actor: buildAuditActorSnapshot(context.actor),
  }
  return auditContextStorage.run(merged, fn)
}

export function getAuditRequestContext(): AuditRequestContext {
  return auditContextStorage.getStore() ?? {
    requestId: null,
    correlationId: null,
    occurredAt: null,
    actor: null,
  }
}

export function setAuditActorContext(actor?: AuditActorInput | null) {
  const store = auditContextStorage.getStore()
  if (!store) return
  store.actor = buildAuditActorSnapshot(actor)
}

export function resolveAuditWriteInput(input: AuditWriteInput) {
  const context = getAuditRequestContext()
  const actor = buildAuditActorSnapshot(input.actor) ?? buildAuditActorSnapshot(context.actor) ?? buildAuditActorSnapshot({ actorUserId: input.actorUserId })

  return {
    siteId: toNullableIdString(input.siteId),
    actorUserId: actor?.actorUserId ?? toNullableIdString(input.actorUserId),
    action: String(input.action ?? '').trim(),
    entityTable: String(input.entityTable ?? '').trim(),
    entityId: String(input.entityId ?? '').trim(),
    beforeJson: encodeJson(input.beforeSnapshot),
    afterJson: encodeJson(input.afterSnapshot),
    actorJson: encodeJson(actor),
    actor,
    requestId: toNullableTrimmedString(input.requestId) ?? context.requestId,
    correlationId: toNullableTrimmedString(input.correlationId) ?? context.correlationId,
    occurredAt: toIsoString(input.occurredAt) ?? context.occurredAt ?? new Date().toISOString(),
  }
}

export async function writeAuditLog(input: AuditWriteInput) {
  const resolved = resolveAuditWriteInput(input)
  if (!resolved.action) throw new ApiError({ code: 'BAD_REQUEST', message: 'audit action là bắt buộc' })
  if (!resolved.entityTable) throw new ApiError({ code: 'BAD_REQUEST', message: 'audit entityTable là bắt buộc' })
  if (!resolved.entityId) throw new ApiError({ code: 'BAD_REQUEST', message: 'audit entityId là bắt buộc' })

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO audit_logs (
        site_id,
        actor_user_id,
        action,
        entity_table,
        entity_id,
        before_json,
        after_json,
        actor_json,
        request_id,
        correlation_id,
        occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    resolved.siteId,
    resolved.actorUserId,
    resolved.action,
    resolved.entityTable,
    resolved.entityId,
    resolved.beforeJson,
    resolved.afterJson,
    resolved.actorJson,
    resolved.requestId,
    resolved.correlationId,
    toSqlDateTime(resolved.occurredAt),
  )
}

function mapAuditRow(row: Record<string, unknown>): AuditRecord {
  return {
    auditId: String(row.auditId ?? ''),
    siteId: toNullableIdString(row.siteId),
    siteCode: toNullableTrimmedString(row.siteCode),
    actorUserId: toNullableIdString(row.actorUserId),
    action: String(row.action ?? ''),
    entityTable: String(row.entityTable ?? ''),
    entityId: String(row.entityId ?? ''),
    beforeSnapshot: safeParseJson(row.beforeJson),
    afterSnapshot: safeParseJson(row.afterJson),
    actor: safeParseJson<AuditActorSnapshot>(row.actorJson),
    requestId: toNullableTrimmedString(row.requestId),
    correlationId: toNullableTrimmedString(row.correlationId),
    occurredAt: toIsoString(row.occurredAt, true) ?? new Date(0).toISOString(),
    createdAt: toIsoString(row.createdAt, true) ?? new Date(0).toISOString(),
  }
}

export async function getAuditRecordDetail(auditId: string): Promise<AuditRecord | null> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        al.audit_id AS auditId,
        al.site_id AS siteId,
        ps.site_code AS siteCode,
        al.actor_user_id AS actorUserId,
        al.action AS action,
        al.entity_table AS entityTable,
        al.entity_id AS entityId,
        al.before_json AS beforeJson,
        al.after_json AS afterJson,
        al.actor_json AS actorJson,
        al.request_id AS requestId,
        al.correlation_id AS correlationId,
        al.occurred_at AS occurredAt,
        al.created_at AS createdAt
      FROM audit_logs al
      LEFT JOIN parking_sites ps ON ps.site_id = al.site_id
      WHERE al.audit_id = ?
      LIMIT 1
    `,
    auditId,
  )
  return rows[0] ? mapAuditRow(rows[0]) : null
}

export async function listAuditLogs(args: AuditListQuery): Promise<{ items: AuditRecord[]; nextCursor: string | null }> {
  const limit = Math.min(200, Math.max(1, Math.trunc(Number(args.limit ?? 50) || 50)))
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        al.audit_id AS auditId,
        al.site_id AS siteId,
        ps.site_code AS siteCode,
        al.actor_user_id AS actorUserId,
        al.action AS action,
        al.entity_table AS entityTable,
        al.entity_id AS entityId,
        al.before_json AS beforeJson,
        al.after_json AS afterJson,
        al.actor_json AS actorJson,
        al.request_id AS requestId,
        al.correlation_id AS correlationId,
        al.occurred_at AS occurredAt,
        al.created_at AS createdAt
      FROM audit_logs al
      LEFT JOIN parking_sites ps ON ps.site_id = al.site_id
      WHERE (? IS NULL OR ps.site_code = ?)
        AND (? IS NULL OR al.actor_user_id = ?)
        AND (? IS NULL OR al.action = ?)
        AND (? IS NULL OR al.entity_table = ?)
        AND (? IS NULL OR al.entity_id = ?)
        AND (? IS NULL OR al.request_id = ?)
        AND (? IS NULL OR al.correlation_id = ?)
        AND (? IS NULL OR al.occurred_at >= ?)
        AND (? IS NULL OR al.occurred_at <= ?)
        AND (? IS NULL OR al.audit_id < ?)
      ORDER BY al.audit_id DESC
      LIMIT ?
    `,
    args.siteCode ?? null,
    args.siteCode ?? null,
    args.actorUserId ?? null,
    args.actorUserId ?? null,
    args.action ?? null,
    args.action ?? null,
    args.entityTable ?? null,
    args.entityTable ?? null,
    args.entityId ?? null,
    args.entityId ?? null,
    args.requestId ?? null,
    args.requestId ?? null,
    args.correlationId ?? null,
    args.correlationId ?? null,
    args.from == null ? null : toSqlDateTime(args.from),
    args.from == null ? null : toSqlDateTime(args.from),
    args.to == null ? null : toSqlDateTime(args.to),
    args.to == null ? null : toSqlDateTime(args.to),
    args.cursor ?? null,
    args.cursor ?? null,
    limit + 1,
  )

  const items = rows.slice(0, limit).map(mapAuditRow)
  return {
    items,
    nextCursor: rows.length > limit && items.length > 0 ? items[items.length - 1].auditId : null,
  }
}
