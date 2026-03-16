import type { SpotProjectionRow } from '../../reconciliation/application/run-reconciliation'
import { classifyReconciliationIncidentSignal } from '../../reconciliation/domain/reconciliation'

export type IncidentSeverity = 'INFO' | 'WARN' | 'CRITICAL'
export type IncidentNoiseClass = 'STALE_SENSOR' | 'GHOST_PRESENCE' | 'REPEATED_MISMATCH' | 'VIOLATION' | 'NONE'

export type IncidentNoiseControlConfig = {
  dedupeCooldownSeconds: number
  reopenWindowSeconds: number
  staleSensorGraceHits: number
  ghostPresenceGraceHits: number
  mismatchCooldownSeconds: number
  staleSensorCriticalHits: number
  ghostPresenceCriticalHits: number
  repeatedMismatchCriticalHits: number
}

export type IncidentNoiseState = {
  fingerprint: string | null
  noiseClass: IncidentNoiseClass
  hitCount: number
  suppressedCount: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  lastMeaningfulAt: string | null
  lastPublishedAt: string | null
}

export type ProjectionIncidentSignal = {
  active: boolean
  sourceKey: string
  incidentType: string | null
  severity: IncidentSeverity | null
  title: string | null
  detail: string | null
  snapshot: Record<string, unknown>
  noiseClass: IncidentNoiseClass
  cooldownSeconds: number
  reopenWindowSeconds: number
  suppressionThreshold: number
  fingerprint: string
}

function envNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name] ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function getIncidentNoiseControlConfig(overrides: Partial<IncidentNoiseControlConfig> = {}): IncidentNoiseControlConfig {
  return {
    dedupeCooldownSeconds: overrides.dedupeCooldownSeconds ?? envNumber('INCIDENT_DEDUPE_COOLDOWN_SECONDS', 90),
    reopenWindowSeconds: overrides.reopenWindowSeconds ?? envNumber('INCIDENT_REOPEN_WINDOW_SECONDS', 600),
    staleSensorGraceHits: overrides.staleSensorGraceHits ?? envNumber('INCIDENT_STALE_SENSOR_GRACE_HITS', 2),
    ghostPresenceGraceHits: overrides.ghostPresenceGraceHits ?? envNumber('INCIDENT_GHOST_PRESENCE_GRACE_HITS', 2),
    mismatchCooldownSeconds: overrides.mismatchCooldownSeconds ?? envNumber('INCIDENT_MISMATCH_COOLDOWN_SECONDS', 180),
    staleSensorCriticalHits: overrides.staleSensorCriticalHits ?? envNumber('INCIDENT_STALE_SENSOR_CRITICAL_HITS', 4),
    ghostPresenceCriticalHits: overrides.ghostPresenceCriticalHits ?? envNumber('INCIDENT_GHOST_PRESENCE_CRITICAL_HITS', 4),
    repeatedMismatchCriticalHits: overrides.repeatedMismatchCriticalHits ?? envNumber('INCIDENT_REPEATED_MISMATCH_CRITICAL_HITS', 3),
  }
}

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function normalizeUpper(value: unknown) {
  const text = String(value ?? '').trim().toUpperCase()
  return text || null
}

function toIso(value: unknown) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function signatureFields(projection: SpotProjectionRow) {
  return [
    projection.occupancyStatus,
    projection.reasonCode,
    projection.observedPlateCompact ?? '',
    projection.expectedPlateCompact ?? '',
    projection.matchedSubscriptionId ?? '',
    projection.matchedGatePresenceId ?? '',
  ]
}

export function buildIncidentSignalFingerprint(projection: Pick<SpotProjectionRow, 'occupancyStatus' | 'reasonCode' | 'observedPlateCompact' | 'expectedPlateCompact' | 'matchedSubscriptionId' | 'matchedGatePresenceId'>) {
  return [
    projection.occupancyStatus,
    projection.reasonCode,
    projection.observedPlateCompact ?? '',
    projection.expectedPlateCompact ?? '',
    projection.matchedSubscriptionId ?? '',
    projection.matchedGatePresenceId ?? '',
  ].join('|')
}

export function readIncidentNoiseState(snapshot: unknown): IncidentNoiseState {
  const root = safeObject(snapshot)
  const noise = safeObject(root.__noiseControl)
  return {
    fingerprint: normalizeUpper(noise.fingerprint),
    noiseClass: (normalizeUpper(noise.noiseClass) as IncidentNoiseClass | null) ?? 'NONE',
    hitCount: Math.max(0, Number(noise.hitCount ?? 0) || 0),
    suppressedCount: Math.max(0, Number(noise.suppressedCount ?? 0) || 0),
    firstSeenAt: toIso(noise.firstSeenAt),
    lastSeenAt: toIso(noise.lastSeenAt),
    lastMeaningfulAt: toIso(noise.lastMeaningfulAt),
    lastPublishedAt: toIso(noise.lastPublishedAt),
  }
}

