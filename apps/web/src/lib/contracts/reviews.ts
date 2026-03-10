import type { ReviewQueueItem } from '@parkly/contracts'

export type { ReviewQueueItem } from '@parkly/contracts'

export type ReviewQueueRes = {
  rows: ReviewQueueItem[]
}

export type ManualAuditPayload = {
  requestId: string
  idempotencyKey: string
  occurredAt?: string
  reasonCode: string
  note: string
  rawPayload?: unknown
}
