import { apiFetch, buildQuery } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import {
  normalizeAuditRecord,
  normalizeAuditRecordList,
  type AuditListQuery,
  type AuditListRes,
  type AuditRecord,
} from '@/lib/contracts/audit'

export function getAuditRecords(params?: AuditListQuery) {
  const qs = buildQuery(params)
  return apiFetch<AuditListRes>(`/api/ops/audit${qs ? `?${qs}` : ''}`, undefined, (value) => {
    const row = isRecord(value) ? value : {}
    const pageInfo = isRecord(row.pageInfo) ? row.pageInfo : null
    return {
      rows: normalizeAuditRecordList(row.rows),
      nextCursor: typeof row.nextCursor === 'string' && row.nextCursor.trim() ? row.nextCursor : null,
      pageInfo: pageInfo
        ? {
            limit: typeof pageInfo.limit === 'number' && Number.isFinite(pageInfo.limit) ? pageInfo.limit : 0,
            nextCursor: typeof pageInfo.nextCursor === 'string' && pageInfo.nextCursor.trim() ? pageInfo.nextCursor : null,
            sort: typeof pageInfo.sort === 'string' ? pageInfo.sort : '',
          }
        : null,
    }
  })
}

export function getAuditRecordDetail(auditId: string) {
  return apiFetch<AuditRecord>(`/api/ops/audit/${encodeURIComponent(auditId)}`, undefined, normalizeAuditRecord)
}
