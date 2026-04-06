import type { Express } from 'express'
import client from 'prom-client'

const register = new client.Registry()
client.collectDefaultMetrics({ register })

const httpDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in ms',
  labelNames: ['method', 'path', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
})
register.registerMetric(httpDuration)

const gateSessionOpenDuration = new client.Histogram({
  name: 'gate_session_open_duration_ms',
  help: 'Business latency for opening or reusing a gate session',
  labelNames: ['site_code', 'lane_code', 'direction', 'result'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
})
register.registerMetric(gateSessionOpenDuration)

const gateSessionResolveDuration = new client.Histogram({
  name: 'gate_session_resolve_duration_ms',
  help: 'Business latency for resolving a gate session',
  labelNames: ['site_code', 'lane_code', 'direction', 'result'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
})
register.registerMetric(gateSessionResolveDuration)

const gateBarrierAckTimeoutTotal = new client.Counter({
  name: 'gate_barrier_ack_timeout_total',
  help: 'Count of barrier commands that timed out without ACK',
  labelNames: ['site_code', 'lane_code'],
})
register.registerMetric(gateBarrierAckTimeoutTotal)

const gateReviewQueueSize = new client.Gauge({
  name: 'gate_review_queue_size',
  help: 'Open + claimed review queue size by site',
  labelNames: ['site_code'],
})
register.registerMetric(gateReviewQueueSize)

const gateDeviceOfflineCount = new client.Gauge({
  name: 'gate_device_offline_count',
  help: 'Derived offline devices by site from heartbeat aging',
  labelNames: ['site_code'],
})
register.registerMetric(gateDeviceOfflineCount)

const gateOutboxBacklogSize = new client.Gauge({
  name: 'gate_outbox_backlog_size',
  help: 'Current outbox backlog size by site and status',
  labelNames: ['site_code', 'status'],
})
register.registerMetric(gateOutboxBacklogSize)

const redisUp = new client.Gauge({
  name: 'redis_up',
  help: 'Redis dependency availability gauge (1=up, 0=down)',
})
register.registerMetric(redisUp)

const redisCommandFailuresTotal = new client.Counter({
  name: 'redis_command_failures_total',
  help: 'Count of Redis command failures',
  labelNames: ['command'],
})
register.registerMetric(redisCommandFailuresTotal)

const redisLatencyMs = new client.Histogram({
  name: 'redis_latency_ms',
  help: 'Redis command latency in ms',
  labelNames: ['command'],
  buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
})
register.registerMetric(redisLatencyMs)

const alprPreviewCacheEventsTotal = new client.Counter({
  name: 'alpr_preview_cache_events_total',
  help: 'ALPR preview cache outcome by surface',
  labelNames: ['surface', 'result'],
})
register.registerMetric(alprPreviewCacheEventsTotal)

const alprPreviewDedupeSuppressedTotal = new client.Counter({
  name: 'alpr_preview_dedupe_suppressed_total',
  help: 'ALPR preview duplicate requests suppressed by Redis dedupe',
  labelNames: ['surface'],
})
register.registerMetric(alprPreviewDedupeSuppressedTotal)

const operationalRequestsTotal = new client.Counter({
  name: 'parkly_operational_requests_total',
  help: 'Low-cardinality request totals for operational surfaces',
  labelNames: ['surface', 'action', 'outcome'],
})
register.registerMetric(operationalRequestsTotal)

const operationalDurationMs = new client.Histogram({
  name: 'parkly_operational_request_duration_ms',
  help: 'Low-cardinality request latency for operational surfaces',
  labelNames: ['surface', 'action'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 1500, 2500, 5000],
})
register.registerMetric(operationalDurationMs)

const incidentLifecycleTotal = new client.Counter({
  name: 'parkly_incident_lifecycle_total',
  help: 'Incident lifecycle counters for noise-control observability',
  labelNames: ['action'],
})
register.registerMetric(incidentLifecycleTotal)

const retentionCleanupDurationMs = new client.Histogram({
  name: 'parkly_retention_cleanup_duration_ms',
  help: 'Retention cleanup run duration by dataset and mode',
  labelNames: ['dataset', 'mode', 'outcome'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 15000, 30000],
})
register.registerMetric(retentionCleanupDurationMs)

const retentionCleanupScannedRowsTotal = new client.Counter({
  name: 'parkly_retention_cleanup_scanned_rows_total',
  help: 'Retention cleanup scanned rows/files total by dataset and mode',
  labelNames: ['dataset', 'mode'],
})
register.registerMetric(retentionCleanupScannedRowsTotal)

const retentionCleanupDeletedRowsTotal = new client.Counter({
  name: 'parkly_retention_cleanup_deleted_rows_total',
  help: 'Retention cleanup deleted rows/files total by dataset and mode',
  labelNames: ['dataset', 'mode'],
})
register.registerMetric(retentionCleanupDeletedRowsTotal)

const retentionCleanupErrorsTotal = new client.Counter({
  name: 'parkly_retention_cleanup_errors_total',
  help: 'Retention cleanup error count by dataset',
  labelNames: ['dataset'],
})
register.registerMetric(retentionCleanupErrorsTotal)


const secretRejectsTotal = new client.Counter({
  name: 'parkly_secret_rejects_total',
  help: 'Secret/auth rejection counters for internal presence, device capture, and access token surfaces',
  labelNames: ['channel', 'reason'],
})
register.registerMetric(secretRejectsTotal)

const secretMissingAuthHeaderTotal = new client.Counter({
  name: 'parkly_secret_missing_auth_header_total',
  help: 'Missing auth header counters by surface/channel',
  labelNames: ['channel'],
})
register.registerMetric(secretMissingAuthHeaderTotal)

const secretReplaySuspectedTotal = new client.Counter({
  name: 'parkly_secret_replay_suspected_total',
  help: 'Replay suspicion counters by surface/channel and reason',
  labelNames: ['channel', 'reason'],
})
register.registerMetric(secretReplaySuspectedTotal)

const secretRotationEventsTotal = new client.Counter({
  name: 'parkly_secret_rotation_events_total',
  help: 'Secret rotation lifecycle events by field and action',
  labelNames: ['field', 'action'],
})
register.registerMetric(secretRotationEventsTotal)

const tariffCalculationDurationMs = new client.Histogram({
  name: 'parkly_tariff_calculation_duration_ms',
  help: 'Tariff calculation latency in ms',
  labelNames: ['site_code', 'tariff_type'],
  buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500],
})
register.registerMetric(tariffCalculationDurationMs)

const decisionEngineOutcomesTotal = new client.Counter({
  name: 'parkly_decision_engine_outcomes_total',
  help: 'Decision engine outcome distribution by code',
  labelNames: ['site_code', 'decision_code', 'direction'],
})
register.registerMetric(decisionEngineOutcomesTotal)

const activeSseConnections = new client.Gauge({
  name: 'parkly_active_sse_connections',
  help: 'Current number of active SSE connections',
  labelNames: ['channel'],
})
register.registerMetric(activeSseConnections)

const laneLockWaitTimeMs = new client.Histogram({
  name: 'parkly_lane_lock_wait_time_ms',
  help: 'Lane lock acquisition wait time in ms',
  labelNames: ['site_code', 'lane_code', 'outcome'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
})
register.registerMetric(laneLockWaitTimeMs)

export type ObservabilitySurface = 'AUTH' | 'DASHBOARD' | 'MEDIA' | 'INTAKE' | 'RECONCILE' | 'INCIDENT' | 'AUDIT' | 'HEALTH'
export type ObservabilityAction =
  | 'LOGIN'
  | 'ME'
  | 'SUMMARY'
  | 'UPLOAD'
  | 'INGEST'
  | 'REFRESH'
  | 'LIST'
  | 'RESOLVE'
  | 'BREAKDOWN'
  | 'READY'

export type ObservabilityClassification = {
  surface: ObservabilitySurface
  action: ObservabilityAction
}

type OperationSummaryRow = {
  surface: ObservabilitySurface
  action: ObservabilityAction
  requests: number
  errors: number
  totalDurationMs: number
  lastDurationMs: number | null
  maxDurationMs: number
  lastStatusCode: number | null
}

type OperationSummaryView = OperationSummaryRow & {
  avgDurationMs: number
  errorRate: number
  budgetMs: number | null
  withinBudget: boolean | null
}

type IncidentCounterMap = Record<string, number>

type RetentionCleanupSummaryRow = {
  dataset: string
  mode: string
  runs: number
  scanned: number
  eligible: number
  deleted: number
  errors: number
  totalDurationMs: number
  lastDurationMs: number | null
  lastOutcome: string | null
  updatedAt: string | null
}


type SecretCounterRow = {
  channel: string
  reason: string
  count: number
  updatedAt: string | null
}

type SecretRotationEventRow = {
  field: string
  action: string
  count: number
  updatedAt: string | null
}

const operationSummary = new Map<string, OperationSummaryRow>()
const incidentSummary: IncidentCounterMap = Object.create(null)
const retentionCleanupSummary = new Map<string, RetentionCleanupSummaryRow>()

const secretRejectSummary = new Map<string, SecretCounterRow>()
const secretMissingAuthHeaderSummary = new Map<string, SecretCounterRow>()
const secretReplaySuspicionSummary = new Map<string, SecretCounterRow>()
const secretRotationEventSummary = new Map<string, SecretRotationEventRow>()

function budgetFor(surface: ObservabilitySurface, action: ObservabilityAction) {
  const envMap: Record<string, number> = {
    AUTH_LOGIN: numberFromEnv('OBS_LATENCY_BUDGET_AUTH_LOGIN_MS', 800),
    DASHBOARD_SUMMARY: numberFromEnv('OBS_LATENCY_BUDGET_DASHBOARD_SUMMARY_MS', 1200),
    MEDIA_UPLOAD: numberFromEnv('OBS_LATENCY_BUDGET_MEDIA_UPLOAD_MS', 1500),
    INTAKE_INGEST: numberFromEnv('OBS_LATENCY_BUDGET_INTAKE_INGEST_MS', 800),
    RECONCILE_REFRESH: numberFromEnv('OBS_LATENCY_BUDGET_RECONCILE_REFRESH_MS', 1500),
    INCIDENT_RESOLVE: numberFromEnv('OBS_LATENCY_BUDGET_INCIDENT_RESOLVE_MS', 1200),
    AUDIT_LIST: numberFromEnv('OBS_LATENCY_BUDGET_AUDIT_LIST_MS', 800),
    HEALTH_BREAKDOWN: numberFromEnv('OBS_LATENCY_BUDGET_HEALTH_BREAKDOWN_MS', 500),
    HEALTH_READY: numberFromEnv('OBS_LATENCY_BUDGET_HEALTH_READY_MS', 500),
  }
  return envMap[`${surface}_${action}`] ?? null
}

function numberFromEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name] ?? '')
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function safeLabel(value: string | null | undefined, fallback = 'UNKNOWN') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function operationKey(surface: ObservabilitySurface, action: ObservabilityAction) {
  return `${surface}:${action}`
}

