import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { performPilotGate } from '../scripts/pilot-gate'
import type { DeploymentVerificationReport } from '../scripts/deployment-verify'

function mkTempEvidenceRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'parkly-pilot-gate-'))
}

function okRunCommand(_: string, __: string[], options?: { id?: string; label?: string }) {
  return Promise.resolve({
    id: options?.id ?? 'step',
    command: options?.label ?? 'pnpm step',
    ok: true,
    exitCode: 0,
    durationMs: 1,
    stdout: '',
    stderr: '',
  })
}

function buildReadyVerifyReport(): DeploymentVerificationReport {
  return {
    profile: 'RELEASE_CANDIDATE',
    intent: 'pilot',
    mediaDriver: 'MINIO',
    ready: true,
    errors: 0,
    warnings: 0,
    checkedAt: new Date().toISOString(),
    checks: [
      { id: 'internal-service-token', status: 'OK', message: 'ok' },
      { id: 'device-capture-secret', status: 'OK', message: 'ok' },
      { id: 'internal-service-rotation', status: 'OK', message: 'ok' },
      { id: 'device-capture-rotation', status: 'OK', message: 'ok' },
    ],
    securitySecrets: {
      profile: 'release-candidate',
      intent: 'pilot',
      ok: true,
      checkedAt: new Date().toISOString(),
      fields: {
        API_INTERNAL_SERVICE_TOKEN: {
          field: 'API_INTERNAL_SERVICE_TOKEN',
          present: true,
          masked: '529d…435b',
          fingerprint: 'c209b6670430',
          severity: 'PASS',
          findings: [],
        },
        DEVICE_CAPTURE_DEFAULT_SECRET: {
          field: 'DEVICE_CAPTURE_DEFAULT_SECRET',
          present: true,
          masked: 'c5fe…8d44',
          fingerprint: '2114f42b9ac5',
          severity: 'PASS',
          findings: [],
        },
      },
      findings: [],
      summary: { passFields: 2, warnFields: 0, errorFields: 0, findings: 0 },
    },
    securityRotation: {
      ok: true,
      checkedAt: new Date().toISOString(),
      requireActiveEnv: true,
      fields: {
        API_INTERNAL_SERVICE_TOKEN: {
          field: 'API_INTERNAL_SERVICE_TOKEN',
          mode: 'ACTIVE_ONLY',
          rotationEnabled: false,
          ok: true,
          primary: { slot: 'ACTIVE', sourceEnv: 'API_INTERNAL_SERVICE_TOKEN_ACTIVE', masked: '529d…435b', fingerprint: 'c209b6670430' },
          primarySourceKind: 'ACTIVE_ENV',
          activeEnvPresent: true,
          nextEnvPresent: false,
          legacyEnvPresent: true,
          accepted: [{ slot: 'ACTIVE', sourceEnv: 'API_INTERNAL_SERVICE_TOKEN_ACTIVE', masked: '529d…435b', fingerprint: 'c209b6670430' }],
          findings: [],
        },
        DEVICE_CAPTURE_DEFAULT_SECRET: {
          field: 'DEVICE_CAPTURE_DEFAULT_SECRET',
          mode: 'ACTIVE_ONLY',
          rotationEnabled: false,
          ok: true,
          primary: { slot: 'ACTIVE', sourceEnv: 'DEVICE_CAPTURE_SECRET_ACTIVE', masked: 'c5fe…8d44', fingerprint: '2114f42b9ac5' },
          primarySourceKind: 'ACTIVE_ENV',
          activeEnvPresent: true,
          nextEnvPresent: false,
          legacyEnvPresent: true,
          accepted: [{ slot: 'ACTIVE', sourceEnv: 'DEVICE_CAPTURE_SECRET_ACTIVE', masked: 'c5fe…8d44', fingerprint: '2114f42b9ac5' }],
          findings: [],
        },
      },
      findings: [],
      summary: { activeOnlyFields: 2, rotationWindowFields: 0, nextOnlyFields: 0, errorFields: 0 },
    },
  }
}

