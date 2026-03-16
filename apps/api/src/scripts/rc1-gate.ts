import 'dotenv/config'

import { buildEvidenceFilePath, buildPnpmScriptArgs, envFlag, parsePositiveInt, resolveRcGateEnv, runCapturedCommand, writeJson } from './rc1-runtime'

function parseArgs(argv: string[]) {
  let profile: string | null = null
  let runs: number | null = null
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--profile') {
      profile = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (argv[index] === '--runs') {
      runs = parsePositiveInt(argv[index + 1], 3)
      index += 1
    }
  }
  return { profile, runs }
}

export async function performRc1Gate(options?: {
  profile?: string | null
  runs?: number
  env?: NodeJS.ProcessEnv
}) {
  const env = resolveRcGateEnv(options?.env ?? process.env, options?.profile)
  const runs = parsePositiveInt(options?.runs ?? env.RC_REPEAT_SMOKE_RUNS, 3)
  const skipTypecheck = envFlag('RC_SKIP_TYPECHECK', false, env)
  const verifyDeploymentBeforeGate = envFlag('RC_VERIFY_DEPLOYMENT_BEFORE_GATE', true, env)

  const plan: Array<{ id: string; args: string[]; label: string }> = []
  const cleanMachineMatrix = {
    checkedAt: new Date().toISOString(),
    profile: String(options?.profile ?? 'demo'),
    stages: ['bootstrap', 'migrate', 'grant', 'seed', 'login', 'dashboard', 'upload', 'intake', 'refresh', 'resolve', 'audit'],
  }
  writeJson(buildEvidenceFilePath('clean-machine-matrix', env), cleanMachineMatrix)

  if (verifyDeploymentBeforeGate) {
    plan.push({
      id: 'verify-deployment',
      args: buildPnpmScriptArgs('verify:deployment', ['--profile', String(options?.profile ?? 'demo'), '--intent', 'smoke']),
      label: 'pnpm verify:deployment -- --profile demo --intent smoke',
    })
  }

  if (!skipTypecheck) {
    plan.push({ id: 'typecheck', args: buildPnpmScriptArgs('typecheck'), label: 'pnpm typecheck' })
  }

  plan.push(
    { id: 'test-rc1', args: buildPnpmScriptArgs('test:rc1'), label: 'pnpm test:rc1' },
    { id: 'test-pr26', args: buildPnpmScriptArgs('test:pr26'), label: 'pnpm test:pr26' },
    { id: 'test-pr27', args: buildPnpmScriptArgs('test:pr27'), label: 'pnpm test:pr27' },
    { id: 'test-pr28', args: buildPnpmScriptArgs('test:pr28'), label: 'pnpm test:pr28' },
    { id: 'test-pr29', args: buildPnpmScriptArgs('test:pr29'), label: 'pnpm test:pr29' },
    { id: 'test-pr30', args: buildPnpmScriptArgs('test:pr30'), label: 'pnpm test:pr30' },
    { id: 'test-pr31', args: buildPnpmScriptArgs('test:pr31'), label: 'pnpm test:pr31' },
    { id: 'fixture-check', args: buildPnpmScriptArgs('rc1:fixtures:check', ['--profile', String(options?.profile ?? 'demo')]), label: 'pnpm rc1:fixtures:check -- --profile demo' },
    { id: 'repeat-smoke', args: buildPnpmScriptArgs('rc1:smoke:repeat', ['--runs', String(runs), '--profile', String(options?.profile ?? 'demo')]), label: `pnpm rc1:smoke:repeat -- --runs ${runs} --profile demo` },
  )

  const steps = [] as Array<{ id: string; command: string; ok: boolean; exitCode: number; durationMs: number }>
  for (const step of plan) {
    const result = await runCapturedCommand('pnpm', step.args, { env, id: step.id, label: step.label })
    steps.push({ id: step.id, command: step.label, ok: result.ok, exitCode: result.exitCode, durationMs: result.durationMs })
    if (!result.ok) {
      const report = {
        checkedAt: new Date().toISOString(),
        ok: false,
        runs,
        steps,
      }
      writeJson(buildEvidenceFilePath('rc1-gate-summary', env), report)
      throw new Error(`RC1 gate failed at step ${step.id} with exit code ${result.exitCode}`)
    }
  }

  const report = {
    checkedAt: new Date().toISOString(),
    ok: true,
    runs,
    steps,
  }
  writeJson(buildEvidenceFilePath('rc1-gate-summary', env), report)
  return report
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const report = await performRc1Gate({ profile: args.profile, runs: args.runs ?? undefined })
  console.log('[rc1:gate] OK', JSON.stringify(report, null, 2))
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[rc1:gate] FAIL', error)
    process.exitCode = 1
  })
}
