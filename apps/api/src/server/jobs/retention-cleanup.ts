import fs from 'node:fs/promises'
import path from 'node:path'

import { prisma } from '../../lib/prisma'
import { config } from '../config'
import { resolveRuntimeDir } from '../observability-runtime'
import { getBackendRetentionPolicy, type BackendRetentionPolicy, type RetentionMode } from './retention-policy'
import { getRetentionCleanupDebugSummary, observeRetentionCleanupRun } from '../metrics'

export type RetentionCleanupDatasetResult = {
  dataset: string
  mode: RetentionMode
  scanned: number
  eligible: number
  deleted: number
  skipped: number
  errors: number
  cutoffAt: string | null
  sampleIds: string[]
  notes: string[]
}

export type RetentionCleanupSummary = {
  startedAt: string
  finishedAt: string
  durationMs: number
  mode: RetentionMode
  profile: 'DEMO' | 'RELEASE'
  preserveDemoSeed: boolean
  batchLimit: number
  totals: {
    scanned: number
    eligible: number
    deleted: number
    skipped: number
    errors: number
  }
  datasets: RetentionCleanupDatasetResult[]
  metrics: ReturnType<typeof getRetentionCleanupDebugSummary>
}

type DatasetExecutor = () => Promise<RetentionCleanupDatasetResult>

type FileScanResult = {
  scanned: number
  files: string[]
}

type RetentionCleanupStore = {
  listExpiredAuthSessions(cutoffIso: string, limit: number): Promise<string[]>
  listRevokedAuthSessions(cutoffIso: string, limit: number): Promise<string[]>
  deleteAuthSessions(sessionIds: string[]): Promise<number>
  listStaleLoginAttempts(cutoffIso: string, limit: number): Promise<string[]>
  deleteLoginAttempts(attemptKeys: string[]): Promise<number>
  listIncidentNoiseHistory(cutoffIso: string, limit: number): Promise<string[]>
  deleteIncidentNoiseHistory(historyIds: string[]): Promise<number>
  listInternalPresenceRejected(cutoffIso: string, limit: number): Promise<string[]>
  listInternalPresenceAccepted(cutoffIso: string, limit: number): Promise<string[]>
  listInternalPresenceSmokeArtifacts(cutoffIso: string, limit: number): Promise<string[]>
  deleteInternalPresenceEvents(eventIds: string[]): Promise<number>
}

type RunRetentionCleanupOptions = {
  mode?: RetentionMode
  policy?: BackendRetentionPolicy
  now?: Date
  store?: RetentionCleanupStore
}

function safeIso(value: Date) {
  return value.toISOString().slice(0, 19).replace('T', ' ')
}

function daysAgo(now: Date, days: number | null | undefined) {
  if (days == null || days <= 0) return null
  return new Date(now.getTime() - Math.max(1, Math.trunc(days)) * 86_400_000)
}

function hoursAgo(now: Date, hours: number | null | undefined) {
  if (hours == null || hours <= 0) return null
  return new Date(now.getTime() - Math.max(1, Math.trunc(hours)) * 3_600_000)
}


function cutoffFromDatasetDays(now: Date, dataset: { enabled: boolean; retentionDays?: number | null }) {
  return dataset.enabled ? daysAgo(now, dataset.retentionDays) : null
}

function cutoffFromDatasetHours(now: Date, dataset: { enabled: boolean; retentionHours?: number | null }) {
  return dataset.enabled ? hoursAgo(now, dataset.retentionHours) : null
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)))
}

function normalizeDeleteCount(value: unknown) {
  return Math.max(0, Number(value) || 0)
}

function makeResult(args: {
  dataset: string
  mode: RetentionMode
  scanned?: number
  eligible?: number
  deleted?: number
  skipped?: number
  errors?: number
  cutoffAt?: string | null
  sampleIds?: string[]
  notes?: string[]
}): RetentionCleanupDatasetResult {
  return {
    dataset: args.dataset,
    mode: args.mode,
    scanned: Math.max(0, args.scanned ?? 0),
    eligible: Math.max(0, args.eligible ?? 0),
    deleted: Math.max(0, args.deleted ?? 0),
    skipped: Math.max(0, args.skipped ?? 0),
    errors: Math.max(0, args.errors ?? 0),
    cutoffAt: args.cutoffAt ?? null,
    sampleIds: (args.sampleIds ?? []).slice(0, 10),
    notes: args.notes ?? [],
  }
}

