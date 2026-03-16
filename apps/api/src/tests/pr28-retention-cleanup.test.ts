import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describeRetentionPolicy, getBackendRetentionPolicy } from '../server/jobs/retention-policy'
import { runRetentionCleanup } from '../server/jobs/retention-cleanup'
import { getRetentionCleanupDebugSummary, resetMetricsDebugState } from '../server/metrics'

function withEnv<T>(patch: Record<string, string | undefined>, fn: () => Promise<T> | T) {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(patch)) {
    previous.set(key, process.env[key])
    if (value == null) delete process.env[key]
    else process.env[key] = value
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of previous.entries()) {
        if (value == null) delete process.env[key]
        else process.env[key] = value
      }
    })
}

test.afterEach(() => {
  resetMetricsDebugState()
})

test('retention policy phân biệt rõ DEMO và RELEASE để tránh drift fixture', async () => {
  await withEnv({
    RETENTION_PROFILE: 'DEMO',
    RETENTION_PRESERVE_DEMO_SEED: 'ON',
    RETENTION_INTERNAL_PRESENCE_ACCEPTED_RETENTION_DAYS: '',
  }, () => {
    const demo = describeRetentionPolicy(getBackendRetentionPolicy())
    assert.equal(demo.profile, 'DEMO')
    assert.equal(demo.preserveDemoSeed, true)
    assert.equal(demo.datasets.internalPresenceAccepted.enabled, false)
  })

  await withEnv({
    RETENTION_PROFILE: 'RELEASE',
    RETENTION_PRESERVE_DEMO_SEED: 'OFF',
    RETENTION_INTERNAL_PRESENCE_ACCEPTED_RETENTION_DAYS: '30',
  }, () => {
    const release = describeRetentionPolicy(getBackendRetentionPolicy())
    assert.equal(release.profile, 'RELEASE')
    assert.equal(release.preserveDemoSeed, false)
    assert.equal(release.datasets.internalPresenceAccepted.enabled, true)
    assert.equal(release.datasets.internalPresenceAccepted.retentionDays, 30)
  })
})

