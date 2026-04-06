import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

import { BACKEND_RC_BASELINE_TAG, getReleaseFixtureFromEnv } from './release-bundle'
import { applyDeploymentProfileEnv } from './deployment-profiles'
import { resolveCommandInvocation, resolvePnpmInvocation } from './_script-runtime'

export type Rc1StepResult = {
  id: string
  command: string
  ok: boolean
  exitCode: number
  durationMs: number
  stdout: string
  stderr: string
}

export type RepeatSmokeRunSummary = {
  runNumber: number
  reset: Rc1StepResult
  smoke: Rc1StepResult
  parsed: SmokeBundleSummary | null
}

export type SmokeBundleSummary = {
  role: string | null
  siteCode: string | null
  spotCode: string | null
  incidentId: string | null
  auditRows: number | null
}

export function parsePositiveInt(value: unknown, fallback: number) {
  const numberValue = Number(String(value ?? '').trim())
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.trunc(numberValue) : fallback
}

export function envFlag(name: string, fallback = false, env: NodeJS.ProcessEnv = process.env) {
  const raw = String(env[name] ?? '').trim().toUpperCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'ON' || raw === 'TRUE' || raw === 'YES'
}

export function formatUtcStamp(date = new Date()) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  const second = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hour}${minute}${second}Z`
}

export function resolveRcLabel(env: NodeJS.ProcessEnv = process.env) {
  return String(env.RC_LABEL ?? BACKEND_RC_BASELINE_TAG).trim() || BACKEND_RC_BASELINE_TAG
}

export function resolveEvidenceRoot(env: NodeJS.ProcessEnv = process.env) {
  const configured = String(env.RC_EVIDENCE_ROOT_DIR ?? '').trim()
  if (configured) return path.resolve(configured)
  return path.resolve('release-evidence', resolveRcLabel(env))
}

export function ensureDir(target: string) {
  fs.mkdirSync(target, { recursive: true })
  return target
}

export function writeJson(filePath: string, payload: unknown) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

export function buildEvidenceFilePath(kind: string, env: NodeJS.ProcessEnv = process.env) {
  return path.join(resolveEvidenceRoot(env), `${kind}.json`)
}

export function readFixtureFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return getReleaseFixtureFromEnv(env)
}

export function parseSmokeBundleSummary(stdout: string): SmokeBundleSummary | null {
  const role = stdout.match(/role:\s*'([^']+)'/)?.[1] ?? null
  const siteCode = stdout.match(/siteCode:\s*'([^']+)'/)?.[1] ?? null
  const spotCode = stdout.match(/spotCode:\s*'([^']+)'/)?.[1] ?? null
  const incidentId = stdout.match(/incidentId:\s*'([^']+)'/)?.[1] ?? null
  const auditRowsRaw = stdout.match(/auditRows:\s*(\d+)/)?.[1] ?? null
  const auditRows = auditRowsRaw ? Number(auditRowsRaw) : null

  if (!role && !siteCode && !spotCode && !incidentId && auditRows == null) return null
  return { role, siteCode, spotCode, incidentId, auditRows }
}

export function summarizeFixtureDrift(runs: RepeatSmokeRunSummary[], env: NodeJS.ProcessEnv = process.env) {
  const fixture = readFixtureFromEnv(env)
  const issues: string[] = []

  for (const run of runs) {
    if (!run.parsed) {
      issues.push(`Run ${run.runNumber}: không parse được smoke bundle summary.`)
      continue
    }
    if (run.parsed.role !== fixture.role) {
      issues.push(`Run ${run.runNumber}: role drift (${run.parsed.role} != ${fixture.role}).`)
    }
    if (run.parsed.siteCode !== fixture.siteCode) {
      issues.push(`Run ${run.runNumber}: siteCode drift (${run.parsed.siteCode} != ${fixture.siteCode}).`)
    }
    if (run.parsed.spotCode !== fixture.spotCode) {
      issues.push(`Run ${run.runNumber}: spotCode drift (${run.parsed.spotCode} != ${fixture.spotCode}).`)
    }
    if (!run.parsed.incidentId) {
      issues.push(`Run ${run.runNumber}: incidentId trống sau smoke.`)
    }
    if ((run.parsed.auditRows ?? 0) <= 0) {
      issues.push(`Run ${run.runNumber}: auditRows không đủ chứng cứ (${run.parsed.auditRows ?? 0}).`)
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    expectedFixture: fixture,
  }
}

function streamInto(buffer: string[], chunk: Buffer | string, writer: NodeJS.WriteStream) {
  const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
  buffer.push(text)
  writer.write(text)
}

export async function runCapturedCommand(
  command: string,
  args: string[],
  options?: {
    cwd?: string
    env?: NodeJS.ProcessEnv
    id?: string
    label?: string
  },
): Promise<Rc1StepResult> {
  const invocation = command === 'pnpm' ? resolvePnpmInvocation(args, options?.env) : resolveCommandInvocation(command, args)
  const startedAt = Date.now()
  const stdout: string[] = []
  const stderr: string[] = []
  const label = options?.label ?? [command, ...args].join(' ')

  process.stdout.write(`[exec] ${label}\n`)

  return await new Promise<Rc1StepResult>((resolve, reject) => {
    const child = spawn(invocation.file, invocation.args, {
      cwd: options?.cwd ?? process.cwd(),
      env: options?.env,
      shell: invocation.shell,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    child.stdout?.on('data', (chunk) => streamInto(stdout, chunk, process.stdout))
    child.stderr?.on('data', (chunk) => streamInto(stderr, chunk, process.stderr))
    child.on('error', reject)
    child.on('close', (code) => {
      const result: Rc1StepResult = {
        id: options?.id ?? label,
        command: label,
        ok: code === 0,
        exitCode: typeof code === 'number' ? code : 1,
        durationMs: Date.now() - startedAt,
        stdout: stdout.join(''),
        stderr: stderr.join(''),
      }
      resolve(result)
    })
  })
}

export function buildPnpmScriptArgs(scriptName: string, scriptArgs: string[] = []) {
  return scriptArgs.length > 0 ? [scriptName, '--', ...scriptArgs] : [scriptName]
}

export function resolveRcGateEnv(env: NodeJS.ProcessEnv = process.env, explicitProfile?: string | null) {
  return applyDeploymentProfileEnv(env, explicitProfile ?? String(env.RC_CLEAN_MACHINE_PROFILE ?? 'DEMO'))
}
