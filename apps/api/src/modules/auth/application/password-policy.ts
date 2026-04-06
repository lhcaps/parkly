export type PasswordPolicy = {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireDigit: boolean
  requireSpecial: boolean
}

export type PasswordPolicyViolationCode =
  | 'PASSWORD_TOO_SHORT'
  | 'PASSWORD_MISSING_UPPERCASE'
  | 'PASSWORD_MISSING_LOWERCASE'
  | 'PASSWORD_MISSING_DIGIT'
  | 'PASSWORD_MISSING_SPECIAL'

export type PasswordPolicyViolation = {
  code: PasswordPolicyViolationCode
  message: string
}

export type PasswordPolicyResult = {
  ok: boolean
  violations: PasswordPolicyViolation[]
}

const UPPERCASE_RE = /[A-Z]/
const LOWERCASE_RE = /[a-z]/
const DIGIT_RE = /\d/
const SPECIAL_RE = /[^A-Za-z0-9]/

export function validatePasswordPolicy(password: string, policy: PasswordPolicy): PasswordPolicyResult {
  const normalized = String(password ?? '')
  const violations: PasswordPolicyViolation[] = []

  if (normalized.length < Math.max(1, Math.trunc(policy.minLength || 0))) {
    violations.push({
      code: 'PASSWORD_TOO_SHORT',
      message: `Mật khẩu phải có tối thiểu ${Math.max(1, Math.trunc(policy.minLength || 0))} ký tự`,
    })
  }
  if (policy.requireUppercase && !UPPERCASE_RE.test(normalized)) {
    violations.push({ code: 'PASSWORD_MISSING_UPPERCASE', message: 'Mật khẩu phải có ít nhất 1 ký tự in hoa' })
  }
  if (policy.requireLowercase && !LOWERCASE_RE.test(normalized)) {
    violations.push({ code: 'PASSWORD_MISSING_LOWERCASE', message: 'Mật khẩu phải có ít nhất 1 ký tự in thường' })
  }
  if (policy.requireDigit && !DIGIT_RE.test(normalized)) {
    violations.push({ code: 'PASSWORD_MISSING_DIGIT', message: 'Mật khẩu phải có ít nhất 1 chữ số' })
  }
  if (policy.requireSpecial && !SPECIAL_RE.test(normalized)) {
    violations.push({ code: 'PASSWORD_MISSING_SPECIAL', message: 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt' })
  }

  return {
    ok: violations.length === 0,
    violations,
  }
}

export function describePasswordPolicy(policy: PasswordPolicy) {
  const clauses = [`min ${Math.max(1, Math.trunc(policy.minLength || 0))} ký tự`]
  if (policy.requireUppercase) clauses.push('ít nhất 1 chữ in hoa')
  if (policy.requireLowercase) clauses.push('ít nhất 1 chữ in thường')
  if (policy.requireDigit) clauses.push('ít nhất 1 chữ số')
  if (policy.requireSpecial) clauses.push('ít nhất 1 ký tự đặc biệt')
  return clauses.join(', ')
}
