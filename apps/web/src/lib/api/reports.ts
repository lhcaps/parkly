import { getReportsSummary, getSites } from '@/lib/api/topology'
import type { ReportWindowDays, ReportsMatrixFailure, ReportsMatrixRes, ReportsMatrixSiteRow, ReportsSummaryRes } from '@/lib/contracts/reports'
import { normalizeSiteLabel } from '@/lib/contracts/reports'

function deriveIntensity(entry: number, exit: number, total: number): ReportsMatrixSiteRow['intensity'] {
  if (total <= 0) return 'idle'
  const delta = entry - exit
  if (Math.abs(delta) <= Math.max(2, Math.round(total * 0.08))) return 'balanced'
  return delta > 0 ? 'entry-heavy' : 'exit-heavy'
}

function toMatrixRow(summary: ReportsSummaryRes, siteName: string): ReportsMatrixSiteRow {
  const total = summary.total > 0 ? summary.total : 0
  const entryShare = total > 0 ? Math.round((summary.entry / total) * 100) : 0
  const exitShare = total > 0 ? Math.round((summary.exit / total) * 100) : 0
  return {
    ...summary,
    siteName,
    entryShare,
    exitShare,
    delta: summary.entry - summary.exit,
    intensity: deriveIntensity(summary.entry, summary.exit, total),
  }
}

export async function getOperationalReportSummary(siteCode: string, days: ReportWindowDays | number = 7) {
  return getReportsSummary(siteCode, days)
}

export async function getOperationalReportsMatrix(siteCodes: string[], days: ReportWindowDays | number = 7): Promise<ReportsMatrixRes> {
  const uniqueSiteCodes = Array.from(new Set(siteCodes.filter(Boolean)))
  const [siteRes, summaries] = await Promise.all([
    getSites().catch(() => ({ rows: [] })),
    Promise.allSettled(uniqueSiteCodes.map((siteCode) => getReportsSummary(siteCode, days))),
  ])

  const siteNameByCode = new Map(siteRes.rows.map((site) => [site.siteCode, normalizeSiteLabel(site)]))
  const rows: ReportsMatrixSiteRow[] = []
  const failures: ReportsMatrixFailure[] = []

  summaries.forEach((result, index) => {
    const siteCode = uniqueSiteCodes[index]
    if (result.status === 'fulfilled') {
      rows.push(toMatrixRow(result.value, siteNameByCode.get(siteCode) ?? siteCode))
      return
    }

    const reason = result.reason
    failures.push({
      siteCode,
      error: reason instanceof Error ? reason.message : String(reason),
    })
  })

  rows.sort((a, b) => b.total - a.total || a.siteCode.localeCompare(b.siteCode))

  const totals = rows.reduce(
    (acc, row) => ({
      entry: acc.entry + row.entry,
      exit: acc.exit + row.exit,
      total: acc.total + row.total,
    }),
    { entry: 0, exit: 0, total: 0 },
  )

  return {
    days: typeof days === 'number' ? days : 7,
    generatedAt: new Date().toISOString(),
    scopeSiteCodes: uniqueSiteCodes,
    rows,
    totals,
    failures,
  }
}
