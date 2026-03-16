import crypto from 'node:crypto'


export type SecretCheckSeverity = 'PASS' | 'WARN' | 'ERROR'
export type SecretProfile = 'local-dev' | 'demo' | 'release-candidate'
export type SecretIntent = 'bootstrap' | 'reset' | 'smoke' | 'dev' | 'pilot'
export type SecretFieldName = 'API_INTERNAL_SERVICE_TOKEN' | 'DEVICE_CAPTURE_DEFAULT_SECRET'

export type SecretFindingCode =
  | 'missing'
  | 'placeholder-literal'
  | 'placeholder-pattern'
  | 'too-short'
  | 'leading-trailing-whitespace'
  | 'contains-whitespace'
  | 'low-entropy-pattern'
  | 'duplicate-secret'

export type SecretFinding = {
  field: SecretFieldName
  severity: SecretCheckSeverity
  code: SecretFindingCode
  message: string
  fingerprint?: string
  masked?: string
}

export type SecretFieldReport = {
  field: SecretFieldName
  present: boolean
  masked: string | null
  fingerprint: string | null
  severity: SecretCheckSeverity
  findings: SecretFinding[]
}

export type SecretCheckSummary = {
  passFields: number
  warnFields: number
  errorFields: number
  findings: number
}

export type SecretCheckResult = {
  profile: SecretProfile
  intent: SecretIntent
  ok: boolean
  checkedAt: string
  fields: Record<SecretFieldName, SecretFieldReport>
  findings: SecretFinding[]
  summary: SecretCheckSummary
}

export type EvaluateSecretHygieneInput = {
  env?: NodeJS.ProcessEnv
  profile: SecretProfile
  intent: SecretIntent
}

type NormalizedSecret = {
  field: SecretFieldName
  raw: string
  trimmed: string
  present: boolean
  masked: string | null
  fingerprint: string | null
}

const SECRET_FIELDS = ['API_INTERNAL_SERVICE_TOKEN', 'DEVICE_CAPTURE_DEFAULT_SECRET'] as const satisfies SecretFieldName[]
const MIN_SECRET_LENGTH = 32

const PLACEHOLDER_LITERALS = new Set([
  '__set_me_internal_token__',
  '__set_me_device_secret__',
  'internal_service_dev_token_change_me',
  'change_me_capture_secret',
  'changeme',
  'change-me',
  'change_me',
  'replace-me',
  'replace_me',
  'placeholder',
  'demo-only',
])

const PLACEHOLDER_PATTERNS = ['placeholder', 'change_me', 'changeme', 'replace-me', 'replace_me', 'demo-only', 'dev_token_change_me', '__set_me_']

