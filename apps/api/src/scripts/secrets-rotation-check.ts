import 'dotenv/config'

import {
  evaluateSecretRotation,
  type SecretRotationCheckResult,
  type SecretRotationFieldReport,
} from '../lib/security/secret-rotation'

export type SecretsRotationCheckArgs = {
  format: 'text' | 'json'
  requireActive: boolean
}

export type SecretsRotationCheckRunResult = {
  exitCode: number
  report: SecretRotationCheckResult
  output: string
}

export function parseSecretsRotationCheckArgs(argv: string[]): SecretsRotationCheckArgs {
  let format: 'text' | 'json' = 'text'
  let requireActive = false

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
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
    if (token === '--require-active') {
      requireActive = true
      continue
    }
    if (token.startsWith('--')) {
      const error = new Error(`Flag không hợp lệ: ${token}`)
      ;(error as Error & { exitCode?: number }).exitCode = 2
      throw error
    }
  }

  return { format, requireActive }
}

function formatField(report: SecretRotationFieldReport) {
  const header = `- ${report.field}: mode=${report.mode} ok=${report.ok ? 'true' : 'false'}`
  const accepted = report.accepted.length === 0
    ? ['  • accepted: none']
    : report.accepted.map((item) => `  • ${item.slot} via ${item.sourceEnv} fp=${item.fingerprint} masked=${item.masked}`)
  const findings = report.findings.length === 0
    ? ['  • clean']
    : report.findings.map((item) => `  • ${item.code}: ${item.message}`)
  return [header, ...accepted, ...findings]
}

export function formatSecretsRotationCheckReport(report: SecretRotationCheckResult, format: 'text' | 'json' = 'text') {
  if (format === 'json') {
    return JSON.stringify(report, null, 2)
  }

  const lines: string[] = []
  lines.push('[secrets:rotation:check]')
  if (report.requireActiveEnv) {
    lines.push('mode: require-active=ON')
  }
  lines.push(...formatField(report.fields.API_INTERNAL_SERVICE_TOKEN))
  lines.push(...formatField(report.fields.DEVICE_CAPTURE_DEFAULT_SECRET))
  lines.push(
    `summary: ok=${report.ok} activeOnly=${report.summary.activeOnlyFields} rotationWindow=${report.summary.rotationWindowFields} nextOnly=${report.summary.nextOnlyFields} errorFields=${report.summary.errorFields}`,
  )
  return lines.join('\n')
}

export function runSecretsRotationCheck(args: SecretsRotationCheckArgs, env: NodeJS.ProcessEnv = process.env): SecretsRotationCheckRunResult {
  const report = evaluateSecretRotation(env, { requireActiveEnv: args.requireActive })
  const output = formatSecretsRotationCheckReport(report, args.format)
  return {
    exitCode: report.ok ? 0 : 1,
    report,
    output,
  }
}

function main() {
  try {
    const args = parseSecretsRotationCheckArgs(process.argv.slice(2))
    const result = runSecretsRotationCheck(args)
    console.log(result.output)
    process.exitCode = result.exitCode
  } catch (error) {
    const exitCode = Number((error as Error & { exitCode?: number }).exitCode ?? 2)
    console.error(`[secrets:rotation:check] ${String((error as Error).message ?? error)}`)
    process.exitCode = exitCode
  }
}

if (require.main === module) {
  main()
}
