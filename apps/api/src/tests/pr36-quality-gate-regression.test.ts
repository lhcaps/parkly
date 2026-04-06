import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { CreateDeviceBodySchema, CreateLaneBodySchema } from '../modules/topology/interfaces/topology-admin.schemas'

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')

test('topology admin create payloads accept siteCode while keeping numeric siteId compatibility', () => {
  const laneByCode = CreateLaneBodySchema.parse({
    siteCode: 'SITE_HCM_01',
    gateCode: 'GATE_01',
    laneCode: 'L01',
    name: 'Main Entry',
    direction: 'ENTRY',
  })
  assert.equal(laneByCode.siteCode, 'SITE_HCM_01')

  const laneById = CreateLaneBodySchema.parse({
    siteId: '1',
    gateCode: 'GATE_01',
    laneCode: 'L01',
    name: 'Main Entry',
    direction: 'ENTRY',
  })
  assert.equal(laneById.siteId, '1')

  const deviceByCode = CreateDeviceBodySchema.parse({
    siteCode: 'SITE_HCM_01',
    deviceCode: 'CAM_01',
    deviceType: 'CAMERA_ALPR',
    direction: 'ENTRY',
  })
  assert.equal(deviceByCode.siteCode, 'SITE_HCM_01')

  assert.throws(() => CreateLaneBodySchema.parse({
    gateCode: 'GATE_01',
    laneCode: 'L01',
    name: 'Missing site',
    direction: 'ENTRY',
  }))
})

test('quality gate automation assets are wired into package scripts and infra', () => {
  const rootPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
  const apiPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'package.json'), 'utf8'))
  const webPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps', 'web', 'package.json'), 'utf8'))
  const compose = fs.readFileSync(path.join(repoRoot, 'infra', 'docker', 'docker-compose.local.yml'), 'utf8')
  const qualityGateScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'run-quality-gate.mjs'), 'utf8')
  const nodeTestRunner = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'scripts', 'run-node-tests.mjs'), 'utf8')

  assert.equal(rootPackage.scripts['test:ci'], 'node ./scripts/run-quality-gate.mjs --mode ci')
  assert.equal(rootPackage.scripts['test:full'], 'node ./scripts/run-quality-gate.mjs --mode full')
  assert.equal(apiPackage.scripts['test:node'], 'node ./scripts/run-node-tests.mjs')
  assert.equal(apiPackage.scripts['compose:up:observability'], 'docker compose -f ../../infra/docker/docker-compose.local.yml --profile observability up -d prometheus alertmanager grafana')
  assert.equal(webPackage.scripts['test:unit:coverage'], 'vitest run --coverage')
  assert.match(compose, /profiles: \["observability"\]/)
  assert.doesNotMatch(compose, /container_name:/)
  assert.match(qualityGateScript, /Bootstrap API integration environment/)
  assert.match(qualityGateScript, /QUALITY_GATE_BOOTSTRAP/)
  assert.match(nodeTestRunner, /NODE_TEST_FILE_TIMEOUT_MS/)
  assert.match(nodeTestRunner, /Timed out after/)

  const requiredFiles = [
    path.join(repoRoot, 'scripts', 'run-quality-gate.mjs'),
    path.join(repoRoot, 'apps', 'api', 'scripts', 'run-node-tests.mjs'),
    path.join(repoRoot, 'infra', 'observability', 'prometheus', 'prometheus.yml'),
    path.join(repoRoot, 'infra', 'observability', 'prometheus', 'alerts', 'parkly.rules.yml'),
    path.join(repoRoot, 'infra', 'observability', 'alertmanager', 'alertmanager.yml'),
    path.join(repoRoot, 'infra', 'observability', 'grafana', 'provisioning', 'datasources', 'default.yml'),
    path.join(repoRoot, 'infra', 'observability', 'grafana', 'provisioning', 'dashboards', 'default.yml'),
    path.join(repoRoot, 'apps', 'api', 'docs', 'grafana-dashboards', 'operations.json'),
    path.join(repoRoot, 'apps', 'api', 'docs', 'grafana-dashboards', 'infrastructure.json'),
    path.join(repoRoot, 'apps', 'api', 'docs', 'grafana-dashboards', 'business.json'),
  ]

  for (const requiredFile of requiredFiles) {
    assert.ok(fs.existsSync(requiredFile), `Missing ${requiredFile}`)
  }
})

test('config source no longer ships query-token auth or default legacy role tokens', () => {
  const configSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'server', 'config.ts'), 'utf8')
  const envExample = fs.readFileSync(path.join(repoRoot, 'apps', 'api', '.env.example'), 'utf8')

  assert.doesNotMatch(configSource, /API_ALLOW_QUERY_TOKEN/)
  assert.doesNotMatch(configSource, /admin_dev_token_change_me/)
  assert.doesNotMatch(configSource, /ops_dev_token_change_me/)
  assert.doesNotMatch(configSource, /guard_dev_token_change_me/)
  assert.doesNotMatch(configSource, /worker_dev_token_change_me/)
  assert.doesNotMatch(envExample, /API_ALLOW_QUERY_TOKEN=/)
})
