import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  applyDeploymentProfileEnv,
  buildComposeInvocation,
  buildDeploymentPlan,
  resolveDeploymentProfile,
} from '../scripts/deployment-profiles'
import { verifyDeploymentReadiness } from '../scripts/deployment-verify'

import { resolveCommandInvocation, resolvePnpmInvocation } from '../scripts/_script-runtime'

test('deployment profile tách local-dev, demo và release-candidate với media/compose rõ ràng', () => {
  const local = resolveDeploymentProfile({ PARKLY_DEPLOYMENT_PROFILE: 'LOCAL_DEV' })
  const demo = resolveDeploymentProfile({ PARKLY_DEPLOYMENT_PROFILE: 'DEMO' })
  const rc = resolveDeploymentProfile({ PARKLY_DEPLOYMENT_PROFILE: 'RELEASE_CANDIDATE' })

  assert.equal(local.mediaDriver, 'LOCAL')
  assert.deepEqual(local.composeServices, ['mysql', 'redis'])
  assert.equal(demo.mediaDriver, 'LOCAL')
  assert.equal(demo.smokeMediaDriver, 'LOCAL')
  assert.deepEqual(buildDeploymentPlan(demo, 'bootstrap'), ['db:migrate', 'db:validate', 'prisma:generate', 'release:reset'])
  assert.equal(rc.mediaDriver, 'MINIO')
  assert.deepEqual(rc.composeServices, ['mysql', 'redis', 'minio', 'minio-init'])
  assert.deepEqual(buildComposeInvocation(rc).args, [
    'compose',
    '-f',
    '../../infra/docker/docker-compose.local.yml',
    '--profile',
    'storage',
  ])

  const contaminatedDemo = applyDeploymentProfileEnv({ PARKLY_DEPLOYMENT_PROFILE: 'DEMO', PARKLY_MEDIA_PROFILE: 'MINIO' })
  assert.equal(contaminatedDemo.MEDIA_STORAGE_DRIVER, 'LOCAL')
  assert.equal(contaminatedDemo.SMOKE_MEDIA_DRIVER, 'LOCAL')

  const overridden = applyDeploymentProfileEnv(
    { PARKLY_DEPLOYMENT_PROFILE: 'DEMO', PARKLY_MEDIA_PROFILE: 'MINIO' },
    null,
    { allowMediaOverride: true },
  )
  assert.equal(overridden.MEDIA_STORAGE_DRIVER, 'MINIO')
  assert.equal(overridden.SMOKE_MEDIA_DRIVER, 'MINIO')
})

test('verify deployment fail-fast với message hữu ích khi dependency hoặc env còn thiếu', async () => {
  const reachable = async (host: string, port: number) => {
    if (`${host}:${port}` === '127.0.0.1:3306') return
    if (`${host}:${port}` === '127.0.0.1:6379') return
    throw new Error('connection refused')
  }
  const freePort = async () => {
    throw new Error('EADDRINUSE')
  }

  const smokeMissingSecrets = await verifyDeploymentReadiness({
    env: {
      PARKLY_DEPLOYMENT_PROFILE: 'DEMO',
      DATABASE_ADMIN_HOST: '127.0.0.1',
      DATABASE_ADMIN_PORT: '3306',
      REDIS_URL: 'redis://127.0.0.1:6379',
      REDIS_REQUIRED: 'ON',
      API_INTERNAL_SERVICE_TOKEN: 'internal_service_dev_token_change_me',
      DEVICE_CAPTURE_DEFAULT_SECRET: 'change_me_capture_secret',
      SMOKE_USERNAME: 'ops',
      SMOKE_PASSWORD: 'Parkly@123',
      SMOKE_SITE_CODE: 'SITE_HCM_01',
      SMOKE_SPOT_CODE: 'HCM-VIP-01',
    },
    intent: 'smoke',
    probePort: reachable,
    probePortAvailable: freePort,
  })

  assert.equal(smokeMissingSecrets.ready, false)
  assert.ok(smokeMissingSecrets.checks.some((item) => item.id === 'smoke-env' && item.status === 'ERROR'))
  assert.ok(smokeMissingSecrets.checks.some((item) => item.id === 'internal-service-token' && item.status === 'WARN'))
  assert.ok(smokeMissingSecrets.checks.some((item) => item.id === 'device-capture-secret' && item.status === 'WARN'))

  const devPortBusy = await verifyDeploymentReadiness({
    env: {
      PARKLY_DEPLOYMENT_PROFILE: 'DEMO',
      DATABASE_ADMIN_HOST: '127.0.0.1',
      DATABASE_ADMIN_PORT: '3306',
      REDIS_URL: 'redis://127.0.0.1:6379',
      REDIS_REQUIRED: 'ON',
      API_HOST: '127.0.0.1',
      API_PORT: '3000',
      API_INTERNAL_SERVICE_TOKEN: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      DEVICE_CAPTURE_DEFAULT_SECRET: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    },
    intent: 'dev',
    probePort: reachable,
    probePortAvailable: freePort,
  })

  assert.equal(devPortBusy.ready, false)
  assert.ok(devPortBusy.checks.some((item) => item.id === 'api-port' && item.status === 'ERROR'))

  const staleMinioOnDemo = await verifyDeploymentReadiness({
    env: {
      PARKLY_DEPLOYMENT_PROFILE: 'DEMO',
      MEDIA_STORAGE_DRIVER: 'MINIO',
      DATABASE_ADMIN_HOST: '127.0.0.1',
      DATABASE_ADMIN_PORT: '3306',
      REDIS_URL: 'redis://127.0.0.1:6379',
      REDIS_REQUIRED: 'ON',
      API_INTERNAL_SERVICE_TOKEN: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      DEVICE_CAPTURE_DEFAULT_SECRET: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    },
    intent: 'bootstrap',
    probePort: reachable,
    probePortAvailable: async () => {},
  })

  assert.equal(staleMinioOnDemo.ready, true)
  assert.ok(staleMinioOnDemo.checks.some((item) => item.id === 'profile-media-drift' && item.status === 'WARN'))
  assert.ok(staleMinioOnDemo.checks.some((item) => item.id === 'media-driver' && item.status === 'OK'))

  const rcMinioMissing = await verifyDeploymentReadiness({
    env: {
      PARKLY_DEPLOYMENT_PROFILE: 'RELEASE_CANDIDATE',
      DATABASE_ADMIN_HOST: '127.0.0.1',
      DATABASE_ADMIN_PORT: '3306',
      REDIS_URL: 'redis://127.0.0.1:6379',
      REDIS_REQUIRED: 'ON',
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      API_INTERNAL_SERVICE_TOKEN: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      DEVICE_CAPTURE_DEFAULT_SECRET: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    },
    intent: 'bootstrap',
    probePort: reachable,
    probePortAvailable: async () => {},
  })

  assert.equal(rcMinioMissing.ready, false)
  assert.ok(rcMinioMissing.checks.some((item) => item.id === 'minio-endpoint' && item.status === 'ERROR'))
  assert.ok(rcMinioMissing.checks.some((item) => item.id === 'minio-creds' && item.status === 'ERROR'))
})