test('dry-run hiển thị rõ scanned/eligible/deleted và apply idempotent không phá batch metrics', async () => {
  const deleted = {
    sessions: new Set<string>(),
    attempts: new Set<string>(),
    history: new Set<string>(),
    presence: new Set<string>(),
  }

  const summaryDryRun = await runRetentionCleanup({
    mode: 'DRY_RUN',
    now: new Date('2026-03-13T00:00:00.000Z'),
    policy: {
      profile: 'DEMO',
      preserveDemoSeed: true,
      batchLimit: 10,
      datasets: {
        authSessions: { name: 'authSessions', enabled: true, retentionDays: 3, notes: [] },
        loginAttempts: { name: 'loginAttempts', enabled: true, retentionDays: 14, notes: [] },
        incidentNoiseHistory: { name: 'incidentNoiseHistory', enabled: true, retentionDays: 30, notes: [] },
        internalPresenceRejected: { name: 'internalPresenceRejected', enabled: true, retentionDays: 14, notes: [] },
        internalPresenceAccepted: { name: 'internalPresenceAccepted', enabled: false, retentionDays: null, notes: ['protected in demo'] },
        smokeArtifacts: { name: 'smokeArtifacts', enabled: true, retentionDays: 21, notes: [] },
        tempUploads: { name: 'tempUploads', enabled: false, retentionHours: null, notes: [] },
        runtimeArtifacts: { name: 'runtimeArtifacts', enabled: false, retentionDays: null, notes: [] },
      },
    },
    store: {
      async listExpiredAuthSessions() { return ['sess-1', 'sess-2'] },
      async listRevokedAuthSessions() { return ['sess-r1'] },
      async deleteAuthSessions(ids) { ids.forEach((id) => deleted.sessions.add(id)); return ids.length },
      async listStaleLoginAttempts() { return ['attempt:ops', 'attempt:ops|127.0.0.1'] },
      async deleteLoginAttempts(ids) { ids.forEach((id) => deleted.attempts.add(id)); return ids.length },
      async listIncidentNoiseHistory() { return ['1001'] },
      async deleteIncidentNoiseHistory(ids) { ids.forEach((id) => deleted.history.add(id)); return ids.length },
      async listInternalPresenceRejected() { return ['2001'] },
      async listInternalPresenceAccepted() { return ['should-not-run'] },
      async listInternalPresenceSmokeArtifacts() { return ['2002', '2003'] },
      async deleteInternalPresenceEvents(ids) { ids.forEach((id) => deleted.presence.add(id)); return ids.length },
    },
  })

  assert.equal(summaryDryRun.mode, 'DRY_RUN')
  assert.equal(summaryDryRun.totals.eligible, 9)
  assert.equal(summaryDryRun.totals.deleted, 0)
  assert.equal(deleted.sessions.size, 0)
  assert.equal(deleted.attempts.size, 0)
  assert.equal(summaryDryRun.datasets.find((row) => row.dataset === 'auth_sessions_expired')?.eligible, 2)
  assert.equal(summaryDryRun.datasets.find((row) => row.dataset === 'auth_sessions_revoked')?.eligible, 1)
  assert.equal(summaryDryRun.datasets.find((row) => row.dataset === 'internal_presence_accepted')?.notes[0], 'dataset disabled vì retention window = null')

  resetMetricsDebugState()

  const summaryApply = await runRetentionCleanup({
    mode: 'APPLY',
    now: new Date('2026-03-13T00:00:00.000Z'),
    policy: {
      profile: 'RELEASE',
      preserveDemoSeed: false,
      batchLimit: 10,
      datasets: {
        authSessions: { name: 'authSessions', enabled: true, retentionDays: 3, notes: [] },
        loginAttempts: { name: 'loginAttempts', enabled: true, retentionDays: 14, notes: [] },
        incidentNoiseHistory: { name: 'incidentNoiseHistory', enabled: true, retentionDays: 30, notes: [] },
        internalPresenceRejected: { name: 'internalPresenceRejected', enabled: true, retentionDays: 14, notes: [] },
        internalPresenceAccepted: { name: 'internalPresenceAccepted', enabled: true, retentionDays: 30, notes: [] },
        smokeArtifacts: { name: 'smokeArtifacts', enabled: true, retentionDays: 21, notes: [] },
        tempUploads: { name: 'tempUploads', enabled: false, retentionHours: null, notes: [] },
        runtimeArtifacts: { name: 'runtimeArtifacts', enabled: false, retentionDays: null, notes: [] },
      },
    },
    store: {
      async listExpiredAuthSessions() { return deleted.sessions.size === 0 ? ['sess-1', 'sess-2'] : [] },
      async listRevokedAuthSessions() { return deleted.sessions.has('sess-r1') ? [] : ['sess-r1'] },
      async deleteAuthSessions(ids) { ids.forEach((id) => deleted.sessions.add(id)); return ids.length },
      async listStaleLoginAttempts() { return deleted.attempts.size === 0 ? ['attempt:ops'] : [] },
      async deleteLoginAttempts(ids) { ids.forEach((id) => deleted.attempts.add(id)); return ids.length },
      async listIncidentNoiseHistory() { return deleted.history.size === 0 ? ['1001'] : [] },
      async deleteIncidentNoiseHistory(ids) { ids.forEach((id) => deleted.history.add(id)); return ids.length },
      async listInternalPresenceRejected() { return deleted.presence.has('2001') ? [] : ['2001'] },
      async listInternalPresenceAccepted() { return deleted.presence.has('2004') ? [] : ['2004'] },
      async listInternalPresenceSmokeArtifacts() { return deleted.presence.has('2002') ? [] : ['2002'] },
      async deleteInternalPresenceEvents(ids) { ids.forEach((id) => deleted.presence.add(id)); return ids.length },
    },
  })

  assert.equal(summaryApply.mode, 'APPLY')
  assert.equal(summaryApply.totals.deleted, 8)
  assert.ok(deleted.sessions.has('sess-1'))
  assert.ok(deleted.sessions.has('sess-r1'))
  assert.ok(deleted.attempts.has('attempt:ops'))
  assert.ok(deleted.history.has('1001'))
  assert.ok(deleted.presence.has('2004'))

  const metrics = getRetentionCleanupDebugSummary()
  assert.equal(metrics.totals.deleted, 8)
  assert.ok(metrics.rows.some((row) => row.dataset === 'internal_presence_accepted' && row.deleted === 1))
})

