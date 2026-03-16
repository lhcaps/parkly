import { createHash, timingSafeEqual } from 'node:crypto'

import type { SecretFieldName } from './secret-hygiene'

export type SecretRotationSlot = 'ACTIVE' | 'NEXT'
export type SecretRotationMode = 'ACTIVE_ONLY' | 'ACTIVE_AND_NEXT' | 'NEXT_ONLY' | 'MISSING'
export type SecretRotationFindingCode =
  | 'missing-accepted-secret'
  | 'active-next-duplicate'
  | 'legacy-active-mismatch'
  | 'missing-active-secret'
export type SecretRotationFindingSeverity = 'WARN' | 'ERROR'
export type SecretRotationPrimarySourceKind = 'ACTIVE_ENV' | 'LEGACY_ENV' | 'NEXT_ENV' | 'NONE'

export type SecretRotationFinding = {
  field: SecretFieldName
  severity: SecretRotationFindingSeverity
  code: SecretRotationFindingCode
  message: string
}

export type SecretRotationAcceptedSecret = {
  slot: SecretRotationSlot
  sourceEnv: string
  masked: string
  fingerprint: string
}

type SecretRotationRuntimeSecret = SecretRotationAcceptedSecret & {
  value: string
}

export type SecretRotationFieldReport = {
  field: SecretFieldName
  mode: SecretRotationMode
  rotationEnabled: boolean
  ok: boolean
  primary: SecretRotationAcceptedSecret | null
  primarySourceKind: SecretRotationPrimarySourceKind
  activeEnvPresent: boolean
  nextEnvPresent: boolean
  legacyEnvPresent: boolean
  accepted: SecretRotationAcceptedSecret[]
  findings: SecretRotationFinding[]
}

export type SecretRotationSummary = {
  activeOnlyFields: number
  rotationWindowFields: number
  nextOnlyFields: number
  errorFields: number
}

export type SecretRotationCheckResult = {
  ok: boolean
  checkedAt: string
  requireActiveEnv: boolean
  fields: Record<SecretFieldName, SecretRotationFieldReport>
  findings: SecretRotationFinding[]
  summary: SecretRotationSummary
}

export type EvaluateSecretRotationOptions = {
  requireActiveEnv?: boolean
}

type SecretRotationFieldConfig = {
  field: SecretFieldName
  activeEnv: string
  nextEnv: string
  legacyEnv: string
}

type SecretRotationRuntimeCarrier = {
  _runtimeSecrets: SecretRotationRuntimeSecret[]
}

function fingerprintSecret(value: string) {
  const normalized = String(value)
  if (normalized.length === 0) return ''
  return createHash('sha256').update(normalized).digest('hex').slice(0, 12)
}

function maskSecretForDisplay(value: string) {
  const normalized = String(value)
  if (normalized.length === 0) return ''
  const visibleStart = normalized.slice(0, Math.min(4, normalized.length))
  const visibleEnd = normalized.length > 8 ? normalized.slice(-4) : ''
  if (normalized.length <= 8) return `${visibleStart}…`
  return `${visibleStart}…${visibleEnd}`
}

const ROTATION_FIELDS: Record<SecretFieldName, SecretRotationFieldConfig> = {
  API_INTERNAL_SERVICE_TOKEN: {
    field: 'API_INTERNAL_SERVICE_TOKEN',
    activeEnv: 'API_INTERNAL_SERVICE_TOKEN_ACTIVE',
    nextEnv: 'API_INTERNAL_SERVICE_TOKEN_NEXT',
    legacyEnv: 'API_INTERNAL_SERVICE_TOKEN',
  },
  DEVICE_CAPTURE_DEFAULT_SECRET: {
    field: 'DEVICE_CAPTURE_DEFAULT_SECRET',
    activeEnv: 'DEVICE_CAPTURE_SECRET_ACTIVE',
    nextEnv: 'DEVICE_CAPTURE_SECRET_NEXT',
    legacyEnv: 'DEVICE_CAPTURE_DEFAULT_SECRET',
  },
}