function resolveTempUploadRoot() {
  return path.resolve(process.cwd(), config.upload.dir, 'tmp')
}

async function scanFilesOlderThan(args: {
  rootDir: string
  cutoff: Date
  limit: number
  excludeDirNames?: string[]
}): Promise<FileScanResult> {
  const exclude = new Set((args.excludeDirNames ?? []).map((item) => String(item).trim()).filter(Boolean))
  const matched: string[] = []
  let scanned = 0

  async function visit(dir: string): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (matched.length >= args.limit) return
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (exclude.has(entry.name)) continue
        await visit(fullPath)
        continue
      }
      if (!entry.isFile()) continue
      scanned += 1
      try {
        const stat = await fs.stat(fullPath)
        if (stat.mtime.getTime() <= args.cutoff.getTime()) {
          matched.push(fullPath)
        }
      } catch {
        continue
      }
    }
  }

  await visit(args.rootDir)
  return { scanned, files: matched }
}

async function deleteFiles(pathsToDelete: string[]) {
  let deleted = 0
  for (const filePath of pathsToDelete) {
    try {
      await fs.unlink(filePath)
      deleted += 1
    } catch {
      continue
    }
  }
  return deleted
}

function buildSqlRetentionStore(): RetentionCleanupStore {
  return {
    async listExpiredAuthSessions(cutoffIso, limit) {
      const rows = await prisma.$queryRawUnsafe<Array<{ sessionId: string }>>(
        `
          SELECT session_id AS sessionId
          FROM auth_user_sessions
          WHERE refresh_expires_at < ?
          ORDER BY refresh_expires_at ASC
          LIMIT ?
        `,
        cutoffIso,
        limit,
      )
      return rows.map((row) => String(row.sessionId))
    },

    async listRevokedAuthSessions(cutoffIso, limit) {
      const rows = await prisma.$queryRawUnsafe<Array<{ sessionId: string }>>(
        `
          SELECT session_id AS sessionId
          FROM auth_user_sessions
          WHERE revoked_at IS NOT NULL AND revoked_at < ?
          ORDER BY revoked_at ASC
          LIMIT ?
        `,
        cutoffIso,
        limit,
      )
      return rows.map((row) => String(row.sessionId))
    },

    async deleteAuthSessions(sessionIds) {
      const ids = uniqueStrings(sessionIds)
      if (ids.length === 0) return 0
      const placeholders = ids.map(() => '?').join(', ')
      const deleted = await prisma.$executeRawUnsafe(`DELETE FROM auth_user_sessions WHERE session_id IN (${placeholders})`, ...ids)
      return normalizeDeleteCount(deleted)
    },

    async listStaleLoginAttempts(cutoffIso, limit) {
      const rows = await prisma.$queryRawUnsafe<Array<{ attemptKey: string }>>(
        `
          SELECT attempt_key AS attemptKey
          FROM auth_login_attempts
          WHERE updated_at < ? AND (lockout_until IS NULL OR lockout_until < ?)
          ORDER BY updated_at ASC
          LIMIT ?
        `,
        cutoffIso,
        cutoffIso,
        limit,
      )
      return rows.map((row) => String(row.attemptKey))
    },

    async deleteLoginAttempts(attemptKeys) {
      const ids = uniqueStrings(attemptKeys)
      if (ids.length === 0) return 0
      const placeholders = ids.map(() => '?').join(', ')
      const deleted = await prisma.$executeRawUnsafe(`DELETE FROM auth_login_attempts WHERE attempt_key IN (${placeholders})`, ...ids)
      return normalizeDeleteCount(deleted)
    },

    async listIncidentNoiseHistory(cutoffIso, limit) {
      const rows = await prisma.$queryRawUnsafe<Array<{ historyId: bigint | number | string }>>(
        `
          SELECT gih.history_id AS historyId
          FROM gate_incident_history gih
          JOIN gate_incidents gi ON gi.incident_id = gih.incident_id
          WHERE gih.created_at < ?
            AND gi.status IN ('RESOLVED', 'IGNORED')
            AND gi.severity IN ('INFO', 'WARN')
            AND (
              gi.incident_type IN ('SPOT_SENSOR_STALE', 'SPOT_OCCUPANCY_UNKNOWN')
              OR gi.source_key LIKE 'reconciliation:%'
            )
          ORDER BY gih.created_at ASC
          LIMIT ?
        `,
        cutoffIso,
        limit,
      )
      return rows.map((row) => String(row.historyId))
    },

    async deleteIncidentNoiseHistory(historyIds) {
      const ids = uniqueStrings(historyIds)
      if (ids.length === 0) return 0
      const placeholders = ids.map(() => '?').join(', ')
      const deleted = await prisma.$executeRawUnsafe(`DELETE FROM gate_incident_history WHERE history_id IN (${placeholders})`, ...ids)
      return normalizeDeleteCount(deleted)
    },

    async listInternalPresenceRejected(cutoffIso, limit) {
      const rows = await prisma.$queryRawUnsafe<Array<{ eventId: bigint | number | string }>>(
        `
          SELECT presence_event_id AS eventId
          FROM internal_presence_events
          WHERE created_at < ?
            AND intake_status = 'REJECTED'
          ORDER BY created_at ASC
          LIMIT ?
        `,
        cutoffIso,
        limit,
      )
      return rows.map((row) => String(row.eventId))
    },

    async listInternalPresenceAccepted(cutoffIso, limit) {
      const rows = await prisma.$queryRawUnsafe<Array<{ eventId: bigint | number | string }>>(
        `
          SELECT presence_event_id AS eventId
          FROM internal_presence_events
          WHERE created_at < ?
            AND intake_status = 'ACCEPTED'
            AND (trace_id IS NULL OR trace_id NOT LIKE 'smoke-%')
            AND (snapshot_object_key IS NULL OR snapshot_object_key NOT LIKE 'smoke/%')
          ORDER BY created_at ASC
          LIMIT ?
        `,
        cutoffIso,
        limit,
      )
      return rows.map((row) => String(row.eventId))
    },

    async listInternalPresenceSmokeArtifacts(cutoffIso, limit) {
      const rows = await prisma.$queryRawUnsafe<Array<{ eventId: bigint | number | string }>>(
        `
          SELECT presence_event_id AS eventId
          FROM internal_presence_events
          WHERE created_at < ?
            AND (
              trace_id LIKE 'smoke-%'
              OR snapshot_object_key LIKE 'smoke/%'
              OR model_version LIKE 'smoke-%'
            )
          ORDER BY created_at ASC
          LIMIT ?
        `,
        cutoffIso,
        limit,
      )
      return rows.map((row) => String(row.eventId))
    },

    async deleteInternalPresenceEvents(eventIds) {
      const ids = uniqueStrings(eventIds)
      if (ids.length === 0) return 0
      const placeholders = ids.map(() => '?').join(', ')
      const deleted = await prisma.$executeRawUnsafe(`DELETE FROM internal_presence_events WHERE presence_event_id IN (${placeholders})`, ...ids)
      return normalizeDeleteCount(deleted)
    },
  }
}

