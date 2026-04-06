import { apiFetch, buildQuery } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import type { LaneStatusSnapshot } from '@parkly/contracts'

export type LaneStatusPage = {
  rows: LaneStatusSnapshot['rows']
  nextCursor: string | null
  pageInfo: unknown | null
}

function normalizeLaneStatusRows(value: unknown): LaneStatusSnapshot['rows'] {
  return Array.isArray(value) ? (value as LaneStatusSnapshot['rows']) : []
}

export function getLaneStatusPage(params?: {
  siteCode?: string
  limit?: number
  cursor?: string
}) {
  const qs = buildQuery(params)
  return apiFetch<LaneStatusPage>(`/api/ops/lane-status${qs ? `?${qs}` : ''}`, undefined, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      rows: normalizeLaneStatusRows(row.rows),
      nextCursor: typeof row.nextCursor === 'string' && row.nextCursor.trim() ? row.nextCursor : null,
      pageInfo: row.pageInfo ?? null,
    }
  })
}

export async function getLaneStatusSnapshot(params?: { siteCode?: string; limit?: number }) {
  const limit = params?.limit ?? 200
  const merged: LaneStatusSnapshot['rows'] = []
  let cursor: string | undefined

  for (let pageIndex = 0; pageIndex < 10; pageIndex += 1) {
    const page = await getLaneStatusPage({
      siteCode: params?.siteCode,
      limit,
      cursor,
    })

    merged.push(...page.rows)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  return {
    rows: merged,
  }
}
