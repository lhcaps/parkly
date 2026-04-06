import 'dotenv/config'

import {
  type SecretCheckResult,
  type SecretIntent,
  type SecretProfile,
  evaluateSecretHygiene,
} from '../lib/security/secret-hygiene'

const PROFILE_LABELS = new Map([
  ['LOCAL', 'local-dev'],
  ['LOCALDEV', 'local-dev'],
  ['LOCAL_DEV', 'local-dev'],
  ['DEV', 'local-dev'],
  ['DEMO', 'demo'],
  ['RC', 'release-candidate'],
  ['RELEASE_CANDIDATE', 'release-candidate'],
  ['RELEASECANDIDATE', 'release-candidate'],
]) satisfies Map<string, SecretProfile>

type SecretsCheckArgs = {
  profile: SecretProfile
  intent: SecretIntent
  format: 'text' | 'json'
  strict: boolean
}

export type SecretsCheckRunResult = {
  exitCode: number
  report: SecretCheckResult
  output: string
}

function parseSecretProfile(value: string | null): SecretProfile | null {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[-\s]/g, '_')
    .toUpperCase()
  if (!normalized) return null
  return PROFILE_LABELS.get(normalized) ?? null
}

function parseSecretIntent(value: string | null): SecretIntent | null {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  if (normalized === 'bootstrap' || normalized === 'reset' || normalized === 'smoke' || normalized === 'dev' || normalized === 'pilot') {
    return normalized
  }
  return null
}

export function parseSecretsCheckArgs(argv: string[]): SecretsCheckArgs {
  let profile: SecretProfile = 'demo'
  let intent: SecretIntent = 'bootstrap'
  let format: 'text' | 'json' = 'text'
  let strict = false

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--profile') {
      const next = argv[index + 1] ?? ''
      if (!String(next).trim()) {
        const error = new Error('--profile yêu cầu một giá trị')
        ;(error as Error & { exitCode?: number }).exitCode = 2
        throw error
      }
      const parsedProfile = parseSecretProfile(next)
      if (!parsedProfile) {
        const error = new Error(`--profile không hợp lệ: ${next}`)
        ;(error as Error & { exitCode?: number }).exitCode = 2
        throw error
      }
      profile = parsedProfile
      index += 1
      continue
    }
    if (token === '--intent') {
      const parsedIntent = parseSecretIntent(argv[index + 1] ?? null)
      if (!parsedIntent) {
        const error = new Error(`--intent không hợp lệ: ${String(argv[index + 1] ?? '')}`)
        ;(error as Error & { exitCode?: number }).exitCode = 2
        throw error
      }
      intent = parsedIntent
      index += 1
      continue
    }
    if (token === '--format') {
      const next = String(argv[index + 1] ?? '').trim().toLowerCase()
      if (next !== 'text' && next !== 'json') {
        const error = new Error(`--format không hợp lệ: ${next}`)
        ;(error as Error & { exitCode?: number }).exitCode = 2
        throw error
      }
      format = next
      index += 1
      continue
    }
    if (token === '--strict') {
      strict = true
      continue
    }
    if (token.startsWith('--')) {
      const error = new Error(`Flag không hợp lệ: ${token}`)
      ;(error as Error & { exitCode?: number }).exitCode = 2
      throw error
    }
  }

  return { profile, intent, format, strict }
}

export function formatSecretsCheckReport(report: SecretCheckResult, format: 'text' | 'json' = 'text') {
  if (format === 'json') {
    return JSON.stringify(report, null, 2)
  }

  const lines: string[] = []
  lines.push(`[secrets:check] profile=${report.profile} intent=${report.intent}`)
  for (const field of Object.values(report.fields)) {
    lines.push(`- ${field.field}: ${field.severity} fp=${field.fingerprint ?? '-'} masked=${field.masked ?? '-'}`)
    if (field.findings.length === 0) {
      lines.push('  • clean')
      continue
    }
    for (const finding of field.findings) {
      lines.push(`  • ${finding.code}: ${finding.message}`)
    }
  }
  lines.push(
    `summary: ok=${report.ok} passFields=${report.summary.passFields} warnFields=${report.summary.warnFields} errorFields=${report.summary.errorFields} findings=${report.summary.findings}`,
  )
  return lines.join('\n')
}

export function runSecretsCheck(args: SecretsCheckArgs, env: NodeJS.ProcessEnv = process.env): SecretsCheckRunResult {
  const report = evaluateSecretHygiene({ env, profile: args.profile, intent: args.intent })
  const output = formatSecretsCheckReport(report, args.format)
  const exitCode = report.summary.errorFields > 0 ? 1 : args.strict && report.summary.warnFields > 0 ? 1 : 0
  return {
    exitCode,
    report,
    output,
  }
}

async function main() {
  const args = parseSecretsCheckArgs(process.argv.slice(2))
  const result = runSecretsCheck(args)
  const sink = result.exitCode === 0 ? console.log : console.error
  sink(result.output)
  if (result.exitCode !== 0) process.exitCode = result.exitCode
}

if (require.main === module) {
  main().catch((error) => {
    const exitCode = Number((error as Error & { exitCode?: number }).exitCode ?? 1)
    console.error('[secrets:check] FAIL', (error as Error).message)
    process.exitCode = exitCode
  })
}