test('pilot gate tạo đủ evidence artifact và chạy plan PR26..PR34 khi security readiness sạch', async () => {
  const evidenceRoot = mkTempEvidenceRoot()
  const env = {
    PILOT_EVIDENCE_ROOT_DIR: evidenceRoot,
    PILOT_LABEL: 'backend-pilot-ready',
    PARKLY_DEPLOYMENT_PROFILE: 'RELEASE_CANDIDATE',
    PARKLY_MEDIA_PROFILE: 'MINIO',
    MEDIA_STORAGE_DRIVER: 'MINIO',
    SMOKE_MEDIA_DRIVER: 'MINIO',
    API_INTERNAL_SERVICE_TOKEN: '529dc1cb7dcf797fee2e076917cd6b0b872aa43af1fc0811fcecdc1c3f8e435b',
    API_INTERNAL_SERVICE_TOKEN_ACTIVE: '529dc1cb7dcf797fee2e076917cd6b0b872aa43af1fc0811fcecdc1c3f8e435b',
    DEVICE_CAPTURE_DEFAULT_SECRET: 'c5fec4789c275edcfcb95307ac97c40b9f3a70ad0fa0d1f534b6672dc90b8d44',
    DEVICE_CAPTURE_SECRET_ACTIVE: 'c5fec4789c275edcfcb95307ac97c40b9f3a70ad0fa0d1f534b6672dc90b8d44',
    S3_ENDPOINT: 'http://127.0.0.1:9000',
    S3_ACCESS_KEY: 'minioadmin',
    S3_SECRET_KEY: 'minioadmin123',
    S3_BUCKET_MEDIA: 'parkly-media',
    DATABASE_ADMIN_HOST: '127.0.0.1',
    DATABASE_ADMIN_PORT: '3306',
    REDIS_URL: 'redis://127.0.0.1:6379',
    REDIS_REQUIRED: 'ON',
  } as NodeJS.ProcessEnv

  const summary = await performPilotGate({
    env,
    runCommand: okRunCommand,
    verifyDeployment: async () => buildReadyVerifyReport(),
  })

  assert.equal(summary.ok, true)
  assert.equal(summary.label, 'backend-pilot-ready')
  assert.ok(summary.steps.some((item) => item.id === 'secrets-check'))
  assert.ok(summary.steps.some((item) => item.id === 'secrets-rotation-check'))
  assert.ok(summary.steps.some((item) => item.id === 'verify-deployment-pilot'))
  assert.ok(summary.steps.some((item) => item.id === 'test-pr34'))

  for (const artifact of [
    'security-secrets-check.json',
    'security-rotation-check.json',
    'verify-deployment-pilot.json',
    'pilot-gate-summary.json',
  ]) {
    assert.equal(fs.existsSync(path.join(evidenceRoot, artifact)), true, `${artifact} missing`)
  }
})

test('pilot gate fail-fast nếu rotation vẫn dựa vào legacy alias và chưa set ACTIVE env', async () => {
  const evidenceRoot = mkTempEvidenceRoot()
  await assert.rejects(
    () =>
      performPilotGate({
        env: {
          PILOT_EVIDENCE_ROOT_DIR: evidenceRoot,
          PARKLY_DEPLOYMENT_PROFILE: 'RELEASE_CANDIDATE',
          PARKLY_MEDIA_PROFILE: 'MINIO',
          MEDIA_STORAGE_DRIVER: 'MINIO',
          API_INTERNAL_SERVICE_TOKEN: '529dc1cb7dcf797fee2e076917cd6b0b872aa43af1fc0811fcecdc1c3f8e435b',
          DEVICE_CAPTURE_DEFAULT_SECRET: 'c5fec4789c275edcfcb95307ac97c40b9f3a70ad0fa0d1f534b6672dc90b8d44',
          S3_ENDPOINT: 'http://127.0.0.1:9000',
          S3_ACCESS_KEY: 'minioadmin',
          S3_SECRET_KEY: 'minioadmin123',
          S3_BUCKET_MEDIA: 'parkly-media',
          DATABASE_ADMIN_HOST: '127.0.0.1',
          DATABASE_ADMIN_PORT: '3306',
          REDIS_URL: 'redis://127.0.0.1:6379',
          REDIS_REQUIRED: 'ON',
        } as NodeJS.ProcessEnv,
        runCommand: okRunCommand,
        verifyDeployment: async () => buildReadyVerifyReport(),
      }),
    /secrets-rotation-check/i,
  )

  const summaryPath = path.join(evidenceRoot, 'pilot-gate-summary.json')
  assert.equal(fs.existsSync(summaryPath), true)
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
  assert.equal(summary.ok, false)
  assert.equal(summary.steps[1].id, 'secrets-rotation-check')
})
