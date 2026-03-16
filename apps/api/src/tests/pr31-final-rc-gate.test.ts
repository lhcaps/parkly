import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { DEFAULT_RELEASE_FIXTURE } from '../scripts/release-bundle'
import { parseSmokeBundleSummary, summarizeFixtureDrift } from '../scripts/rc1-runtime'
import { performFixtureCheck } from '../scripts/rc1-fixture-check'

test('parse smoke bundle summary đọc được role/site/spot/incident/audit từ output smoke hiện tại', () => {
  const sample = `[smoke:bundle] OK {\n  baseUrl: 'http://127.0.0.1:62232/api',\n  role: 'OPS',\n  siteCode: 'SITE_HCM_01',\n  spotCode: 'HCM-VIP-01',\n  incidentId: '8',\n  auditRows: 8,\n  correlationRoot: ''\n}`

  const parsed = parseSmokeBundleSummary(sample)
  assert.deepEqual(parsed, {
    role: 'OPS',
    siteCode: 'SITE_HCM_01',
    spotCode: 'HCM-VIP-01',
    incidentId: '8',
    auditRows: 8,
  })
})

test('repeat smoke drift summary fail khi fixture trọng yếu bị lệch', () => {
  const summary = summarizeFixtureDrift(
    [
      {
        runNumber: 1,
        reset: { id: 'reset', command: 'pnpm release:reset', ok: true, exitCode: 0, durationMs: 1, stdout: '', stderr: '' },
        smoke: { id: 'smoke', command: 'pnpm smoke:bundle', ok: true, exitCode: 0, durationMs: 1, stdout: '', stderr: '' },
        parsed: {
          role: 'OPS',
          siteCode: 'SITE_HCM_01',
          spotCode: 'HCM-VIP-99',
          incidentId: '11',
          auditRows: 4,
        },
      },
    ],
    {
      SMOKE_ROLE: DEFAULT_RELEASE_FIXTURE.role,
      SMOKE_SITE_CODE: DEFAULT_RELEASE_FIXTURE.siteCode,
      SMOKE_SPOT_CODE: DEFAULT_RELEASE_FIXTURE.spotCode,
    } as NodeJS.ProcessEnv,
  )

  assert.equal(summary.ok, false)
  assert.match(summary.issues.join(' | '), /spotCode drift/i)
})

test('fixture check chốt baseline smoke và release label từ source hiện hành', () => {
  const report = performFixtureCheck({
    env: {
      RC_LABEL: 'backend-rc1',
      SMOKE_USERNAME: 'ops',
      SMOKE_ROLE: 'OPS',
      SMOKE_SITE_CODE: 'SITE_HCM_01',
      SMOKE_ZONE_CODE: 'VIP_A',
      SMOKE_SPOT_CODE: 'HCM-VIP-01',
      DEMO_SITE_CODE: 'SITE_HCM_01',
      RC_CLEAN_MACHINE_PROFILE: 'DEMO',
    } as NodeJS.ProcessEnv,
  })

  assert.equal(report.releaseLabel, 'backend-rc1')
  assert.equal(report.expected.siteCode, 'SITE_HCM_01')
  assert.equal(report.expected.spotCode, 'HCM-VIP-01')
})

test('source regression: package scripts, changelog, checklist và runbook đã chốt final RC gate', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'package.json'), 'utf8'))
  const envExample = fs.readFileSync(path.join(repoRoot, 'apps', 'api', '.env.example'), 'utf8')
  const apiRunbook = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'docs', 'RUNBOOK.md'), 'utf8')
  const checklist = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'docs', 'RC1_RELEASE_CHECKLIST.md'), 'utf8')
  const matrix = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'docs', 'CLEAN_MACHINE_MATRIX.md'), 'utf8')
  const changelog = fs.readFileSync(path.join(repoRoot, 'CHANGELOG_BACKEND_RC.md'), 'utf8')
  const gateSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'scripts', 'rc1-gate.ts'), 'utf8')
  const repeatSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'scripts', 'rc1-repeat-smoke.ts'), 'utf8')

  assert.equal(packageJson.scripts['rc1:fixtures:check'], 'tsx src/scripts/rc1-fixture-check.ts')
  assert.equal(packageJson.scripts['rc1:smoke:repeat'], 'tsx src/scripts/rc1-repeat-smoke.ts')
  assert.equal(packageJson.scripts['rc1:gate'], 'tsx src/scripts/rc1-gate.ts')
  assert.equal(packageJson.scripts['test:pr31'], 'node --import tsx --test src/tests/pr31-final-rc-gate.test.ts')
  assert.match(envExample, /RC_LABEL=backend-rc1/)
  assert.match(envExample, /RC_REPEAT_SMOKE_RUNS=3/)
  assert.match(apiRunbook, /Final RC gate \+ clean machine verification/i)
  assert.match(apiRunbook, /repeat smoke 3 vòng liên tục/i)
  assert.match(checklist, /Clean machine matrix/i)
  assert.match(matrix, /rc1:smoke:repeat/)
  assert.match(changelog, /BE-PR-25/i)
  assert.match(changelog, /backend-rc1/)
  assert.match(gateSource, /test:pr31/)
  assert.match(repeatSource, /release:reset/)
  assert.match(repeatSource, /smoke:bundle/)
})
