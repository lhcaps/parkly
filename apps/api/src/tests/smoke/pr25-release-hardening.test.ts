import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  buildBootstrapSteps,
  buildReleaseChecklistText,
  buildResetSteps,
  buildSmokePresenceBody,
  buildSmokeSteps,
  DEFAULT_RELEASE_FIXTURE,
  getReleaseFixtureFromEnv,
} from '../../scripts/release-bundle'

function resolveApiRoot() {
  const cwd = process.cwd()
  const candidates = [
    path.resolve(cwd),
    path.resolve(cwd, 'apps/api'),
    path.resolve(__dirname, '../../..'),
  ]
  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'package.json')) && fs.existsSync(path.join(candidate, 'src')))
  if (!found) throw new Error('Không resolve được apps/api root cho PR25 test')
  return found
}

const apiRoot = resolveApiRoot()
const repoRoot = path.resolve(apiRoot, '../..')

function readApiFile(relPath: string) {
  return fs.readFileSync(path.join(apiRoot, relPath), 'utf8')
}

test('bootstrap + reset plan chốt rõ thứ tự migrate/validate/generate/grant/seed', () => {
  const bootstrap = buildBootstrapSteps()
  const reset = buildResetSteps()

  assert.deepEqual(
    bootstrap.map((step) => step.id),
    ['platform-up', 'db-migrate', 'db-validate', 'prisma-generate', 'grant-app', 'seed-min'],
  )
  assert.equal(bootstrap.every((step) => step.required), true)
  assert.deepEqual(
    reset.map((step) => step.id),
    ['grant-app', 'seed-reset', 'seed-min'],
  )
  assert.match(buildReleaseChecklistText(DEFAULT_RELEASE_FIXTURE), /pnpm --dir apps\/api db:migrate/)
  assert.match(buildReleaseChecklistText(DEFAULT_RELEASE_FIXTURE), /pnpm --dir apps\/api db:seed:reset/)
})

test('smoke bundle coverage đủ auth -> media -> intake -> reconciliation -> incident -> audit', () => {
  const steps = buildSmokeSteps(DEFAULT_RELEASE_FIXTURE)
  assert.deepEqual(
    steps.map((step) => step.id),
    [
      'smoke-login',
      'smoke-me',
      'smoke-dashboard',
      'smoke-media',
      'smoke-presence-intake',
      'smoke-reconciliation',
      'smoke-incidents',
      'smoke-audit',
    ],
  )

  const body = buildSmokePresenceBody(DEFAULT_RELEASE_FIXTURE)
  assert.equal(body.zoneCode, 'VIP_A')
  assert.equal(body.spotCode, 'HCM-VIP-01')
  assert.equal(body.plateCompact, '51B67890')
  assert.match(String(body.snapshotObjectKey), /smoke\/SITE_HCM_01\/HCM-VIP-01\//)
})

test('seed fixture release giữ site/zone/spot/user mặc định ổn định và override được từ env', () => {
  assert.deepEqual(DEFAULT_RELEASE_FIXTURE, {
    username: 'ops',
    password: 'Parkly@123',
    role: 'OPS',
    siteCode: 'SITE_HCM_01',
    zoneCode: 'VIP_A',
    spotCode: 'HCM-VIP-01',
    mismatchPlateCompact: '51B67890',
    notes: DEFAULT_RELEASE_FIXTURE.notes,
  })

  const overridden = getReleaseFixtureFromEnv({
    SMOKE_USERNAME: 'admin',
    SMOKE_PASSWORD: 'Secret@1',
    SMOKE_ROLE: 'admin',
    DEMO_SITE_CODE: 'SITE_DN_01',
    SMOKE_ZONE_CODE: 'ZONE_X',
    SMOKE_SPOT_CODE: 'X-01',
    SMOKE_MISMATCH_PLATE: '43a-999.99',
  })

  assert.equal(overridden.username, 'admin')
  assert.equal(overridden.password, 'Secret@1')
  assert.equal(overridden.role, 'ADMIN')
  assert.equal(overridden.siteCode, 'SITE_DN_01')
  assert.equal(overridden.zoneCode, 'ZONE_X')
  assert.equal(overridden.spotCode, 'X-01')
  assert.equal(overridden.mismatchPlateCompact, '43A99999')
})

test('source regression: env example, runbook, scripts và package scripts đủ cho bootstrap/reset/smoke trên máy sạch', () => {
  const envExample = readApiFile('.env.example')
  const packageJson = JSON.parse(readApiFile('package.json')) as { scripts?: Record<string, string> }
  const runbook = readApiFile('docs/RUNBOOK.md')
  const smokeScript = readApiFile('src/scripts/smoke-backend.ts')
  const resetScript = readApiFile('src/scripts/release-reset.ts')
  const rootRunbook = fs.readFileSync(path.join(repoRoot, 'docs/RUNBOOK.md'), 'utf8')

  assert.match(envExample, /SMOKE_USERNAME=ops/)
  assert.match(envExample, /PARKLY_APP_PROFILE=MVP/)
  assert.match(envExample, /SMOKE_SITE_CODE=SITE_HCM_01/)
  assert.match(envExample, /SMOKE_SPOT_CODE=HCM-VIP-01/)
  assert.equal(packageJson.scripts?.['release:reset'], 'tsx src/scripts/release-reset.ts')
  assert.equal(packageJson.scripts?.['smoke:bundle'], 'tsx src/scripts/smoke-backend.ts')
  assert.equal(packageJson.scripts?.['test:pr25'], 'node --import tsx --test src/tests/smoke/pr25-release-hardening.test.ts')

  assert.match(runbook, /pnpm --dir apps\/api db:migrate/)
  assert.match(runbook, /pnpm --dir apps\/api release:reset/)
  assert.match(runbook, /pnpm --dir apps\/api smoke:bundle/)
  assert.match(runbook, /login -> me -> dashboard -> media -> presence -> reconciliation -> incident -> audit/)
  assert.match(runbook, /SITE_HCM_01/)
  assert.match(runbook, /HCM-VIP-01/)

  assert.match(rootRunbook, /PR18/)
  assert.match(rootRunbook, /smoke:bundle/)
  assert.match(rootRunbook, /release:reset/)

  assert.match(smokeScript, /applyParkingAppGrants/)
  assert.match(smokeScript, /RELEASE_GRANT_PROFILE/)
  assert.match(smokeScript, /\/auth\/login/)
  assert.match(smokeScript, /\/media\/upload/)
  assert.match(smokeScript, /\/internal\/presence-events/)
  assert.match(smokeScript, /\/ops\/spot-occupancy\//)
  assert.match(smokeScript, /\/ops\/incidents\//)
  assert.match(smokeScript, /\/ops\/audit/)
  assert.match(resetScript, /applyParkingAppGrants/)
  assert.match(resetScript, /RELEASE_GRANT_PROFILE/)
  assert.match(resetScript, /db\/seed\/reset_seed\.sql/)
  assert.match(resetScript, /db\/seed\/seed_min\.sql/)
})
