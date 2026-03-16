import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SCRYPT_KEY_LENGTH = 64
const HASH_PREFIX = 'scrypt'

function toBase64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url')
}

function fromBase64Url(input: string) {
  return Buffer.from(String(input ?? ''), 'base64url')
}

export function hashPassword(password: string, opts: { salt?: string } = {}) {
  const normalized = String(password ?? '')
  if (!normalized) throw new Error('Password không được rỗng')

  const salt = opts.salt ?? toBase64Url(randomBytes(16))
  const derived = scryptSync(normalized, salt, SCRYPT_KEY_LENGTH)
  return `${HASH_PREFIX}$${salt}$${toBase64Url(derived)}`
}

export function verifyPassword(password: string, encodedHash: string) {
  const normalizedPassword = String(password ?? '')
  const normalizedHash = String(encodedHash ?? '').trim()
  if (!normalizedPassword || !normalizedHash) return false

  const [prefix, salt, digest] = normalizedHash.split('$')
  if (prefix !== HASH_PREFIX || !salt || !digest) return false

  const expected = fromBase64Url(digest)
  const actual = scryptSync(normalizedPassword, salt, expected.length || SCRYPT_KEY_LENGTH)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