export function withIncidentNoiseState(snapshot: Record<string, unknown>, state: IncidentNoiseState) {
  return {
    ...snapshot,
    __noiseControl: {
      fingerprint: state.fingerprint,
      noiseClass: state.noiseClass,
      hitCount: state.hitCount,
      suppressedCount: state.suppressedCount,
      firstSeenAt: state.firstSeenAt,
      lastSeenAt: state.lastSeenAt,
      lastMeaningfulAt: state.lastMeaningfulAt,
      lastPublishedAt: state.lastPublishedAt,
    },
  }
}

export function getSuppressionThreshold(noiseClass: IncidentNoiseClass, config: IncidentNoiseControlConfig) {
  if (noiseClass === 'STALE_SENSOR') return Math.max(1, config.staleSensorGraceHits)
  if (noiseClass === 'GHOST_PRESENCE') return Math.max(1, config.ghostPresenceGraceHits)
  return 1
}

export function resolveSeverityForSignal(noiseClass: IncidentNoiseClass, hitCount: number, config: IncidentNoiseControlConfig): IncidentSeverity {
  if (noiseClass === 'STALE_SENSOR') {
    if (hitCount >= config.staleSensorCriticalHits) return 'CRITICAL'
    return hitCount >= config.staleSensorGraceHits ? 'WARN' : 'INFO'
  }
  if (noiseClass === 'GHOST_PRESENCE') {
    if (hitCount >= config.ghostPresenceCriticalHits) return 'CRITICAL'
    return hitCount >= config.ghostPresenceGraceHits ? 'WARN' : 'INFO'
  }
  if (noiseClass === 'REPEATED_MISMATCH') {
    return hitCount >= config.repeatedMismatchCriticalHits ? 'CRITICAL' : 'WARN'
  }
  if (noiseClass === 'VIOLATION') return 'CRITICAL'
  return 'INFO'
}

export function buildProjectionIncidentSignal(projection: SpotProjectionRow, options: { config?: Partial<IncidentNoiseControlConfig>; hitCount?: number } = {}): ProjectionIncidentSignal {
  const config = getIncidentNoiseControlConfig(options.config)
  const noiseClass = classifyReconciliationIncidentSignal({
    occupancyStatus: projection.occupancyStatus,
    reasonCode: projection.reasonCode,
  })
  const suppressionThreshold = getSuppressionThreshold(noiseClass, config)
  const hitCount = Math.max(1, options.hitCount ?? suppressionThreshold)
  const fingerprint = buildIncidentSignalFingerprint(projection)
  const sourceKey = `reconciliation:${projection.siteId}:${projection.spotId}`
  const snapshot = {
    source: 'RECONCILIATION',
    projection,
    incidentHint: {
      noiseClass,
      suppressionThreshold,
      fingerprint,
      dedupeCooldownSeconds: noiseClass === 'REPEATED_MISMATCH' ? config.mismatchCooldownSeconds : config.dedupeCooldownSeconds,
      reopenWindowSeconds: config.reopenWindowSeconds,
      signatureFields: signatureFields(projection),
    },
  }

  if (projection.occupancyStatus === 'OCCUPIED_VIOLATION') {
    return {
      active: true,
      sourceKey,
      incidentType: 'SPOT_OCCUPANCY_VIOLATION',
      severity: resolveSeverityForSignal(noiseClass, hitCount, config),
      title: `Spot ${projection.spotCode} có vi phạm occupancy`,
      detail: projection.reasonDetail,
      snapshot,
      noiseClass,
      cooldownSeconds: noiseClass === 'REPEATED_MISMATCH' ? config.mismatchCooldownSeconds : config.dedupeCooldownSeconds,
      reopenWindowSeconds: config.reopenWindowSeconds,
      suppressionThreshold,
      fingerprint,
    }
  }
  if (projection.occupancyStatus === 'OCCUPIED_UNKNOWN') {
    return {
      active: true,
      sourceKey,
      incidentType: 'SPOT_OCCUPANCY_UNKNOWN',
      severity: resolveSeverityForSignal(noiseClass, hitCount, config),
      title: `Spot ${projection.spotCode} có xe chưa định danh`,
      detail: projection.reasonDetail,
      snapshot,
      noiseClass,
      cooldownSeconds: config.dedupeCooldownSeconds,
      reopenWindowSeconds: config.reopenWindowSeconds,
      suppressionThreshold,
      fingerprint,
    }
  }
  if (projection.occupancyStatus === 'SENSOR_STALE') {
    return {
      active: true,
      sourceKey,
      incidentType: 'SPOT_SENSOR_STALE',
      severity: resolveSeverityForSignal(noiseClass, hitCount, config),
      title: `Spot ${projection.spotCode} stale từ camera`,
      detail: projection.reasonDetail,
      snapshot,
      noiseClass,
      cooldownSeconds: config.dedupeCooldownSeconds,
      reopenWindowSeconds: config.reopenWindowSeconds,
      suppressionThreshold,
      fingerprint,
    }
  }
  return {
    active: false,
    sourceKey,
    incidentType: null,
    severity: null,
    title: null,
    detail: projection.reasonDetail,
    snapshot,
    noiseClass,
    cooldownSeconds: config.dedupeCooldownSeconds,
    reopenWindowSeconds: config.reopenWindowSeconds,
    suppressionThreshold: 1,
    fingerprint,
  }
}

