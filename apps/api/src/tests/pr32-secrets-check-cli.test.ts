import test from 'node:test'
import assert from 'node:assert/strict'

import { parseSecretsCheckArgs, runSecretsCheck } from '../scripts/secrets-check'

const strongInternal = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const strongCapture = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'

test('secrets:check parse/run output và exit code đúng', () => {
  const cleanText = runSecretsCheck(parseSecretsCheckArgs(['--profile', 'release-candidate', '--intent', 'bootstrap']), {
    API_INTERNAL_SERVICE_TOKEN: strongInternal,
    DEVICE_CAPTURE_DEFAULT_SECRET: strongCapture,
  })
  assert.equal(cleanText.exitCode, 0)
  assert.match(cleanText.output, /summary: ok=true/)
  assert.doesNotMatch(cleanText.output, new RegExp(strongInternal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  const cleanJson = runSecretsCheck(parseSecretsCheckArgs(['--profile', 'release-candidate', '--intent', 'bootstrap', '--format', 'json']), {
    API_INTERNAL_SERVICE_TOKEN: strongInternal,
    DEVICE_CAPTURE_DEFAULT_SECRET: strongCapture,
  })
  assert.equal(cleanJson.exitCode, 0)
  const payload = JSON.parse(cleanJson.output)
  assert.equal(payload.ok, true)
  assert.equal(payload.profile, 'release-candidate')

  const demoWarn = runSecretsCheck(parseSecretsCheckArgs(['--profile', 'demo', '--intent', 'smoke']), {
    API_INTERNAL_SERVICE_TOKEN: '__SET_ME_INTERNAL_TOKEN__',
    DEVICE_CAPTURE_DEFAULT_SECRET: '__SET_ME_DEVICE_SECRET__',
  })
  assert.equal(demoWarn.exitCode, 0)
  assert.match(demoWarn.output, /WARN/)

  const rcFail = runSecretsCheck(parseSecretsCheckArgs(['--profile', 'release-candidate', '--intent', 'bootstrap']), {
    API_INTERNAL_SERVICE_TOKEN: '__SET_ME_INTERNAL_TOKEN__',
    DEVICE_CAPTURE_DEFAULT_SECRET: '__SET_ME_DEVICE_SECRET__',
  })
  assert.equal(rcFail.exitCode, 1)
  assert.match(rcFail.output, /placeholder/i)
})

test('secrets:check reject duplicate secret và invalid profile', () => {
  const duplicate = runSecretsCheck(parseSecretsCheckArgs(['--profile', 'demo', '--intent', 'bootstrap']), {
    API_INTERNAL_SERVICE_TOKEN: strongInternal,
    DEVICE_CAPTURE_DEFAULT_SECRET: strongInternal,
  })
  assert.equal(duplicate.exitCode, 1)
  assert.match(duplicate.output, /duplicate-secret/i)

  assert.throws(
    () => parseSecretsCheckArgs(['--profile', 'nope', '--intent', 'bootstrap']),
    (error: unknown) => {
      assert.match(String((error as Error).message), /--profile không hợp lệ/i)
      assert.equal(Number((error as Error & { exitCode?: number }).exitCode), 2)
      return true
    },
  )
})
