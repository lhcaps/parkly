import { isRecord } from '@/lib/http/errors'

export type AuditPrincipalType = 'USER' | 'SERVICE' | 'SYSTEM'

export type AuditActor = {
  principalType: AuditPrincipalType
  role: string | null
  actorUserId: string | null
  actorLabel: string | null
  userId: string | null
  username: string | null
  sessionId: string | null
  serviceCode: string | null
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
  actor: AuditActor | null
  requestId: string | null
  correlationId: string | null
  occurredAt: string
  createdAt: string
}

export type AuditListPageInfo = {
  limit: number
  nextCursor: string | null
  sort: string
}

export type AuditListRes = {
  rows: AuditRecord[]
  nextCursor: string | null
  pageInfo: AuditListPageInfo | null
}

export type AuditListQuery = {
  siteCode?: string
  actorUserId?: string
  action?: string
  entityTable?: string
  entityId?: string
  requestId?: string
  correlationId?: string
  from?: string
  to?: string
  limit?: number
  cursor?: string
}

export function normalizeAuditActor(value: unknown): AuditActor | null {
  if (!isRecord(value)) return null
  const principalType = String(value.principalType ?? '').trim().toUpperCase()
  return {
    principalType: principalType === 'SERVICE' || principalType === 'SYSTEM' ? principalType : 'USER',
    role: typeof value.role === 'string' ? value.role : null,
    actorUserId: typeof value.actorUserId === 'string' ? value.actorUserId : null,
    actorLabel: typeof value.actorLabel === 'string' ? value.actorLabel : null,
    userId: typeof value.userId === 'string' ? value.userId : null,
    username: typeof value.username === 'string' ? value.username : null,
    sessionId: typeof value.sessionId === 'string' ? value.sessionId : null,
    serviceCode: typeof value.serviceCode === 'string' ? value.serviceCode : null,
  }
}

export function normalizeAuditRecord(value: unknown): AuditRecord {
  const row = isRecord(value) ? value : {}
  return {
    auditId: typeof row.auditId === 'string' ? row.auditId : '',
    siteId: typeof row.siteId === 'string' ? row.siteId : null,
    siteCode: typeof row.siteCode === 'string' ? row.siteCode : null,
    actorUserId: typeof row.actorUserId === 'string' ? row.actorUserId : null,
    action: typeof row.action === 'string' ? row.action : 'UNKNOWN',
    entityTable: typeof row.entityTable === 'string' ? row.entityTable : 'unknown_entity',
    entityId: typeof row.entityId === 'string' ? row.entityId : '',
    beforeSnapshot: 'beforeSnapshot' in row ? row.beforeSnapshot : null,
    afterSnapshot: 'afterSnapshot' in row ? row.afterSnapshot : null,
    actor: normalizeAuditActor(row.actor),
    requestId: typeof row.requestId === 'string' ? row.requestId : null,
    correlationId: typeof row.correlationId === 'string' ? row.correlationId : null,
    occurredAt: typeof row.occurredAt === 'string' ? row.occurredAt : '',
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
  }
}

export function normalizeAuditRecordList(value: unknown): AuditRecord[] {
  return Array.isArray(value)
    ? value.map((item) => normalizeAuditRecord(item)).filter((item) => Boolean(item.auditId))
    : []
}
