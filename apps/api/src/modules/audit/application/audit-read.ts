import { ApiError } from '../../../server/http'
import { getAuditRecordDetail, listAuditLogs, type AuditListQuery } from '../../../server/services/audit-service'

export type OpsAuditListQuery = AuditListQuery

export function normalizeAuditListQuery(input: OpsAuditListQuery): Required<Pick<AuditListQuery, 'limit'>> & AuditListQuery {
  const limit = Math.min(200, Math.max(1, Math.trunc(Number(input.limit ?? 50) || 50)))
  const normalize = (value: unknown) => {
    const normalized = String(value ?? '').trim()
    return normalized || null
  }

  return {
    limit,
    siteCode: normalize(input.siteCode),
    actorUserId: normalize(input.actorUserId),
    action: normalize(input.action)?.toUpperCase() ?? null,
    entityTable: normalize(input.entityTable),
    entityId: normalize(input.entityId),
    requestId: normalize(input.requestId),
    correlationId: normalize(input.correlationId),
    from: normalize(input.from),
    to: normalize(input.to),
    cursor: normalize(input.cursor),
  }
}

export async function listOpsAudit(query: OpsAuditListQuery) {
  const normalized = normalizeAuditListQuery(query)
  return await listAuditLogs(normalized)
}

export async function getOpsAuditDetail(auditId: string) {
  const item = await getAuditRecordDetail(auditId)
  if (!item) throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy audit record', details: { auditId } })
  return item
}