function retentionCleanupKey(dataset: string, mode: string) {
  return `${safeLabel(dataset)}:${safeLabel(mode)}`
}


function secretCounterKey(channel: string, reason: string) {
  return `${safeLabel(channel)}:${safeLabel(reason)}`
}

function secretRotationEventKey(field: string, action: string) {
  return `${safeLabel(field)}:${safeLabel(action)}`
}

function recordSecretCounter(map: Map<string, SecretCounterRow>, channel: string, reason: string, count = 1) {
  const safeCount = Math.max(0, Number(count) || 0)
  if (safeCount <= 0) return
  const normalizedChannel = safeLabel(channel)
  const normalizedReason = safeLabel(reason)
  const key = secretCounterKey(normalizedChannel, normalizedReason)
  const current = map.get(key) ?? {
    channel: normalizedChannel,
    reason: normalizedReason,
    count: 0,
    updatedAt: null,
  }
  current.count += safeCount
  current.updatedAt = new Date().toISOString()
  map.set(key, current)
}

function normalizePath(rawPath: string | null | undefined) {
  const normalized = String(rawPath ?? '').trim()
  if (!normalized) return '/'
  return normalized.startsWith('/api/') ? normalized.slice(4) : normalized
}

export function classifyOperationMetric(method: string, rawPath: string): ObservabilityClassification | null {
  const verb = String(method ?? '').trim().toUpperCase()
  const path = normalizePath(rawPath)

  if (verb === 'POST' && path === '/auth/login') return { surface: 'AUTH', action: 'LOGIN' }
  if (verb === 'GET' && path === '/auth/me') return { surface: 'AUTH', action: 'ME' }
  if (verb === 'GET' && path === '/ops/dashboard/summary') return { surface: 'DASHBOARD', action: 'SUMMARY' }
  if (verb === 'POST' && path === '/media/upload') return { surface: 'MEDIA', action: 'UPLOAD' }
  if (verb === 'POST' && path === '/internal/presence-events') return { surface: 'INTAKE', action: 'INGEST' }
  if (verb === 'GET' && (path === '/ops/spot-occupancy' || path === '/ops/spot-occupancy/:spotCode')) return { surface: 'RECONCILE', action: 'REFRESH' }
  if (verb === 'GET' && path === '/ops/incidents') return { surface: 'INCIDENT', action: 'LIST' }
  if (verb === 'POST' && path === '/ops/incidents/:incidentId/resolve') return { surface: 'INCIDENT', action: 'RESOLVE' }
  if (verb === 'GET' && path === '/ops/audit') return { surface: 'AUDIT', action: 'LIST' }
  if (verb === 'GET' && path === '/health') return { surface: 'HEALTH', action: 'BREAKDOWN' }
  if (verb === 'GET' && path === '/ready') return { surface: 'HEALTH', action: 'READY' }
  return null
}