function normalizeText(value: unknown) {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text ? text : null
}

export function constantTimeSecretEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(String(left ?? ''))
  const rightBuffer = Buffer.from(String(right ?? ''))
  if (leftBuffer.length === 0 || rightBuffer.length === 0) return false
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

function buildRuntimeSecret(slot: SecretRotationSlot, sourceEnv: string, value: string): SecretRotationRuntimeSecret {
  return {
    slot,
    sourceEnv,
    value,
    masked: maskSecretForDisplay(value),
    fingerprint: fingerprintSecret(value),
  }
}

function toAcceptedSecret(value: SecretRotationRuntimeSecret): SecretRotationAcceptedSecret {
  return {
    slot: value.slot,
    sourceEnv: value.sourceEnv,
    masked: value.masked,
    fingerprint: value.fingerprint,
  }
}

function resolvePrimarySourceKind(config: SecretRotationFieldConfig, primary: SecretRotationAcceptedSecret | null): SecretRotationPrimarySourceKind {
  if (!primary) return 'NONE'
  if (primary.sourceEnv === config.activeEnv) return 'ACTIVE_ENV'
  if (primary.sourceEnv === config.legacyEnv) return 'LEGACY_ENV'
  if (primary.sourceEnv === config.nextEnv) return 'NEXT_ENV'
  return 'NONE'
}

function resolveRotationField(
  field: SecretFieldName,
  env: NodeJS.ProcessEnv,
  options?: EvaluateSecretRotationOptions,
): SecretRotationFieldReport & SecretRotationRuntimeCarrier {
  const config = ROTATION_FIELDS[field]
  const active = normalizeText(env[config.activeEnv])
  const legacy = normalizeText(env[config.legacyEnv])
  const next = normalizeText(env[config.nextEnv])
  const requireActiveEnv = options?.requireActiveEnv === true
  const findings: SecretRotationFinding[] = []
  const runtimeSecrets: SecretRotationRuntimeSecret[] = []

  if (active && legacy && active !== legacy) {
    findings.push({
      field,
      severity: 'ERROR',
      code: 'legacy-active-mismatch',
      message: `${config.activeEnv} và ${config.legacyEnv} đang khác nhau. Hãy chốt một nguồn primary duy nhất trước khi rollout rotation.`,
    })
  }

  const primaryValue = active ?? legacy
  if (primaryValue) {
    runtimeSecrets.push(buildRuntimeSecret('ACTIVE', active ? config.activeEnv : config.legacyEnv, primaryValue))
  }

  if (next) {
    runtimeSecrets.push(buildRuntimeSecret('NEXT', config.nextEnv, next))
  }

  if (!primaryValue && !next) {
    findings.push({
      field,
      severity: 'ERROR',
      code: 'missing-accepted-secret',
      message: `${config.activeEnv}/${config.legacyEnv} và ${config.nextEnv} đều đang trống; runtime không có secret nào để accept.`,
    })
  }

  if (primaryValue && next && constantTimeSecretEquals(primaryValue, next)) {
    findings.push({
      field,
      severity: 'ERROR',
      code: 'active-next-duplicate',
      message: `${config.activeEnv}/${config.legacyEnv} và ${config.nextEnv} đang reuse cùng một giá trị; rotation window phải dùng hai secret khác nhau.`,
    })
  }

  if (requireActiveEnv && !active) {
    findings.push({
      field,
      severity: 'ERROR',
      code: 'missing-active-secret',
      message: `${config.activeEnv} đang trống. Pilot/release gate yêu cầu ACTIVE env rõ ràng thay vì chỉ dựa vào legacy alias hoặc NEXT_ONLY.`,
    })
  }

  const mode: SecretRotationMode = primaryValue
    ? next
      ? 'ACTIVE_AND_NEXT'
      : 'ACTIVE_ONLY'
    : next
      ? 'NEXT_ONLY'
      : 'MISSING'

  const accepted = runtimeSecrets.map(toAcceptedSecret)
  const primary = accepted.find((item) => item.slot === 'ACTIVE') ?? accepted[0] ?? null
  const primarySourceKind = resolvePrimarySourceKind(config, primary)

  const report: SecretRotationFieldReport = {
    field,
    mode,
    rotationEnabled: mode === 'ACTIVE_AND_NEXT',
    ok: findings.every((item) => item.severity !== 'ERROR'),
    primary,
    primarySourceKind,
    activeEnvPresent: Boolean(active),
    nextEnvPresent: Boolean(next),
    legacyEnvPresent: Boolean(legacy),
    accepted,
    findings,
  }

  const withRuntime = report as SecretRotationFieldReport & SecretRotationRuntimeCarrier
  Object.defineProperty(withRuntime, '_runtimeSecrets', {
    value: runtimeSecrets,
    enumerable: false,
    configurable: false,
    writable: false,
  })
  return withRuntime
}

