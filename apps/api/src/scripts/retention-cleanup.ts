import 'dotenv/config'

import { describeRetentionPolicy, getBackendRetentionPolicy, type RetentionMode } from '../server/jobs/retention-policy'
import { runRetentionCleanup } from '../server/jobs/retention-cleanup'
import { writeRuntimeMarker } from '../server/observability-runtime'

function envFlag(name: string, fallback = false) {
  const raw = String(process.env[name] ?? '').trim().toUpperCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'TRUE' || raw === 'ON' || raw === 'YES'
}

function resolveMode(): RetentionMode {
  const argv = process.argv.map((item) => String(item).trim().toLowerCase())
  if (argv.includes('--apply')) return 'APPLY'
  if (argv.includes('--dry-run')) return 'DRY_RUN'
  return envFlag('RETENTION_DRY_RUN', true) ? 'DRY_RUN' : 'APPLY'
}

async function main() {
  const policy = getBackendRetentionPolicy()
  const mode = resolveMode()
  const summary = await runRetentionCleanup({ mode, policy })
  await writeRuntimeMarker('retention-cleanup', {
    outcome: summary.totals.errors > 0 ? 'FAIL' : 'OK',
    mode: summary.mode,
    profile: summary.profile,
    preserveDemoSeed: summary.preserveDemoSeed,
    batchLimit: summary.batchLimit,
    totals: summary.totals,
    datasets: summary.datasets,
    metrics: summary.metrics,
    policy: describeRetentionPolicy(policy),
  })
  console.log('[retention-cleanup]', JSON.stringify(summary, null, 2))
}

main().catch(async (error) => {
  await writeRuntimeMarker('retention-cleanup', {
    outcome: 'FAIL',
    mode: resolveMode(),
    error: String((error as { message?: unknown } | null | undefined)?.message ?? error ?? 'Unknown retention cleanup failure'),
    policy: describeRetentionPolicy(getBackendRetentionPolicy()),
  }).catch(() => void 0)
  console.error('[retention-cleanup] failed', error)
  process.exitCode = 1
})
