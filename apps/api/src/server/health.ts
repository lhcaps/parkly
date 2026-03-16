import fs from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import path from 'node:path'

import { config } from './config'
import type { RedisHealthSnapshot } from '../lib/redis'
import type { ObjectStorageHealthSnapshot } from '../lib/object-storage'
import { readRuntimeMarker } from './observability-runtime'
import { evaluateSecretHygiene, type SecretProfile } from '../lib/security/secret-hygiene'
import { resolveDeviceCaptureDefaultRotation, resolveInternalServiceTokenRotation } from '../lib/security/secret-rotation'
import { getSecretSafetyDebugSummary } from './metrics'

export type HealthComponentStatus = 'READY' | 'DEGRADED' | 'NOT_READY' | 'MISCONFIGURED'

export type DbHealthSnapshot = {
  available: boolean
  latencyMs: number | null
  error: string | null
}

type BuildHealthDeps = {
  probeDb: () => Promise<DbHealthSnapshot>
  getRedisHealth: () => Promise<RedisHealthSnapshot>
  getObjectStorageHealth: () => Promise<ObjectStorageHealthSnapshot>
  readCleanupMarker?: typeof readRuntimeMarker
  now?: () => Date
}

function sanitizeError(error: unknown) {
  const message = String((error as { message?: unknown } | null | undefined)?.message ?? error ?? 'Unknown health probe error').trim()
  return message || 'Unknown health probe error'
}


function resolveSecretProfile(): SecretProfile {
  const raw = String(process.env.PARKLY_DEPLOYMENT_PROFILE ?? 'DEMO').trim().toUpperCase()
  if (raw === 'LOCAL_DEV') return 'local-dev'
  if (raw === 'RELEASE_CANDIDATE') return 'release-candidate'
  return 'demo'
}

function deriveSecretSafetyStatus(args: { profile: SecretProfile; hygieneOk: boolean; errorFields: number; warnFields: number }): HealthComponentStatus {
  if (!args.hygieneOk || args.errorFields > 0) return args.profile === 'release-candidate' ? 'MISCONFIGURED' : 'DEGRADED'
  if (args.warnFields > 0) return 'DEGRADED'
  return 'READY'
}

function localUploadDir() {
  return path.resolve(process.cwd(), config.upload.dir)
}

async function getLocalMediaHealth() {
  try {
    await fs.mkdir(localUploadDir(), { recursive: true })
    await fs.access(localUploadDir(), fsConstants.R_OK | fsConstants.W_OK)
    return {
      status: 'READY' as HealthComponentStatus,
      driver: 'LOCAL',
      configured: true,
      writable: true,
      uploadDir: localUploadDir(),
      lastError: null,
    }
  } catch (error) {
    return {
      status: 'NOT_READY' as HealthComponentStatus,
      driver: 'LOCAL',
      configured: true,
      writable: false,
      uploadDir: localUploadDir(),
      lastError: sanitizeError(error),
    }
  }
}

function deriveRedisStatus(redis: RedisHealthSnapshot): HealthComponentStatus {
  if (!redis.configured) return redis.required ? 'MISCONFIGURED' : 'DEGRADED'
  if (redis.available) return 'READY'
  return redis.required ? 'NOT_READY' : 'DEGRADED'
}

function deriveObjectStorageStatus(storage: ObjectStorageHealthSnapshot): HealthComponentStatus {
  if (!storage.configured) return 'MISCONFIGURED'
  if (storage.available) return 'READY'
  return 'NOT_READY'
}