export function observeOperation(args: {
  surface: ObservabilitySurface
  action: ObservabilityAction
  statusCode: number
  durationMs: number
}) {
  const outcome = Number(args.statusCode) >= 400 ? 'ERROR' : 'OK'
  const durationMs = Math.max(0, Number(args.durationMs) || 0)
  operationalRequestsTotal.labels(args.surface, args.action, outcome).inc(1)
  operationalDurationMs.labels(args.surface, args.action).observe(durationMs)

  const key = operationKey(args.surface, args.action)
  const current = operationSummary.get(key) ?? {
    surface: args.surface,
    action: args.action,
    requests: 0,
    errors: 0,
    totalDurationMs: 0,
    lastDurationMs: null,
    maxDurationMs: 0,
    lastStatusCode: null,
  }

  current.requests += 1
  current.errors += outcome === 'ERROR' ? 1 : 0
  current.totalDurationMs += durationMs
  current.lastDurationMs = durationMs
  current.maxDurationMs = Math.max(current.maxDurationMs, durationMs)
  current.lastStatusCode = Number(args.statusCode) || null
  operationSummary.set(key, current)
}

export function observeIncidentLifecycle(action: string, count = 1) {
  const normalized = safeLabel(String(action ?? '').trim().toUpperCase(), 'UNKNOWN')
  const safeCount = Math.max(0, Number(count) || 0)
  if (safeCount <= 0) return
  incidentLifecycleTotal.labels(normalized).inc(safeCount)
  incidentSummary[normalized] = (incidentSummary[normalized] ?? 0) + safeCount
}

