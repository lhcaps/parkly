import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { BACKEND_RC_BASELINE_TAG, buildRcEvidenceTemplate, buildRcGateSteps } from '../../scripts/release-bundle'

function resolveApiRoot() {
  const cwd = process.cwd()
  const candidates = [
    path.resolve(cwd),
    path.resolve(cwd, 'apps/api'),
    path.resolve(__dirname, '../../..'),
  ]
  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'package.json')) && fs.existsSync(path.join(candidate, 'src')))
  if (!found) throw new Error('Không resolve được apps/api root cho RC1 test')
  return found
}

const apiRoot = resolveApiRoot()
const repoRoot = path.resolve(apiRoot, '../..')

function readApiFile(relPath: string) {
  return fs.readFileSync(path.join(apiRoot, relPath), 'utf8')
}

test('rc1 gate chốt đủ typecheck + PR20-PR25 + reset + smoke', () => {
  const steps = buildRcGateSteps()
  assert.deepEqual(
    steps.map((step) => step.id),
    ['typecheck', 'test-pr20', 'test-pr21', 'test-pr22', 'test-pr23', 'test-pr24', 'test-pr25', 'release-reset', 'smoke-bundle'],
  )
  assert.equal(steps.every((step) => step.required), true)

  const template = buildRcEvidenceTemplate()
  assert.match(template, /backend-rc1/)
  assert.match(template, /test:pr20/)
  assert.match(template, /smoke:bundle/)
  assert.match(template, /HCM-VIP-01/)
})

test('package docs changelog và grants đã được chuẩn hóa cho RC1', () => {
  const packageJson = JSON.parse(readApiFile('package.json')) as { scripts?: Record<string, string> }
  const apiRunbook = readApiFile('docs/RUNBOOK.md')
  const scriptsReadme = readApiFile('src/scripts/README.md')
  const grants = readApiFile('db/scripts/grants_parking_app.mvp.sql')
  const rootRunbook = fs.readFileSync(path.join(repoRoot, 'docs/RUNBOOK.md'), 'utf8')
  const rootApi = fs.readFileSync(path.join(repoRoot, 'docs/API.md'), 'utf8')
  const changelog = fs.readFileSync(path.join(repoRoot, 'CHANGELOG_BACKEND_RC.md'), 'utf8')

  assert.equal(packageJson.scripts?.['rc:gate'], 'pnpm -s typecheck && pnpm -s test:pr20 && pnpm -s test:pr21 && pnpm -s test:pr22 && pnpm -s test:pr23 && pnpm -s test:pr24 && pnpm -s test:pr25 && pnpm -s release:reset && pnpm -s smoke:bundle')
  assert.equal(packageJson.scripts?.['rc:gate:reset'], 'pnpm -s rc:gate')
  assert.equal(packageJson.scripts?.['test:rc1'], 'node --import tsx --test src/tests/smoke/rc1-release-consolidation.test.ts')
  assert.equal(packageJson.scripts?.['shift:close:smoke'], 'tsx src/scripts/close-shift-demo.ts')
  assert.equal(packageJson.scripts?.['tariff:audit'], 'tsx src/scripts/tariff-audit-demo.ts')
  assert.equal(packageJson.scripts?.['demo:close-shift'], undefined)
  assert.equal(packageJson.scripts?.['demo:tariff-audit'], undefined)

  assert.match(apiRunbook, /backend-rc1/)
  assert.match(apiRunbook, /rc:gate/)
  assert.match(apiRunbook, /test:pr20/)
  assert.match(apiRunbook, /smoke:bundle/)
  assert.match(apiRunbook, /auth -> dashboard -> media\(local\) -> intake -> reconcile -> incident -> audit/)

  assert.match(rootRunbook, /rc:gate/)
  assert.match(rootApi, /backend-rc1/)
  assert.match(rootApi, /PR20→PR25/)
  assert.match(scriptsReadme, /rc:gate/)
  assert.match(changelog, new RegExp(BACKEND_RC_BASELINE_TAG))
  assert.match(changelog, /PR20/)
  assert.match(changelog, /PR25/)
  assert.match(changelog, /schema impact/i)
  assert.match(changelog, /grant impact/i)
  assert.match(grants, /RC1 consolidated runtime surface/i)
  assert.match(grants, /auth \/ dashboard \/ presence \/ incidents \/ audit/i)
})