function secondsBetween(left: string | null, right: string | null) {
  if (!left || !right) return Number.POSITIVE_INFINITY
  const a = new Date(left).getTime()
  const b = new Date(right).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY
  return Math.abs(a - b) / 1000
}

export function computeNoiseHitCount(args: {
  signal: ProjectionIncidentSignal
  previousSnapshot?: unknown
  existingLastSignalAt?: string | null
  nowIso: string
}) {
  const previous = readIncidentNoiseState(args.previousSnapshot)
  const sameFingerprint = previous.fingerprint === normalizeUpper(args.signal.fingerprint)
  const previousSeen = args.existingLastSignalAt ?? previous.lastSeenAt
  if (!sameFingerprint) return 1
  const withinSequenceWindow = secondsBetween(previousSeen, args.nowIso) <= Math.max(args.signal.cooldownSeconds, args.signal.reopenWindowSeconds)
  return withinSequenceWindow ? Math.max(1, previous.hitCount + 1) : 1
}

export function shouldSuppressRecurringSignal(args: {
  signal: ProjectionIncidentSignal
  previousSnapshot?: unknown
  existingLastSignalAt?: string | null
  previousSeverity?: IncidentSeverity | null
  nowIso: string
}) {
  const previous = readIncidentNoiseState(args.previousSnapshot)
  const sameFingerprint = previous.fingerprint === normalizeUpper(args.signal.fingerprint)
  if (!sameFingerprint) return false
  const withinCooldown = secondsBetween(args.existingLastSignalAt ?? previous.lastPublishedAt ?? previous.lastSeenAt, args.nowIso) < args.signal.cooldownSeconds
  const severityStable = (args.previousSeverity ?? null) === (args.signal.severity ?? null)
  return withinCooldown && severityStable
}

export function shouldReopenResolvedIncident(args: {
  signal: ProjectionIncidentSignal
  latestStatus?: string | null
  latestLastSignalAt?: string | null
  latestResolvedAt?: string | null
  previousSnapshot?: unknown
  nowIso: string
}) {
  const status = normalizeUpper(args.latestStatus)
  if (status !== 'RESOLVED' && status !== 'IGNORED') return false
  const previous = readIncidentNoiseState(args.previousSnapshot)
  const sameFingerprint = previous.fingerprint === normalizeUpper(args.signal.fingerprint)
  if (!sameFingerprint) return false
  const anchor = args.latestResolvedAt ?? args.latestLastSignalAt ?? previous.lastSeenAt
  return secondsBetween(anchor, args.nowIso) <= args.signal.reopenWindowSeconds
}

export function decorateIncidentSnapshot(snapshot: Record<string, unknown>, args: {
  signal: ProjectionIncidentSignal
  nowIso: string
  hitCount: number
  previousSnapshot?: unknown
  published: boolean
}) {
  const previous = readIncidentNoiseState(args.previousSnapshot)
  const state: IncidentNoiseState = {
    fingerprint: normalizeUpper(args.signal.fingerprint),
    noiseClass: args.signal.noiseClass,
    hitCount: args.hitCount,
    suppressedCount: args.published ? previous.suppressedCount : previous.suppressedCount + 1,
    firstSeenAt: previous.firstSeenAt ?? args.nowIso,
    lastSeenAt: args.nowIso,
    lastMeaningfulAt: args.published ? args.nowIso : previous.lastMeaningfulAt,
    lastPublishedAt: args.published ? args.nowIso : previous.lastPublishedAt,
  }
  return withIncidentNoiseState(snapshot, state)
}