export function observeRetentionCleanupRun(args: {
  dataset: string
  mode: 'DRY_RUN' | 'APPLY'
  outcome: 'OK' | 'ERROR' | 'SKIPPED'
  durationMs: number
  scanned: number
  eligible: number
  deleted: number
  errors: number
}) {
  const dataset = safeLabel(args.dataset)
  const mode = safeLabel(args.mode)
  const outcome = safeLabel(args.outcome)
  const durationMs = Math.max(0, Number(args.durationMs) || 0)
  const scanned = Math.max(0, Number(args.scanned) || 0)
  const eligible = Math.max(0, Number(args.eligible) || 0)
  const deleted = Math.max(0, Number(args.deleted) || 0)
  const errors = Math.max(0, Number(args.errors) || 0)

  retentionCleanupDurationMs.labels(dataset, mode, outcome).observe(durationMs)
  if (scanned > 0) retentionCleanupScannedRowsTotal.labels(dataset, mode).inc(scanned)
  if (deleted > 0) retentionCleanupDeletedRowsTotal.labels(dataset, mode).inc(deleted)
  if (errors > 0) retentionCleanupErrorsTotal.labels(dataset).inc(errors)

  const key = retentionCleanupKey(dataset, mode)
  const current = retentionCleanupSummary.get(key) ?? {
    dataset,
    mode,
    runs: 0,
    scanned: 0,
    eligible: 0,
    deleted: 0,
    errors: 0,
    totalDurationMs: 0,
    lastDurationMs: null,
    lastOutcome: null,
    updatedAt: null,
  }

  current.runs += 1
  current.scanned += scanned
  current.eligible += eligible
  current.deleted += deleted
  current.errors += errors
  current.totalDurationMs += durationMs
  current.lastDurationMs = durationMs
  current.lastOutcome = outcome
  current.updatedAt = new Date().toISOString()
  retentionCleanupSummary.set(key, current)
}

