import { apiFetch, buildQuery } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import { cachedRead, queryTtl } from '@/lib/query/policies'
import type { GateListRes, LaneListRes, ReportsSummaryRes, SiteListRes } from '@/lib/contracts/topology'
import type { GateRow, LaneRow, SiteRow } from '@parkly/contracts'

export function getSites() {
  return cachedRead('topology:sites', queryTtl.topology, () => apiFetch<SiteListRes>('/api/sites', undefined, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      rows: Array.isArray(row.rows) ? row.rows.filter((item): item is SiteRow => isRecord(item)) : [],
    }
  }))
}

export function getGates(siteCode: string) {
  const qs = buildQuery({ siteCode })
  return cachedRead(`topology:gates:${siteCode}`, queryTtl.topology, () => apiFetch<GateListRes>(`/api/gates${qs ? `?${qs}` : ''}`, undefined, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      siteCode: typeof row.siteCode === 'string' ? row.siteCode : siteCode,
      rows: Array.isArray(row.rows) ? row.rows.filter((item): item is GateRow => isRecord(item)) : [],
    }
  }))
}

export function getLanes(siteCode: string) {
  const qs = buildQuery({ siteCode })
  return cachedRead(`topology:lanes:${siteCode}`, queryTtl.topology, () => apiFetch<LaneListRes>(`/api/lanes${qs ? `?${qs}` : ''}`, undefined, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      siteCode: typeof row.siteCode === 'string' ? row.siteCode : siteCode,
      rows: Array.isArray(row.rows) ? row.rows.filter((item): item is LaneRow => isRecord(item)) : [],
    }
  }))
}

export function getReportsSummary(siteCode: string, days = 7) {
  const qs = buildQuery({ siteCode, days })
  return cachedRead(`reports:summary:${siteCode}:${days}`, queryTtl.reports, () => apiFetch<ReportsSummaryRes>(`/api/reports/summary${qs ? `?${qs}` : ''}`, undefined, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      siteCode: typeof row.siteCode === 'string' ? row.siteCode : siteCode,
      days: typeof row.days === 'number' && Number.isFinite(row.days) ? row.days : days,
      entry: typeof row.entry === 'number' && Number.isFinite(row.entry) ? row.entry : 0,
      exit: typeof row.exit === 'number' && Number.isFinite(row.exit) ? row.exit : 0,
      total: typeof row.total === 'number' && Number.isFinite(row.total) ? row.total : 0,
    }
  }))
}
