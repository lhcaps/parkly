import * as dotenv from 'dotenv'
dotenv.config()

import { authService } from '../modules/auth/application/auth-service'
import { writeRuntimeMarker } from '../server/observability-runtime'

async function main() {
  const startedAt = Date.now()
  const result = await authService.cleanupExpiredSessions()
  await writeRuntimeMarker('auth-session-cleanup', {
    outcome: 'OK',
    durationMs: Date.now() - startedAt,
    ...result,
  })
  console.log('[auth-session-cleanup]', JSON.stringify(result, null, 2))
}

main().catch(async (error) => {
  await writeRuntimeMarker('auth-session-cleanup', {
    outcome: 'FAIL',
    error: String((error as { message?: unknown } | null | undefined)?.message ?? error ?? 'Unknown cleanup failure'),
  }).catch(() => void 0)
  console.error('[auth-session-cleanup] failed', error)
  process.exitCode = 1
})