export function getRetentionCleanupDebugSummary() {
  const rows = Array.from(retentionCleanupSummary.values()).sort((a, b) => retentionCleanupKey(a.dataset, a.mode).localeCompare(retentionCleanupKey(b.dataset, b.mode)))
  return {
    generatedAt: new Date().toISOString(),
    totals: {
      runs: rows.reduce((sum, row) => sum + row.runs, 0),
      scanned: rows.reduce((sum, row) => sum + row.scanned, 0),
      eligible: rows.reduce((sum, row) => sum + row.eligible, 0),
      deleted: rows.reduce((sum, row) => sum + row.deleted, 0),
      errors: rows.reduce((sum, row) => sum + row.errors, 0),
    },
    rows: rows.map((row) => ({
      ...row,
      avgDurationMs: row.runs > 0 ? row.totalDurationMs / row.runs : 0,
    })),
  }
}


function getSecretCounterRows(map: Map<string, SecretCounterRow>) {
  return Array.from(map.values()).sort((a, b) => secretCounterKey(a.channel, a.reason).localeCompare(secretCounterKey(b.channel, b.reason)))
}

function getSecretRotationEventRows() {
  return Array.from(secretRotationEventSummary.values()).sort((a, b) => secretRotationEventKey(a.field, a.action).localeCompare(secretRotationEventKey(b.field, b.action)))
}

export function observeSecretReject(args: { channel: string; reason: string; count?: number }) {
  const count = Math.max(0, Number(args.count ?? 1) || 0)
  if (count <= 0) return
  secretRejectsTotal.labels(safeLabel(args.channel), safeLabel(args.reason)).inc(count)
  recordSecretCounter(secretRejectSummary, args.channel, args.reason, count)
}

export function observeSecretMissingAuthHeader(args: { channel: string; count?: number }) {
  const count = Math.max(0, Number(args.count ?? 1) || 0)
  if (count <= 0) return
  secretMissingAuthHeaderTotal.labels(safeLabel(args.channel)).inc(count)
  recordSecretCounter(secretMissingAuthHeaderSummary, args.channel, 'MISSING_AUTH_HEADER', count)
}

export function observeSecretReplaySuspicion(args: { channel: string; reason?: string; count?: number }) {
  const count = Math.max(0, Number(args.count ?? 1) || 0)
  if (count <= 0) return
  const reason = safeLabel(args.reason ?? 'REPLAY_SUSPECTED')
  secretReplaySuspectedTotal.labels(safeLabel(args.channel), reason).inc(count)
  recordSecretCounter(secretReplaySuspicionSummary, args.channel, reason, count)
}

export function observeSecretRotationEvent(args: { field: string; action: string; count?: number }) {
  const count = Math.max(0, Number(args.count ?? 1) || 0)
  if (count <= 0) return
  const field = safeLabel(args.field)
  const action = safeLabel(args.action)
  secretRotationEventsTotal.labels(field, action).inc(count)
  const key = secretRotationEventKey(field, action)
  const current = secretRotationEventSummary.get(key) ?? {
    field,
    action,
    count: 0,
    updatedAt: null,
  }
  current.count += count
  current.updatedAt = new Date().toISOString()
  secretRotationEventSummary.set(key, current)
}

