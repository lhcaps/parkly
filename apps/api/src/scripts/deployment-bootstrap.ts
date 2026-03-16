import 'dotenv/config'

import {
  applyDeploymentProfileEnv,
  buildComposeInvocation,
  buildDeploymentPlan,
  resolveDeploymentProfile,
} from './deployment-profiles'
import { ensureDockerEngineReady, runCommand, runPnpmScript, sleep } from './_script-runtime'
import { verifyDeploymentReadiness } from './deployment-verify'

function parseArgs(argv: string[]) {
  let profile: string | null = null
  let composeUp = false

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--profile') {
      profile = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (token === '--compose-up') {
      composeUp = true
    }
  }

  return { profile, composeUp }
}

async function verifyWithRetry(env: NodeJS.ProcessEnv, profileInput: string | null, retries: number, delayMs: number) {
  let report = await verifyDeploymentReadiness({ env, profile: profileInput, intent: 'bootstrap' })
  for (let attempt = 1; !report.ready && attempt < retries; attempt += 1) {
    console.log(`[deployment:bootstrap] waiting for dependencies (${attempt}/${retries - 1})`)
    await sleep(delayMs)
    report = await verifyDeploymentReadiness({ env, profile: profileInput, intent: 'bootstrap' })
  }
  return report
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const env = applyDeploymentProfileEnv(process.env, args.profile)
  const profile = resolveDeploymentProfile(env, args.profile)
  const retries = Number(env.DEPLOYMENT_VERIFY_RETRIES ?? 12) || 12
  const delayMs = Number(env.DEPLOYMENT_VERIFY_RETRY_DELAY_MS ?? 1000) || 1000

  console.log(
    '[deployment:bootstrap]',
    JSON.stringify(
      {
        profile: profile.name,
        label: profile.label,
        mediaDriver: profile.mediaDriver,
        composeServices: profile.composeServices,
        composeUp: args.composeUp,
      },
      null,
      2,
    ),
  )

  if (args.composeUp) {
    ensureDockerEngineReady({ env })
    const compose = buildComposeInvocation(profile)
    await runCommand('docker', [...compose.args, 'up', '-d', ...profile.composeServices], {
      env,
      label: `docker ${compose.args.join(' ')} up -d ${profile.composeServices.join(' ')}`,
    })
  }

  const report = await verifyWithRetry(env, args.profile, retries, delayMs)
  console.log('[deployment:bootstrap:verify]', JSON.stringify(report, null, 2))
  if (!report.ready) {
    throw new Error('Deployment verification failed. Backend chưa đủ điều kiện bootstrap an toàn.')
  }

  for (const scriptName of buildDeploymentPlan(profile, 'bootstrap')) {
    await runPnpmScript(scriptName, { env })
  }

  console.log('[deployment:bootstrap] OK')
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[deployment:bootstrap] FAIL', error)
    process.exitCode = 1
  })
}
