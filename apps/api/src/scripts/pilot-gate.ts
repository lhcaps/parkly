import 'dotenv/config'

import path from 'node:path'

import { runSecretsCheck } from './secrets-check'
import { runSecretsRotationCheck } from './secrets-rotation-check'
import { verifyDeploymentReadiness } from './deployment-verify'
import { applyDeploymentProfileEnv, resolveDeploymentProfile } from './deployment-profiles'
import { buildPnpmScriptArgs, envFlag, runCapturedCommand, type Rc1StepResult, writeJson } from './rc1-runtime'

export type PilotGateStep = {
  id: string
  command: string
  ok: boolean
  exitCode: number
  durationMs: number
  artifact?: string
}

export type PilotGateSummary = {
  checkedAt: string
  ok: boolean
  label: string
  profile: string
  evidenceRoot: string
  steps: PilotGateStep[]
}

const PILOT_EVIDENCE_FILES = {
  securitySecretsCheck: 'security-secrets-check.json',
  securityRotationCheck: 'security-rotation-check.json',
  verifyDeploymentPilot: 'verify-deployment-pilot.json',
  pilotGateSummary: 'pilot-gate-summary.json',
} as const

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

export function resolvePilotLabel(env: NodeJS.ProcessEnv = process.env) {
  return String(env.PILOT_LABEL ?? 'backend-pilot-ready').trim() || 'backend-pilot-ready'
}

export function resolvePilotEvidenceRoot(env: NodeJS.ProcessEnv = process.env) {
  const configured = String(env.PILOT_EVIDENCE_ROOT_DIR ?? '').trim()
  if (configured) return path.resolve(configured)
  return path.resolve('release-evidence', 'backend-pilot')
}

export function buildPilotEvidenceFilePath(fileName: string, env: NodeJS.ProcessEnv = process.env) {
  return path.join(resolvePilotEvidenceRoot(env), fileName)
}

function toStep(id: string, command: string, startedAt: number, ok: boolean, exitCode: number, artifact?: string): PilotGateStep {
  return {
    id,
    command,
    ok,
    exitCode,
    durationMs: Date.now() - startedAt,
    artifact,
  }
}