export async function buildHealthBreakdown(deps: BuildHealthDeps) {
  const now = deps.now?.() ?? new Date()
  const [db, redis, objectStorage, cleanupMarker, retentionMarker] = await Promise.all([
    deps.probeDb(),
    deps.getRedisHealth(),
    config.media.driver === 'LOCAL'
      ? Promise.resolve({
        configured: false,
        available: false,
        degraded: false,
        endpoint: null,
        region: null,
        bucket: null,
        forcePathStyle: false,
        useSsl: false,
        lastCheckAt: null,
        lastError: null,
      })
      : deps.getObjectStorageHealth(),
    (deps.readCleanupMarker ?? readRuntimeMarker)('auth-session-cleanup'),
    (deps.readCleanupMarker ?? readRuntimeMarker)('retention-cleanup'),
  ])

  const dbStatus: HealthComponentStatus = db.available ? 'READY' : 'NOT_READY'
  const intakeConfigured = Boolean(String(process.env.INTERNAL_PRESENCE_API_KEY ?? '').trim() && String(process.env.INTERNAL_PRESENCE_HMAC_SECRET ?? '').trim())
  const intakeStatus: HealthComponentStatus = intakeConfigured ? 'READY' : 'MISCONFIGURED'
  const redisStatus = deriveRedisStatus(redis)

  const mediaStorage = config.media.driver === 'LOCAL'
    ? await getLocalMediaHealth()
    : {
        status: deriveObjectStorageStatus(objectStorage),
        driver: config.media.driver,
        configured: objectStorage.configured,
        available: objectStorage.available,
        endpoint: objectStorage.endpoint,
        bucket: objectStorage.bucket,
        lastError: objectStorage.lastError,
      }

  const maxCleanupAgeMinutes = Number(process.env.OBS_BACKGROUND_JOB_MAX_AGE_MINUTES ?? '1440') || 1440
  const maxRetentionAgeMinutes = Number(process.env.OBS_RETENTION_JOB_MAX_AGE_MINUTES ?? process.env.OBS_BACKGROUND_JOB_MAX_AGE_MINUTES ?? '1440') || 1440
  const cleanupLastRunAt = typeof cleanupMarker?.updatedAt === 'string' ? cleanupMarker.updatedAt : null
  const cleanupAgeMinutes = cleanupLastRunAt
    ? Math.max(0, (now.getTime() - new Date(cleanupLastRunAt).getTime()) / 60_000)
    : null
  const cleanupStatus: HealthComponentStatus = cleanupLastRunAt == null
    ? 'DEGRADED'
    : cleanupAgeMinutes != null && cleanupAgeMinutes > maxCleanupAgeMinutes
      ? 'DEGRADED'
      : String(cleanupMarker?.outcome ?? '').toUpperCase() === 'FAIL'
        ? 'DEGRADED'
        : 'READY'

  const retentionLastRunAt = typeof retentionMarker?.updatedAt === 'string' ? retentionMarker.updatedAt : null
  const retentionAgeMinutes = retentionLastRunAt
    ? Math.max(0, (now.getTime() - new Date(retentionLastRunAt).getTime()) / 60_000)
    : null
  const retentionStatus: HealthComponentStatus = retentionLastRunAt == null
    ? 'DEGRADED'
    : retentionAgeMinutes != null && retentionAgeMinutes > maxRetentionAgeMinutes
      ? 'DEGRADED'
      : String(retentionMarker?.outcome ?? '').toUpperCase() === 'FAIL'
        ? 'DEGRADED'
        : 'READY'

  const secretProfile = resolveSecretProfile()
  const secretIntent = secretProfile === 'release-candidate' ? 'pilot' : 'smoke'
  const secretHygiene = evaluateSecretHygiene({ profile: secretProfile, intent: secretIntent, env: process.env })
  const internalRotation = resolveInternalServiceTokenRotation(process.env)
  const deviceRotation = resolveDeviceCaptureDefaultRotation(process.env)
  const secretSafetyMetrics = getSecretSafetyDebugSummary()
  const secretSafetyStatus = deriveSecretSafetyStatus({
    profile: secretProfile,
    hygieneOk: secretHygiene.ok,
    errorFields: secretHygiene.summary.errorFields,
    warnFields: secretHygiene.summary.warnFields,
  })

  const components = {
    db: {
      status: dbStatus,
      available: db.available,
      latencyMs: db.latencyMs,
      lastError: db.error,
    },
    redis: {
      status: redisStatus,
      ...redis,
    },
    mediaStorage,
    intakeSigning: {
      status: intakeStatus,
      configured: intakeConfigured,
      apiKeyConfigured: Boolean(String(process.env.INTERNAL_PRESENCE_API_KEY ?? '').trim()),
      hmacSecretConfigured: Boolean(String(process.env.INTERNAL_PRESENCE_HMAC_SECRET ?? '').trim()),
    },
    secretSafety: {
      status: secretSafetyStatus,
      profile: secretProfile,
      intent: secretIntent,
      hygiene: {
        ok: secretHygiene.ok,
        summary: secretHygiene.summary,
        findings: secretHygiene.findings,
      },
      internalServiceRotation: {
        mode: internalRotation.mode,
        rotationEnabled: internalRotation.rotationEnabled,
        acceptedFingerprints: internalRotation.accepted.map((item) => item.fingerprint),
      },
      deviceCaptureRotation: {
        mode: deviceRotation.mode,
        rotationEnabled: deviceRotation.rotationEnabled,
        acceptedFingerprints: deviceRotation.accepted.map((item) => item.fingerprint),
      },
      observed: secretSafetyMetrics,
      mismatchSpikeHint: secretSafetyMetrics.hints.length > 0 ? secretSafetyMetrics.hints[0] : null,
      recommendedCommands: [
        'pnpm --dir apps/api secrets:check -- --profile release-candidate --intent pilot',
        'pnpm --dir apps/api secrets:rotation:check',
      ],
    },
    backgroundJobs: {
      status: cleanupStatus === 'READY' && retentionStatus === 'READY' ? 'READY' : 'DEGRADED',
      authSessionCleanup: {
        status: cleanupStatus,
        lastRunAt: cleanupLastRunAt,
        ageMinutes: cleanupAgeMinutes == null ? null : Number(cleanupAgeMinutes.toFixed(2)),
        maxAgeMinutes: maxCleanupAgeMinutes,
        outcome: cleanupMarker?.outcome ?? null,
        retentionDays: {
          expired: config.auth.sessionHygiene.cleanupExpiredRetentionDays,
          revoked: config.auth.sessionHygiene.cleanupRevokedRetentionDays,
        },
        batchLimit: config.auth.sessionHygiene.cleanupBatchLimit,
        recommendedCommand: 'pnpm --dir apps/api auth:sessions:cleanup',
      },
      retentionCleanup: {
        status: retentionStatus,
        lastRunAt: retentionLastRunAt,
        ageMinutes: retentionAgeMinutes == null ? null : Number(retentionAgeMinutes.toFixed(2)),
        maxAgeMinutes: maxRetentionAgeMinutes,
        outcome: retentionMarker?.outcome ?? null,
        profile: retentionMarker?.profile ?? null,
        mode: retentionMarker?.mode ?? null,
        recommendedCommand: 'pnpm --dir apps/api cleanup:retention:dry-run && pnpm --dir apps/api cleanup:retention',
      },
    },
  }

  const ready = dbStatus === 'READY'
    && intakeStatus === 'READY'
    && mediaStorage.status === 'READY'
    && secretSafetyStatus !== 'MISCONFIGURED'
    && (!redis.required || redisStatus === 'READY')

  const degraded = !ready || cleanupStatus !== 'READY' || retentionStatus !== 'READY' || redisStatus === 'DEGRADED'

  return {
    ok: true,
    ready,
    status: ready ? (degraded ? 'DEGRADED' : 'READY') : 'NOT_READY',
    ts: now.toISOString(),
    components,
    dependencies: {
      db: components.db,
      redis,
      objectStorage,
      intakeSigning: components.intakeSigning,
      secretSafety: components.secretSafety,
      backgroundJobs: components.backgroundJobs,
    },
  }
}
