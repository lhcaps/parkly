import fs from 'node:fs'
import path from 'node:path'

import { type DeploymentProfile, applyDeploymentProfileEnv, resolveDeploymentProfile } from './deployment-profiles'

export type BackupKind = 'DB_ONLY' | 'FULL'
export type BackupMediaStrategy = 'LOCAL_SNAPSHOT' | 'MINIO_EXTERNAL' | 'NONE'

export type MysqlConnectionConfig = {
  host: string
  port: number
  user: string
  password: string
  database: string
}

export type BackupArtifactManifest = {
  version: '2026-03-pr24'
  backupId: string
  createdAt: string
  createdByProfile: DeploymentProfile['name']
  deploymentLabel: string
  backupKind: BackupKind
  backupRoot: string
  artifactDir: string
  retentionDays: number
  objectives: {
    rpoMinutes: number
    rtoMinutes: number
  }
  database: {
    engine: 'mysql'
    database: string
    artifactPath: string
    bytes: number | null
    dumpCommand: string[]
    notes: string[]
  }
  media: {
    driver: DeploymentProfile['mediaDriver']
    strategy: BackupMediaStrategy
    includedPaths: string[]
    notes: string[]
  }
}

function envInt(name: string, fallback: number, env: NodeJS.ProcessEnv = process.env) {
  const raw = String(env[name] ?? '').trim()
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback
}

export function envFlag(name: string, fallback = false, env: NodeJS.ProcessEnv = process.env) {
  const raw = String(env[name] ?? '').trim().toUpperCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'ON' || raw === 'TRUE' || raw === 'YES'
}

export function ensureDir(target: string) {
  fs.mkdirSync(target, { recursive: true })
  return target
}

