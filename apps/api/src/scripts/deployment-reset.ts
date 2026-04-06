import 'dotenv/config'

import { applyDeploymentProfileEnv, buildDeploymentPlan, resolveDeploymentProfile } from './deployment-profiles'
import { runPnpmScript } from './_script-runtime'
import { verifyDeploymentReadiness } from './deployment-verify'

function parseArgs(argv: string[]) {
  let profile: string | null = null
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--profile') {
      profile = argv[index + 1] ?? null
      index += 1
    }
  }
  return { profile }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const env = applyDeploymentProfileEnv(process.env, args.profile)
  const profile = resolveDeploymentProfile(env, args.profile)
  const report = await verifyDeploymentReadiness({ env, profile: args.profile, intent: 'reset' })
  console.log('[deployment:reset:verify]', JSON.stringify(report, null, 2))
  if (!report.ready) {
    throw new Error('Deployment verification failed. Reset không nên chạy khi dependency chưa sẵn sàng.')
  }

  for (const scriptName of buildDeploymentPlan(profile, 'reset')) {
    await runPnpmScript(scriptName, { env })
  }

  console.log('[deployment:reset] OK')
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[deployment:reset] FAIL', error)
    process.exitCode = 1
  })
}