test('cleanup file artifacts xóa đúng tmp/runtime cũ và chạy lại vẫn idempotent', async () => {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'parkly-retention-'))
  const uploadTmp = path.join(tempRoot, 'uploads', 'tmp')
  const runtimeDir = path.join(tempRoot, '.runtime')
  const runtimeSmoke = path.join(runtimeDir, 'smoke')
  const runtimeObservability = path.join(runtimeDir, 'observability')
  await fsp.mkdir(uploadTmp, { recursive: true })
  await fsp.mkdir(runtimeSmoke, { recursive: true })
  await fsp.mkdir(runtimeObservability, { recursive: true })

  const oldUpload = path.join(uploadTmp, 'old.tmp')
  const newUpload = path.join(uploadTmp, 'fresh.tmp')
  const oldRuntime = path.join(runtimeSmoke, 'old.log')
  const retainedMarker = path.join(runtimeObservability, 'retention-cleanup.json')
  await fsp.writeFile(oldUpload, 'old')
  await fsp.writeFile(newUpload, 'fresh')
  await fsp.writeFile(oldRuntime, 'runtime-old')
  await fsp.writeFile(retainedMarker, '{}')

  const oldTime = new Date('2026-03-10T00:00:00.000Z')
  const newTime = new Date('2026-03-13T00:00:00.000Z')
  await fsp.utimes(oldUpload, oldTime, oldTime)
  await fsp.utimes(newUpload, newTime, newTime)
  await fsp.utimes(oldRuntime, oldTime, oldTime)
  await fsp.utimes(retainedMarker, oldTime, oldTime)

  const previousCwd = process.cwd()
  process.chdir(tempRoot)
  const prevUploadDir = process.env.UPLOAD_DIR
  const prevRuntimeDir = process.env.OBS_RUNTIME_DIR
  process.env.UPLOAD_DIR = 'uploads'
  process.env.OBS_RUNTIME_DIR = '.runtime'

  try {
    const first = await runRetentionCleanup({
      mode: 'APPLY',
      now: new Date('2026-03-13T12:00:00.000Z'),
      policy: {
        profile: 'DEMO',
        preserveDemoSeed: true,
        batchLimit: 20,
        datasets: {
          authSessions: { name: 'authSessions', enabled: false, retentionDays: null, notes: [] },
          loginAttempts: { name: 'loginAttempts', enabled: false, retentionDays: null, notes: [] },
          incidentNoiseHistory: { name: 'incidentNoiseHistory', enabled: false, retentionDays: null, notes: [] },
          internalPresenceRejected: { name: 'internalPresenceRejected', enabled: false, retentionDays: null, notes: [] },
          internalPresenceAccepted: { name: 'internalPresenceAccepted', enabled: false, retentionDays: null, notes: [] },
          smokeArtifacts: { name: 'smokeArtifacts', enabled: false, retentionDays: null, notes: [] },
          tempUploads: { name: 'tempUploads', enabled: true, retentionHours: 24, notes: [] },
          runtimeArtifacts: { name: 'runtimeArtifacts', enabled: true, retentionDays: 2, notes: [] },
        },
      },
      store: {
        async listExpiredAuthSessions() { return [] },
        async listRevokedAuthSessions() { return [] },
        async deleteAuthSessions() { return 0 },
        async listStaleLoginAttempts() { return [] },
        async deleteLoginAttempts() { return 0 },
        async listIncidentNoiseHistory() { return [] },
        async deleteIncidentNoiseHistory() { return 0 },
        async listInternalPresenceRejected() { return [] },
        async listInternalPresenceAccepted() { return [] },
        async listInternalPresenceSmokeArtifacts() { return [] },
        async deleteInternalPresenceEvents() { return 0 },
      },
    })

    assert.equal(first.datasets.find((row) => row.dataset === 'temp_upload_files')?.deleted, 1)
    assert.equal(first.datasets.find((row) => row.dataset === 'runtime_artifacts')?.deleted, 1)
    assert.equal(fs.existsSync(oldUpload), false)
    assert.equal(fs.existsSync(oldRuntime), false)
    assert.equal(fs.existsSync(newUpload), true)
    assert.equal(fs.existsSync(retainedMarker), true)

    const second = await runRetentionCleanup({
      mode: 'APPLY',
      now: new Date('2026-03-13T12:00:00.000Z'),
      policy: {
        profile: 'DEMO',
        preserveDemoSeed: true,
        batchLimit: 20,
        datasets: {
          authSessions: { name: 'authSessions', enabled: false, retentionDays: null, notes: [] },
          loginAttempts: { name: 'loginAttempts', enabled: false, retentionDays: null, notes: [] },
          incidentNoiseHistory: { name: 'incidentNoiseHistory', enabled: false, retentionDays: null, notes: [] },
          internalPresenceRejected: { name: 'internalPresenceRejected', enabled: false, retentionDays: null, notes: [] },
          internalPresenceAccepted: { name: 'internalPresenceAccepted', enabled: false, retentionDays: null, notes: [] },
          smokeArtifacts: { name: 'smokeArtifacts', enabled: false, retentionDays: null, notes: [] },
          tempUploads: { name: 'tempUploads', enabled: true, retentionHours: 24, notes: [] },
          runtimeArtifacts: { name: 'runtimeArtifacts', enabled: true, retentionDays: 2, notes: [] },
        },
      },
      store: {
        async listExpiredAuthSessions() { return [] },
        async listRevokedAuthSessions() { return [] },
        async deleteAuthSessions() { return 0 },
        async listStaleLoginAttempts() { return [] },
        async deleteLoginAttempts() { return 0 },
        async listIncidentNoiseHistory() { return [] },
        async deleteIncidentNoiseHistory() { return 0 },
        async listInternalPresenceRejected() { return [] },
        async listInternalPresenceAccepted() { return [] },
        async listInternalPresenceSmokeArtifacts() { return [] },
        async deleteInternalPresenceEvents() { return 0 },
      },
    })

    assert.equal(second.totals.deleted, 0)
  } finally {
    process.chdir(previousCwd)
    if (prevUploadDir == null) delete process.env.UPLOAD_DIR
    else process.env.UPLOAD_DIR = prevUploadDir
    if (prevRuntimeDir == null) delete process.env.OBS_RUNTIME_DIR
    else process.env.OBS_RUNTIME_DIR = prevRuntimeDir
    await fsp.rm(tempRoot, { recursive: true, force: true })
  }
})

