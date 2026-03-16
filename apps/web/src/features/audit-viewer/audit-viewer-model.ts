import type { AuditActor, AuditRecord } from '@/lib/contracts/audit'
import { isRecord } from '@/lib/http/errors'

export type AuditQuickFilter = 'all' | 'request' | 'correlation' | 'manual' | 'gate-session' | 'barrier'

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN')
}

export function actorHeadline(actor: AuditActor | null, fallbackUserId?: string | null) {
  if (!actor) return fallbackUserId || 'SYSTEM'
  return actor.actorLabel || actor.username || actor.userId || actor.serviceCode || actor.actorUserId || actor.principalType
}

export function entityHeadline(record: Pick<AuditRecord, 'entityTable' | 'entityId'>) {
  return `${record.entityTable}.${record.entityId}`
}

export function summarizeAudit(record: AuditRecord) {
  const beforeKeys = countObjectKeys(record.beforeSnapshot)
  const afterKeys = countObjectKeys(record.afterSnapshot)
  const changedKeys = summarizeChangedKeys(record.beforeSnapshot, record.afterSnapshot)
  return {
    actorLabel: actorHeadline(record.actor, record.actorUserId),
    entityLabel: entityHeadline(record),
    changedKeys,
    beforeKeys,
    afterKeys,
    actionFamily: classifyActionFamily(record.action),
  }
}

export function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2)
  } catch {
    return String(value)
  }
}

export function countObjectKeys(value: unknown): number {
  if (!isRecord(value)) return 0
  return Object.keys(value).length
}

export function summarizeChangedKeys(beforeValue: unknown, afterValue: unknown) {
  if (!isRecord(beforeValue) && !isRecord(afterValue)) return [] as string[]
  const before = isRecord(beforeValue) ? beforeValue : {}
  const after = isRecord(afterValue) ? afterValue : {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changed: string[] = []
  for (const key of keys) {
    const beforeEncoded = safeEncode(before[key])
    const afterEncoded = safeEncode(after[key])
    if (beforeEncoded !== afterEncoded) changed.push(key)
  }
  return changed.slice(0, 8)
}

function safeEncode(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function classifyActionFamily(action: string) {
  const normalized = action.trim().toUpperCase()
  if (normalized.includes('MANUAL') || normalized.includes('OVERRIDE')) return 'manual'
  if (normalized.includes('BARRIER')) return 'barrier'
  if (normalized.includes('SESSION') || normalized.includes('REVIEW')) return 'gate-session'
  return 'standard'
}

export function toneForAction(action: string): 'outline' | 'secondary' | 'amber' | 'destructive' {
  const normalized = action.trim().toUpperCase()
  if (normalized.includes('FAIL') || normalized.includes('DENY') || normalized.includes('ERROR')) return 'destructive'
  if (normalized.includes('MANUAL') || normalized.includes('OVERRIDE')) return 'amber'
  if (normalized.includes('APPROVE') || normalized.includes('PASS') || normalized.includes('RESOLVE')) return 'secondary'
  return 'outline'
}

export function matchesAuditQuickFilter(record: AuditRecord, filter: AuditQuickFilter) {
  if (filter === 'all') return true
  if (filter === 'request') return Boolean(record.requestId)
  if (filter === 'correlation') return Boolean(record.correlationId)
  if (filter === 'manual') return classifyActionFamily(record.action) === 'manual'
  if (filter === 'gate-session') return classifyActionFamily(record.action) === 'gate-session'
  if (filter === 'barrier') return classifyActionFamily(record.action) === 'barrier'
  return true
}

export function matchesAuditKeyword(record: AuditRecord, keyword: string) {
  const term = keyword.trim().toLowerCase()
  if (!term) return true
  const summary = summarizeAudit(record)
  const haystack = [
    record.auditId,
    record.siteCode,
    record.actorUserId,
    record.action,
    record.entityTable,
    record.entityId,
    record.requestId,
    record.correlationId,
    summary.actorLabel,
    summary.entityLabel,
    ...summary.changedKeys,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase()
  return haystack.includes(term)
}