async function executeSqlDataset(args: {
  dataset: string
  mode: RetentionMode
  cutoff: Date | null
  listEligible: (cutoffIso: string, limit: number) => Promise<string[]>
  deleteEligible: (ids: string[]) => Promise<number>
  batchLimit: number
  notes?: string[]
}): Promise<RetentionCleanupDatasetResult> {
  const startedAt = Date.now()
  if (!args.cutoff) {
    const result = makeResult({ dataset: args.dataset, mode: args.mode, notes: ['dataset disabled vì retention window = null', ...(args.notes ?? [])] })
    observeRetentionCleanupRun({
      dataset: args.dataset,
      mode: args.mode,
      outcome: 'SKIPPED',
      durationMs: Date.now() - startedAt,
      scanned: 0,
      eligible: 0,
      deleted: 0,
      errors: 0,
    })
    return result
  }

  try {
    const ids = await args.listEligible(safeIso(args.cutoff), args.batchLimit)
    const uniqueIds = uniqueStrings(ids)
    const deleted = args.mode === 'APPLY' ? await args.deleteEligible(uniqueIds) : 0
    const result = makeResult({
      dataset: args.dataset,
      mode: args.mode,
      scanned: uniqueIds.length,
      eligible: uniqueIds.length,
      deleted,
      skipped: args.mode === 'DRY_RUN' ? uniqueIds.length : Math.max(0, uniqueIds.length - deleted),
      cutoffAt: args.cutoff.toISOString(),
      sampleIds: uniqueIds,
      notes: args.notes,
    })
    observeRetentionCleanupRun({
      dataset: args.dataset,
      mode: args.mode,
      outcome: 'OK',
      durationMs: Date.now() - startedAt,
      scanned: result.scanned,
      eligible: result.eligible,
      deleted: result.deleted,
      errors: 0,
    })
    return result
  } catch (error) {
    const result = makeResult({
      dataset: args.dataset,
      mode: args.mode,
      errors: 1,
      cutoffAt: args.cutoff.toISOString(),
      notes: [...(args.notes ?? []), `error=${String((error as { message?: unknown } | null | undefined)?.message ?? error)}`],
    })
    observeRetentionCleanupRun({
      dataset: args.dataset,
      mode: args.mode,
      outcome: 'ERROR',
      durationMs: Date.now() - startedAt,
      scanned: 0,
      eligible: 0,
      deleted: 0,
      errors: 1,
    })
    return result
  }
}