test('source regression: compose packaging, launcher scripts, env và runbook đã chốt deployment profiles', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'package.json'), 'utf8'))
  const envExample = fs.readFileSync(path.join(repoRoot, 'apps', 'api', '.env.example'), 'utf8')
  const runbook = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'docs', 'RUNBOOK.md'), 'utf8')
  const compose = fs.readFileSync(path.join(repoRoot, 'infra', 'docker', 'docker-compose.local.yml'), 'utf8')
  const launcherPs1 = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'scripts', 'launch-backend.ps1'), 'utf8')
  const launcherSh = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'scripts', 'launch-backend.sh'), 'utf8')

  assert.equal(packageJson.scripts['compose:up:demo'], 'docker compose -f ../../infra/docker/docker-compose.local.yml up -d mysql redis')
  assert.equal(packageJson.scripts['bootstrap:rc'], 'tsx src/scripts/deployment-bootstrap.ts --profile release-candidate --compose-up')
  assert.equal(packageJson.scripts['verify:deployment'], 'tsx src/scripts/deployment-verify.ts')
  assert.equal(packageJson.scripts['test:pr29'], 'node --import tsx --test src/tests/pr29-deployment-profile.test.ts')
  assert.match(envExample, /PARKLY_DEPLOYMENT_PROFILE=DEMO/)
  assert.match(envExample, /PARKLY_MEDIA_PROFILE=LOCAL/)
  assert.match(envExample, /PARKLY_ALLOW_MEDIA_OVERRIDE=OFF/)
  assert.match(envExample, /COMPOSE_MINIO_API_PORT=9000/)
  assert.match(envExample, /MEDIA_STORAGE_DRIVER=LOCAL/)
  assert.match(compose, /services:\n  mysql:/)
  assert.match(compose, /profiles: \["storage"\]/)
  assert.match(compose, /bootstrap\.sql:\/docker-entrypoint-initdb\.d\/001-bootstrap\.sql/)
  assert.match(runbook, /BE-PR-23 chốt 3 profile triển khai đủ ít nhưng rõ/)
  assert.match(runbook, /PARKLY_ALLOW_MEDIA_OVERRIDE=ON/)
  assert.match(runbook, /Docker engine chưa chạy/)
  assert.match(runbook, /verify:deployment -- --profile demo --intent bootstrap/)
  assert.match(runbook, /bootstrap:rc/)
  assert.match(runbook, /MEDIA_STORAGE_DRIVER=MINIO/)
  assert.match(launcherPs1, /launch-backend\.ps1/)
  assert.match(launcherPs1, /verify:deployment/)
  assert.match(launcherSh, /launch-backend\.sh/)
  assert.match(launcherSh, /compose:up:rc/)
})


test('script runtime bọc pnpm đúng kiểu cross-platform để smoke wrapper không spawn EINVAL trên Windows', () => {
  const source = fs.readFileSync(path.join(path.resolve(__dirname, '..', '..', '..', '..'), 'apps', 'api', 'src', 'scripts', '_script-runtime.ts'), 'utf8')
  assert.match(source, /resolveCommandInvocation/)
  assert.match(source, /resolvePnpmInvocation/)
  assert.match(source, /npm_execpath/)
  assert.match(source, /process\.execPath/)

  const invocation = resolveCommandInvocation('pnpm', ['smoke:bundle'])
  if (process.platform === 'win32') {
    assert.match(invocation.file, /cmd\.exe$/i)
    assert.deepEqual(invocation.args.slice(0, 3), ['/d', '/s', '/c'])
    assert.match(invocation.args[3] ?? '', /pnpm\.cmd/)
    assert.match(invocation.args[3] ?? '', /smoke:bundle/)
  } else {
    assert.equal(invocation.file, 'pnpm')
    assert.deepEqual(invocation.args, ['smoke:bundle'])
  }

  const pnpmViaNode = resolvePnpmInvocation(['smoke:bundle'], {
    npm_execpath: '/repo/node_modules/pnpm/bin/pnpm.cjs',
  })
  assert.equal(pnpmViaNode.file, process.execPath)
  assert.deepEqual(pnpmViaNode.args, ['/repo/node_modules/pnpm/bin/pnpm.cjs', 'smoke:bundle'])
})
