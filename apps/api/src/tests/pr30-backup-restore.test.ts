import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { resolveDeploymentProfile } from '../scripts/deployment-profiles'
import {
  buildBackupId,
  createBackupManifest,
  formatArtifactTimestamp,
  pruneExpiredBackups,
  resolveMediaBackupStrategy,
} from '../scripts/backup-restore-runtime'
import { sanitizeDumpSqlForPortableRestore } from '../scripts/restore-apply'

test('backup artifact naming có timestamp rõ ràng và manifest chốt RPO/RTO thực tế', () => {
  const profile = resolveDeploymentProfile({ PARKLY_DEPLOYMENT_PROFILE: 'DEMO' } as NodeJS.ProcessEnv, 'demo')
  const now = new Date('2026-03-13T10:11:12.000Z')
  const backupId = buildBackupId(profile, now)
  assert.equal(formatArtifactTimestamp(now), '20260313T101112Z')
  assert.equal(backupId, 'demo-backup-20260313T101112Z')

  const manifest = createBackupManifest({
    profile,
    backupKind: 'FULL',
    backupRoot: '/tmp/backups',
    artifactDir: '/tmp/backups/demo-backup-20260313T101112Z',
    backupId,
    createdAt: now,
    env: {
      DATABASE_ADMIN_USER: 'parking_root',
      DATABASE_ADMIN_PASSWORD: 'secret',
      DATABASE_NAME: 'parking_mgmt',
      BACKUP_RPO_TARGET_MINUTES: '60',
      BACKUP_RTO_TARGET_MINUTES: '15',
    } as NodeJS.ProcessEnv,
    databaseArtifactPath: '/tmp/backups/demo/mysql.sql',
    databaseBytes: 1024,
  })

  assert.equal(manifest.objectives.rpoMinutes, 60)
  assert.equal(manifest.objectives.rtoMinutes, 15)
  assert.equal(manifest.database.database, 'parking_mgmt')
  assert.equal(manifest.media.strategy, 'LOCAL_SNAPSHOT')
})

test('media strategy tách rõ local snapshot với MinIO external strategy', () => {
  const demoProfile = resolveDeploymentProfile({ PARKLY_DEPLOYMENT_PROFILE: 'DEMO' } as NodeJS.ProcessEnv, 'demo')
  const rcProfile = resolveDeploymentProfile({ PARKLY_DEPLOYMENT_PROFILE: 'RELEASE_CANDIDATE' } as NodeJS.ProcessEnv, 'release-candidate')

  const demoMedia = resolveMediaBackupStrategy(demoProfile, { UPLOAD_DIR: 'uploads', OBS_RUNTIME_DIR: '.runtime' } as NodeJS.ProcessEnv)
  const rcMedia = resolveMediaBackupStrategy(rcProfile, {} as NodeJS.ProcessEnv)

  assert.equal(demoMedia.strategy, 'LOCAL_SNAPSHOT')
  assert.ok(demoMedia.includedPaths.some((value) => value.endsWith(path.join('uploads', 'gate-media'))))
  assert.equal(rcMedia.strategy, 'MINIO_EXTERNAL')
  assert.match(rcMedia.notes.join(' '), /object storage/i)
})

test('backup retention prune chỉ xóa artifact quá hạn và giữ artifact mới', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'parkly-pr30-'))
  const oldDir = path.join(root, 'demo-backup-old')
  const freshDir = path.join(root, 'demo-backup-fresh')
  fs.mkdirSync(oldDir)
  fs.mkdirSync(freshDir)
  const oldTime = new Date('2026-02-01T00:00:00.000Z')
  const freshTime = new Date('2026-03-12T00:00:00.000Z')
  fs.utimesSync(oldDir, oldTime, oldTime)
  fs.utimesSync(freshDir, freshTime, freshTime)

  const summary = pruneExpiredBackups(root, 7, new Date('2026-03-13T00:00:00.000Z'))
  assert.equal(summary.scanned, 2)
  assert.ok(summary.removed.includes('demo-backup-old'))
  assert.ok(summary.kept.includes('demo-backup-fresh'))
  assert.equal(fs.existsSync(oldDir), false)
  assert.equal(fs.existsSync(freshDir), true)
})

test('restore stream bỏ qua EPIPE để surfacing lỗi mysql thực thay vì crash Node', () => {
  const sql = [
    '/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */',
    'CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` VIEW `v_demo` AS select 1 AS `n`;',
    '/*!50017 DEFINER=`root`@`localhost`*/',
    'SET @@SESSION.SQL_LOG_BIN=0;',
    'CREATE TRIGGER `t_demo` BEFORE INSERT ON `x` FOR EACH ROW SET @a = 1;',
  ].join('\n')

  const sanitized = sanitizeDumpSqlForPortableRestore(sql)
  assert.doesNotMatch(sanitized, /DEFINER=/)
  assert.doesNotMatch(sanitized, /SQL_LOG_BIN/)
  assert.match(sanitized, /CREATE TRIGGER/)
  assert.match(sanitized, /VIEW `v_demo`/)
})

test('source regression: package scripts, env và runbook đã chốt backup/restore/disaster drill', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'package.json'), 'utf8'))
  const envExample = fs.readFileSync(path.join(repoRoot, 'apps', 'api', '.env.example'), 'utf8')
  const apiRunbook = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'docs', 'RUNBOOK.md'), 'utf8')
  const repoRunbook = fs.readFileSync(path.join(repoRoot, 'docs', 'RUNBOOK.md'), 'utf8')
  const backupSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'scripts', 'backup-create.ts'), 'utf8')
  const restoreSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'scripts', 'restore-apply.ts'), 'utf8')

  assert.equal(packageJson.scripts['backup:create'], 'tsx src/scripts/backup-create.ts')
  assert.equal(packageJson.scripts['restore:apply'], 'tsx src/scripts/restore-apply.ts')
  assert.equal(packageJson.scripts['restore:verify'], 'tsx src/scripts/restore-verify.ts')
  assert.equal(packageJson.scripts['drill:disaster'], 'tsx src/scripts/disaster-drill.ts')
  assert.equal(packageJson.scripts['test:pr30'], 'node --import tsx --test src/tests/pr30-backup-restore.test.ts')
  assert.match(envExample, /BACKUP_ROOT_DIR=.backups/)
  assert.match(envExample, /BACKUP_RPO_TARGET_MINUTES=60/)
  assert.match(envExample, /MYSQLDUMP_BIN=mysqldump/)
  assert.match(apiRunbook, /khi nào dùng reset, khi nào dùng restore/i)
  assert.match(apiRunbook, /drill:disaster/i)
  assert.match(repoRunbook, /rollback bản demo/i)
  assert.match(backupSource, /mysqldump/)
  assert.match(restoreSource, /db:grant:app/)
  assert.match(restoreSource, /sanitizeDumpSqlForPortableRestore/)
})
