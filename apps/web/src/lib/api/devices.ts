import { apiFetch, buildQuery } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import type { DeviceListRes } from '@/lib/contracts/devices'
import type { DeviceRow } from '@parkly/contracts'

export function getDevices(params?: { siteCode?: string; heartbeatStatus?: string; unassignedOnly?: boolean }) {
  const qs = buildQuery({
    siteCode: params?.siteCode,
    heartbeatStatus: params?.heartbeatStatus,
    unassignedOnly: typeof params?.unassignedOnly === 'boolean' ? String(params.unassignedOnly) : undefined,
  })
  return apiFetch<DeviceListRes>(`/api/devices${qs ? `?${qs}` : ''}`, undefined, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      siteCode: typeof row.siteCode === 'string' ? row.siteCode : null,
      rows: Array.isArray(row.rows) ? row.rows.filter((item): item is DeviceRow => isRecord(item)) : [],
    }
  })
}