export function evaluateSecretRotation(
  env: NodeJS.ProcessEnv = process.env,
  options?: EvaluateSecretRotationOptions,
): SecretRotationCheckResult {
  const internal = resolveRotationField('API_INTERNAL_SERVICE_TOKEN', env, options)
  const capture = resolveRotationField('DEVICE_CAPTURE_DEFAULT_SECRET', env, options)
  const fields = {
    API_INTERNAL_SERVICE_TOKEN: internal,
    DEVICE_CAPTURE_DEFAULT_SECRET: capture,
  } satisfies Record<SecretFieldName, SecretRotationFieldReport>

  const findings = [...internal.findings, ...capture.findings]
  return {
    ok: findings.every((item) => item.severity !== 'ERROR'),
    checkedAt: new Date().toISOString(),
    requireActiveEnv: options?.requireActiveEnv === true,
    fields,
    findings,
    summary: {
      activeOnlyFields: Object.values(fields).filter((item) => item.mode === 'ACTIVE_ONLY').length,
      rotationWindowFields: Object.values(fields).filter((item) => item.mode === 'ACTIVE_AND_NEXT').length,
      nextOnlyFields: Object.values(fields).filter((item) => item.mode === 'NEXT_ONLY').length,
      errorFields: Object.values(fields).filter((item) => item.ok === false).length,
    },
  }
}

function runtimeSecretsOf(field: SecretRotationFieldReport) {
  return ((field as SecretRotationFieldReport & SecretRotationRuntimeCarrier)._runtimeSecrets ?? []) as SecretRotationRuntimeSecret[]
}

export function getPrimaryRotationSecretValue(field: SecretRotationFieldReport) {
  return runtimeSecretsOf(field).find((item) => item.slot === 'ACTIVE')?.value ?? runtimeSecretsOf(field)[0]?.value ?? null
}

export function getNextRotationSecretValue(field: SecretRotationFieldReport) {
  return runtimeSecretsOf(field).find((item) => item.slot === 'NEXT')?.value ?? null
}

export function getRotationAcceptedSecretValues(field: SecretRotationFieldReport) {
  return runtimeSecretsOf(field).map((item) => item.value)
}

export function matchRotationSecret(field: SecretRotationFieldReport, candidate: string | null | undefined): SecretRotationAcceptedSecret | null {
  const normalizedCandidate = normalizeText(candidate)
  if (!normalizedCandidate) return null

  for (const secret of runtimeSecretsOf(field)) {
    if (constantTimeSecretEquals(secret.value, normalizedCandidate)) {
      return toAcceptedSecret(secret)
    }
  }

  return null
}

export function resolveInternalServiceTokenRotation(env: NodeJS.ProcessEnv = process.env, options?: EvaluateSecretRotationOptions) {
  return evaluateSecretRotation(env, options).fields.API_INTERNAL_SERVICE_TOKEN
}

export function resolveDeviceCaptureDefaultRotation(env: NodeJS.ProcessEnv = process.env, options?: EvaluateSecretRotationOptions) {
  return evaluateSecretRotation(env, options).fields.DEVICE_CAPTURE_DEFAULT_SECRET
}