async function executeFileDataset(args: {
  dataset: string
  mode: RetentionMode
  cutoff: Date | null
  rootDir: string
  batchLimit: number
  excludeDirNames?: string[]
  notes?: string[]
}): Promise<RetentionCleanupDatasetResult> {
  const startedAt = Date.now()
  if (!args.cutoff) {
    const result = makeResult({ dataset: args.dataset, mode: args.mode, notes: ['dataset disabled vì retention window = null', ...(args.notes ?? [])] })
    observeRetentionCleanupRun({
      dataset: args.dataset,
      mode: args.mode,
      outcome: 'SKIPPED',
      durationMs: Date.now() - startedAt,
      scanned: 0,
      eligible: 0,
      deleted: 0,
      errors: 0,
    })
    return result
  }

  try {
    const scan = await scanFilesOlderThan({
      rootDir: args.rootDir,
      cutoff: args.cutoff,
      limit: args.batchLimit,
      excludeDirNames: args.excludeDirNames,
    })
    const deleted = args.mode === 'APPLY' ? await deleteFiles(scan.files) : 0
    const result = makeResult({
      dataset: args.dataset,
      mode: args.mode,
      scanned: scan.scanned,
      eligible: scan.files.length,
      deleted,
      skipped: args.mode === 'DRY_RUN' ? scan.files.length : Math.max(0, scan.files.length - deleted),
      cutoffAt: args.cutoff.toISOString(),
      sampleIds: scan.files,
      notes: [`root=${args.rootDir}`, ...(args.notes ?? [])],
    })
    observeRetentionCleanupRun({
      dataset: args.dataset,
      mode: args.mode,
      outcome: 'OK',
      durationMs: Date.now() - startedAt,
      scanned: result.scanned,
      eligible: result.eligible,
      deleted: result.deleted,
      errors: 0,
    })
    return result
  } catch (error) {
    const result = makeResult({
      dataset: args.dataset,
      mode: args.mode,
      errors: 1,
      cutoffAt: args.cutoff.toISOString(),
      notes: [`root=${args.rootDir}`, ...(args.notes ?? []), `error=${String((error as { message?: unknown } | null | undefined)?.message ?? error)}`],
    })
    observeRetentionCleanupRun({
      dataset: args.dataset,
      mode: args.mode,
      outcome: 'ERROR',
      durationMs: Date.now() - startedAt,
      scanned: 0,
      eligible: 0,
      deleted: 0,
      errors: 1,
    })
    return result
  }
}

