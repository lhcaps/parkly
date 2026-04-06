import 'dotenv/config'

import fs from 'node:fs'
import net from 'node:net'

import { type SecretFieldName, evaluateSecretHygiene } from '../lib/security/secret-hygiene'
import { type SecretRotationCheckResult, type SecretRotationFieldReport, evaluateSecretRotation } from '../lib/security/secret-rotation'
import {
  type DeploymentIntent,
  type DeploymentProfile,
  applyDeploymentProfileEnv,
  isMediaOverrideEnabled,
  resolveDeploymentProfile,
} from './deployment-profiles'

export type VerificationStatus = 'OK' | 'WARN' | 'ERROR'

export type VerificationCheck = {
  id: string
  status: VerificationStatus
  message: string
  hint?: string
}

export type DeploymentVerificationReport = {
  profile: DeploymentProfile['name']
  intent: DeploymentIntent
  mediaDriver: DeploymentProfile['mediaDriver']
  ready: boolean
  errors: number
  warnings: number
  checkedAt: string
  checks: VerificationCheck[]
  securitySecrets: ReturnType<typeof evaluateSecretHygiene>
  securityRotation: SecretRotationCheckResult
}

function parseArgs(argv: string[]) {
  let profile: string | null = null
  let intent: DeploymentIntent = 'bootstrap'

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--profile') {
      profile = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (token === '--intent') {
      const raw = String(argv[index + 1] ?? '').trim().toLowerCase()
      if (raw === 'bootstrap' || raw === 'reset' || raw === 'smoke' || raw === 'dev' || raw === 'pilot') intent = raw
      index += 1
    }
  }

  return { profile, intent }
}

function envInt(name: string, fallback: number, env: NodeJS.ProcessEnv) {
  const raw = String(env[name] ?? '').trim()
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? Math.trunc(value) : fallback
}

function parseHostPortFromUrl(urlString: string, fallbackPort: number) {
  const parsed = new URL(urlString)
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : fallbackPort,
  }
}