export async function performPilotGate(options?: {
  env?: NodeJS.ProcessEnv
  profile?: string | null
  runCommand?: typeof runCapturedCommand
  verifyDeployment?: typeof verifyDeploymentReadiness
}) {
  const baseEnv = options?.env ?? process.env
  const env = applyDeploymentProfileEnv(baseEnv, options?.profile ?? 'release-candidate')
  const profile = resolveDeploymentProfile(env, options?.profile ?? 'release-candidate')
  const runCommand = options?.runCommand ?? runCapturedCommand
  const verifyDeployment = options?.verifyDeployment ?? verifyDeploymentReadiness
  const label = resolvePilotLabel(env)
  const evidenceRoot = resolvePilotEvidenceRoot(env)
  const skipTypecheck = envFlag('PILOT_SKIP_TYPECHECK', false, env)
  const verifyBeforeGate = envFlag('PILOT_VERIFY_DEPLOYMENT_BEFORE_GATE', true, env)
  const steps: PilotGateStep[] = []

  if (profile.name !== 'RELEASE_CANDIDATE') {
    const summary: PilotGateSummary = {
      checkedAt: new Date().toISOString(),
      ok: false,
      label,
      profile: profile.label,
      evidenceRoot,
      steps: [
        {
          id: 'profile-guard',
          command: 'pilot gate requires release-candidate profile',
          ok: false,
          exitCode: 1,
          durationMs: 0,
        },
      ],
    }
    writeJson(buildPilotEvidenceFilePath(PILOT_EVIDENCE_FILES.pilotGateSummary, env), summary)
    throw new Error('Pilot gate chỉ hỗ trợ profile release-candidate.')
  }

  const securityStart = Date.now()
  const secretsCheck = runSecretsCheck({ profile: 'release-candidate', intent: 'pilot', format: 'json', strict: true }, env)
  const secretsArtifact = buildPilotEvidenceFilePath(PILOT_EVIDENCE_FILES.securitySecretsCheck, env)
  writeJson(secretsArtifact, secretsCheck.report)
  steps.push(toStep('secrets-check', 'pnpm secrets:check -- --profile release-candidate --intent pilot --strict --format json', securityStart, secretsCheck.exitCode === 0, secretsCheck.exitCode, secretsArtifact))
  if (secretsCheck.exitCode !== 0) {
    const summary: PilotGateSummary = { checkedAt: new Date().toISOString(), ok: false, label, profile: profile.label, evidenceRoot, steps }
    writeJson(buildPilotEvidenceFilePath(PILOT_EVIDENCE_FILES.pilotGateSummary, env), summary)
    throw new Error('Pilot gate failed at step secrets-check')
  }

  const rotationStart = Date.now()
  const rotationCheck = runSecretsRotationCheck({ format: 'json', requireActive: true }, env)
  const rotationArtifact = buildPilotEvidenceFilePath(PILOT_EVIDENCE_FILES.securityRotationCheck, env)
  writeJson(rotationArtifact, rotationCheck.report)
  steps.push(toStep('secrets-rotation-check', 'pnpm secrets:rotation:check -- --require-active --format json', rotationStart, rotationCheck.exitCode === 0, rotationCheck.exitCode, rotationArtifact))
  if (rotationCheck.exitCode !== 0) {
    const summary: PilotGateSummary = { checkedAt: new Date().toISOString(), ok: false, label, profile: profile.label, evidenceRoot, steps }
    writeJson(buildPilotEvidenceFilePath(PILOT_EVIDENCE_FILES.pilotGateSummary, env), summary)
    throw new Error('Pilot gate failed at step secrets-rotation-check')
  }

  if (verifyBeforeGate) {
    const verifyStart = Date.now()
    const verifyReport = await verifyDeployment({ env, profile: profile.label, intent: 'pilot' })
    const verifyArtifact = buildPilotEvidenceFilePath(PILOT_EVIDENCE_FILES.verifyDeploymentPilot, env)
    writeJson(verifyArtifact, verifyReport)
    steps.push(toStep('verify-deployment-pilot', 'pnpm verify:deployment -- --profile release-candidate --intent pilot', verifyStart, verifyReport.ready, verifyReport.ready ? 0 : 1, verifyArtifact))
    if (!verifyReport.ready) {
      const summary: PilotGateSummary = { checkedAt: new Date().toISOString(), ok: false, label, profile: profile.label, evidenceRoot, steps }
      writeJson(buildPilotEvidenceFilePath(PILOT_EVIDENCE_FILES.pilotGateSummary, env), summary)
      throw new Error('Pilot gate failed at step verify-deployment-pilot')
    }
  }

  const plan: Array<{ id: string; label: string; args: string[] }> = []
  if (!skipTypecheck) {
    plan.push({ id: 'typecheck', label: 'pnpm typecheck', args: buildPnpmScriptArgs('typecheck') })
  }

  for (const script of ['test:pr26', 'test:pr27', 'test:pr28', 'test:pr29', 'test:pr30', 'test:pr31', 'test:pr32', 'test:pr33', 'test:pr34']) {
    plan.push({ id: script.replace(/:/g, '-'), label: `pnpm ${script}`, args: buildPnpmScriptArgs(script) })
  }

  for (const step of plan) {
    const result: Rc1StepResult = await runCommand('pnpm', step.args, { env, id: step.id, label: step.label })
    steps.push({ id: step.id, command: step.label, ok: result.ok, exitCode: result.exitCode, durationMs: result.durationMs })
    if (!result.ok) {
      const summary: PilotGateSummary = { checkedAt: new Date().toISOString(), ok: false, label, profile: profile.label, evidenceRoot, steps }
      writeJson(buildPilotEvidenceFilePath(PILOT_EVIDENCE_FILES.pilotGateSummary, env), summary)
      throw new Error(`Pilot gate failed at step ${step.id}`)
    }
  }

  const summary: PilotGateSummary = {
    checkedAt: new Date().toISOString(),
    ok: true,
    label,
    profile: profile.label,
    evidenceRoot,
    steps,
  }
  writeJson(buildPilotEvidenceFilePath(PILOT_EVIDENCE_FILES.pilotGateSummary, env), summary)
  return summary
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const summary = await performPilotGate({ profile: args.profile })
  console.log('[pilot:gate] OK', JSON.stringify(summary, null, 2))
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[pilot:gate] FAIL', error)
    process.exitCode = 1
  })
}
