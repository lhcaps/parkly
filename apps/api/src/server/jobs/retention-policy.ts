import { config } from '../config'

export type RetentionProfile = 'DEMO' | 'RELEASE'
export type RetentionMode = 'DRY_RUN' | 'APPLY'

export type RetentionDatasetPolicy = {
  name: string
  enabled: boolean
  retentionDays?: number | null
  retentionHours?: number | null
  notes: string[]
}

export type BackendRetentionPolicy = {
  profile: RetentionProfile
  preserveDemoSeed: boolean
  batchLimit: number
  datasets: {
    authSessions: RetentionDatasetPolicy
    loginAttempts: RetentionDatasetPolicy
    incidentNoiseHistory: RetentionDatasetPolicy
    internalPresenceRejected: RetentionDatasetPolicy
    internalPresenceAccepted: RetentionDatasetPolicy
    smokeArtifacts: RetentionDatasetPolicy
    tempUploads: RetentionDatasetPolicy
    runtimeArtifacts: RetentionDatasetPolicy
  }
}

function envFlag(name: string, fallback = false) {
  const raw = String(process.env[name] ?? '').trim().toUpperCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'TRUE' || raw === 'ON' || raw === 'YES'
}

function envInt(name: string, fallback: number | null) {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function normalizeProfile(value: unknown): RetentionProfile {
  const normalized = String(value ?? '').trim().toUpperCase()
  return normalized === 'RELEASE' ? 'RELEASE' : 'DEMO'
}

function daysPolicy(name: string, fallback: number | null, notes: string[] = []): RetentionDatasetPolicy {
  const retentionDays = envInt(name, fallback)
  return {
    name,
    enabled: retentionDays != null && retentionDays > 0,
    retentionDays,
    notes,
  }
}

function hoursPolicy(name: string, fallback: number | null, notes: string[] = []): RetentionDatasetPolicy {
  const retentionHours = envInt(name, fallback)
  return {
    name,
    enabled: retentionHours != null && retentionHours > 0,
    retentionHours,
    notes,
  }
}

export function getBackendRetentionPolicy(): BackendRetentionPolicy {
  const profile = normalizeProfile(process.env.RETENTION_PROFILE)
  const preserveDemoSeed = envFlag('RETENTION_PRESERVE_DEMO_SEED', profile === 'DEMO')
  const batchLimit = Math.max(1, envInt('RETENTION_CLEANUP_BATCH_LIMIT', 250) ?? 250)

  const authSessions: RetentionDatasetPolicy = {
    name: 'authSessions',
    enabled: true,
    retentionDays: Math.max(
      config.auth.sessionHygiene.cleanupExpiredRetentionDays,
      config.auth.sessionHygiene.cleanupRevokedRetentionDays,
    ),
    notes: [
      `expired>${config.auth.sessionHygiene.cleanupExpiredRetentionDays}d`,
      `revoked>${config.auth.sessionHygiene.cleanupRevokedRetentionDays}d`,
      'window lấy trực tiếp từ auth session hygiene hiện hành',
    ],
  }

  const loginAttempts = daysPolicy(
    'RETENTION_AUTH_LOGIN_ATTEMPTS_RETENTION_DAYS',
    profile === 'DEMO' ? 14 : 7,
    ['dọn bucket brute-force cũ để auth_login_attempts không phình vô hạn'],
  )

  const incidentNoiseHistory = daysPolicy(
    'RETENTION_INCIDENT_NOISE_HISTORY_RETENTION_DAYS',
    profile === 'DEMO' ? 30 : 14,
    [
      'chỉ dọn history của incident đã RESOLVED/IGNORED và severity INFO/WARN',
      'không chạm incident CRITICAL để giữ forensic value',
    ],
  )

  const internalPresenceRejected = daysPolicy(
    'RETENTION_INTERNAL_PRESENCE_REJECTED_RETENTION_DAYS',
    profile === 'DEMO' ? 14 : 7,
    ['raw intake REJECTED ít giá trị vận hành dài hạn nên được dọn sớm hơn'],
  )

  const acceptedDaysFallback = profile === 'DEMO' ? null : 30
  const internalPresenceAccepted = daysPolicy(
    'RETENTION_INTERNAL_PRESENCE_ACCEPTED_RETENTION_DAYS',
    acceptedDaysFallback,
    preserveDemoSeed
      ? ['DEMO profile mặc định không hard-delete ACCEPTED rows để giữ repeatability baseline']
      : ['RELEASE profile cho phép dọn ACCEPTED rows đã quá hạn retention'],
  )

  const smokeArtifacts = daysPolicy(
    'RETENTION_SMOKE_ARTIFACT_RETENTION_DAYS',
    profile === 'DEMO' ? 21 : 7,
    ['gồm trace_id smoke-* hoặc snapshot_object_key bắt đầu bằng smoke/'],
  )

  const tempUploads = hoursPolicy(
    'RETENTION_TEMP_UPLOAD_RETENTION_HOURS',
    24,
    ['chỉ quét uploads/tmp; không đụng evidence media trong gate-media'],
  )

  const runtimeArtifacts = daysPolicy(
    'RETENTION_RUNTIME_ARTIFACT_RETENTION_DAYS',
    profile === 'DEMO' ? 14 : 7,
    ['chỉ quét file trong runtime dir ngoài thư mục observability để không phá health markers'],
  )

  return {
    profile,
    preserveDemoSeed,
    batchLimit,
    datasets: {
      authSessions,
      loginAttempts,
      incidentNoiseHistory,
      internalPresenceRejected,
      internalPresenceAccepted,
      smokeArtifacts,
      tempUploads,
      runtimeArtifacts,
    },
  }
}

export function describeRetentionPolicy(policy = getBackendRetentionPolicy()) {
  return {
    profile: policy.profile,
    preserveDemoSeed: policy.preserveDemoSeed,
    batchLimit: policy.batchLimit,
    datasets: Object.fromEntries(
      Object.entries(policy.datasets).map(([key, value]) => [key, {
        enabled: value.enabled,
        retentionDays: value.retentionDays ?? null,
        retentionHours: value.retentionHours ?? null,
        notes: value.notes,
      }]),
    ),
  }
}
