import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  classifyOperationMetric,
  getMetricsDebugSummary,
  observeIncidentLifecycle,
  observeOperation,
  resetMetricsDebugState,
} from '../server/metrics'
import { buildHealthBreakdown } from '../server/health'

test.afterEach(() => {
  resetMetricsDebugState()
})

async function withStableBudgetEnv(fn: () => Promise<void> | void) {
  const keys = [
    'OBS_LATENCY_BUDGET_AUTH_LOGIN_MS',
    'OBS_LATENCY_BUDGET_DASHBOARD_SUMMARY_MS',
    'OBS_LATENCY_BUDGET_MEDIA_UPLOAD_MS',
    'OBS_LATENCY_BUDGET_INTAKE_INGEST_MS',
    'OBS_LATENCY_BUDGET_RECONCILE_REFRESH_MS',
    'OBS_LATENCY_BUDGET_INCIDENT_RESOLVE_MS',
    'OBS_LATENCY_BUDGET_AUDIT_LIST_MS',
    'OBS_LATENCY_BUDGET_HEALTH_BREAKDOWN_MS',
    'OBS_LATENCY_BUDGET_HEALTH_READY_MS',
  ] as const

  const previous = new Map<string, string | undefined>()
  const stableValues: Record<(typeof keys)[number], string> = {
    OBS_LATENCY_BUDGET_AUTH_LOGIN_MS: '800',
    OBS_LATENCY_BUDGET_DASHBOARD_SUMMARY_MS: '1200',
    OBS_LATENCY_BUDGET_MEDIA_UPLOAD_MS: '1500',
    OBS_LATENCY_BUDGET_INTAKE_INGEST_MS: '800',
    OBS_LATENCY_BUDGET_RECONCILE_REFRESH_MS: '1500',
    OBS_LATENCY_BUDGET_INCIDENT_RESOLVE_MS: '1200',
    OBS_LATENCY_BUDGET_AUDIT_LIST_MS: '800',
    OBS_LATENCY_BUDGET_HEALTH_BREAKDOWN_MS: '500',
    OBS_LATENCY_BUDGET_HEALTH_READY_MS: '500',
  }

  for (const key of keys) {
    previous.set(key, process.env[key])
    process.env[key] = stableValues[key]
  }

  try {
    await fn()
  } finally {
    for (const key of keys) {
      const value = previous.get(key)
      if (value == null) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('metrics summary phản ánh traffic + error buckets + latency budgets sau smoke flow giả lập', async () => {
  await withStableBudgetEnv(() => {
    assert.deepEqual(classifyOperationMetric('POST', '/api/auth/login'), { surface: 'AUTH', action: 'LOGIN' })
    assert.deepEqual(classifyOperationMetric('GET', '/api/ops/dashboard/summary'), { surface: 'DASHBOARD', action: 'SUMMARY' })
    assert.deepEqual(classifyOperationMetric('GET', '/api/ops/spot-occupancy/:spotCode'), { surface: 'RECONCILE', action: 'REFRESH' })

    observeOperation({ surface: 'AUTH', action: 'LOGIN', statusCode: 200, durationMs: 180 })
    observeOperation({ surface: 'DASHBOARD', action: 'SUMMARY', statusCode: 200, durationMs: 260 })
    observeOperation({ surface: 'MEDIA', action: 'UPLOAD', statusCode: 500, durationMs: 85 })
    observeOperation({ surface: 'INTAKE', action: 'INGEST', statusCode: 202, durationMs: 70 })
    observeOperation({ surface: 'RECONCILE', action: 'REFRESH', statusCode: 200, durationMs: 320 })
    observeOperation({ surface: 'INCIDENT', action: 'RESOLVE', statusCode: 200, durationMs: 210 })
    observeOperation({ surface: 'AUDIT', action: 'LIST', statusCode: 200, durationMs: 45 })

    observeIncidentLifecycle('AUTO_OPEN')
    observeIncidentLifecycle('AUTO_REOPEN')
    observeIncidentLifecycle('RESOLVE')
    observeIncidentLifecycle('SUPPRESS', 2)

    const summary = getMetricsDebugSummary()
    const dashboard = summary.operations.find((row) => row.surface === 'DASHBOARD' && row.action === 'SUMMARY')
    const media = summary.operations.find((row) => row.surface === 'MEDIA' && row.action === 'UPLOAD')
    const reconcile = summary.operations.find((row) => row.surface === 'RECONCILE' && row.action === 'REFRESH')

    assert.equal(summary.totals.requests, 7)
    assert.equal(summary.totals.errors, 1)
    assert.ok(dashboard)
    assert.equal(dashboard?.requests, 1)
    assert.equal(dashboard?.errors, 0)
    assert.equal(dashboard?.withinBudget, true)
    assert.ok(reconcile)
    assert.equal(reconcile?.withinBudget, true)
    assert.ok(media)
    assert.equal(media?.errors, 1)
    assert.equal(summary.incidents.AUTO_OPEN, 1)
    assert.equal(summary.incidents.AUTO_REOPEN, 1)
    assert.equal(summary.incidents.RESOLVE, 1)
    assert.equal(summary.incidents.SUPPRESS, 2)
  })
})

test('health breakdown chỉ ra component fail cụ thể thay vì một cờ xanh đỏ mơ hồ', async () => {
  const prevApiKey = process.env.INTERNAL_PRESENCE_API_KEY
  const prevSecret = process.env.INTERNAL_PRESENCE_HMAC_SECRET
  const prevMediaDriver = process.env.MEDIA_STORAGE_DRIVER
  process.env.INTERNAL_PRESENCE_API_KEY = ''
  process.env.INTERNAL_PRESENCE_HMAC_SECRET = ''
  process.env.MEDIA_STORAGE_DRIVER = 'LOCAL'

  try {
    const health = await buildHealthBreakdown({
      probeDb: async () => ({ available: true, latencyMs: 12, error: null }),
      getRedisHealth: async () => ({
        configured: true,
        required: false,
        keyPrefix: 'parkly:test',
        db: 0,
        url: 'redis://127.0.0.1:6379/0',
        connected: false,
        ready: false,
        available: false,
        degraded: false,
        latencyMs: null,
        lastCheckAt: '2026-03-13T00:00:00.000Z',
        lastError: 'redis optional down',
      }),
      getObjectStorageHealth: async () => ({
        configured: true,
        available: true,
        degraded: false,
        endpoint: 'http://127.0.0.1:9000',
        region: 'us-east-1',
        bucket: 'parkly-media',
        forcePathStyle: true,
        useSsl: false,
        lastCheckAt: '2026-03-13T00:00:00.000Z',
        lastError: null,
      }),
      readCleanupMarker: async () => null,
      now: () => new Date('2026-03-13T00:00:00.000Z'),
    })

    assert.equal(health.components.db.status, 'READY')
    assert.equal(health.components.redis.status, 'DEGRADED')
    assert.equal(health.components.intakeSigning.status, 'MISCONFIGURED')
    assert.equal(health.components.backgroundJobs.authSessionCleanup.status, 'DEGRADED')
    assert.equal(health.ready, false)
    assert.equal(health.status, 'NOT_READY')
  } finally {
    if (prevApiKey == null) delete process.env.INTERNAL_PRESENCE_API_KEY
    else process.env.INTERNAL_PRESENCE_API_KEY = prevApiKey
    if (prevSecret == null) delete process.env.INTERNAL_PRESENCE_HMAC_SECRET
    else process.env.INTERNAL_PRESENCE_HMAC_SECRET = prevSecret
    if (prevMediaDriver == null) delete process.env.MEDIA_STORAGE_DRIVER
    else process.env.MEDIA_STORAGE_DRIVER = prevMediaDriver
  }
})

test('source regression: route docs env smoke correlation và health breakdown đã được chốt', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'package.json'), 'utf8'))
  const appSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'server', 'app.ts'), 'utf8')
  const apiDocs = fs.readFileSync(path.join(repoRoot, 'docs', 'API.md'), 'utf8')
  const runbook = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'docs', 'RUNBOOK.md'), 'utf8')
  const envExample = fs.readFileSync(path.join(repoRoot, 'apps', 'api', '.env.example'), 'utf8')
  const smokeSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'scripts', 'smoke-backend.ts'), 'utf8')
  const cleanupSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'scripts', 'auth-session-cleanup.ts'), 'utf8')

  assert.equal(packageJson.scripts['test:pr27'], 'node --import tsx --test src/tests/pr27-observability.test.ts')
  assert.match(appSource, /app\.get\('\/metrics'/)
  assert.match(appSource, /api\.get\('\/ops\/metrics\/summary'/)
  assert.match(appSource, /buildHealthBreakdown\(/)
  assert.match(smokeSource, /x-correlation-id/)
  assert.match(cleanupSource, /writeRuntimeMarker\('auth-session-cleanup'/)
  assert.match(apiDocs, /GET \/api\/ops\/metrics\/summary/)
  assert.match(apiDocs, /health breakdown/i)
  assert.match(runbook, /Khi hệ thống chậm hoặc lỗi thì đọc metrics nào trước/)
  assert.match(envExample, /OBS_LATENCY_BUDGET_DASHBOARD_SUMMARY_MS=1200/)
  assert.match(envExample, /OBS_RUNTIME_DIR=.runtime/)
})
