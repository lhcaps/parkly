import 'dotenv/config'

import { buildEvidenceFilePath, buildPnpmScriptArgs, parsePositiveInt, parseSmokeBundleSummary, resolveRcGateEnv, runCapturedCommand, summarizeFixtureDrift, type RepeatSmokeRunSummary, writeJson } from './rc1-runtime'

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

export async function performRepeatSmoke(options?: {
  profile?: string | null
  runs?: number
  env?: NodeJS.ProcessEnv
}) {
  const env = resolveRcGateEnv(options?.env ?? process.env, options?.profile)
  const runs = parsePositiveInt(options?.runs ?? env.RC_REPEAT_SMOKE_RUNS, 3)
  const reportRuns: RepeatSmokeRunSummary[] = []

  for (let runNumber = 1; runNumber <= runs; runNumber += 1) {
    const reset = await runCapturedCommand('pnpm', buildPnpmScriptArgs('release:reset'), {
      id: `release-reset-${runNumber}`,
      env,
      label: 'pnpm release:reset',
    })
    if (!reset.ok) throw new Error(`Run ${runNumber}: release:reset failed with exit code ${reset.exitCode}`)

    const smoke = await runCapturedCommand('pnpm', buildPnpmScriptArgs('smoke:bundle'), {
      id: `smoke-bundle-${runNumber}`,
      env,
      label: 'pnpm smoke:bundle',
    })
    if (!smoke.ok) throw new Error(`Run ${runNumber}: smoke:bundle failed with exit code ${smoke.exitCode}`)

    reportRuns.push({
      runNumber,
      reset,
      smoke,
      parsed: parseSmokeBundleSummary(smoke.stdout),
    })
  }

  const drift = summarizeFixtureDrift(reportRuns, env)
  const report = {
    checkedAt: new Date().toISOString(),
    runs,
    ok: drift.ok,
    drift,
    results: reportRuns.map((run) => ({
      runNumber: run.runNumber,
      reset: {
        ok: run.reset.ok,
        exitCode: run.reset.exitCode,
        durationMs: run.reset.durationMs,
      },
      smoke: {
        ok: run.smoke.ok,
        exitCode: run.smoke.exitCode,
        durationMs: run.smoke.durationMs,
      },
      parsed: run.parsed,
    })),
  }

  writeJson(buildEvidenceFilePath('repeat-smoke-report', env), report)
  if (!report.ok) {
    throw new Error(`Repeat smoke drift detected: ${drift.issues.join(' | ')}`)
  }
  return report
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const report = await performRepeatSmoke({ profile: args.profile, runs: args.runs ?? undefined })
  console.log('[rc1:smoke:repeat] OK', JSON.stringify(report, null, 2))
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[rc1:smoke:repeat] FAIL', error)
    process.exitCode = 1
  })
}
