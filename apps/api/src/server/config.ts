import { z } from 'zod'
import type { AuthRole as CanonicalAuthRole } from '@parkly/contracts'

import { getNextRotationSecretValue, getPrimaryRotationSecretValue, resolveInternalServiceTokenRotation } from '../lib/security/secret-rotation'

const intFromEnv = (name: string, fallback: number) => {
  const raw = process.env[name]
  if (!raw || raw.trim() === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

const stringListFromEnv = (name: string, fallback: string[] = []) => {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return fallback
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const intListFromEnv = (name: string, fallback: number[]) => {
  const values = stringListFromEnv(name)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0)
  return values.length > 0 ? values : fallback
}

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

const optionalUrlEnv = z.preprocess(emptyStringToUndefined, z.string().url().optional())
const optionalStringEnv = z.preprocess(emptyStringToUndefined, z.string().optional())

export type LegacyAppRole = 'ADMIN' | 'OPS' | 'WORKER'
export type AppRole = CanonicalAuthRole | LegacyAppRole
export type AlprMode = 'MOCK' | 'TESSERACT' | 'DISABLED'
export type AlprProviderName = 'LOCAL' | 'HTTP' | 'OCRSPACE' | 'PLATE_RECOGNIZER'

export const config = (() => {
  const schema = z.object({
    API_HOST: z.string().default('127.0.0.1'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    API_PREFIX: z.string().default('/api'),

    API_AUTH_MODE: z.enum(['ON', 'OFF']).default('ON'),
    API_ADMIN_TOKEN: optionalStringEnv,
    API_OPS_TOKEN: optionalStringEnv,
    API_GUARD_TOKEN: optionalStringEnv,
    API_WORKER_TOKEN: optionalStringEnv,
    API_CASHIER_TOKEN: optionalStringEnv,
    API_EDGE_SYNC_KEY: z.string().optional(),
    API_LEGACY_ROLE_TOKENS: z.enum(['ON', 'OFF']).default('OFF'),

    API_AUTH_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().optional(),
    API_AUTH_REFRESH_TTL_DAYS: z.coerce.number().int().positive().optional(),
    API_AUTH_LOGIN_THROTTLE_WINDOW_SECONDS: z.coerce.number().int().positive().optional(),
    API_AUTH_LOGIN_FAILURE_LOCKOUT_THRESHOLD: z.coerce.number().int().positive().optional(),
    API_AUTH_LOGIN_LOCKOUT_SECONDS: z.coerce.number().int().positive().optional(),
    API_AUTH_LOGIN_PROGRESSIVE_DELAY_MS: z.coerce.number().int().min(0).optional(),
    API_AUTH_LOGIN_PROGRESSIVE_DELAY_MAX_MS: z.coerce.number().int().min(0).optional(),
    API_AUTH_SESSION_LIMIT_PER_USER: z.coerce.number().int().positive().optional(),
    API_AUTH_SESSION_CLEANUP_EXPIRED_RETENTION_DAYS: z.coerce.number().int().positive().optional(),
    API_AUTH_SESSION_CLEANUP_REVOKED_RETENTION_DAYS: z.coerce.number().int().positive().optional(),
    API_AUTH_SESSION_CLEANUP_BATCH_LIMIT: z.coerce.number().int().positive().optional(),
    API_AUTH_PASSWORD_MIN_LENGTH: z.coerce.number().int().positive().optional(),
    API_AUTH_PASSWORD_REQUIRE_UPPERCASE: z.enum(['ON', 'OFF']).default('ON'),
    API_AUTH_PASSWORD_REQUIRE_LOWERCASE: z.enum(['ON', 'OFF']).default('ON'),
    API_AUTH_PASSWORD_REQUIRE_DIGIT: z.enum(['ON', 'OFF']).default('ON'),
    API_AUTH_PASSWORD_REQUIRE_SPECIAL: z.enum(['ON', 'OFF']).default('ON'),
    API_AUTH_BOOTSTRAP_PROFILE: z.enum(['DEMO', 'PRODUCTION']).default('DEMO'),
    API_AUTH_DEMO_SEED_CREDENTIALS: z.enum(['ON', 'OFF']).default('ON'),
    API_INTERNAL_SERVICE_TOKEN: optionalStringEnv,
    API_INTERNAL_SERVICE_TOKEN_ACTIVE: optionalStringEnv,
    API_INTERNAL_SERVICE_TOKEN_NEXT: optionalStringEnv,
    API_INTERNAL_SERVICE_ROLE: z.enum(['SUPER_ADMIN', 'SITE_ADMIN', 'MANAGER', 'CASHIER', 'GUARD', 'OPERATOR', 'VIEWER', 'ADMIN', 'OPS', 'WORKER']).default('WORKER'),

    API_ADMIN_ACTOR_USER_ID: z.coerce.number().int().positive().optional(),
    API_OPS_ACTOR_USER_ID: z.coerce.number().int().positive().optional(),
    API_GUARD_ACTOR_USER_ID: z.coerce.number().int().positive().optional(),
    API_WORKER_ACTOR_USER_ID: z.coerce.number().int().positive().optional(),
    API_CASHIER_ACTOR_USER_ID: z.coerce.number().int().positive().optional(),

    API_CORS_ORIGINS: optionalStringEnv,
    API_RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
    API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional(),
    API_RATE_LIMIT_BACKEND: z.enum(['MEMORY', 'REDIS']).default('MEMORY'),
    API_RATE_LIMIT_PREFIX: optionalStringEnv,

    REDIS_URL: optionalStringEnv,
    REDIS_PREFIX: optionalStringEnv,
    REDIS_DB: z.coerce.number().int().min(0).optional(),
    REDIS_REQUIRED: z.enum(['ON', 'OFF']).default('OFF'),
    REDIS_TLS: z.enum(['ON', 'OFF']).default('OFF'),

    S3_ENDPOINT: optionalStringEnv,
    S3_REGION: optionalStringEnv,
    S3_ACCESS_KEY: optionalStringEnv,
    S3_SECRET_KEY: optionalStringEnv,
    S3_BUCKET_MEDIA: optionalStringEnv,
    S3_FORCE_PATH_STYLE: z.enum(['ON', 'OFF']).default('ON'),
    S3_USE_SSL: z.enum(['ON', 'OFF']).default('OFF'),

    PREVIEW_CACHE_BACKEND: z.enum(['OFF', 'REDIS']).default('OFF'),
    PREVIEW_CACHE_DEDUPE_TTL_MS: z.coerce.number().int().positive().optional(),
    PREVIEW_CACHE_RESPONSE_TTL_MS: z.coerce.number().int().positive().optional(),
    PREVIEW_CACHE_POLL_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    PREVIEW_CACHE_DEBUG_HEADERS: z.enum(['ON', 'OFF']).default('OFF'),

    OUTBOX_WORKER_INTERVAL_MS: z.coerce.number().int().positive().optional(),

    UPLOAD_DIR: z.string().default('uploads'),
    UPLOAD_PUBLIC_PATH: z.string().default('/uploads'),
    UPLOAD_MAX_MB: z.coerce.number().int().positive().default(5),
    MEDIA_STORAGE_DRIVER: z.enum(['LOCAL', 'MINIO']).default('LOCAL'),
    MEDIA_PRESIGN_TTL_SEC: z.coerce.number().int().positive().optional(),

    ALPR_MODE: z.enum(['MOCK', 'TESSERACT', 'DISABLED']).default('MOCK'),
    ALPR_PROVIDER_ORDER: optionalStringEnv,
    ALPR_FAST_PSM_MODES: optionalStringEnv,
    ALPR_DEEP_PSM_MODES: optionalStringEnv,
    ALPR_SLOW_PSM_MODES: optionalStringEnv,
    ALPR_FAST_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    ALPR_DEEP_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    ALPR_EXTERNAL_ESCALATION_THRESHOLD: z.coerce.number().int().positive().optional(),
    ALPR_PREVIEW_MAX_CANDIDATES: z.coerce.number().int().positive().optional(),
    ALPR_PROVINCE_ALLOWLIST: optionalStringEnv,

    ALPR_HTTP_PROVIDER_URL: optionalUrlEnv,
    ALPR_HTTP_PROVIDER_TOKEN: optionalStringEnv,
    ALPR_HTTP_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().optional(),

    ALPR_OCRSPACE_URL: optionalUrlEnv,
    ALPR_OCRSPACE_API_KEY: optionalStringEnv,

    ALPR_PLATE_RECOGNIZER_URL: optionalUrlEnv,
    ALPR_PLATE_RECOGNIZER_TOKEN: optionalStringEnv,
  })

  const parsed = schema.parse({
    API_HOST: process.env.API_HOST,
    API_PORT: process.env.API_PORT,
    API_PREFIX: process.env.API_PREFIX,

    API_AUTH_MODE: process.env.API_AUTH_MODE,
    API_ADMIN_TOKEN: process.env.API_ADMIN_TOKEN,
    API_OPS_TOKEN: process.env.API_OPS_TOKEN,
    API_GUARD_TOKEN: process.env.API_GUARD_TOKEN,
    API_WORKER_TOKEN: process.env.API_WORKER_TOKEN,
    API_CASHIER_TOKEN: process.env.API_CASHIER_TOKEN,
    API_EDGE_SYNC_KEY: process.env.API_EDGE_SYNC_KEY,
    API_LEGACY_ROLE_TOKENS: process.env.API_LEGACY_ROLE_TOKENS,

    API_AUTH_ACCESS_TTL_MINUTES: process.env.API_AUTH_ACCESS_TTL_MINUTES,
    API_AUTH_REFRESH_TTL_DAYS: process.env.API_AUTH_REFRESH_TTL_DAYS,
    API_AUTH_LOGIN_THROTTLE_WINDOW_SECONDS: process.env.API_AUTH_LOGIN_THROTTLE_WINDOW_SECONDS,
    API_AUTH_LOGIN_FAILURE_LOCKOUT_THRESHOLD: process.env.API_AUTH_LOGIN_FAILURE_LOCKOUT_THRESHOLD,
    API_AUTH_LOGIN_LOCKOUT_SECONDS: process.env.API_AUTH_LOGIN_LOCKOUT_SECONDS,
    API_AUTH_LOGIN_PROGRESSIVE_DELAY_MS: process.env.API_AUTH_LOGIN_PROGRESSIVE_DELAY_MS,
    API_AUTH_LOGIN_PROGRESSIVE_DELAY_MAX_MS: process.env.API_AUTH_LOGIN_PROGRESSIVE_DELAY_MAX_MS,
    API_AUTH_SESSION_LIMIT_PER_USER: process.env.API_AUTH_SESSION_LIMIT_PER_USER,
    API_AUTH_SESSION_CLEANUP_EXPIRED_RETENTION_DAYS: process.env.API_AUTH_SESSION_CLEANUP_EXPIRED_RETENTION_DAYS,
    API_AUTH_SESSION_CLEANUP_REVOKED_RETENTION_DAYS: process.env.API_AUTH_SESSION_CLEANUP_REVOKED_RETENTION_DAYS,
    API_AUTH_SESSION_CLEANUP_BATCH_LIMIT: process.env.API_AUTH_SESSION_CLEANUP_BATCH_LIMIT,
    API_AUTH_PASSWORD_MIN_LENGTH: process.env.API_AUTH_PASSWORD_MIN_LENGTH,
    API_AUTH_PASSWORD_REQUIRE_UPPERCASE: process.env.API_AUTH_PASSWORD_REQUIRE_UPPERCASE,
    API_AUTH_PASSWORD_REQUIRE_LOWERCASE: process.env.API_AUTH_PASSWORD_REQUIRE_LOWERCASE,
    API_AUTH_PASSWORD_REQUIRE_DIGIT: process.env.API_AUTH_PASSWORD_REQUIRE_DIGIT,
    API_AUTH_PASSWORD_REQUIRE_SPECIAL: process.env.API_AUTH_PASSWORD_REQUIRE_SPECIAL,
    API_AUTH_BOOTSTRAP_PROFILE: process.env.API_AUTH_BOOTSTRAP_PROFILE,
    API_AUTH_DEMO_SEED_CREDENTIALS: process.env.API_AUTH_DEMO_SEED_CREDENTIALS,
    API_INTERNAL_SERVICE_TOKEN: process.env.API_INTERNAL_SERVICE_TOKEN,
    API_INTERNAL_SERVICE_TOKEN_ACTIVE: process.env.API_INTERNAL_SERVICE_TOKEN_ACTIVE,
    API_INTERNAL_SERVICE_TOKEN_NEXT: process.env.API_INTERNAL_SERVICE_TOKEN_NEXT,
    API_INTERNAL_SERVICE_ROLE: process.env.API_INTERNAL_SERVICE_ROLE,

    API_ADMIN_ACTOR_USER_ID: process.env.API_ADMIN_ACTOR_USER_ID,
    API_OPS_ACTOR_USER_ID: process.env.API_OPS_ACTOR_USER_ID,
    API_GUARD_ACTOR_USER_ID: process.env.API_GUARD_ACTOR_USER_ID,
    API_WORKER_ACTOR_USER_ID: process.env.API_WORKER_ACTOR_USER_ID,
    API_CASHIER_ACTOR_USER_ID: process.env.API_CASHIER_ACTOR_USER_ID,

    API_CORS_ORIGINS: process.env.API_CORS_ORIGINS,
    API_RATE_LIMIT_MAX: process.env.API_RATE_LIMIT_MAX,
    API_RATE_LIMIT_WINDOW_MS: process.env.API_RATE_LIMIT_WINDOW_MS,
    API_RATE_LIMIT_BACKEND: process.env.API_RATE_LIMIT_BACKEND,
    API_RATE_LIMIT_PREFIX: process.env.API_RATE_LIMIT_PREFIX,

    REDIS_URL: process.env.REDIS_URL,
    REDIS_PREFIX: process.env.REDIS_PREFIX,
    REDIS_DB: process.env.REDIS_DB,
    REDIS_REQUIRED: process.env.REDIS_REQUIRED,
    REDIS_TLS: process.env.REDIS_TLS,

    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_REGION: process.env.S3_REGION,
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
    S3_SECRET_KEY: process.env.S3_SECRET_KEY,
    S3_BUCKET_MEDIA: process.env.S3_BUCKET_MEDIA,
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
    S3_USE_SSL: process.env.S3_USE_SSL,

    PREVIEW_CACHE_BACKEND: process.env.PREVIEW_CACHE_BACKEND,
    PREVIEW_CACHE_DEDUPE_TTL_MS: process.env.PREVIEW_CACHE_DEDUPE_TTL_MS,
    PREVIEW_CACHE_RESPONSE_TTL_MS: process.env.PREVIEW_CACHE_RESPONSE_TTL_MS,
    PREVIEW_CACHE_POLL_INTERVAL_MS: process.env.PREVIEW_CACHE_POLL_INTERVAL_MS,
    PREVIEW_CACHE_DEBUG_HEADERS: process.env.PREVIEW_CACHE_DEBUG_HEADERS,

    OUTBOX_WORKER_INTERVAL_MS: process.env.OUTBOX_WORKER_INTERVAL_MS,

    UPLOAD_DIR: process.env.UPLOAD_DIR,
    UPLOAD_PUBLIC_PATH: process.env.UPLOAD_PUBLIC_PATH,
    UPLOAD_MAX_MB: process.env.UPLOAD_MAX_MB,
    MEDIA_STORAGE_DRIVER: process.env.MEDIA_STORAGE_DRIVER,
    MEDIA_PRESIGN_TTL_SEC: process.env.MEDIA_PRESIGN_TTL_SEC,

    ALPR_MODE: process.env.ALPR_MODE,
    ALPR_PROVIDER_ORDER: process.env.ALPR_PROVIDER_ORDER,
    ALPR_FAST_PSM_MODES: process.env.ALPR_FAST_PSM_MODES,
    ALPR_DEEP_PSM_MODES: process.env.ALPR_DEEP_PSM_MODES,
    ALPR_SLOW_PSM_MODES: process.env.ALPR_SLOW_PSM_MODES,
    ALPR_FAST_TIMEOUT_MS: process.env.ALPR_FAST_TIMEOUT_MS,
    ALPR_DEEP_TIMEOUT_MS: process.env.ALPR_DEEP_TIMEOUT_MS,
    ALPR_EXTERNAL_ESCALATION_THRESHOLD: process.env.ALPR_EXTERNAL_ESCALATION_THRESHOLD,
    ALPR_PREVIEW_MAX_CANDIDATES: process.env.ALPR_PREVIEW_MAX_CANDIDATES,
    ALPR_PROVINCE_ALLOWLIST: process.env.ALPR_PROVINCE_ALLOWLIST,

    ALPR_HTTP_PROVIDER_URL: process.env.ALPR_HTTP_PROVIDER_URL,
    ALPR_HTTP_PROVIDER_TOKEN: process.env.ALPR_HTTP_PROVIDER_TOKEN,
    ALPR_HTTP_PROVIDER_TIMEOUT_MS: process.env.ALPR_HTTP_PROVIDER_TIMEOUT_MS,

    ALPR_OCRSPACE_URL: process.env.ALPR_OCRSPACE_URL,
    ALPR_OCRSPACE_API_KEY: process.env.ALPR_OCRSPACE_API_KEY,

    ALPR_PLATE_RECOGNIZER_URL: process.env.ALPR_PLATE_RECOGNIZER_URL,
    ALPR_PLATE_RECOGNIZER_TOKEN: process.env.ALPR_PLATE_RECOGNIZER_TOKEN,
  })

  const prefix = parsed.API_PREFIX.startsWith('/') ? parsed.API_PREFIX : `/${parsed.API_PREFIX}`

  const actors = {
    ADMIN: parsed.API_ADMIN_ACTOR_USER_ID ? BigInt(parsed.API_ADMIN_ACTOR_USER_ID) : undefined,
    OPS: parsed.API_OPS_ACTOR_USER_ID ? BigInt(parsed.API_OPS_ACTOR_USER_ID) : undefined,
    GUARD: parsed.API_GUARD_ACTOR_USER_ID ? BigInt(parsed.API_GUARD_ACTOR_USER_ID) : undefined,
    CASHIER: parsed.API_CASHIER_ACTOR_USER_ID ? BigInt(parsed.API_CASHIER_ACTOR_USER_ID) : undefined,
    WORKER: parsed.API_WORKER_ACTOR_USER_ID ? BigInt(parsed.API_WORKER_ACTOR_USER_ID) : undefined,
  } satisfies Partial<Record<AppRole, bigint>>

  const providerOrder = stringListFromEnv('ALPR_PROVIDER_ORDER', ['LOCAL'])
    .map((item) => item.toUpperCase())
    .filter((item): item is AlprProviderName => item === 'LOCAL' || item === 'HTTP' || item === 'OCRSPACE' || item === 'PLATE_RECOGNIZER')

  const redisPrefix = parsed.REDIS_PREFIX ?? `parkly:${process.env.NODE_ENV ?? 'development'}`
  const previewDedupeTtlMs = parsed.PREVIEW_CACHE_DEDUPE_TTL_MS ?? intFromEnv('PREVIEW_CACHE_DEDUPE_TTL_MS', 3_000)
  const previewResponseTtlMsRaw = parsed.PREVIEW_CACHE_RESPONSE_TTL_MS ?? intFromEnv('PREVIEW_CACHE_RESPONSE_TTL_MS', 2_000)
  const internalServiceRotation = resolveInternalServiceTokenRotation(process.env)
  const internalServiceToken = getPrimaryRotationSecretValue(internalServiceRotation) ?? parsed.API_INTERNAL_SERVICE_TOKEN ?? ''
  const internalServiceNextToken = getNextRotationSecretValue(internalServiceRotation)
  const legacyRoleTokensEnabled = parsed.API_LEGACY_ROLE_TOKENS === 'ON'

  return {
    host: parsed.API_HOST,
    port: parsed.API_PORT,
    prefix,

    authMode: parsed.API_AUTH_MODE,
    legacyRoleTokensEnabled,
    auth: {
      accessTtlMinutes: parsed.API_AUTH_ACCESS_TTL_MINUTES ?? intFromEnv('API_AUTH_ACCESS_TTL_MINUTES', 15),
      refreshTtlDays: parsed.API_AUTH_REFRESH_TTL_DAYS ?? intFromEnv('API_AUTH_REFRESH_TTL_DAYS', 7),
      loginSecurity: {
        windowSeconds: parsed.API_AUTH_LOGIN_THROTTLE_WINDOW_SECONDS ?? intFromEnv('API_AUTH_LOGIN_THROTTLE_WINDOW_SECONDS', 300),
        failureLockoutThreshold: parsed.API_AUTH_LOGIN_FAILURE_LOCKOUT_THRESHOLD ?? intFromEnv('API_AUTH_LOGIN_FAILURE_LOCKOUT_THRESHOLD', 5),
        lockoutSeconds: parsed.API_AUTH_LOGIN_LOCKOUT_SECONDS ?? intFromEnv('API_AUTH_LOGIN_LOCKOUT_SECONDS', 120),
        progressiveDelayMs: parsed.API_AUTH_LOGIN_PROGRESSIVE_DELAY_MS ?? intFromEnv('API_AUTH_LOGIN_PROGRESSIVE_DELAY_MS', 250),
        progressiveDelayMaxMs: parsed.API_AUTH_LOGIN_PROGRESSIVE_DELAY_MAX_MS ?? intFromEnv('API_AUTH_LOGIN_PROGRESSIVE_DELAY_MAX_MS', 1500),
      },
      passwordPolicy: {
        minLength: parsed.API_AUTH_PASSWORD_MIN_LENGTH ?? intFromEnv('API_AUTH_PASSWORD_MIN_LENGTH', 10),
        requireUppercase: parsed.API_AUTH_PASSWORD_REQUIRE_UPPERCASE === 'ON',
        requireLowercase: parsed.API_AUTH_PASSWORD_REQUIRE_LOWERCASE === 'ON',
        requireDigit: parsed.API_AUTH_PASSWORD_REQUIRE_DIGIT === 'ON',
        requireSpecial: parsed.API_AUTH_PASSWORD_REQUIRE_SPECIAL === 'ON',
      },
      sessionHygiene: {
        sessionLimitPerUser: parsed.API_AUTH_SESSION_LIMIT_PER_USER ?? intFromEnv('API_AUTH_SESSION_LIMIT_PER_USER', 5),
        cleanupExpiredRetentionDays: parsed.API_AUTH_SESSION_CLEANUP_EXPIRED_RETENTION_DAYS ?? intFromEnv('API_AUTH_SESSION_CLEANUP_EXPIRED_RETENTION_DAYS', 3),
        cleanupRevokedRetentionDays: parsed.API_AUTH_SESSION_CLEANUP_REVOKED_RETENTION_DAYS ?? intFromEnv('API_AUTH_SESSION_CLEANUP_REVOKED_RETENTION_DAYS', 30),
        cleanupBatchLimit: parsed.API_AUTH_SESSION_CLEANUP_BATCH_LIMIT ?? intFromEnv('API_AUTH_SESSION_CLEANUP_BATCH_LIMIT', 500),
      },
      bootstrapProfile: parsed.API_AUTH_BOOTSTRAP_PROFILE,
      demoSeedCredentialsEnabled: parsed.API_AUTH_DEMO_SEED_CREDENTIALS === 'ON',
    },
    internalService: {
      token: internalServiceToken,
      nextToken: internalServiceNextToken ?? undefined,
      rotationMode: internalServiceRotation.mode,
      tokenFingerprints: internalServiceRotation.accepted.map((item) => item.fingerprint),
      role: parsed.API_INTERNAL_SERVICE_ROLE as AppRole,
    },
    tokens: {
      ADMIN: legacyRoleTokensEnabled ? parsed.API_ADMIN_TOKEN : undefined,
      OPS: legacyRoleTokensEnabled ? parsed.API_OPS_TOKEN : undefined,
      GUARD: legacyRoleTokensEnabled ? parsed.API_GUARD_TOKEN : undefined,
      CASHIER: legacyRoleTokensEnabled ? parsed.API_CASHIER_TOKEN : undefined,
      WORKER: legacyRoleTokensEnabled ? parsed.API_WORKER_TOKEN : undefined,
    } satisfies Partial<Record<AppRole, string>>,

    apiEdgeSyncKey: parsed.API_EDGE_SYNC_KEY,

    actors,

    corsOrigins: (parsed.API_CORS_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),

    rateLimit: {
      max: parsed.API_RATE_LIMIT_MAX ?? intFromEnv('API_RATE_LIMIT_MAX', 200),
      windowMs: parsed.API_RATE_LIMIT_WINDOW_MS ?? intFromEnv('API_RATE_LIMIT_WINDOW_MS', 60_000),
      backend: parsed.API_RATE_LIMIT_BACKEND,
      prefix: parsed.API_RATE_LIMIT_PREFIX ?? `${redisPrefix}:rate-limit`,
    },

    redis: {
      url: parsed.REDIS_URL ?? 'redis://127.0.0.1:6379',
      prefix: redisPrefix,
      db: parsed.REDIS_DB ?? intFromEnv('REDIS_DB', 0),
      required: parsed.REDIS_REQUIRED === 'ON',
      tls: parsed.REDIS_TLS === 'ON',
    },

    s3: {
      endpoint: parsed.S3_ENDPOINT ?? 'http://127.0.0.1:9000',
      region: parsed.S3_REGION ?? 'us-east-1',
      accessKey: parsed.S3_ACCESS_KEY ?? 'minioadmin',
      secretKey: parsed.S3_SECRET_KEY ?? 'minioadmin123',
      bucket: parsed.S3_BUCKET_MEDIA ?? 'parkly-media',
      forcePathStyle: parsed.S3_FORCE_PATH_STYLE === 'ON',
      useSsl: parsed.S3_USE_SSL === 'ON',
    },

    previewCache: {
      backend: parsed.PREVIEW_CACHE_BACKEND,
      dedupeTtlMs: previewDedupeTtlMs,
      responseTtlMs: Math.min(previewDedupeTtlMs, Math.max(100, previewResponseTtlMsRaw)),
      pollIntervalMs: parsed.PREVIEW_CACHE_POLL_INTERVAL_MS ?? intFromEnv('PREVIEW_CACHE_POLL_INTERVAL_MS', 120),
      debugHeaders: parsed.PREVIEW_CACHE_DEBUG_HEADERS === 'ON',
    },

    worker: {
      outboxIntervalMs: parsed.OUTBOX_WORKER_INTERVAL_MS ?? intFromEnv('OUTBOX_WORKER_INTERVAL_MS', 5_000),
    },

    upload: {
      dir: parsed.UPLOAD_DIR,
      publicPath: parsed.UPLOAD_PUBLIC_PATH.startsWith('/') ? parsed.UPLOAD_PUBLIC_PATH : `/${parsed.UPLOAD_PUBLIC_PATH}`,
      maxBytes: parsed.UPLOAD_MAX_MB * 1024 * 1024,
    },

    media: {
      driver: parsed.MEDIA_STORAGE_DRIVER as 'LOCAL' | 'MINIO',
      presignTtlSec: parsed.MEDIA_PRESIGN_TTL_SEC ?? intFromEnv('MEDIA_PRESIGN_TTL_SEC', 300),
    },

    alpr: {
      mode: parsed.ALPR_MODE as AlprMode,
      providerOrder: providerOrder.length > 0 ? providerOrder : ['LOCAL'],
      fastPsmModes: intListFromEnv('ALPR_FAST_PSM_MODES', [7, 6]),
      deepPsmModes: intListFromEnv('ALPR_DEEP_PSM_MODES', intListFromEnv('ALPR_SLOW_PSM_MODES', [11, 13])),
      fastTimeoutMs: parsed.ALPR_FAST_TIMEOUT_MS ?? intFromEnv('ALPR_FAST_TIMEOUT_MS', 2_500),
      deepTimeoutMs: parsed.ALPR_DEEP_TIMEOUT_MS ?? intFromEnv('ALPR_DEEP_TIMEOUT_MS', 6_000),
      previewMaxCandidates: parsed.ALPR_PREVIEW_MAX_CANDIDATES ?? intFromEnv('ALPR_PREVIEW_MAX_CANDIDATES', 5),
      externalEscalationThreshold: parsed.ALPR_EXTERNAL_ESCALATION_THRESHOLD ?? intFromEnv('ALPR_EXTERNAL_ESCALATION_THRESHOLD', 86),
      providerTimeoutMs: parsed.ALPR_HTTP_PROVIDER_TIMEOUT_MS ?? intFromEnv('ALPR_PROVIDER_TIMEOUT_MS', 4_500),
      provinceAllowlist: stringListFromEnv('ALPR_PROVINCE_ALLOWLIST'),
      httpProvider: {
        url: parsed.ALPR_HTTP_PROVIDER_URL ?? null,
        token: parsed.ALPR_HTTP_PROVIDER_TOKEN ?? null,
      },
      ocrSpace: {
        url: parsed.ALPR_OCRSPACE_URL ?? 'https://api.ocr.space/parse/image',
        apiKey: parsed.ALPR_OCRSPACE_API_KEY ?? null,
      },
      plateRecognizer: {
        url: parsed.ALPR_PLATE_RECOGNIZER_URL ?? 'https://api.platerecognizer.com/v1/plate-reader/',
        token: parsed.ALPR_PLATE_RECOGNIZER_TOKEN ?? null,
      },
    },
  }
})()
