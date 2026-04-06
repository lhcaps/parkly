import type { ReportsSummaryRes, SiteRow } from '@/lib/contracts/topology'

export type { ReportsSummaryRes } from '@/lib/contracts/topology'

export type ReportWindowDays = 1 | 3 | 7 | 14 | 30

export type ReportsMatrixSiteRow = ReportsSummaryRes & {
  siteName: string
  entryShare: number
  exitShare: number
  delta: number
  intensity: 'entry-heavy' | 'exit-heavy' | 'balanced' | 'idle'
}

export type ReportsMatrixFailure = {
  siteCode: string
  error: string
}

export type ReportsMatrixRes = {
  days: number
  generatedAt: string
  scopeSiteCodes: string[]
  rows: ReportsMatrixSiteRow[]
  totals: {
    entry: number
    exit: number
    total: number
  }
  failures: ReportsMatrixFailure[]
}

export type ReportInsight = {
  title: string
  message: string
  tone: 'default' | 'warning' | 'danger' | 'success'
}

export function normalizeSiteLabel(site: Pick<SiteRow, 'siteCode' | 'name'>) {
  return site.name?.trim() ? site.name : site.siteCode
}
