import 'dotenv/config'

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

import { resolveCommandInvocation, runPnpmScript } from './_script-runtime'
import {
  copyDirectoryRecursive,
  listAvailableBackupArtifacts,
  readBackupManifest,
  removePathIfExists,
  resolveBackupProfile,
  resolveBackupRootDir,
  resolveMysqlConnection,
  writeJsonFile,
} from './backup-restore-runtime'

function parseArgs(argv: string[]) {
  let profile: string | null = null
  let source: string | null = null
  let skipDb = false
  let skipMedia = false
  let confirm = false

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--profile') {
      profile = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (token === '--source') {
      source = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (token === '--skip-db') {
      skipDb = true
      continue
    }
    if (token === '--skip-media') {
      skipMedia = true
      continue
    }
    if (token === '--confirm') {
      confirm = true
    }
  }

  return { profile, source, skipDb, skipMedia, confirm }
}

export function isIgnorablePipeError(error: unknown) {
  return !!error && typeof error === 'object' && 'code' in error && (error as NodeJS.ErrnoException).code === 'EPIPE'
}

export function sanitizeDumpSqlForPortableRestore(input: string) {
  let output = input
  output = output.replace(/\/\*![0-9]{5}\s+DEFINER=`[^`]+`@`[^`]+`\s+SQL SECURITY DEFINER\s*\*\//g, '')
  output = output.replace(/\/\*![0-9]{5}\s+DEFINER=`[^`]+`@`[^`]+`\s*\*\//g, '')
  output = output.replace(/\bDEFINER=`[^`]+`@`[^`]+`\s*/g, '')
  output = output.replace(/\/\*![0-9]{5}\s+SET\s+@@SESSION\.SQL_LOG_BIN\s*=\s*0\s*\*\/?;?/gi, '')
  output = output.replace(/\bSET\s+@@SESSION\.SQL_LOG_BIN\s*=\s*0;?/gi, '')
  return output
}

async function createPortableRestoreSql(sourcePath: string) {
  const portablePath = path.join(os.tmpdir(), `parkly-restore-${process.pid}-${Date.now()}.sql`)
  const source = fs.readFileSync(sourcePath, 'utf8')
  const sanitized = sanitizeDumpSqlForPortableRestore(source)
  fs.writeFileSync(portablePath, sanitized, 'utf8')
  return {
    filePath: portablePath,
    changed: sanitized !== source,
  }
}

async function restoreMysqlFromFile(filePath: string, env: NodeJS.ProcessEnv) {
  const mysql = resolveMysqlConnection(env)
  const mysqlBin = String(env.MYSQL_BIN ?? 'mysql').trim() || 'mysql'
  const passwordArg = mysql.password ? `--password=${mysql.password}` : '--password='
  const args = [`--host=${mysql.host}`, `--port=${mysql.port}`, `--user=${mysql.user}`, passwordArg]
  const invocation = resolveCommandInvocation(mysqlBin, args)

  await new Promise<void>((resolve, reject) => {
    let settled = false

    const child = spawn(invocation.file, invocation.args, {
      env,
      shell: invocation.shell,
      stdio: ['pipe', 'inherit', 'pipe'],
    })

    const input = fs.createReadStream(filePath)
    let stderr = ''

    const cleanup = () => {
      input.unpipe(child.stdin)
      if (!input.destroyed) input.destroy()
      if (!child.stdin.destroyed) child.stdin.destroy()
    }

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const succeed = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    child.stdin.on('error', (error) => {
      if (isIgnorablePipeError(error)) return
      fail(error instanceof Error ? error : new Error(String(error)))
    })

    child.on('error', (error) => {
      fail(error instanceof Error ? error : new Error(String(error)))
    })

    input.on('error', (error) => {
      fail(error instanceof Error ? error : new Error(String(error)))
    })

    input.pipe(child.stdin)

    child.on('close', (code) => {
      const detail = stderr.trim()
      if (code === 0) {
        succeed()
        return
      }
      fail(new Error(`mysql restore failed with exit code ${code}.${detail ? ` ${detail}` : ''}`))
    })
  })
}

function mapSnapshotFolderToTarget(folderName: string, env: NodeJS.ProcessEnv) {
  const uploadRoot = path.resolve(String(env.UPLOAD_DIR ?? 'uploads').trim() || 'uploads')
  const runtimeRoot = path.resolve(String(env.OBS_RUNTIME_DIR ?? '.runtime').trim() || '.runtime')

  if (folderName === 'gate-media') return path.join(uploadRoot, 'gate-media')
  if (folderName === 'observability') return path.join(runtimeRoot, 'observability')
  return path.join(uploadRoot, folderName)
}

function resolveRestoreSourceOrThrow(source: string, env: NodeJS.ProcessEnv) {
  const trimmed = source.trim()
  if (trimmed.includes('<artifact-dir>')) {
    throw new Error('Bạn đang dùng placeholder <artifact-dir>. Hãy thay bằng thư mục thật được in ra từ backup:create, ví dụ .backups/demo-backup-20260313T101112Z')
  }
  const resolved = path.resolve(trimmed)
  if (fs.existsSync(resolved)) return resolved

  const backupRoot = resolveBackupRootDir(env)
  const available = listAvailableBackupArtifacts(backupRoot).slice(0, 5)
  const tail = available.length ? ` Available backups: ${available.join(', ')}` : ''
  throw new Error(`Không thấy artifact backup tại ${resolved}.${tail}`)
}

export async function performRestore(options?: {
  profile?: string | null
  source?: string | null
  skipDb?: boolean
  skipMedia?: boolean
  confirm?: boolean
  env?: NodeJS.ProcessEnv
}) {
  const source = String(options?.source ?? process.env.BACKUP_RESTORE_SOURCE ?? '').trim()
  if (!source) throw new Error('Thiếu --source hoặc BACKUP_RESTORE_SOURCE để restore artifact.')
  if (!options?.confirm) {
    throw new Error('Restore là thao tác phá hủy dữ liệu hiện tại. Truyền --confirm để xác nhận.')
  }

  const { env, profile } = resolveBackupProfile(options?.env ?? process.env, options?.profile ?? null)
  const sourcePath = resolveRestoreSourceOrThrow(source, env)
  const manifest = readBackupManifest(sourcePath)
  const restored: { db: boolean; media: string[]; reportPath: string; portableSql: string | null; portableSqlChanged: boolean } = {
    db: false,
    media: [],
    reportPath: '',
    portableSql: null,
    portableSqlChanged: false,
  }

  if (!options?.skipDb) {
    if (!fs.existsSync(manifest.database.artifactPath)) {
      throw new Error(`Không thấy DB artifact để restore: ${manifest.database.artifactPath}`)
    }

    const portable = await createPortableRestoreSql(manifest.database.artifactPath)
    restored.portableSql = portable.filePath
    restored.portableSqlChanged = portable.changed
    try {
      await restoreMysqlFromFile(portable.filePath, env)
    } finally {
      removePathIfExists(portable.filePath)
    }
    await runPnpmScript('db:grant:app', { env })
    restored.db = true
  }

  if (!options?.skipMedia && manifest.media.strategy === 'LOCAL_SNAPSHOT') {
    const mediaRoot = path.join(path.dirname(manifest.database.artifactPath), '..', 'media')
    if (fs.existsSync(mediaRoot)) {
      for (const entry of fs.readdirSync(mediaRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const snapshotPath = path.join(mediaRoot, entry.name)
        const target = mapSnapshotFolderToTarget(entry.name, env)
        removePathIfExists(target)
        copyDirectoryRecursive(snapshotPath, target)
        restored.media.push(target)
      }
    }
  }

  const reportPath = path.join(manifest.artifactDir, 'restore-report.json')
  restored.reportPath = reportPath
  writeJsonFile(reportPath, {
    restoredAt: new Date().toISOString(),
    backupId: manifest.backupId,
    targetProfile: profile.name,
    restoredDb: restored.db,
    restoredMediaPaths: restored.media,
    source: sourcePath,
    portableSqlChanged: restored.portableSqlChanged,
  })

  return {
    backupId: manifest.backupId,
    profile: profile.name,
    restoredDb: restored.db,
    restoredMediaPaths: restored.media,
    reportPath,
    portableSqlChanged: restored.portableSqlChanged,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const result = await performRestore(args)
  console.log('[restore:apply] OK', JSON.stringify(result, null, 2))
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[restore:apply] FAIL', error)
    process.exitCode = 1
  })
}
