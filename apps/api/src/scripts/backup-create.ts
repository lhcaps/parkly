import 'dotenv/config'

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

import { resolveCommandInvocation } from './_script-runtime'
import {
  type BackupArtifactManifest,
  type BackupKind,
  createBackupManifest,
  ensureDir,
  envFlag,
  pruneExpiredBackups,
  resolveBackupProfile,
  resolveBackupRootDir,
  resolveMediaBackupStrategy,
  resolveMysqlConnection,
  writeJsonFile,
  buildBackupId,
  copyDirectoryRecursive,
} from './backup-restore-runtime'

type BackupResult = {
  backupId: string
  profile: string
  artifactDir: string
  dbArtifact: string
  mediaStrategy: BackupArtifactManifest['media']['strategy']
  copiedPaths: string[]
  manifestPath: string
  prune: ReturnType<typeof pruneExpiredBackups>
  databaseNotes: string[]
}

type DumpExecutionResult = {
  args: string[]
  notes: string[]
}

function parseArgs(argv: string[]) {
  let profile: string | null = null
  let kind: BackupKind = 'FULL'
  let output: string | null = null
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--profile') {
      profile = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (token === '--kind') {
      const raw = String(argv[index + 1] ?? '').trim().toUpperCase()
      if (raw === 'DB_ONLY' || raw === 'FULL') kind = raw
      index += 1
      continue
    }
    if (token === '--output-dir') {
      output = argv[index + 1] ?? null
      index += 1
    }
  }
  return { profile, kind, output }
}

function buildMysqlDumpArgs(
  env: NodeJS.ProcessEnv,
  options: { includeRoutines: boolean; includeEvents: boolean },
) {
  const mysql = resolveMysqlConnection(env)
  const passwordArg = mysql.password ? `--password=${mysql.password}` : '--password='
  const args = [
    `--host=${mysql.host}`,
    `--port=${mysql.port}`,
    `--user=${mysql.user}`,
    passwordArg,
    '--single-transaction',
    '--triggers',
    '--skip-lock-tables',
    '--set-gtid-purged=OFF',
    '--hex-blob',
    '--default-character-set=utf8mb4',
    '--no-tablespaces',
  ]

  if (options.includeRoutines) args.push('--routines')
  if (options.includeEvents) args.push('--events')

  args.push('--databases', mysql.database)
  return args
}

function isPrivilegeLimitedDump(stderr: string) {
  const normalized = stderr.toLowerCase()
  return (
    normalized.includes('process privilege') ||
    normalized.includes('show create procedure') ||
    normalized.includes('show routine') ||
    normalized.includes('tablespaces')
  )
}

async function executeDump(filePath: string, env: NodeJS.ProcessEnv, args: string[]) {
  const mysqldumpBin = String(env.MYSQLDUMP_BIN ?? 'mysqldump').trim() || 'mysqldump'
  const invocation = resolveCommandInvocation(mysqldumpBin, args)
  ensureDir(path.dirname(filePath))

  await new Promise<void>((resolve, reject) => {
    const child = spawn(invocation.file, invocation.args, {
      env,
      shell: invocation.shell,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const output = fs.createWriteStream(filePath)
    let stderr = ''
    child.stdout.pipe(output)
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      output.close()
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`mysqldump failed with exit code ${code}. ${stderr.trim()}`.trim()))
    })
  })
}

async function dumpMysqlToFile(filePath: string, env: NodeJS.ProcessEnv): Promise<DumpExecutionResult> {
  const notes: string[] = []
  const includeRoutines = envFlag('BACKUP_MYSQL_INCLUDE_ROUTINES', false, env)
  const includeEvents = envFlag('BACKUP_MYSQL_INCLUDE_EVENTS', false, env)
  const primaryArgs = buildMysqlDumpArgs(env, { includeRoutines, includeEvents })

  try {
    await executeDump(filePath, env, primaryArgs)
    if (!includeRoutines) notes.push('backup DB mặc định bỏ qua routines; bật BACKUP_MYSQL_INCLUDE_ROUTINES=ON nếu user đủ privilege.')
    if (!includeEvents) notes.push('backup DB mặc định bỏ qua events; bật BACKUP_MYSQL_INCLUDE_EVENTS=ON nếu cần snapshot event scheduler.')
    notes.push('--no-tablespaces đang bật để không đòi PROCESS privilege trên local MySQL 8.')
    return { args: primaryArgs, notes }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!(includeRoutines || includeEvents) || !isPrivilegeLimitedDump(message)) throw error

    const fallbackArgs = buildMysqlDumpArgs(env, { includeRoutines: false, includeEvents: false })
    await executeDump(filePath, env, fallbackArgs)
    notes.push('mysqldump fallback đã tự tắt routines/events vì user hiện tại thiếu privilege cho SHOW CREATE PROCEDURE hoặc objects tương tự.')
    notes.push('--no-tablespaces vẫn được giữ để tránh lỗi PROCESS privilege khi dump tablespaces.')
    return { args: fallbackArgs, notes }
  }
}

