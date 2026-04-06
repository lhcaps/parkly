import { createHmac, createHash, timingSafeEqual } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '../../../lib/prisma'
import { config } from '../../../server/config'
import { buildRedisKey, runRedisCommand } from '../../../lib/redis'
import { ApiError } from '../../../server/http'
import { observeSecretMissingAuthHeader, observeSecretReject } from '../../../server/metrics'

export const ZONE_PRESENCE_SCHEMA_VERSION = 'zone.presence.v1'

const ZonePresenceEventSchema = z.object({
  schemaVersion: z.string().trim().min(1).max(32),
  cameraCode: z.string().trim().min(1).max(64),
  zoneCode: z.string().trim().min(1).max(32),
  spotCode: z.string().trim().min(1).max(32),
  plateCompact: z.string().trim().max(32).optional().nullable(),
  confidence: z.coerce.number().min(0).max(1),
  capturedAt: z.string().datetime(),
  snapshotObjectKey: z.string().trim().max(255).optional().nullable(),
  modelVersion: z.string().trim().max(64).optional().nullable(),
  traceId: z.string().trim().max(128).optional().nullable(),
})

export type ZonePresenceEventInput = z.infer<typeof ZonePresenceEventSchema>

export type InternalPresenceIntakeStatus = 'ACCEPTED' | 'DEDUPED' | 'REJECTED'

export type ZonePresenceIntakeResult = {
  status: InternalPresenceIntakeStatus
  reasonCode: string
  schemaVersion: string
  idempotencyKey: string
  traceId: string | null
  presenceEventId: string | null
  deduped: boolean
  siteId: string | null
  zoneId: string | null
  spotId: string | null
  streamId: string | null
}

type ZonePresenceResolvedLocation = {
  siteId: bigint | null
  zoneId: bigint | null
  spotId: bigint | null
}

type PersistPresenceEventArgs = {
  schemaVersion: string
  intakeStatus: 'ACCEPTED' | 'REJECTED'
  rejectReasonCode: string | null
  idempotencyKey: string
  traceId: string | null
  cameraCode: string
  zoneCode: string
  spotCode: string
  plateCompact: string | null
  confidence: number
  capturedAt: Date
  snapshotObjectKey: string | null
  modelVersion: string | null
  siteId: bigint | null
  zoneId: bigint | null
  spotId: bigint | null
  rawEventJson: unknown
  redisStreamId?: string | null
}

type ExistingPresenceEventRow = {
  presenceEventId: bigint
  intakeStatus: 'ACCEPTED' | 'REJECTED'
  rejectReasonCode: string | null
  schemaVersion: string
  idempotencyKey: string
  traceId: string | null
  siteId: bigint | null
  zoneId: bigint | null
  spotId: bigint | null
  redisStreamId: string | null
}

type PresenceIntakeDeps = {
  now: () => Date
  maxSkewSeconds: number
  verifyRequest: (args: { body: ZonePresenceEventInput; apiKey: string | null; timestamp: string | null; signature: string | null }) => void
  resolveLocation: (args: { zoneCode: string; spotCode: string }) => Promise<ZonePresenceResolvedLocation>
  findByIdempotencyKey: (idempotencyKey: string) => Promise<ExistingPresenceEventRow | null>
  persistEvent: (args: PersistPresenceEventArgs) => Promise<{ presenceEventId: bigint }>
  publishToRedisStream: (payload: Record<string, string>) => Promise<string | null>
}

function normalizePlate(value?: string | null) {
  const v = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return v || null
}

function normalizeNullableString(value?: string | null, maxLen?: number) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null
  return maxLen ? trimmed.slice(0, maxLen) : trimmed
}

function envString(name: string, fallback = '') {
  return String(process.env[name] ?? fallback).trim()
}

function envInt(name: string, fallback: number) {
  const parsed = Number(process.env[name])
  return Number.isFinite(parsed) ? parsed : fallback
}

function bufferEq(left: string, right: string) {
  const leftBuf = Buffer.from(left)
  const rightBuf = Buffer.from(right)
  if (leftBuf.length !== rightBuf.length) return false
  return timingSafeEqual(leftBuf, rightBuf)
}

