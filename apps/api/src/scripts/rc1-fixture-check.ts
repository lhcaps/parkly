import 'dotenv/config'

import fs from 'node:fs'
import path from 'node:path'

import { BACKEND_RC_BASELINE_TAG } from './release-bundle'
import { buildEvidenceFilePath, resolveRcGateEnv, writeJson } from './rc1-runtime'

function parseArgs(argv: string[]) {
  let profile: string | null = null
  let writeEvidence = true
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--profile') {
      profile = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (argv[index] === '--no-write') {
      writeEvidence = false
    }
  }
  return { profile, writeEvidence }
}

function mustContain(text: string, pattern: string, issues: string[], label: string) {
  if (!text.includes(pattern)) issues.push(`${label} thiếu marker ${pattern}`)
}

export function performFixtureCheck(options?: { profile?: string | null; env?: NodeJS.ProcessEnv }) {
  const env = resolveRcGateEnv(options?.env ?? process.env, options?.profile)
  const apiRoot = path.resolve(__dirname, '..', '..')
  const seedMin = fs.readFileSync(path.join(apiRoot, 'db', 'seed', 'seed_min.sql'), 'utf8')
  const grantsMvp = fs.readFileSync(path.join(apiRoot, 'db', 'scripts', 'grants_parking_app.mvp.sql'), 'utf8')
  const envExample = fs.readFileSync(path.join(apiRoot, '.env.example'), 'utf8')
  const packageJson = JSON.parse(fs.readFileSync(path.join(apiRoot, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }

  const expected = {
    releaseLabel: String(env.RC_LABEL ?? BACKEND_RC_BASELINE_TAG).trim() || BACKEND_RC_BASELINE_TAG,
    smokeUser: String(env.SMOKE_USERNAME ?? 'ops').trim() || 'ops',
    smokeRole: String(env.SMOKE_ROLE ?? 'OPERATOR').trim() || 'OPERATOR',
    siteCode: String(env.SMOKE_SITE_CODE ?? env.DEMO_SITE_CODE ?? 'SITE_HCM_01').trim() || 'SITE_HCM_01',
    zoneCode: String(env.SMOKE_ZONE_CODE ?? 'VIP_A').trim() || 'VIP_A',
    spotCode: String(env.SMOKE_SPOT_CODE ?? 'HCM-VIP-01').trim() || 'HCM-VIP-01',
  }

  const issues: string[] = []
  mustContain(seedMin, expected.siteCode, issues, 'seed_min.sql')
  mustContain(seedMin, expected.zoneCode, issues, 'seed_min.sql')
  mustContain(seedMin, expected.spotCode, issues, 'seed_min.sql')
  mustContain(seedMin, expected.smokeUser, issues, 'seed_min.sql')
  mustContain(grantsMvp, 'users', issues, 'grants_parking_app.mvp.sql')
  mustContain(envExample, `SMOKE_SITE_CODE=${expected.siteCode}`, issues, '.env.example')
  mustContain(envExample, `SMOKE_ZONE_CODE=${expected.zoneCode}`, issues, '.env.example')
  mustContain(envExample, `SMOKE_SPOT_CODE=${expected.spotCode}`, issues, '.env.example')
  mustContain(envExample, `RC_LABEL=${expected.releaseLabel}`, issues, '.env.example')

  if (packageJson.scripts?.['release:reset'] !== 'tsx src/scripts/release-reset.ts') {
    issues.push('package.json drift: release:reset script không còn canonical.')
  }
  if (packageJson.scripts?.['smoke:bundle'] !== 'tsx src/scripts/smoke-backend.ts') {
    issues.push('package.json drift: smoke:bundle script không còn canonical.')
  }

  return {
    checkedAt: new Date().toISOString(),
    releaseLabel: expected.releaseLabel,
    expected,
    ok: issues.length === 0,
    issues,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const report = performFixtureCheck({ profile: args.profile })
  if (args.writeEvidence) {
    writeJson(buildEvidenceFilePath('fixture-check'), report)
  }

  if (!report.ok) {
    throw new Error(`Fixture drift detected: ${report.issues.join(' | ')}`)
  }

  console.log('[rc1:fixtures:check] OK', JSON.stringify(report, null, 2))
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[rc1:fixtures:check] FAIL', error)
    process.exitCode = 1
  })
}
