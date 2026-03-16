// Backend routes:
// GET /api/ops/spot-occupancy?siteCode=X  — list all projection rows (ADMIN, OPS, GUARD)
// GET /api/ops/spot-occupancy/:spotCode?siteCode=X — single slot detail
// ?refresh=true triggers on-demand reconciliation on backend
//
// NO dedicated realtime SSE stream exists for occupancy.
// This module implements polling fallback (see hooks/useParkingLiveData.ts).

import { apiFetch, buildQuery } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import { normalizeSpotProjectionList, normalizeSpotProjectionRow } from '../mappers'
import type { OccupancyStatus, SpotProjectionRow } from '../types'

export function getSpotOccupancy(params: {
  siteCode: string
  spotCode?: string
  zoneCode?: string
  status?: OccupancyStatus | ''
  limit?: number
  refresh?: boolean
}): Promise<SpotProjectionRow[]> {
  const qs = buildQuery({
    siteCode: params.siteCode,
    spotCode: params.spotCode || undefined,
    zoneCode: params.zoneCode || undefined,
    status: params.status || undefined,
    limit: params.limit ?? 500,
    refresh: params.refresh ? true : undefined,
  })
  return apiFetch<SpotProjectionRow[]>(
    `/api/ops/spot-occupancy${qs ? `?${qs}` : ''}`,
    undefined,
    normalizeSpotProjectionList,
  )
}

export function getSpotOccupancyDetail(siteCode: string, spotCode: string, refresh = false): Promise<SpotProjectionRow | null> {
  const qs = buildQuery({ siteCode, refresh: refresh ? true : undefined })
  return apiFetch<SpotProjectionRow | null>(
    `/api/ops/spot-occupancy/${encodeURIComponent(spotCode)}${qs ? `?${qs}` : ''}`,
    undefined,
    (raw) => {
      const r = isRecord(raw) ? raw : {}
      const data = isRecord(r.data) ? r.data : r
      const row = isRecord(data.row) ? data.row : data
      return normalizeSpotProjectionRow(row)
    },
  )
}