export function getSecretSafetyDebugSummary() {
  const rejectRows = getSecretCounterRows(secretRejectSummary)
  const missingHeaderRows = getSecretCounterRows(secretMissingAuthHeaderSummary)
  const replayRows = getSecretCounterRows(secretReplaySuspicionSummary)
  const rotationRows = getSecretRotationEventRows()
  const spikeThreshold = numberFromEnv('OBS_SECRET_REJECT_SPIKE_THRESHOLD', 5)
  const hints: string[] = []

  for (const row of rejectRows) {
    if (row.count >= spikeThreshold) {
      hints.push(`Spike secret reject ở ${row.channel}/${row.reason}: ${row.count} lần. Kiểm tra ngay header, timestamp hoặc rollout secret.`)
    }
  }
  for (const row of missingHeaderRows) {
    if (row.count >= spikeThreshold) {
      hints.push(`Missing auth header tăng mạnh ở ${row.channel}: ${row.count} lần. Rà lại proxy/client header forwarding.`)
    }
  }
  for (const row of replayRows) {
    if (row.count >= spikeThreshold) {
      hints.push(`Replay suspicion tăng ở ${row.channel}/${row.reason}: ${row.count} lần. Kiểm tra skew clock, retry storm hoặc nonce/idempotency.`)
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    thresholds: { spikeRejectCount: spikeThreshold },
    totals: {
      rejects: rejectRows.reduce((sum, row) => sum + row.count, 0),
      missingAuthHeaders: missingHeaderRows.reduce((sum, row) => sum + row.count, 0),
      replaySuspicions: replayRows.reduce((sum, row) => sum + row.count, 0),
      rotationEvents: rotationRows.reduce((sum, row) => sum + row.count, 0),
    },
    rejects: rejectRows,
    missingAuthHeaders: missingHeaderRows,
    replaySuspicions: replayRows,
    rotationEvents: rotationRows,
    hints,
  }
}

export function getMetricsDebugSummary() {
  const operations: OperationSummaryView[] = Array.from(operationSummary.values())
    .sort((a, b) => operationKey(a.surface, a.action).localeCompare(operationKey(b.surface, b.action)))
    .map((row) => {
      const avgDurationMs = row.requests > 0 ? row.totalDurationMs / row.requests : 0
      const budgetMs = budgetFor(row.surface, row.action)
      const comparator = row.lastDurationMs ?? avgDurationMs
      return {
        ...row,
        avgDurationMs,
        errorRate: row.requests > 0 ? row.errors / row.requests : 0,
        budgetMs,
        withinBudget: budgetMs == null ? null : comparator <= budgetMs,
      }
    })

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      requests: operations.reduce((sum, row) => sum + row.requests, 0),
      errors: operations.reduce((sum, row) => sum + row.errors, 0),
    },
    operations,
    incidents: { ...incidentSummary },
    retentionCleanup: getRetentionCleanupDebugSummary(),
    secretSafety: getSecretSafetyDebugSummary(),
    budgets: {
      authLoginMs: budgetFor('AUTH', 'LOGIN'),
      dashboardSummaryMs: budgetFor('DASHBOARD', 'SUMMARY'),
      mediaUploadMs: budgetFor('MEDIA', 'UPLOAD'),
      intakeIngestMs: budgetFor('INTAKE', 'INGEST'),
      reconcileRefreshMs: budgetFor('RECONCILE', 'REFRESH'),
      incidentResolveMs: budgetFor('INCIDENT', 'RESOLVE'),
      auditListMs: budgetFor('AUDIT', 'LIST'),
      secretRejectSpikeThreshold: numberFromEnv('OBS_SECRET_REJECT_SPIKE_THRESHOLD', 5),
    },
  }
}

export function resetMetricsDebugState() {
  operationSummary.clear()
  for (const key of Object.keys(incidentSummary)) {
    delete incidentSummary[key]
  }
  retentionCleanupSummary.clear()
  secretRejectSummary.clear()
  secretMissingAuthHeaderSummary.clear()
  secretReplaySuspicionSummary.clear()
  secretRotationEventSummary.clear()
}

export function observeSessionOpen(args: { siteCode?: string | null; laneCode?: string | null; direction?: string | null; result?: string | null; durationMs: number }) {
  gateSessionOpenDuration
    .labels(safeLabel(args.siteCode), safeLabel(args.laneCode), safeLabel(args.direction), safeLabel(args.result, 'OK'))
    .observe(Math.max(0, args.durationMs))
}

export function observeSessionResolve(args: { siteCode?: string | null; laneCode?: string | null; direction?: string | null; result?: string | null; durationMs: number }) {
  gateSessionResolveDuration
    .labels(safeLabel(args.siteCode), safeLabel(args.laneCode), safeLabel(args.direction), safeLabel(args.result, 'OK'))
    .observe(Math.max(0, args.durationMs))
}

