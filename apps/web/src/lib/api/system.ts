import { apiFetch } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import { cachedRead, queryTtl } from '@/lib/query/policies'
import type { HealthRes, MeRes } from '@/lib/contracts/common'

export function getHealth() {
  return cachedRead('system:health', queryTtl.system, () => apiFetch<HealthRes>('/api/health', undefined, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      ok: typeof row.ok === 'boolean' ? row.ok : false,
      ts: typeof row.ts === 'string' ? row.ts : '',
    }
  }))
}

export function getMe() {
  return cachedRead('system:me', queryTtl.system, () => apiFetch<MeRes>('/api/me', undefined, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      role: typeof row.role === 'string' ? row.role : 'UNKNOWN',
    }
  }))
}