export async function performBackup(options?: {
  profile?: string | null
  kind?: BackupKind
  outputDir?: string | null
  env?: NodeJS.ProcessEnv
  now?: Date
}) {
  const now = options?.now ?? new Date()
  const { env, profile } = resolveBackupProfile(options?.env ?? process.env, options?.profile ?? null)
  const backupKind = options?.kind ?? 'FULL'
  const backupRoot = options?.outputDir ? path.resolve(options.outputDir) : resolveBackupRootDir(env)
  ensureDir(backupRoot)
  const backupId = buildBackupId(profile, now)
  const artifactDir = path.join(backupRoot, backupId)
  ensureDir(artifactDir)

  const dbArtifact = path.join(artifactDir, 'mysql', 'parking_mgmt.sql')
  const dump = await dumpMysqlToFile(dbArtifact, env)
  const dbBytes = fs.statSync(dbArtifact).size

  const media = resolveMediaBackupStrategy(profile, env)
  const copiedPaths: string[] = []
  if (backupKind === 'FULL' && media.strategy === 'LOCAL_SNAPSHOT') {
    for (const source of media.includedPaths) {
      if (!fs.existsSync(source)) continue
      const folderName = path.basename(source) || 'artifact'
      const target = path.join(artifactDir, 'media', folderName)
      copyDirectoryRecursive(source, target)
      copiedPaths.push(source)
    }
  }
  const manifest = createBackupManifest({
    profile,
    backupKind,
    backupRoot,
    artifactDir,
    backupId,
    createdAt: now,
    env,
    databaseArtifactPath: dbArtifact,
    databaseBytes: dbBytes,
    databaseDumpCommand: [String(env.MYSQLDUMP_BIN ?? 'mysqldump').trim() || 'mysqldump', ...dump.args],
    databaseNotes: dump.notes,
  })
  const manifestPath = path.join(artifactDir, 'manifest.json')
  writeJsonFile(manifestPath, manifest)

  const notesPath = path.join(artifactDir, 'README.txt')
  fs.writeFileSync(
    notesPath,
    [
      `backupId=${manifest.backupId}`,
      `createdAt=${manifest.createdAt}`,
      `profile=${manifest.createdByProfile}`,
      `kind=${manifest.backupKind}`,
      `dbArtifact=${manifest.database.artifactPath}`,
      `mediaStrategy=${manifest.media.strategy}`,
      `rpoMinutes=${manifest.objectives.rpoMinutes}`,
      `rtoMinutes=${manifest.objectives.rtoMinutes}`,
      `retentionDays=${manifest.retentionDays}`,
      ...manifest.database.notes.map((note, index) => `dbNote${index + 1}=${note}`),
    ].join('\n') + '\n',
    'utf8',
  )

  const prune = pruneExpiredBackups(backupRoot, manifest.retentionDays, now)

  return {
    backupId,
    profile: profile.name,
    artifactDir,
    dbArtifact,
    mediaStrategy: manifest.media.strategy,
    copiedPaths,
    manifestPath,
    prune,
    databaseNotes: manifest.database.notes,
  } satisfies BackupResult
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const result = await performBackup({ profile: args.profile, kind: args.kind, outputDir: args.output })
  console.log('[backup:create] OK', JSON.stringify(result, null, 2))
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[backup:create] FAIL', error)
    process.exitCode = 1
  })
}
