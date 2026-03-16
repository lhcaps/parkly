import 'dotenv/config'

import { performBackup } from './backup-create'
import { performRestore } from './restore-apply'
import { performRestoreVerification } from './restore-verify'
import { applyDeploymentProfileEnv } from './deployment-profiles'
import { runPnpmScript } from './_script-runtime'

function parseArgs(argv: string[]) {
  let profile: string | null = null
  let source: string | null = null
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--profile') {
      profile = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (argv[index] === '--source') {
      source = argv[index + 1] ?? null
      index += 1
    }
  }
  return { profile, source }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const env = applyDeploymentProfileEnv(process.env, args.profile)
  const backup = args.source
    ? { artifactDir: args.source, backupId: 'external' }
    : await performBackup({ profile: args.profile, env })

  console.log('[disaster:drill] backup ready', JSON.stringify(backup, null, 2))
  await runPnpmScript('release:reset', { env })
  console.log('[disaster:drill] simulated incident via release:reset complete')
  const restore = await performRestore({ profile: args.profile, source: backup.artifactDir, confirm: true, env })
  const verify = await performRestoreVerification({ env })

  console.log(
    '[disaster:drill] OK',
    JSON.stringify(
      {
        backupId: restore.backupId,
        restoredDb: restore.restoredDb,
        restoredMediaPaths: restore.restoredMediaPaths,
        verify,
      },
      null,
      2,
    ),
  )
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[disaster:drill] FAIL', error)
    process.exitCode = 1
  })
}
