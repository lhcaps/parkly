import type { Request, Response } from 'express'

import { buildRedisKey, runRedisCommand } from '../lib/redis'

export type SseEnvelope<T = unknown> = {
  eventType: string
  sequence: number
  occurredAt: string
  siteCode: string | null
  laneCode: string | null
  correlationId: string | null
  payload: T
}

type MemoryReplayState = {
  sequence: number
  events: SseEnvelope[]
}

const memoryReplay = new Map<string, MemoryReplayState>()

function envInt(name: string, fallback: number) {
  const raw = Number(process.env[name] ?? '')
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : fallback
}

export function getSseReplayWindowSize() {
  return envInt('GATE_SSE_REPLAY_WINDOW', 200)
}

export function getSseReplayFetchLimit() {
  return envInt('GATE_SSE_REPLAY_FETCH_LIMIT', 100)
}

function toJson(value: unknown) {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item))
}

function replaySeqKey(channel: string) {
  return buildRedisKey('sse', channel, 'seq')
}

function replayListKey(channel: string) {
  return buildRedisKey('sse', channel, 'events')
}

function getMemoryState(channel: string) {
  const existing = memoryReplay.get(channel)
  if (existing) return existing
  const next: MemoryReplayState = { sequence: 0, events: [] }
  memoryReplay.set(channel, next)
  return next
}

function parseStoredEnvelope(raw: string): SseEnvelope | null {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    if (typeof parsed.eventType !== 'string') return null
    if (typeof parsed.sequence !== 'number') return null
    if (typeof parsed.occurredAt !== 'string') return null
    return parsed as SseEnvelope
  } catch {
    return null
  }
}

function pushMemoryReplay(channel: string, envelope: SseEnvelope) {
  const state = getMemoryState(channel)
  state.sequence = Math.max(state.sequence, envelope.sequence)
  state.events.push(envelope)
  const max = getSseReplayWindowSize()
  if (state.events.length > max) {
    state.events.splice(0, state.events.length - max)
  }
}

async function nextSequence(channel: string): Promise<number> {
  try {
    const next = await runRedisCommand('SSE_INCR', async (client) => {
      const value = await client.incr(replaySeqKey(channel))
      return Number(value)
    })
    return next
  } catch {
    const state = getMemoryState(channel)
    state.sequence += 1
    return state.sequence
  }
}

async function appendReplay(channel: string, envelope: SseEnvelope) {
  const serialized = toJson(envelope)
  try {
    await runRedisCommand('SSE_APPEND_REPLAY', async (client) => {
      const max = getSseReplayWindowSize()
      await client
        .multi()
        .rpush(replayListKey(channel), serialized)
        .ltrim(replayListKey(channel), -max, -1)
        .exec()
    })
  } catch {
    pushMemoryReplay(channel, envelope)
  }
}

export async function publishSseEnvelope<T = unknown>(
  channel: string,
  args: {
    eventType: string
    payload: T
    occurredAt?: string | Date
    siteCode?: string | null
    laneCode?: string | null
    correlationId?: string | null
  },
): Promise<SseEnvelope<T>> {
  const sequence = await nextSequence(channel)
  const occurredAt =
    args.occurredAt instanceof Date
      ? args.occurredAt.toISOString()
      : typeof args.occurredAt === 'string' && args.occurredAt.trim()
        ? new Date(args.occurredAt).toISOString()
        : new Date().toISOString()

  const envelope: SseEnvelope<T> = {
    eventType: args.eventType,
    sequence,
    occurredAt,
    siteCode: args.siteCode ?? null,
    laneCode: args.laneCode ?? null,
    correlationId: args.correlationId ?? null,
    payload: args.payload,
  }

  await appendReplay(channel, envelope)
  return envelope
}

export async function getSseReplaySince(
  channel: string,
  afterSequence: number | null | undefined,
  opts: { limit?: number } = {},
): Promise<SseEnvelope[]> {
  const threshold = Number.isFinite(Number(afterSequence ?? '')) ? Math.max(0, Number(afterSequence ?? 0)) : 0
  const limit = Math.min(getSseReplayFetchLimit(), Math.max(1, opts.limit ?? getSseReplayFetchLimit()))

  try {
    const items = await runRedisCommand('SSE_REPLAY_READ', async (client) => {
      return await client.lrange(replayListKey(channel), -getSseReplayWindowSize(), -1)
    })

    return items
      .map(parseStoredEnvelope)
      .filter((item): item is SseEnvelope => item != null && item.sequence > threshold)
      .slice(0, limit)
  } catch {
    return getMemoryState(channel).events.filter((item) => item.sequence > threshold).slice(0, limit)
  }
}

export function initSse(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  ;(res as any).flushHeaders?.()
}

export function writeLegacySseEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${toJson(data)}\n\n`)
}

export function writeSseEnvelope(res: Response, channel: string, envelope: SseEnvelope) {
  res.write(`id: ${channel}:${envelope.sequence}\n`)
  res.write('event: parkly_event\n')
  res.write(`data: ${toJson(envelope)}\n\n`)
}

export function writeSseComment(res: Response, comment: string) {
  res.write(`: ${comment}\n\n`)
}

export function parseLastEventSequence(raw: string | null | undefined, channel: string): number | null {
  const value = String(raw ?? '').trim()
  if (!value) return null

  const prefix = `${channel}:`
  if (value.startsWith(prefix)) {
    const sequence = Number(value.slice(prefix.length))
    return Number.isFinite(sequence) && sequence > 0 ? Math.trunc(sequence) : null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null
}

export function resolveRequestLastEventSequence(req: Request, channel: string): number | null {
  const queryValue = typeof req.query.lastEventId === 'string' ? req.query.lastEventId : null
  const headerValue = typeof req.header('last-event-id') === 'string' ? req.header('last-event-id') : null
  return parseLastEventSequence(queryValue ?? headerValue, channel)
}

function sortForStability(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForStability)
  if (!value || typeof value !== 'object') return value

  const input = value as Record<string, unknown>
  const output: Record<string, unknown> = {}
  for (const key of Object.keys(input).sort()) {
    output[key] = sortForStability(input[key])
  }
  return output
}

export function stableStringify(value: unknown): string {
  return toJson(sortForStability(value))
}

export function keyOf(parts: Array<string | number | null | undefined>) {
  return parts.map((part) => String(part ?? '')).join('::')
}

export function filterReplayBySite<T extends SseEnvelope>(items: T[], siteCode?: string) {
  const normalized = typeof siteCode === 'string' && siteCode.trim() ? siteCode.trim() : null
  if (!normalized) return items
  return items.filter((item) => item.siteCode == null || item.siteCode === normalized)
}

export function createRowDiff<T>(rows: T[], keyFn: (row: T) => string) {
  const map = new Map<string, { row: T; fingerprint: string }>()
  for (const row of rows) {
    map.set(keyFn(row), { row, fingerprint: stableStringify(row) })
  }
  return map
}

export function diffRowMaps<T>(
  previous: Map<string, { row: T; fingerprint: string }>,
  current: Map<string, { row: T; fingerprint: string }>,
) {
  const upserts: T[] = []
  const removes: string[] = []

  for (const [key, value] of current.entries()) {
    const prev = previous.get(key)
    if (!prev || prev.fingerprint !== value.fingerprint) upserts.push(value.row)
  }

  for (const key of previous.keys()) {
    if (!current.has(key)) removes.push(key)
  }

  return { upserts, removes }
}

export function resetSseReplayMemory(channel?: string) {
  if (channel) {
    memoryReplay.delete(channel)
    return
  }
  memoryReplay.clear()
}
