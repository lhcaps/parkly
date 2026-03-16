import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('source regression: env, scripts, docs và verify đã chốt secret hardening baseline', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'package.json'), 'utf8'))
  const envExample = fs.readFileSync(path.join(repoRoot, 'apps', 'api', '.env.example'), 'utf8')
  const runbook = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'docs', 'RUNBOOK.md'), 'utf8')
  const securityDoc = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'docs', 'SECURITY_SECRETS.md'), 'utf8')
  const verifySource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'scripts', 'deployment-verify.ts'), 'utf8')
  const checkSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'scripts', 'secrets-check.ts'), 'utf8')
  const hygieneSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'lib', 'security', 'secret-hygiene.ts'), 'utf8')

  assert.equal(packageJson.scripts['secrets:check'], 'tsx src/scripts/secrets-check.ts')
  assert.equal(packageJson.scripts['test:pr32'], 'pnpm -s test:pr32:rules && pnpm -s test:pr32:cli && pnpm -s test:pr32:verify && pnpm -s test:pr32:source')
  assert.match(envExample, /API_INTERNAL_SERVICE_TOKEN=__SET_ME_INTERNAL_TOKEN__/)
  assert.match(envExample, /DEVICE_CAPTURE_DEFAULT_SECRET=__SET_ME_DEVICE_SECRET__/)
  assert.match(runbook, /secrets:check -- --profile release-candidate --intent bootstrap/)
  assert.match(runbook, /SECURITY_SECRETS\.md/)
  assert.match(securityDoc, /API_INTERNAL_SERVICE_TOKEN/)
  assert.match(securityDoc, /DEVICE_CAPTURE_DEFAULT_SECRET/)
  assert.match(securityDoc, /release-candidate.*pilot/i)
  assert.match(verifySource, /securitySecrets/)
  assert.match(verifySource, /evaluateSecretHygiene/)
  assert.match(checkSource, /formatSecretsCheckReport/)
  assert.match(hygieneSource, /duplicate-secret/)
  assert.match(hygieneSource, /placeholder-literal/)
})
