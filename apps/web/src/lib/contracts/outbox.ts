import type { OutboxSnapshot, OutboxStreamItem } from '@parkly/contracts'

export type { OutboxSnapshot, OutboxStreamItem } from '@parkly/contracts'

export type OutboxListItem = {
  outboxId: string
  eventId: string
  siteId: string | null
  eventTime: string
  status: string
  attempts: number
  sentAt: string | null
  nextRetryAt: string | null
  lastError: string | null
  mongoDocId: string | null
  createdAt: string
  updatedAt: string
  payload: unknown
}

export type OutboxListRes = {
  rows: OutboxListItem[]
  nextCursor: string | null
}

export type OutboxRequeueRes = {
  changed: number
}

export type OutboxDrainRes =
  | { dryRun: true; candidates: string[] }
  | { dryRun: false; claimed: number; ok: number; fail: number; outboxIds: string[] }
