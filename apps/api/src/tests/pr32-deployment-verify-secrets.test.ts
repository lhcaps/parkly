import test from 'node:test'
import assert from 'node:assert/strict'

import { verifyDeploymentReadiness } from '../scripts/deployment-verify'

const strongInternal = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const strongCapture = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'

const reachable = async (host: string, port: number) => {
  if (`${host}:${port}` === '127.0.0.1:3306') return
  throw new Error('connection refused')
}

test('verify deployment giữ WARN cho demo smoke placeholder nhưng fail ở release-candidate bootstrap/pilot', async () => {
  const demoReport = await verifyDeploymentReadiness({
    env: {
      PARKLY_DEPLOYMENT_PROFILE: 'DEMO',
      DATABASE_ADMIN_HOST: '127.0.0.1',
      DATABASE_ADMIN_PORT: '3306',
      REDIS_REQUIRED: 'OFF',
      API_INTERNAL_SERVICE_TOKEN: '__SET_ME_INTERNAL_TOKEN__',
      DEVICE_CAPTURE_DEFAULT_SECRET: '__SET_ME_DEVICE_SECRET__',
      SMOKE_USERNAME: 'ops',
      SMOKE_PASSWORD: 'Parkly@123',
      SMOKE_SITE_CODE: 'SITE_HCM_01',
      SMOKE_SPOT_CODE: 'HCM-VIP-01',
      INTERNAL_PRESENCE_API_KEY: 'presence-api-key-demo-012345678901234567890123',
      INTERNAL_PRESENCE_HMAC_SECRET: 'presence-hmac-demo-012345678901234567890123',
    },
    intent: 'smoke',
    probePort: reachable,
    probePortAvailable: async () => {},
  })

  assert.equal(demoReport.ready, true)
  assert.ok(demoReport.checks.some((item) => item.id === 'internal-service-token' && item.status === 'WARN'))
  assert.ok(demoReport.checks.some((item) => item.id === 'device-capture-secret' && item.status === 'WARN'))
  assert.equal(demoReport.securitySecrets.fields.API_INTERNAL_SERVICE_TOKEN.severity, 'WARN')

  const rcBootstrap = await verifyDeploymentReadiness({
    env: {
      PARKLY_DEPLOYMENT_PROFILE: 'RELEASE_CANDIDATE',
      DATABASE_ADMIN_HOST: '127.0.0.1',
      DATABASE_ADMIN_PORT: '3306',
      REDIS_REQUIRED: 'OFF',
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_ACCESS_KEY: 'minio-access-key-not-empty',
      S3_SECRET_KEY: 'minio-secret-key-not-empty',
      S3_BUCKET_MEDIA: 'parkly-media',
      API_INTERNAL_SERVICE_TOKEN: '__SET_ME_INTERNAL_TOKEN__',
      DEVICE_CAPTURE_DEFAULT_SECRET: '__SET_ME_DEVICE_SECRET__',
    },
    intent: 'bootstrap',
    probePort: reachable,
    probePortAvailable: async () => {},
  })

  assert.equal(rcBootstrap.ready, false)
  assert.ok(rcBootstrap.checks.some((item) => item.id === 'internal-service-token' && item.status === 'ERROR'))
  assert.ok(rcBootstrap.checks.some((item) => item.id === 'device-capture-secret' && item.status === 'ERROR'))
  assert.equal(rcBootstrap.securitySecrets.ok, false)

  const rcPilot = await verifyDeploymentReadiness({
    env: {
      PARKLY_DEPLOYMENT_PROFILE: 'RELEASE_CANDIDATE',
      DATABASE_ADMIN_HOST: '127.0.0.1',
      DATABASE_ADMIN_PORT: '3306',
      REDIS_REQUIRED: 'OFF',
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_ACCESS_KEY: 'minio-access-key-not-empty',
      S3_SECRET_KEY: 'minio-secret-key-not-empty',
      S3_BUCKET_MEDIA: 'parkly-media',
      API_INTERNAL_SERVICE_TOKEN: strongInternal,
      DEVICE_CAPTURE_DEFAULT_SECRET: strongInternal,
    },
    intent: 'pilot',
    probePort: reachable,
    probePortAvailable: async () => {},
  })

  assert.equal(rcPilot.ready, false)
  assert.ok(rcPilot.checks.some((item) => item.id === 'internal-service-token' && item.status === 'ERROR'))
  assert.ok(rcPilot.checks.some((item) => item.id === 'device-capture-secret' && item.status === 'ERROR'))
})

test('verify deployment pass khi secret hygiene sạch và report có section securitySecrets', async () => {
  const report = await verifyDeploymentReadiness({
    env: {
      PARKLY_DEPLOYMENT_PROFILE: 'DEMO',
      DATABASE_ADMIN_HOST: '127.0.0.1',
      DATABASE_ADMIN_PORT: '3306',
      REDIS_REQUIRED: 'OFF',
      API_INTERNAL_SERVICE_TOKEN: strongInternal,
      DEVICE_CAPTURE_DEFAULT_SECRET: strongCapture,
    },
    intent: 'bootstrap',
    probePort: reachable,
    probePortAvailable: async () => {},
  })

  assert.equal(report.ready, true)
  assert.equal(report.securitySecrets.ok, true)
  assert.equal(report.securitySecrets.summary.errorFields, 0)
})