export function incrementBarrierAckTimeout(args: { siteCode?: string | null; laneCode?: string | null; count?: number }) {
  const count = Math.max(0, Number(args.count ?? 1) || 0)
  if (count <= 0) return
  gateBarrierAckTimeoutTotal.labels(safeLabel(args.siteCode), safeLabel(args.laneCode)).inc(count)
}

export function setReviewQueueSize(args: { siteCode?: string | null; count: number }) {
  gateReviewQueueSize.labels(safeLabel(args.siteCode)).set(Math.max(0, args.count))
}

export function setDeviceOfflineCount(args: { siteCode?: string | null; count: number }) {
  gateDeviceOfflineCount.labels(safeLabel(args.siteCode)).set(Math.max(0, args.count))
}

export function setOutboxBacklogSize(args: { siteCode?: string | null; status?: string | null; count: number }) {
  gateOutboxBacklogSize.labels(safeLabel(args.siteCode), safeLabel(args.status)).set(Math.max(0, args.count))
}

export function registerMetrics(app: Express) {
  app.use((req, res, next) => {
    const startedAt = Date.now()
    res.on('finish', () => {
      const durationMs = Date.now() - startedAt
      const routePath = req.route?.path ? String(req.route.path) : req.path
      httpDuration.labels(req.method, routePath, String(res.statusCode)).observe(durationMs)

      const classification = classifyOperationMetric(req.method, routePath)
      if (classification) {
        observeOperation({
          surface: classification.surface,
          action: classification.action,
          statusCode: res.statusCode,
          durationMs,
        })
      }
    })
    next()
  })
}

export async function getMetricsText(): Promise<string> {
  return await register.metrics()
}

export function setRedisUp(value: number) {
  redisUp.set(value > 0 ? 1 : 0)
}

export function incrementRedisCommandFailures(command: string, count = 1) {
  const safeCount = Math.max(0, Number(count) || 0)
  if (safeCount <= 0) return
  redisCommandFailuresTotal.labels(safeLabel(command, 'unknown')).inc(safeCount)
}

export function observeRedisLatency(command: string, durationMs: number) {
  redisLatencyMs.labels(safeLabel(command, 'unknown')).observe(Math.max(0, durationMs))
}

export function incrementAlprPreviewCacheEvent(args: { surface?: string | null; result: 'MISS' | 'HIT' | 'DEDUPED' | 'DISABLED' }) {
  alprPreviewCacheEventsTotal.labels(safeLabel(args.surface), safeLabel(args.result)).inc(1)
}

export function incrementAlprPreviewDedupeSuppressed(surface?: string | null, count = 1) {
  const safeCount = Math.max(0, Number(count) || 0)
  if (safeCount <= 0) return
  alprPreviewDedupeSuppressedTotal.labels(safeLabel(surface)).inc(safeCount)
}

// ─── New Phase 3 metric helpers ──────────────────────────────────────────────

export function observeTariffCalculation(args: { siteCode?: string | null; tariffType?: string | null; durationMs: number }) {
  tariffCalculationDurationMs
    .labels(safeLabel(args.siteCode), safeLabel(args.tariffType, 'STANDARD'))
    .observe(Math.max(0, args.durationMs))
}

export function observeDecisionEngineOutcome(args: { siteCode?: string | null; decisionCode: string; direction: string; count?: number }) {
  const count = Math.max(0, Number(args.count ?? 1) || 0)
  if (count <= 0) return
  decisionEngineOutcomesTotal
    .labels(safeLabel(args.siteCode), safeLabel(args.decisionCode), safeLabel(args.direction))
    .inc(count)
}

export function incSseConnections(channel: string, delta: 1 | -1) {
  activeSseConnections.labels(safeLabel(channel)).inc(delta)
}

export function observeLaneLockWait(args: { siteCode?: string | null; laneCode?: string | null; outcome?: string | null; durationMs: number }) {
  laneLockWaitTimeMs
    .labels(safeLabel(args.siteCode), safeLabel(args.laneCode), safeLabel(args.outcome, 'ACQUIRED'))
    .observe(Math.max(0, args.durationMs))
}
