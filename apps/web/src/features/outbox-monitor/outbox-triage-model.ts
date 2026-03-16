import type { OutboxListItem, OutboxStreamItem } from '@/lib/contracts/outbox'
import { isRecord } from '@/lib/http/errors'

export type OutboxTriageRecord = {
  source: 'rest' | 'stream'
  outboxId: string
  eventId: string
  siteCode: string | null
  siteId: string | null
  laneCode: string | null
  deviceCode: string | null
  eventTime: string
  status: string
  attempts: number
  sentAt: string | null
  nextRetryAt: string | null
  lastError: string | null
  mongoDocId: string | null
  createdAt: string
  updatedAt: string
  direction: string | null
  readType: string | null
  plate: string | null
  reviewRequired: boolean
  correlationId: string | null
  requestId: string | null
  action: string | null
  entityTable: string | null
  entityId: string | null
  sessionId: string | null
  payload: unknown
}

export type OutboxQuickFilter = 'all' | 'failed' | 'pending' | 'retrying' | 'sent' | 'barrier' | 'review'

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN')
}

function readDeepString(value: unknown, candidates: string[]): string | null {
  if (!isRecord(value)) return null
  for (const key of candidates) {
    const direct = value[key]
    if (typeof direct === 'string' && direct.trim()) return direct.trim()
  }
  for (const nested of Object.values(value)) {
    if (!isRecord(nested)) continue
    for (const key of candidates) {
      const inner = nested[key]
      if (typeof inner === 'string' && inner.trim()) return inner.trim()
    }
  }
  return null
}

function readDeepBoolean(value: unknown, candidates: string[]): boolean {
  if (!isRecord(value)) return false
  for (const key of candidates) {
    const direct = value[key]
    if (typeof direct === 'boolean') return direct
  }
  for (const nested of Object.values(value)) {
    if (!isRecord(nested)) continue
    for (const key of candidates) {
      const inner = nested[key]
      if (typeof inner === 'boolean') return inner
    }
  }
  return false
}

function normalizePayloadSummary(payload: unknown) {
  const direction = readDeepString(payload, ['direction'])
  const readType = readDeepString(payload, ['readType'])
  const plate = readDeepString(payload, ['plateDisplay', 'plateCompact', 'plateRaw', 'recognizedPlate', 'licensePlateRaw'])
  const correlationId = readDeepString(payload, ['correlationId'])
  const requestId = readDeepString(payload, ['requestId'])
  const action = readDeepString(payload, ['action', 'decisionCode', 'recommendedAction', 'finalAction'])
  const entityTable = readDeepString(payload, ['entityTable', 'targetTable'])
  const entityId = readDeepString(payload, ['entityId', 'targetId'])
  const sessionId = readDeepString(payload, ['sessionId', 'mappedSessionId'])
  const laneCode = readDeepString(payload, ['laneCode'])
  const deviceCode = readDeepString(payload, ['deviceCode'])
  return {
    direction,
    readType,
    plate,
    correlationId,
    requestId,
    action,
    entityTable,
    entityId,
    sessionId,
    laneCode,
    deviceCode,
    reviewRequired: readDeepBoolean(payload, ['reviewRequired', 'needsReview', 'manualReviewRequired']),
  }
}

export function normalizeRestOutboxRecord(row: OutboxListItem): OutboxTriageRecord {
  const payloadSummary = normalizePayloadSummary(row.payload)
  return {
    source: 'rest',
    outboxId: row.outboxId,
    eventId: row.eventId,
    siteCode: readDeepString(row.payload, ['siteCode']) || row.siteId,
    siteId: row.siteId,
    laneCode: payloadSummary.laneCode,
    deviceCode: payloadSummary.deviceCode,
    eventTime: row.eventTime,
    status: row.status,
    attempts: row.attempts,
    sentAt: row.sentAt,
    nextRetryAt: row.nextRetryAt,
    lastError: row.lastError,
    mongoDocId: row.mongoDocId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    direction: payloadSummary.direction,
    readType: payloadSummary.readType,
    plate: payloadSummary.plate,
    reviewRequired: payloadSummary.reviewRequired,
    correlationId: payloadSummary.correlationId,
    requestId: payloadSummary.requestId,
    action: payloadSummary.action,
    entityTable: payloadSummary.entityTable,
    entityId: payloadSummary.entityId,
    sessionId: payloadSummary.sessionId,
    payload: row.payload,
  }
}

export function normalizeStreamOutboxRecord(row: OutboxStreamItem): OutboxTriageRecord {
  return {
    source: 'stream',
    outboxId: row.outboxId,
    eventId: row.eventId,
    siteCode: row.siteCode,
    siteId: null,
    laneCode: row.laneCode,
    deviceCode: row.deviceCode,
    eventTime: row.eventTime,
    status: row.status,
    attempts: row.attempts,
    sentAt: null,
    nextRetryAt: row.nextRetryAt,
    lastError: row.lastError,
    mongoDocId: row.mongoDocId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    direction: row.payloadSummary.direction,
    readType: row.payloadSummary.readType,
    plate: row.payloadSummary.plateDisplay || row.payloadSummary.plateCompact,
    reviewRequired: row.payloadSummary.reviewRequired,
    correlationId: null,
    requestId: null,
    action: null,
    entityTable: null,
    entityId: null,
    sessionId: null,
    payload: row,
  }
}

export function matchesOutboxQuickFilter(row: OutboxTriageRecord, filter: OutboxQuickFilter) {
  if (filter === 'all') return true
  if (filter === 'failed') return isFailureStatus(row.status)
  if (filter === 'pending') return row.status === 'PENDING'
  if (filter === 'retrying') return row.status === 'RETRYING' || (!!row.nextRetryAt && !isSentStatus(row.status) && !isFailureStatus(row.status))
  if (filter === 'sent') return isSentStatus(row.status)
  if (filter === 'barrier') return (row.action || '').toUpperCase().includes('BARRIER') || (row.entityTable || '').toLowerCase().includes('barrier')
  if (filter === 'review') return row.reviewRequired
  return true
}

export function matchesOutboxKeyword(row: OutboxTriageRecord, keyword: string) {
  const term = keyword.trim().toLowerCase()
  if (!term) return true
  const haystack = [
    row.outboxId,
    row.eventId,
    row.siteCode,
    row.laneCode,
    row.deviceCode,
    row.status,
    row.direction,
    row.readType,
    row.plate,
    row.correlationId,
    row.requestId,
    row.action,
    row.entityTable,
    row.entityId,
    row.sessionId,
    row.lastError,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase()
  return haystack.includes(term)
}

export function isSentStatus(status: string) {
  return status === 'SENT' || status === 'ACKED'
}

export function isFailureStatus(status: string) {
  return status === 'FAILED' || status === 'TIMEOUT' || status === 'NACKED'
}

export function outboxStatusVariant(status: string): 'secondary' | 'outline' | 'destructive' | 'amber' {
  if (isSentStatus(status)) return 'secondary'
  if (isFailureStatus(status)) return 'destructive'
  if (status === 'RETRYING') return 'amber'
  return 'outline'
}

export function summarizeFailure(row: OutboxTriageRecord) {
  if (row.lastError) return row.lastError
  if (isFailureStatus(row.status)) return 'Terminal failure without explicit error text.'
  if (row.nextRetryAt && !isSentStatus(row.status)) return `Scheduled retry at ${formatDateTime(row.nextRetryAt)}`
  return 'No explicit failure reason.'
}

export function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2)
  } catch {
    return String(value)
  }
}
