import type { GateRow, LaneRow, SiteRow } from '@parkly/contracts'

export type { GateRow, LaneRow, SiteRow } from '@parkly/contracts'

export type SiteListRes = { rows: SiteRow[] }
export type GateListRes = { siteCode: string; rows: GateRow[] }
export type LaneListRes = { siteCode: string; rows: LaneRow[] }
export type ReportsSummaryRes = {
  siteCode: string
  days: number
  entry: number
  exit: number
  total: number
}