function firstDefinedRawEnvValue(env: NodeJS.ProcessEnv, keys: string[]) {
  for (const key of keys) {
    const value = env[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return ''
}

function getFieldRuntimeValue(field: SecretFieldName, env: NodeJS.ProcessEnv) {
  if (field === 'API_INTERNAL_SERVICE_TOKEN') {
    return firstDefinedRawEnvValue(env, [
      'API_INTERNAL_SERVICE_TOKEN_ACTIVE',
      'API_INTERNAL_SERVICE_TOKEN',
      'API_INTERNAL_SERVICE_TOKEN_NEXT',
    ])
  }

  return firstDefinedRawEnvValue(env, [
    'DEVICE_CAPTURE_SECRET_ACTIVE',
    'DEVICE_CAPTURE_DEFAULT_SECRET',
    'DEVICE_CAPTURE_SECRET_NEXT',
  ])
}

function normalizeSecretValue(value: unknown, field: SecretFieldName): NormalizedSecret {
  const raw = typeof value === 'string' ? value : ''
  const trimmed = raw.trim()
  const present = raw.length > 0
  const masked = present ? maskSecretForDisplay(raw) : null
  const fingerprint = present ? fingerprintSecret(raw) : null

  return {
    field,
    raw,
    trimmed,
    present,
    masked,
    fingerprint,
  }
}

function isPlaceholderLiteral(value: string) {
  return PLACEHOLDER_LITERALS.has(value.toLowerCase())
}

function looksLikePlaceholderPattern(value: string) {
  const normalized = value.toLowerCase()
  return PLACEHOLDER_PATTERNS.some((pattern) => normalized.includes(pattern))
}

function looksLowEntropy(value: string) {
  if (value.length === 0) return false
  if (/^(.)\1+$/.test(value)) return true
  if (new Set(value).size <= 2 && value.length >= 16) return true
  if (/^(.{1,4})\1{5,}$/.test(value)) return true
  return false
}

function severityForFinding(code: SecretFindingCode, profile: SecretProfile, intent: SecretIntent): SecretCheckSeverity {
  if (code === 'missing' || code === 'placeholder-literal' || code === 'placeholder-pattern') {
    if (profile === 'release-candidate' || intent === 'pilot') return 'ERROR'
    return 'WARN'
  }

  return 'ERROR'
}

function buildFinding(secret: NormalizedSecret, code: SecretFindingCode, profile: SecretProfile, intent: SecretIntent, message: string): SecretFinding {
  return {
    field: secret.field,
    severity: severityForFinding(code, profile, intent),
    code,
    message,
    masked: secret.masked ?? undefined,
    fingerprint: secret.fingerprint ?? undefined,
  }
}

function highestSeverity(findings: SecretFinding[]): SecretCheckSeverity {
  if (findings.some((item) => item.severity === 'ERROR')) return 'ERROR'
  if (findings.some((item) => item.severity === 'WARN')) return 'WARN'
  return 'PASS'
}

export function fingerprintSecret(value: string) {
  const normalized = String(value)
  if (normalized.length === 0) return ''
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12)
}

export function maskSecretForDisplay(value: string) {
  const normalized = String(value)
  if (normalized.length === 0) return ''
  const visibleStart = normalized.slice(0, Math.min(4, normalized.length))
  const visibleEnd = normalized.length > 8 ? normalized.slice(-4) : ''
  if (normalized.length <= 8) return `${visibleStart}…`
  return `${visibleStart}…${visibleEnd}`
}

export function evaluateSecretHygiene(input: EvaluateSecretHygieneInput): SecretCheckResult {
  const env = input.env ?? process.env
  const normalizedSecrets = SECRET_FIELDS.map((field) => normalizeSecretValue(getFieldRuntimeValue(field, env), field))
  const findingsByField = new Map<SecretFieldName, SecretFinding[]>(SECRET_FIELDS.map((field) => [field, []]))

  for (const secret of normalizedSecrets) {
    const bucket = findingsByField.get(secret.field)
    if (!bucket) continue

    if (!secret.present || secret.trimmed.length === 0) {
      bucket.push(
        buildFinding(
          secret,
          'missing',
          input.profile,
          input.intent,
          `${secret.field} chưa được set. Profile ${input.profile} với intent ${input.intent} không nên dùng secret trống.`,
        ),
      )
      continue
    }

    if (secret.raw !== secret.trimmed) {
      bucket.push(
        buildFinding(
          secret,
          'leading-trailing-whitespace',
          input.profile,
          input.intent,
          `${secret.field} có leading/trailing whitespace. Hãy trim sạch trước khi nạp vào runtime.`,
        ),
      )
    }

    if (/\s/.test(secret.trimmed)) {
      bucket.push(
        buildFinding(
          secret,
          'contains-whitespace',
          input.profile,
          input.intent,
          `${secret.field} chứa khoảng trắng hoặc newline; secret runtime phải là chuỗi liền mạch không whitespace.`,
        ),
      )
    }

    const placeholderLiteral = isPlaceholderLiteral(secret.trimmed)
    const placeholderPattern = !placeholderLiteral && looksLikePlaceholderPattern(secret.trimmed)

    if (placeholderLiteral) {
      bucket.push(
        buildFinding(
          secret,
          'placeholder-literal',
          input.profile,
          input.intent,
          `${secret.field} vẫn đang dùng literal placeholder/dev token.`,
        ),
      )
    } else if (placeholderPattern) {
      bucket.push(
        buildFinding(
          secret,
          'placeholder-pattern',
          input.profile,
          input.intent,
          `${secret.field} trông giống placeholder/dev secret pattern và không nên đi vào runtime nghiêm túc.`,
        ),
      )
    }

    if (!placeholderLiteral && !placeholderPattern && secret.trimmed.length < MIN_SECRET_LENGTH) {
      bucket.push(
        buildFinding(
          secret,
          'too-short',
          input.profile,
          input.intent,
          `${secret.field} quá ngắn (${secret.trimmed.length}/${MIN_SECRET_LENGTH}). Tối thiểu ${MIN_SECRET_LENGTH} ký tự.`,
        ),
      )
    }

    if (!placeholderLiteral && !placeholderPattern && looksLowEntropy(secret.trimmed)) {
      bucket.push(
        buildFinding(
          secret,
          'low-entropy-pattern',
          input.profile,
          input.intent,
          `${secret.field} có pattern yếu hoặc lặp quá rõ; hãy thay bằng secret ngẫu nhiên hơn.`,
        ),
      )
    }
  }

  const [internalSecret, captureSecret] = normalizedSecrets
  if (internalSecret.trimmed.length > 0 && internalSecret.trimmed === captureSecret.trimmed) {
    const duplicateMessage = 'API_INTERNAL_SERVICE_TOKEN và DEVICE_CAPTURE_DEFAULT_SECRET đang reuse cùng một giá trị; phải tách secret theo channel.'
    findingsByField.get('API_INTERNAL_SERVICE_TOKEN')?.push(
      buildFinding(internalSecret, 'duplicate-secret', input.profile, input.intent, duplicateMessage),
    )
    findingsByField.get('DEVICE_CAPTURE_DEFAULT_SECRET')?.push(
      buildFinding(captureSecret, 'duplicate-secret', input.profile, input.intent, duplicateMessage),
    )
  }

  const fields = Object.fromEntries(
    normalizedSecrets.map((secret) => {
      const findings = findingsByField.get(secret.field) ?? []
      const report: SecretFieldReport = {
        field: secret.field,
        present: secret.present,
        masked: secret.masked,
        fingerprint: secret.fingerprint,
        severity: highestSeverity(findings),
        findings,
      }
      return [secret.field, report]
    }),
  ) as Record<SecretFieldName, SecretFieldReport>

  const findings = SECRET_FIELDS.flatMap((field) => fields[field].findings)
  const summary: SecretCheckSummary = {
    passFields: SECRET_FIELDS.filter((field) => fields[field].severity === 'PASS').length,
    warnFields: SECRET_FIELDS.filter((field) => fields[field].severity === 'WARN').length,
    errorFields: SECRET_FIELDS.filter((field) => fields[field].severity === 'ERROR').length,
    findings: findings.length,
  }

  return {
    profile: input.profile,
    intent: input.intent,
    ok: summary.errorFields === 0,
    checkedAt: new Date().toISOString(),
    fields,
    findings,
    summary,
  }
}