test('source regression: package scripts, runbook, env và grants đã chốt retention cleanup', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'package.json'), 'utf8'))
  const runbook = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'docs', 'RUNBOOK.md'), 'utf8')
  const retentionDoc = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'docs', 'RETENTION_POLICY.md'), 'utf8')
  const envExample = fs.readFileSync(path.join(repoRoot, 'apps', 'api', '.env.example'), 'utf8')
  const cleanupScript = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'scripts', 'retention-cleanup.ts'), 'utf8')
  const cleanupJob = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'server', 'jobs', 'retention-cleanup.ts'), 'utf8')
  const healthSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'server', 'health.ts'), 'utf8')
  const grants = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'db', 'scripts', 'grants_parking_app.mvp.sql'), 'utf8')

  assert.equal(packageJson.scripts?.['cleanup:retention:dry-run'], 'cross-env RETENTION_DRY_RUN=ON tsx src/scripts/retention-cleanup.ts --dry-run')
  assert.equal(packageJson.scripts?.['cleanup:retention'], 'cross-env RETENTION_DRY_RUN=OFF tsx src/scripts/retention-cleanup.ts --apply')
  assert.equal(packageJson.scripts?.['test:pr28'], 'node --import tsx --test src/tests/pr28-retention-cleanup.test.ts')
  assert.match(runbook, /cleanup:retention:dry-run/)
  assert.match(runbook, /RETENTION_POLICY\.md/)
  assert.match(retentionDoc, /internal_presence_events/)
  assert.match(retentionDoc, /không xóa `audit_logs`/)
  assert.match(envExample, /RETENTION_PROFILE=DEMO/)
  assert.match(envExample, /RETENTION_CLEANUP_BATCH_LIMIT=250/)
  assert.match(envExample, /OBS_RETENTION_JOB_MAX_AGE_MINUTES=1440/)
  assert.match(cleanupScript, /writeRuntimeMarker\('retention-cleanup'/)
  assert.match(cleanupJob, /internal_presence_smoke_artifacts/)
  assert.match(cleanupJob, /runtime_artifacts/)
  assert.match(healthSource, /retention-cleanup/)
  assert.match(healthSource, /retentionCleanup/)
  assert.match(grants, /GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt\.gate_incident_history/)
  assert.match(grants, /GRANT SELECT, INSERT, DELETE ON parking_mgmt\.internal_presence_events/)
})
