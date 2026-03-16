import test from 'node:test'
import assert from 'node:assert/strict'

import { evaluateSecretHygiene } from '../lib/security/secret-hygiene'

const strongInternal = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const strongCapture = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'

test('secret hygiene pass khi hai secret đủ dài, distinct và sạch', () => {
  const report = evaluateSecretHygiene({
    env: {
      API_INTERNAL_SERVICE_TOKEN: strongInternal,
      DEVICE_CAPTURE_DEFAULT_SECRET: strongCapture,
    },
    profile: 'release-candidate',
    intent: 'bootstrap',
  })

  assert.equal(report.ok, true)
  assert.equal(report.summary.errorFields, 0)
  assert.equal(report.fields.API_INTERNAL_SERVICE_TOKEN.severity, 'PASS')
  assert.equal(report.fields.DEVICE_CAPTURE_DEFAULT_SECRET.severity, 'PASS')
})

test('secret hygiene warn cho missing/placeholder ở demo smoke nhưng fail hard ở release-candidate bootstrap', () => {
  const demoReport = evaluateSecretHygiene({
    env: {
      API_INTERNAL_SERVICE_TOKEN: '__SET_ME_INTERNAL_TOKEN__',
      DEVICE_CAPTURE_DEFAULT_SECRET: '__SET_ME_DEVICE_SECRET__',
    },
    profile: 'demo',
    intent: 'smoke',
  })
  assert.equal(demoReport.ok, true)
  assert.equal(demoReport.fields.API_INTERNAL_SERVICE_TOKEN.severity, 'WARN')
  assert.equal(demoReport.fields.DEVICE_CAPTURE_DEFAULT_SECRET.severity, 'WARN')

  const rcReport = evaluateSecretHygiene({
    env: {
      API_INTERNAL_SERVICE_TOKEN: '__SET_ME_INTERNAL_TOKEN__',
      DEVICE_CAPTURE_DEFAULT_SECRET: '__SET_ME_DEVICE_SECRET__',
    },
    profile: 'release-candidate',
    intent: 'bootstrap',
  })
  assert.equal(rcReport.ok, false)
  assert.equal(rcReport.fields.API_INTERNAL_SERVICE_TOKEN.severity, 'ERROR')
  assert.equal(rcReport.fields.DEVICE_CAPTURE_DEFAULT_SECRET.severity, 'ERROR')
})

test('secret hygiene reject secret ngắn, trùng nhau, whitespace và pattern yếu', () => {
  const report = evaluateSecretHygiene({
    env: {
      API_INTERNAL_SERVICE_TOKEN: ' same-secret-same-secret-same-secret ',
      DEVICE_CAPTURE_DEFAULT_SECRET: 'same-secret-same-secret-same-secret',
    },
    profile: 'demo',
    intent: 'bootstrap',
  })

  assert.equal(report.ok, false)
  assert.match(report.findings.map((item) => item.code).join('|'), /leading-trailing-whitespace/)
  assert.match(report.findings.map((item) => item.code).join('|'), /duplicate-secret/)

  const shortWeak = evaluateSecretHygiene({
    env: {
      API_INTERNAL_SERVICE_TOKEN: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      DEVICE_CAPTURE_DEFAULT_SECRET: 'short-secret',
    },
    profile: 'demo',
    intent: 'bootstrap',
  })

  assert.equal(shortWeak.ok, false)
  assert.match(shortWeak.findings.map((item) => item.code).join('|'), /low-entropy-pattern/)
  assert.match(shortWeak.findings.map((item) => item.code).join('|'), /too-short/)
})

test('finding message không làm lộ raw secret', () => {
  const leakedValue = 'leakme-leakme-leakme-leakme-leakme'
  const report = evaluateSecretHygiene({
    env: {
      API_INTERNAL_SERVICE_TOKEN: leakedValue,
      DEVICE_CAPTURE_DEFAULT_SECRET: strongCapture,
    },
    profile: 'demo',
    intent: 'bootstrap',
  })

  for (const finding of report.findings) {
    assert.doesNotMatch(finding.message, new RegExp(leakedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})
