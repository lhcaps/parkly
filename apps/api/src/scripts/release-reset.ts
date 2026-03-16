import 'dotenv/config'

import { buildResetSteps, RELEASE_GRANT_PROFILE } from './release-bundle'
import { runSqlFile } from './_run-sql-file'
import { applyParkingAppGrants } from './apply-grants-parking-app'

async function main() {
  const steps = buildResetSteps()
  console.log('[release-reset] begin')
  for (const step of steps) {
    console.log(`[release-reset] ${step.id} :: ${step.intent}`)
    if (step.id === 'grant-app') {
      await applyParkingAppGrants({ profile: RELEASE_GRANT_PROFILE })
      continue
    }
    if (step.id === 'seed-reset') {
      await runSqlFile('db/seed/reset_seed.sql', { useAdmin: true })
      continue
    }
    if (step.id === 'seed-min') {
      await runSqlFile('db/seed/seed_min.sql', { useAdmin: true })
      continue
    }
    throw new Error(`Unsupported reset step: ${step.id}`)
  }
  console.log('[release-reset] OK')
}

main().catch((error) => {
  console.error('[release-reset] FAIL', error)
  process.exitCode = 1
})
