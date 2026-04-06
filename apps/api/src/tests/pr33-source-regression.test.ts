import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('source regression: secret rotation docs, env, scripts và runtime wiring đã chốt', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'package.json'), 'utf8'))
  const envExample = fs.readFileSync(path.join(repoRoot, 'apps', 'api', '.env.example'), 'utf8')
  const runbook = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'docs', 'RUNBOOK.md'), 'utf8')
  const securityDoc = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'docs', 'SECURITY_SECRETS.md'), 'utf8')
  const rotationSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'lib', 'security', 'secret-rotation.ts'), 'utf8')
  const cliSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'scripts', 'secrets-rotation-check.ts'), 'utf8')
  const authSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'modules', 'auth', 'application', 'auth-service.ts'), 'utf8')
  const deviceSource = fs.readFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'modules', 'gate', 'application', 'verify-device-signature.ts'), 'utf8')

  assert.equal(packageJson.scripts['secrets:rotation:check'], 'tsx src/scripts/secrets-rotation-check.ts')
  assert.equal(packageJson.scripts['test:pr33'], 'pnpm -s test:pr33:rotation && pnpm -s test:pr33:device && pnpm -s test:pr33:cli && pnpm -s test:pr33:source')
  assert.match(envExample, /API_INTERNAL_SERVICE_TOKEN_ACTIVE=__SET_ME_INTERNAL_TOKEN__/)
  assert.match(envExample, /API_INTERNAL_SERVICE_TOKEN_NEXT=/)
  assert.match(envExample, /DEVICE_CAPTURE_SECRET_ACTIVE=__SET_ME_DEVICE_SECRET__/)
  assert.match(envExample, /DEVICE_CAPTURE_SECRET_NEXT=/)
  assert.match(runbook, /secrets:rotation:check/)
  assert.match(runbook, /NEXT_ONLY/)
  assert.match(securityDoc, /API_INTERNAL_SERVICE_TOKEN_ACTIVE/)
  assert.match(securityDoc, /DEVICE_CAPTURE_SECRET_ACTIVE/)
  assert.match(rotationSource, /active-next-duplicate/)
  assert.match(rotationSource, /legacy-active-mismatch/)
  assert.match(cliSource, /formatSecretsRotationCheckReport/)
  assert.match(authSource, /config\.internalService\.nextToken/)
  assert.match(deviceSource, /DEVICE_CAPTURE_SECRET_NEXT/)
})