export async function runRetentionCleanup(options: RunRetentionCleanupOptions = {}): Promise<RetentionCleanupSummary> {
  const policy = options.policy ?? getBackendRetentionPolicy()
  const mode = options.mode ?? 'DRY_RUN'
  const now = options.now ?? new Date()
  const store = options.store ?? buildSqlRetentionStore()
  const startedAt = Date.now()

  const datasets: DatasetExecutor[] = [
    () => executeSqlDataset({
      dataset: 'auth_sessions_expired',
      mode,
      cutoff: policy.datasets.authSessions.enabled ? daysAgo(now, config.auth.sessionHygiene.cleanupExpiredRetentionDays) : null,
      listEligible: store.listExpiredAuthSessions,
      deleteEligible: store.deleteAuthSessions,
      batchLimit: policy.batchLimit,
      notes: [`expired>${config.auth.sessionHygiene.cleanupExpiredRetentionDays}d`, ...policy.datasets.authSessions.notes],
    }),
    () => executeSqlDataset({
      dataset: 'auth_sessions_revoked',
      mode,
      cutoff: policy.datasets.authSessions.enabled ? daysAgo(now, config.auth.sessionHygiene.cleanupRevokedRetentionDays) : null,
      listEligible: store.listRevokedAuthSessions,
      deleteEligible: store.deleteAuthSessions,
      batchLimit: policy.batchLimit,
      notes: [`revoked>${config.auth.sessionHygiene.cleanupRevokedRetentionDays}d`, ...policy.datasets.authSessions.notes],
    }),
    () => executeSqlDataset({
      dataset: 'auth_login_attempts',
      mode,
      cutoff: cutoffFromDatasetDays(now, policy.datasets.loginAttempts),
      listEligible: store.listStaleLoginAttempts,
      deleteEligible: store.deleteLoginAttempts,
      batchLimit: policy.batchLimit,
      notes: policy.datasets.loginAttempts.notes,
    }),
    () => executeSqlDataset({
      dataset: 'incident_noise_history',
      mode,
      cutoff: cutoffFromDatasetDays(now, policy.datasets.incidentNoiseHistory),
      listEligible: store.listIncidentNoiseHistory,
      deleteEligible: store.deleteIncidentNoiseHistory,
      batchLimit: policy.batchLimit,
      notes: policy.datasets.incidentNoiseHistory.notes,
    }),
    () => executeSqlDataset({
      dataset: 'internal_presence_rejected',
      mode,
      cutoff: cutoffFromDatasetDays(now, policy.datasets.internalPresenceRejected),
      listEligible: store.listInternalPresenceRejected,
      deleteEligible: store.deleteInternalPresenceEvents,
      batchLimit: policy.batchLimit,
      notes: policy.datasets.internalPresenceRejected.notes,
    }),
    () => executeSqlDataset({
      dataset: 'internal_presence_smoke_artifacts',
      mode,
      cutoff: cutoffFromDatasetDays(now, policy.datasets.smokeArtifacts),
      listEligible: store.listInternalPresenceSmokeArtifacts,
      deleteEligible: store.deleteInternalPresenceEvents,
      batchLimit: policy.batchLimit,
      notes: policy.datasets.smokeArtifacts.notes,
    }),
    () => executeSqlDataset({
      dataset: 'internal_presence_accepted',
      mode,
      cutoff: cutoffFromDatasetDays(now, policy.datasets.internalPresenceAccepted),
      listEligible: store.listInternalPresenceAccepted,
      deleteEligible: store.deleteInternalPresenceEvents,
      batchLimit: policy.batchLimit,
      notes: policy.datasets.internalPresenceAccepted.notes,
    }),
    () => executeFileDataset({
      dataset: 'temp_upload_files',
      mode,
      cutoff: cutoffFromDatasetHours(now, policy.datasets.tempUploads),
      rootDir: resolveTempUploadRoot(),
      batchLimit: policy.batchLimit,
      notes: policy.datasets.tempUploads.notes,
    }),
    () => executeFileDataset({
      dataset: 'runtime_artifacts',
      mode,
      cutoff: cutoffFromDatasetDays(now, policy.datasets.runtimeArtifacts),
      rootDir: resolveRuntimeDir(),
      batchLimit: policy.batchLimit,
      excludeDirNames: ['observability'],
      notes: policy.datasets.runtimeArtifacts.notes,
    }),
  ]

  const results: RetentionCleanupDatasetResult[] = []
  for (const run of datasets) {
    results.push(await run())
  }

  const summary: RetentionCleanupSummary = {
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    mode,
    profile: policy.profile,
    preserveDemoSeed: policy.preserveDemoSeed,
    batchLimit: policy.batchLimit,
    totals: {
      scanned: results.reduce((sum, item) => sum + item.scanned, 0),
      eligible: results.reduce((sum, item) => sum + item.eligible, 0),
      deleted: results.reduce((sum, item) => sum + item.deleted, 0),
      skipped: results.reduce((sum, item) => sum + item.skipped, 0),
      errors: results.reduce((sum, item) => sum + item.errors, 0),
    },
    datasets: results,
    metrics: getRetentionCleanupDebugSummary(),
  }

  return summary
}