export async function probeTcpPort(host: string, port: number, timeoutMs = 800) {
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port })
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error(`timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    socket.once('connect', () => {
      clearTimeout(timer)
      socket.end()
      resolve()
    })
    socket.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

export async function checkPortAvailable(host: string, port: number) {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', reject)
    server.listen(port, host, () => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })
}

function createCheck(id: string, status: VerificationStatus, message: string, hint?: string): VerificationCheck {
  return { id, status, message, hint }
}

function severityToStatus(value: 'PASS' | 'WARN' | 'ERROR'): VerificationStatus {
  if (value === 'PASS') return 'OK'
  return value
}

function fieldToCheckId(field: SecretFieldName) {
  return field === 'API_INTERNAL_SERVICE_TOKEN' ? 'internal-service-token' : 'device-capture-secret'
}

function fieldToRotationCheckId(field: SecretFieldName) {
  return field === 'API_INTERNAL_SERVICE_TOKEN' ? 'internal-service-rotation' : 'device-capture-rotation'
}

function fieldHint(field: SecretFieldName, report: ReturnType<typeof evaluateSecretHygiene>, profile: DeploymentProfile, intent: DeploymentIntent) {
  if (report.fields[field].severity === 'PASS') return undefined
  if (profile.name === 'RELEASE_CANDIDATE' || intent === 'pilot') {
    return 'Profile nghiêm túc phải thay secret thật, đủ dài, distinct và không còn placeholder.'
  }
  return 'Demo/local vẫn có thể WARN cho placeholder nhưng không nên giữ nguyên trước khi handoff nghiêm túc.'
}

function rotationHint(field: SecretFieldName, report: SecretRotationFieldReport, intent: DeploymentIntent) {
  if (report.ok) return undefined
  if (intent === 'pilot' && !report.activeEnvPresent) {
    return field === 'API_INTERNAL_SERVICE_TOKEN'
      ? 'Pilot gate yêu cầu set API_INTERNAL_SERVICE_TOKEN_ACTIVE rõ ràng và không chỉ dựa vào legacy alias.'
      : 'Pilot gate yêu cầu set DEVICE_CAPTURE_SECRET_ACTIVE rõ ràng và không chỉ dựa vào legacy alias.'
  }
  return 'Rotation topology phải tránh ACTIVE/NEXT trùng nhau, legacy-active mismatch và runtime secret trống.'
}

function buildSecretChecks(profile: DeploymentProfile, intent: DeploymentIntent, env: NodeJS.ProcessEnv) {
  const secretReport = evaluateSecretHygiene({ env, profile: profile.label as 'local-dev' | 'demo' | 'release-candidate', intent })
  const secretChecks: VerificationCheck[] = []

  for (const field of ['API_INTERNAL_SERVICE_TOKEN', 'DEVICE_CAPTURE_DEFAULT_SECRET'] as const) {
    const fieldReport = secretReport.fields[field]
    const status = severityToStatus(fieldReport.severity)
    const message =
      fieldReport.findings.length === 0
        ? `${field} đã qua secret hygiene baseline.`
        : `${field} failed secret hygiene: ${fieldReport.findings.map((item) => item.code).join(', ')}`

    secretChecks.push(createCheck(fieldToCheckId(field), status, message, fieldHint(field, secretReport, profile, intent)))
  }

  return {
    secretReport,
    secretChecks,
  }
}

function buildRotationChecks(intent: DeploymentIntent, env: NodeJS.ProcessEnv) {
  const requireActiveEnv = intent === 'pilot'
  const rotationReport = evaluateSecretRotation(env, { requireActiveEnv })
  const rotationChecks: VerificationCheck[] = []

  for (const field of ['API_INTERNAL_SERVICE_TOKEN', 'DEVICE_CAPTURE_DEFAULT_SECRET'] as const) {
    const fieldReport = rotationReport.fields[field]
    const status: VerificationStatus = fieldReport.ok ? 'OK' : 'ERROR'
    const modeInfo = requireActiveEnv
      ? `${field} rotation topology ${fieldReport.mode} đã qua active-backed requirement.`
      : `${field} rotation topology hợp lệ ở mode ${fieldReport.mode}.`
    const message = fieldReport.findings.length === 0 ? modeInfo : `${field} rotation failed: ${fieldReport.findings.map((item) => item.code).join(', ')}`
    rotationChecks.push(createCheck(fieldToRotationCheckId(field), status, message, rotationHint(field, fieldReport, intent)))
  }

  return {
    rotationReport,
    rotationChecks,
  }
}

function finalizeReport(
  profile: DeploymentProfile,
  intent: DeploymentIntent,
  checks: VerificationCheck[],
  securitySecrets: ReturnType<typeof evaluateSecretHygiene>,
  securityRotation: SecretRotationCheckResult,
): DeploymentVerificationReport {
  const errors = checks.filter((item) => item.status === 'ERROR').length
  const warnings = checks.filter((item) => item.status === 'WARN').length
  return {
    profile: profile.name,
    intent,
    mediaDriver: profile.mediaDriver,
    ready: errors === 0,
    errors,
    warnings,
    checkedAt: new Date().toISOString(),
    checks,
    securitySecrets,
    securityRotation,
  }
}

export async function verifyDeploymentReadiness(options?: {
  env?: NodeJS.ProcessEnv
  profile?: string | null
  intent?: DeploymentIntent
  probePort?: typeof probeTcpPort
  probePortAvailable?: typeof checkPortAvailable
}) {
  const rawEnv = options?.env ?? process.env
  const env = applyDeploymentProfileEnv(rawEnv, options?.profile ?? null)
  const profile = resolveDeploymentProfile(env, options?.profile ?? null)
  const intent = options?.intent ?? 'bootstrap'
  const timeoutMs = envInt('DEPLOYMENT_VERIFY_TIMEOUT_MS', 800, env)
  const checks: VerificationCheck[] = []
  const portProbe = options?.probePort ?? probeTcpPort
  const portAvailabilityProbe = options?.probePortAvailable ?? checkPortAvailable

  if (!fs.existsSync('.env')) {
    checks.push(createCheck('env-file', 'WARN', 'Không thấy apps/api/.env ở working directory hiện tại.', 'Copy từ .env.example trước khi bootstrap.'))
  } else {
    checks.push(createCheck('env-file', 'OK', 'Đã thấy apps/api/.env.'))
  }

  const requestedMedia = String(rawEnv.PARKLY_MEDIA_PROFILE ?? rawEnv.MEDIA_STORAGE_DRIVER ?? '').trim().toUpperCase()
  const mediaOverrideEnabled = isMediaOverrideEnabled(rawEnv)
  if (requestedMedia && requestedMedia !== profile.mediaDriver && !mediaOverrideEnabled) {
    checks.push(
      createCheck(
        'profile-media-drift',
        'WARN',
        `Env cũ đang yêu cầu media ${requestedMedia} nhưng profile ${profile.label} sẽ ép về ${profile.mediaDriver}.`,
        'Bật PARKLY_ALLOW_MEDIA_OVERRIDE=ON nếu thực sự muốn override media driver của profile.',
      ),
    )
  }

  const dbHost = String(env.DATABASE_ADMIN_HOST ?? env.DATABASE_HOST ?? '127.0.0.1').trim() || '127.0.0.1'
  const dbPort = envInt('DATABASE_ADMIN_PORT', envInt('DATABASE_PORT', 3306, env), env)
  try {
    await portProbe(dbHost, dbPort, timeoutMs)
    checks.push(createCheck('mysql', 'OK', `MySQL đang reachable tại ${dbHost}:${dbPort}.`))
  } catch (error) {
    checks.push(
      createCheck(
        'mysql',
        'ERROR',
        `Không kết nối được MySQL tại ${dbHost}:${dbPort}.`,
        `Hãy chạy compose profile ${profile.label} hoặc bật MySQL local trước. ${String((error as Error)?.message ?? error)}`,
      ),
    )
  }

  const redisRequired = String(env.REDIS_REQUIRED ?? 'OFF').trim().toUpperCase() === 'ON'
  try {
    const redisUrl = String(env.REDIS_URL ?? 'redis://127.0.0.1:6379').trim()
    const redis = parseHostPortFromUrl(redisUrl, 6379)
    await portProbe(redis.host, redis.port, timeoutMs)
    checks.push(createCheck('redis', 'OK', `Redis đang reachable tại ${redis.host}:${redis.port}.`))
  } catch (error) {
    checks.push(
      createCheck(
        'redis',
        redisRequired ? 'ERROR' : 'WARN',
        'Redis chưa reachable theo REDIS_URL hiện tại.',
        `Kiểm tra compose redis hoặc chỉnh REDIS_URL. ${String((error as Error)?.message ?? error)}`,
      ),
    )
  }

  const needsMinio = profile.mediaDriver === 'MINIO'
  if (needsMinio) {
    const s3Endpoint = String(env.S3_ENDPOINT ?? '').trim()
    if (!s3Endpoint) {
      checks.push(createCheck('minio-endpoint', 'ERROR', 'Profile này yêu cầu S3_ENDPOINT nhưng biến đang trống.'))
    } else {
      try {
        const endpoint = parseHostPortFromUrl(s3Endpoint, 9000)
        await portProbe(endpoint.host, endpoint.port, timeoutMs)
        checks.push(createCheck('minio-endpoint', 'OK', `MinIO/S3 endpoint đang reachable tại ${endpoint.host}:${endpoint.port}.`))
      } catch (error) {
        checks.push(
          createCheck(
            'minio-endpoint',
            'ERROR',
            `Không kết nối được object storage tại ${s3Endpoint}.`,
            `Bật profile storage trong compose hoặc kiểm tra S3_ENDPOINT. ${String((error as Error)?.message ?? error)}`,
          ),
        )
      }
    }

    if (!String(env.S3_ACCESS_KEY ?? '').trim() || !String(env.S3_SECRET_KEY ?? '').trim() || !String(env.S3_BUCKET_MEDIA ?? '').trim()) {
      checks.push(createCheck('minio-creds', 'ERROR', 'Profile MINIO yêu cầu đủ S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_MEDIA.'))
    } else {
      checks.push(createCheck('minio-creds', 'OK', 'S3 credentials đã được set cho profile MINIO.'))
    }
  } else {
    checks.push(createCheck('media-driver', 'OK', 'Profile hiện dùng media local; MinIO là tùy chọn.'))
  }

  if (intent === 'smoke') {
    const smokeKeys = ['SMOKE_USERNAME', 'SMOKE_PASSWORD', 'SMOKE_SITE_CODE', 'SMOKE_SPOT_CODE', 'INTERNAL_PRESENCE_API_KEY', 'INTERNAL_PRESENCE_HMAC_SECRET'] as const
    const missing = smokeKeys.filter((key) => !String(env[key] ?? '').trim())
    if (missing.length > 0) {
      checks.push(createCheck('smoke-env', 'ERROR', `Thiếu biến cần cho smoke: ${missing.join(', ')}`))
    } else {
      checks.push(createCheck('smoke-env', 'OK', 'Smoke env đã đủ.'))
    }
  }

  if (intent === 'dev') {
    const apiHost = String(env.API_HOST ?? '127.0.0.1').trim() || '127.0.0.1'
    const apiPort = envInt('API_PORT', 3000, env)
    try {
      await portAvailabilityProbe(apiHost, apiPort)
      checks.push(createCheck('api-port', 'OK', `API port ${apiHost}:${apiPort} đang trống để start server.`))
    } catch (error) {
      checks.push(
        createCheck(
          'api-port',
          'ERROR',
          `API port ${apiHost}:${apiPort} đang bị chiếm.`,
          `Đổi API_PORT hoặc tắt process đang giữ cổng. ${String((error as Error)?.message ?? error)}`,
        ),
      )
    }
  }

  const { secretReport, secretChecks } = buildSecretChecks(profile, intent, env)
  const { rotationReport, rotationChecks } = buildRotationChecks(intent, env)
  checks.push(...secretChecks)
  checks.push(...rotationChecks)

  return finalizeReport(profile, intent, checks, secretReport, rotationReport)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const report = await verifyDeploymentReadiness({ profile: args.profile, intent: args.intent })
  console.log('[deployment:verify]', JSON.stringify(report, null, 2))
  if (!report.ready) process.exitCode = 1
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[deployment:verify] FAIL', error)
    process.exitCode = 1
  })
}