export function formatArtifactTimestamp(date = new Date()) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  const second = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hour}${minute}${second}Z`
}

export function buildBackupId(profile: DeploymentProfile, date = new Date()) {
  return `${profile.label}-backup-${formatArtifactTimestamp(date)}`
}

export function resolveBackupRootDir(env: NodeJS.ProcessEnv = process.env) {
  return path.resolve(String(env.BACKUP_ROOT_DIR ?? '.backups').trim() || '.backups')
}

export function resolveBackupRetentionDays(profile: DeploymentProfile, env: NodeJS.ProcessEnv = process.env) {
  if (profile.name === 'RELEASE_CANDIDATE') {
    return envInt('BACKUP_RETENTION_RC_DAYS', 14, env)
  }
  return envInt('BACKUP_RETENTION_DEMO_DAYS', 7, env)
}

export function resolveRecoveryObjectives(env: NodeJS.ProcessEnv = process.env) {
  return {
    rpoMinutes: envInt('BACKUP_RPO_TARGET_MINUTES', 60, env),
    rtoMinutes: envInt('BACKUP_RTO_TARGET_MINUTES', 15, env),
  }
}

export function resolveMysqlConnection(env: NodeJS.ProcessEnv = process.env): MysqlConnectionConfig {
  const host = String(env.DATABASE_ADMIN_HOST ?? env.DATABASE_HOST ?? '127.0.0.1').trim() || '127.0.0.1'
  const port = envInt('DATABASE_ADMIN_PORT', envInt('DATABASE_PORT', 3306, env), env)
  const user = String(env.DATABASE_ADMIN_USER ?? env.DATABASE_USER ?? '').trim()
  const password = String(env.DATABASE_ADMIN_PASSWORD ?? env.DATABASE_PASSWORD ?? '').trim()
  const database = String(env.DATABASE_NAME ?? 'parking_mgmt').trim() || 'parking_mgmt'
  if (!user) throw new Error('Thiếu DATABASE_ADMIN_USER hoặc DATABASE_USER để chạy backup/restore MySQL.')
  return { host, port, user, password, database }
}

export function resolveBackupProfile(env: NodeJS.ProcessEnv = process.env, explicitProfile?: string | null) {
  const appliedEnv = applyDeploymentProfileEnv(env, explicitProfile)
  return {
    env: appliedEnv,
    profile: resolveDeploymentProfile(appliedEnv, explicitProfile),
  }
}

export function resolveLocalArtifactPaths(env: NodeJS.ProcessEnv = process.env) {
  const uploadRoot = path.resolve(String(env.UPLOAD_DIR ?? 'uploads').trim() || 'uploads')
  const runtimeRoot = path.resolve(String(env.OBS_RUNTIME_DIR ?? '.runtime').trim() || '.runtime')
  const custom = String(env.BACKUP_LOCAL_ARTIFACT_PATHS ?? '').trim()
  const configured = custom
    ? custom
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => path.resolve(item))
    : [path.join(uploadRoot, 'gate-media'), path.join(runtimeRoot, 'observability')]

  return Array.from(new Set(configured))
}

export function resolveMediaBackupStrategy(profile: DeploymentProfile, env: NodeJS.ProcessEnv = process.env): {
  strategy: BackupMediaStrategy
  includedPaths: string[]
  notes: string[]
} {
  if (profile.mediaDriver === 'LOCAL') {
    return {
      strategy: 'LOCAL_SNAPSHOT',
      includedPaths: resolveLocalArtifactPaths(env),
      notes: ['local media driver đang bật nên backup sẽ snapshot thư mục local artifacts quan trọng.'],
    }
  }

  return {
    strategy: 'MINIO_EXTERNAL',
    includedPaths: [],
    notes: [
      'profile này dùng MINIO/S3 nên script không snapshot object storage qua filesystem.',
      'cần backup bucket bằng chiến lược riêng của object storage hoặc công cụ MinIO/mc ở tầng hạ tầng.',
    ],
  }
}

export function createBackupManifest(args: {
  profile: DeploymentProfile
  backupKind: BackupKind
  backupRoot: string
  artifactDir: string
  backupId: string
  createdAt?: Date
  env?: NodeJS.ProcessEnv
  databaseArtifactPath: string
  databaseBytes?: number | null
  databaseDumpCommand?: string[]
  databaseNotes?: string[]
}) {
  const createdAt = (args.createdAt ?? new Date()).toISOString()
  const env = args.env ?? process.env
  const mysql = resolveMysqlConnection(env)
  const objectives = resolveRecoveryObjectives(env)
  const retentionDays = resolveBackupRetentionDays(args.profile, env)
  const media = resolveMediaBackupStrategy(args.profile, env)

  const dumpCommand =
    args.databaseDumpCommand ?? [
      String(env.MYSQLDUMP_BIN ?? 'mysqldump').trim() || 'mysqldump',
      `--host=${mysql.host}`,
      `--port=${mysql.port}`,
      `--user=${mysql.user}`,
      '--single-transaction',
      '--triggers',
      '--skip-lock-tables',
      '--set-gtid-purged=OFF',
      '--no-tablespaces',
      '--databases',
      mysql.database,
    ]

  const databaseNotes = args.databaseNotes ?? ['backup DB mặc định ưu tiên portability; routines/events là opt-in nếu user đủ privilege.']

  return {
    version: '2026-03-pr24',
    backupId: args.backupId,
    createdAt,
    createdByProfile: args.profile.name,
    deploymentLabel: args.profile.label,
    backupKind: args.backupKind,
    backupRoot: args.backupRoot,
    artifactDir: args.artifactDir,
    retentionDays,
    objectives,
    database: {
      engine: 'mysql',
      database: mysql.database,
      artifactPath: args.databaseArtifactPath,
      bytes: args.databaseBytes ?? null,
      dumpCommand,
      notes: databaseNotes,
    },
    media: {
      driver: args.profile.mediaDriver,
      strategy: media.strategy,
      includedPaths: media.includedPaths,
      notes: media.notes,
    },
  } satisfies BackupArtifactManifest
}

export function writeJsonFile(filePath: string, payload: unknown) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

export function listAvailableBackupArtifacts(rootDir: string) {
  if (!fs.existsSync(rootDir)) return []
  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse()
}

export function readBackupManifest(inputPath: string): BackupArtifactManifest {
  const stat = fs.statSync(inputPath)
  const manifestPath = stat.isDirectory() ? path.join(inputPath, 'manifest.json') : inputPath
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Partial<BackupArtifactManifest>
  if (!raw || raw.version !== '2026-03-pr24' || !raw.backupId || !raw.database?.artifactPath) {
    throw new Error(`Artifact backup manifest không hợp lệ: ${manifestPath}`)
  }
  return raw as BackupArtifactManifest
}

export function copyDirectoryRecursive(source: string, destination: string) {
  if (!fs.existsSync(source)) return false
  ensureDir(destination)
  const entries = fs.readdirSync(source, { withFileTypes: true })
  for (const entry of entries) {
    const from = path.join(source, entry.name)
    const to = path.join(destination, entry.name)
    if (entry.isDirectory()) {
      copyDirectoryRecursive(from, to)
      continue
    }
    ensureDir(path.dirname(to))
    fs.copyFileSync(from, to)
  }
  return true
}

export function removePathIfExists(target: string) {
  if (!fs.existsSync(target)) return false
  fs.rmSync(target, { recursive: true, force: true })
  return true
}

export type BackupPruneSummary = {
  scanned: number
  removed: string[]
  kept: string[]
}

export function pruneExpiredBackups(rootDir: string, retentionDays: number, now = new Date()): BackupPruneSummary {
  if (!fs.existsSync(rootDir)) return { scanned: 0, removed: [], kept: [] }
  const cutoffMs = now.getTime() - retentionDays * 24 * 60 * 60 * 1000
  const summary: BackupPruneSummary = { scanned: 0, removed: [], kept: [] }

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    summary.scanned += 1
    const target = path.join(rootDir, entry.name)
    const stat = fs.statSync(target)
    if (stat.mtimeMs < cutoffMs) {
      removePathIfExists(target)
      summary.removed.push(entry.name)
    } else {
      summary.kept.push(entry.name)
    }
  }

  return summary
}