function buildSignatureBase(body: ZonePresenceEventInput, timestamp: string) {
  return [
    body.schemaVersion,
    timestamp,
    body.traceId ?? '',
    body.cameraCode,
    body.zoneCode,
    body.spotCode,
    normalizePlate(body.plateCompact) ?? '',
    body.capturedAt,
    body.snapshotObjectKey ?? '',
    body.modelVersion ?? '',
    Number(body.confidence).toFixed(4),
  ].join('\n')
}

export function computeZonePresenceSignature(args: {
  body: ZonePresenceEventInput
  timestamp: string
  secret: string
}) {
  return createHmac('sha256', args.secret).update(buildSignatureBase(args.body, args.timestamp)).digest('hex')
}

export function deriveZonePresenceIdempotencyKey(body: ZonePresenceEventInput) {
  const stableTrace = normalizeNullableString(body.traceId, 128)
  if (stableTrace) return `trace:${stableTrace}`

  return createHash('sha256')
    .update([
      body.schemaVersion,
      body.cameraCode,
      body.zoneCode,
      body.spotCode,
      normalizePlate(body.plateCompact) ?? '',
      body.capturedAt,
    ].join('|'))
    .digest('hex')
}

export function getDefaultZonePresenceIntakeDeps(): PresenceIntakeDeps {
  return {
    now: () => new Date(),
    maxSkewSeconds: envInt('INTERNAL_PRESENCE_MAX_SKEW_SECONDS', 300),
    verifyRequest: ({ body, apiKey, timestamp, signature }) => {
      const expectedApiKey = envString('INTERNAL_PRESENCE_API_KEY', config.tokens.WORKER)
      const secret = envString('INTERNAL_PRESENCE_HMAC_SECRET', envString('DEVICE_CAPTURE_DEFAULT_SECRET'))
      const ts = normalizeNullableString(timestamp, 64)
      const sig = normalizeNullableString(signature, 256)

      if (!expectedApiKey || !secret) {
        throw new ApiError({ code: 'SERVICE_UNAVAILABLE', message: 'Internal presence intake auth is not configured' })
      }

      if (!apiKey) {
        observeSecretMissingAuthHeader({ channel: 'INTERNAL_PRESENCE' })
        observeSecretReject({ channel: 'INTERNAL_PRESENCE', reason: 'MISSING_API_KEY' })
        throw new ApiError({ code: 'FORBIDDEN', message: 'Invalid internal presence API key' })
      }

      if (apiKey !== expectedApiKey) {
        observeSecretReject({ channel: 'INTERNAL_PRESENCE', reason: 'INVALID_API_KEY' })
        throw new ApiError({ code: 'FORBIDDEN', message: 'Invalid internal presence API key' })
      }

      if (!ts || !/^\d+$/.test(ts)) {
        observeSecretReject({ channel: 'INTERNAL_PRESENCE', reason: 'INVALID_TIMESTAMP' })
        throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Missing or invalid internal presence timestamp' })
      }

      const tsSeconds = Number(ts)
      const nowSeconds = Math.floor(Date.now() / 1000)
      if (Math.abs(nowSeconds - tsSeconds) > envInt('INTERNAL_PRESENCE_MAX_SKEW_SECONDS', 300)) {
        observeSecretReject({ channel: 'INTERNAL_PRESENCE', reason: 'TIMESTAMP_EXPIRED' })
        throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Internal presence signature timestamp expired' })
      }

      if (!sig) {
        observeSecretMissingAuthHeader({ channel: 'INTERNAL_PRESENCE' })
        observeSecretReject({ channel: 'INTERNAL_PRESENCE', reason: 'MISSING_SIGNATURE' })
        throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Missing internal presence signature' })
      }

      const expected = computeZonePresenceSignature({ body, timestamp: ts, secret })
      if (!bufferEq(expected, sig)) {
        observeSecretReject({ channel: 'INTERNAL_PRESENCE', reason: 'INVALID_SIGNATURE' })
        throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Invalid internal presence signature' })
      }
    },
    resolveLocation: async ({ zoneCode, spotCode }) => {
      const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT
          z.site_id AS siteId,
          z.zone_id AS zoneId,
          s.spot_id AS spotId
        FROM zones z
        LEFT JOIN spots s
          ON s.site_id = z.site_id
         AND s.zone_id = z.zone_id
         AND s.code = ${spotCode}
        WHERE z.code = ${zoneCode}
      `)

      if (rows.length === 0) {
        return { siteId: null, zoneId: null, spotId: null }
      }

      const withSpot = rows.filter((row) => row.spotId != null)
      if (withSpot.length === 1) {
        return {
          siteId: BigInt(withSpot[0].siteId as any),
          zoneId: BigInt(withSpot[0].zoneId as any),
          spotId: BigInt(withSpot[0].spotId as any),
        }
      }

      const distinctSites = Array.from(new Set(rows.map((row) => String(row.siteId ?? '')))).filter(Boolean)
      if (distinctSites.length !== 1) {
        return { siteId: null, zoneId: null, spotId: null }
      }

      if (withSpot.length !== 1) {
        return { siteId: BigInt(rows[0].siteId as any), zoneId: BigInt(rows[0].zoneId as any), spotId: null }
      }

      return {
        siteId: BigInt(withSpot[0].siteId as any),
        zoneId: BigInt(withSpot[0].zoneId as any),
        spotId: BigInt(withSpot[0].spotId as any),
      }
    },
    findByIdempotencyKey: async (idempotencyKey) => {
      const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT
          presence_event_id AS presenceEventId,
          intake_status AS intakeStatus,
          reject_reason_code AS rejectReasonCode,
          schema_version AS schemaVersion,
          idempotency_key AS idempotencyKey,
          trace_id AS traceId,
          site_id AS siteId,
          zone_id AS zoneId,
          spot_id AS spotId,
          redis_stream_id AS redisStreamId
        FROM internal_presence_events
        WHERE idempotency_key = ${idempotencyKey}
        LIMIT 1
      `)
      const row = rows[0]
      if (!row) return null
      return {
        presenceEventId: BigInt(row.presenceEventId as any),
        intakeStatus: String(row.intakeStatus) as 'ACCEPTED' | 'REJECTED',
        rejectReasonCode: row.rejectReasonCode == null ? null : String(row.rejectReasonCode),
        schemaVersion: String(row.schemaVersion),
        idempotencyKey: String(row.idempotencyKey),
        traceId: row.traceId == null ? null : String(row.traceId),
        siteId: row.siteId == null ? null : BigInt(row.siteId as any),
        zoneId: row.zoneId == null ? null : BigInt(row.zoneId as any),
        spotId: row.spotId == null ? null : BigInt(row.spotId as any),
        redisStreamId: row.redisStreamId == null ? null : String(row.redisStreamId),
      }
    },
    persistEvent: async (args) => {
      const rawJson = JSON.stringify(args.rawEventJson ?? null)
      const insert = await prisma.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
        INSERT INTO internal_presence_events (
          schema_version,
          intake_status,
          reject_reason_code,
          idempotency_key,
          trace_id,
          camera_code,
          zone_code,
          spot_code,
          plate_compact,
          confidence,
          captured_at,
          snapshot_object_key,
          model_version,
          site_id,
          zone_id,
          spot_id,
          redis_stream_id,
          raw_event_json
        ) VALUES (
          ${args.schemaVersion},
          ${args.intakeStatus},
          ${args.rejectReasonCode},
          ${args.idempotencyKey},
          ${args.traceId},
          ${args.cameraCode},
          ${args.zoneCode},
          ${args.spotCode},
          ${args.plateCompact},
          ${args.confidence},
          ${args.capturedAt},
          ${args.snapshotObjectKey},
          ${args.modelVersion},
          ${args.siteId},
          ${args.zoneId},
          ${args.spotId},
          ${args.redisStreamId ?? null},
          CAST(${rawJson} AS JSON)
        ) RETURNING presence_event_id AS id
      `).catch(async (error) => {
        const message = String((error as any)?.message ?? '')
        if (!message.includes('RETURNING')) throw error
        await prisma.$executeRaw(Prisma.sql`
          INSERT INTO internal_presence_events (
            schema_version,
            intake_status,
            reject_reason_code,
            idempotency_key,
            trace_id,
            camera_code,
            zone_code,
            spot_code,
            plate_compact,
            confidence,
            captured_at,
            snapshot_object_key,
            model_version,
            site_id,
            zone_id,
            spot_id,
            redis_stream_id,
            raw_event_json
          ) VALUES (
            ${args.schemaVersion},
            ${args.intakeStatus},
            ${args.rejectReasonCode},
            ${args.idempotencyKey},
            ${args.traceId},
            ${args.cameraCode},
            ${args.zoneCode},
            ${args.spotCode},
            ${args.plateCompact},
            ${args.confidence},
            ${args.capturedAt},
            ${args.snapshotObjectKey},
            ${args.modelVersion},
            ${args.siteId},
            ${args.zoneId},
            ${args.spotId},
            ${args.redisStreamId ?? null},
            CAST(${rawJson} AS JSON)
          )
        `)
        return [] as Array<{ id: bigint }>
      })

      const insertedId = insert[0]?.id
      if (insertedId != null) return { presenceEventId: BigInt(insertedId as any) }

      const row = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT presence_event_id AS presenceEventId
        FROM internal_presence_events
        WHERE idempotency_key = ${args.idempotencyKey}
        LIMIT 1
      `)
      return { presenceEventId: BigInt(row[0].presenceEventId as any) }
    },
    publishToRedisStream: async (payload) => {
      try {
        const streamKey = envString('INTERNAL_PRESENCE_STREAM_KEY', buildRedisKey('internal-presence-events'))
        return await runRedisCommand('XADD', async (client) => {
          const flat = Object.entries(payload).flatMap(([key, value]) => [key, value])
          if (flat.length === 0) return null
          const streamId = await client.xadd(streamKey, '*', ...flat)
          return streamId ?? null
        })
      } catch {
        return null
      }
    },
  }
}

export async function ingestZonePresenceEvent(args: {
  body: unknown
  apiKey?: string | null
  signature?: string | null
  timestamp?: string | null
  deps?: Partial<PresenceIntakeDeps>
}): Promise<ZonePresenceIntakeResult> {
  const parsed = ZonePresenceEventSchema.safeParse(args.body)
  if (!parsed.success) {
    throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid zone presence payload', details: parsed.error.flatten() })
  }

  const body = {
    ...parsed.data,
    plateCompact: normalizePlate(parsed.data.plateCompact),
    snapshotObjectKey: normalizeNullableString(parsed.data.snapshotObjectKey, 255),
    modelVersion: normalizeNullableString(parsed.data.modelVersion, 64),
    traceId: normalizeNullableString(parsed.data.traceId, 128),
  }

  const deps = { ...getDefaultZonePresenceIntakeDeps(), ...(args.deps ?? {}) }
  deps.verifyRequest({ body, apiKey: args.apiKey ?? null, timestamp: args.timestamp ?? null, signature: args.signature ?? null })

  const idempotencyKey = deriveZonePresenceIdempotencyKey(body)
  const existing = await deps.findByIdempotencyKey(idempotencyKey)
  if (existing) {
    return {
      status: 'DEDUPED',
      reasonCode: existing.intakeStatus === 'REJECTED' ? existing.rejectReasonCode ?? 'DEDUPED_REJECTED' : 'DEDUPED',
      schemaVersion: existing.schemaVersion,
      idempotencyKey: existing.idempotencyKey,
      traceId: existing.traceId,
      presenceEventId: String(existing.presenceEventId),
      deduped: true,
      siteId: existing.siteId == null ? null : String(existing.siteId),
      zoneId: existing.zoneId == null ? null : String(existing.zoneId),
      spotId: existing.spotId == null ? null : String(existing.spotId),
      streamId: existing.redisStreamId,
    }
  }

  if (body.schemaVersion !== envString('INTERNAL_PRESENCE_SCHEMA_VERSION', ZONE_PRESENCE_SCHEMA_VERSION)) {
    const persisted = await deps.persistEvent({
      schemaVersion: body.schemaVersion,
      intakeStatus: 'REJECTED',
      rejectReasonCode: 'UNSUPPORTED_SCHEMA_VERSION',
      idempotencyKey,
      traceId: body.traceId,
      cameraCode: body.cameraCode,
      zoneCode: body.zoneCode,
      spotCode: body.spotCode,
      plateCompact: body.plateCompact,
      confidence: body.confidence,
      capturedAt: new Date(body.capturedAt),
      snapshotObjectKey: body.snapshotObjectKey,
      modelVersion: body.modelVersion,
      siteId: null,
      zoneId: null,
      spotId: null,
      rawEventJson: body,
      redisStreamId: null,
    })

    return {
      status: 'REJECTED',
      reasonCode: 'UNSUPPORTED_SCHEMA_VERSION',
      schemaVersion: body.schemaVersion,
      idempotencyKey,
      traceId: body.traceId,
      presenceEventId: String(persisted.presenceEventId),
      deduped: false,
      siteId: null,
      zoneId: null,
      spotId: null,
      streamId: null,
    }
  }

  const capturedAt = new Date(body.capturedAt)
  const skewMs = Math.abs(deps.now().getTime() - capturedAt.getTime())
  if (!Number.isFinite(capturedAt.getTime()) || skewMs > deps.maxSkewSeconds * 1000) {
    const persisted = await deps.persistEvent({
      schemaVersion: body.schemaVersion,
      intakeStatus: 'REJECTED',
      rejectReasonCode: 'CAPTURED_AT_OUT_OF_RANGE',
      idempotencyKey,
      traceId: body.traceId,
      cameraCode: body.cameraCode,
      zoneCode: body.zoneCode,
      spotCode: body.spotCode,
      plateCompact: body.plateCompact,
      confidence: body.confidence,
      capturedAt: Number.isFinite(capturedAt.getTime()) ? capturedAt : deps.now(),
      snapshotObjectKey: body.snapshotObjectKey,
      modelVersion: body.modelVersion,
      siteId: null,
      zoneId: null,
      spotId: null,
      rawEventJson: body,
      redisStreamId: null,
    })

    return {
      status: 'REJECTED',
      reasonCode: 'CAPTURED_AT_OUT_OF_RANGE',
      schemaVersion: body.schemaVersion,
      idempotencyKey,
      traceId: body.traceId,
      presenceEventId: String(persisted.presenceEventId),
      deduped: false,
      siteId: null,
      zoneId: null,
      spotId: null,
      streamId: null,
    }
  }

  const resolved = await deps.resolveLocation({ zoneCode: body.zoneCode, spotCode: body.spotCode })
  const rejectReason = resolved.zoneId == null ? 'ZONE_OR_SPOT_NOT_FOUND' : resolved.spotId == null ? 'SPOT_NOT_FOUND' : null

  const redisStreamId = rejectReason
    ? null
    : await deps.publishToRedisStream({
        schemaVersion: body.schemaVersion,
        idempotencyKey,
        traceId: body.traceId ?? '',
        cameraCode: body.cameraCode,
        zoneCode: body.zoneCode,
        spotCode: body.spotCode,
        plateCompact: body.plateCompact ?? '',
        confidence: Number(body.confidence).toFixed(4),
        capturedAt: capturedAt.toISOString(),
        snapshotObjectKey: body.snapshotObjectKey ?? '',
        modelVersion: body.modelVersion ?? '',
        siteId: resolved.siteId == null ? '' : String(resolved.siteId),
        zoneId: resolved.zoneId == null ? '' : String(resolved.zoneId),
        spotId: resolved.spotId == null ? '' : String(resolved.spotId),
      })

  const persisted = await deps.persistEvent({
    schemaVersion: body.schemaVersion,
    intakeStatus: rejectReason ? 'REJECTED' : 'ACCEPTED',
    rejectReasonCode: rejectReason,
    idempotencyKey,
    traceId: body.traceId,
    cameraCode: body.cameraCode,
    zoneCode: body.zoneCode,
    spotCode: body.spotCode,
    plateCompact: body.plateCompact,
    confidence: body.confidence,
    capturedAt,
    snapshotObjectKey: body.snapshotObjectKey,
    modelVersion: body.modelVersion,
    siteId: resolved.siteId,
    zoneId: resolved.zoneId,
    spotId: resolved.spotId,
    rawEventJson: body,
    redisStreamId,
  })

  return {
    status: rejectReason ? 'REJECTED' : 'ACCEPTED',
    reasonCode: rejectReason ?? 'ACCEPTED',
    schemaVersion: body.schemaVersion,
    idempotencyKey,
    traceId: body.traceId,
    presenceEventId: String(persisted.presenceEventId),
    deduped: false,
    siteId: resolved.siteId == null ? null : String(resolved.siteId),
    zoneId: resolved.zoneId == null ? null : String(resolved.zoneId),
    spotId: resolved.spotId == null ? null : String(resolved.spotId),
    streamId: redisStreamId,
  }
}
