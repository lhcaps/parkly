import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { withCursorPage } from '../server/http'
import {
  buildAuditActorSnapshot,
  resolveAuditWriteInput,
  runWithAuditContext,
} from '../server/services/audit-service'
import { normalizeAuditListQuery } from '../modules/audit/application/audit-read'

function resolveApiSrcRoot() {
  const cwd = process.cwd()
  const candidates = [
    path.resolve(cwd, 'src'),
    path.resolve(cwd, 'apps/api/src'),
    path.resolve(__dirname, '..'),
  ]
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error('Không resolve được apps/api/src cho audit test')
  return found
}

const srcRoot = resolveApiSrcRoot()

function readSource(relPath: string) {
  return fs.readFileSync(path.join(srcRoot, relPath), 'utf8')
}

test('before/after audit snapshot được canonicalize cùng actor + request context', () => {
  const payload = runWithAuditContext({
    requestId: 'req-pr23',
    correlationId: 'corr-pr23',
    occurredAt: '2026-03-12T08:00:00.000Z',
    actor: {
      principalType: 'USER',
      role: 'OPERATOR',
      actorUserId: '42',
      actorLabel: 'OPERATOR:42',
      userId: '42',
      username: 'ops',
      sessionId: 'sess-1',
    },
  }, () => resolveAuditWriteInput({
    siteId: '10',
    action: 'SUBSCRIPTION_UPDATED',
    entityTable: 'subscriptions',
    entityId: '88',
    beforeSnapshot: { status: 'ACTIVE', total: 1 },
    afterSnapshot: { status: 'SUSPENDED', total: 2 },
  }))

  assert.equal(payload.siteId, '10')
  assert.equal(payload.action, 'SUBSCRIPTION_UPDATED')
  assert.equal(payload.entityTable, 'subscriptions')
  assert.equal(payload.entityId, '88')
  assert.equal(payload.requestId, 'req-pr23')
  assert.equal(payload.correlationId, 'corr-pr23')
  assert.equal(payload.occurredAt, '2026-03-12T08:00:00.000Z')
  assert.deepEqual(JSON.parse(String(payload.actorJson)), {
    principalType: 'USER',
    role: 'OPERATOR',
    actorUserId: '42',
    actorLabel: 'OPERATOR:42',
    userId: '42',
    username: 'ops',
    sessionId: 'sess-1',
    serviceCode: null,
  })
  assert.deepEqual(JSON.parse(String(payload.beforeJson)), { status: 'ACTIVE', total: 1 })
  assert.deepEqual(JSON.parse(String(payload.afterJson)), { status: 'SUSPENDED', total: 2 })
})

test('cross-module actor attribution support user/service/system principal', () => {
  assert.deepEqual(
    buildAuditActorSnapshot({
      principalType: 'USER',
      role: 'SUPER_ADMIN',
      actorUserId: '7',
      actorLabel: 'SUPER_ADMIN:7',
      userId: '7',
      username: 'admin',
      sessionId: 'sess-admin',
    }),
    {
      principalType: 'USER',
      role: 'SUPER_ADMIN',
      actorUserId: '7',
      actorLabel: 'SUPER_ADMIN:7',
      userId: '7',
      username: 'admin',
      sessionId: 'sess-admin',
      serviceCode: null,
    },
  )

  assert.deepEqual(
    buildAuditActorSnapshot({
      principalType: 'SERVICE',
      role: 'OPERATOR',
      actorLabel: 'INTERNAL_SERVICE:OPERATOR',
      serviceCode: 'INTERNAL_SERVICE',
    }),
    {
      principalType: 'SERVICE',
      role: 'OPERATOR',
      actorUserId: null,
      actorLabel: 'INTERNAL_SERVICE:OPERATOR',
      userId: null,
      username: null,
      sessionId: null,
      serviceCode: 'INTERNAL_SERVICE',
    },
  )

  assert.deepEqual(
    buildAuditActorSnapshot({ role: 'SYSTEM', actorLabel: 'SYSTEM' }),
    {
      principalType: 'SYSTEM',
      role: 'SYSTEM',
      actorUserId: null,
      actorLabel: 'SYSTEM',
      userId: null,
      username: null,
      sessionId: null,
      serviceCode: null,
    },
  )
})

test('audit query filtering và cursor pagination được canonicalize ổn định', () => {
  const normalized = normalizeAuditListQuery({
    siteCode: ' SITE_HCM_01 ',
    actorUserId: ' 42 ',
    action: ' subscription_updated ',
    entityTable: ' subscriptions ',
    entityId: ' 88 ',
    requestId: ' req-1 ',
    correlationId: ' corr-1 ',
    from: ' 2026-03-01T00:00:00.000Z ',
    to: ' 2026-03-12T23:59:59.000Z ',
    cursor: ' 120 ',
    limit: 500,
  })

  assert.deepEqual(normalized, {
    limit: 200,
    siteCode: 'SITE_HCM_01',
    actorUserId: '42',
    action: 'SUBSCRIPTION_UPDATED',
    entityTable: 'subscriptions',
    entityId: '88',
    requestId: 'req-1',
    correlationId: 'corr-1',
    from: '2026-03-01T00:00:00.000Z',
    to: '2026-03-12T23:59:59.000Z',
    cursor: '120',
  })

  const page = withCursorPage([{ auditId: '200' }, { auditId: '199' }], {
    limit: normalized.limit,
    nextCursor: '199',
    sort: ' auditId:desc ',
  })

  assert.deepEqual(page.pageInfo, {
    type: 'CURSOR',
    limit: 200,
    nextCursor: '199',
    hasMore: true,
    sort: 'auditId:desc',
  })
})

test('source regression: audit routes được register và các mutate module dùng audit service tập trung', () => {
  const appSource = readSource('server/app.ts')
  const routeSource = readSource('modules/audit/interfaces/http/register-audit-routes.ts')
  const authSource = readSource('modules/auth/application/auth-service.ts')
  const incidentSource = readSource('modules/incidents/application/incident-service.ts')
  const subscriptionSource = readSource('modules/subscriptions/application/admin-subscriptions.ts')
  const claimSource = readSource('modules/gate/application/review/claim-review.ts')
  const approveSource = readSource('modules/gate/application/review/manual-approve.ts')
  const rejectSource = readSource('modules/gate/application/review/manual-reject.ts')
  const barrierSource = readSource('modules/gate/application/review/manual-open-barrier.ts')
  const commonSource = readSource('modules/gate/application/review/common.ts')
  const docsSource = fs.readFileSync(path.resolve(srcRoot, '../../../docs/API.md'), 'utf8')

  assert.match(appSource, /registerAuditRoutes\(api\)/)
  assert.match(appSource, /runWithAuditContext\(/)
  assert.match(appSource, /'\/ops\/audit': \{\}/)
  assert.match(appSource, /'\/ops\/audit\/\{auditId\}': \{\}/)

  assert.match(routeSource, /api\.get\('\/ops\/audit'/)
  assert.match(routeSource, /api\.get\('\/ops\/audit\/:auditId'/)
  assert.match(routeSource, /const parsed = validateOrThrow\(AuditListQuery, req\.query \?\? \{\}\)/)
  assert.match(routeSource, /withCursorPage\(data\.items, \{/)
  assert.match(routeSource, /sort: 'auditId:desc'/)

  assert.match(authSource, /AUTH_LOGIN/)
  assert.match(authSource, /AUTH_REFRESH/)
  assert.match(authSource, /AUTH_LOGOUT/)
  assert.match(authSource, /defaultAuthAuditWriter/)
  assert.match(authSource, /writeAuditLog\(/)

  assert.match(incidentSource, /writeIncidentAuditLog\(/)
  assert.match(incidentSource, /INCIDENT_AUTO_OPENED/)
  assert.match(incidentSource, /INCIDENT_AUTO_UPDATED/)
  assert.match(incidentSource, /INCIDENT_AUTO_RESOLVED/)

  assert.match(subscriptionSource, /writePlatformAudit\(/)
  assert.match(commonSource, /export async function writeReviewAuditLog\(/)
  assert.match(claimSource, /GATE_REVIEW_CLAIM/)
  assert.match(approveSource, /GATE_REVIEW_MANUAL_APPROVE/)
  assert.match(rejectSource, /GATE_REVIEW_MANUAL_REJECT/)
  assert.match(barrierSource, /GATE_REVIEW_MANUAL_OPEN_BARRIER/)

  assert.match(docsSource, /GET \/api\/ops\/audit/)
  assert.match(docsSource, /requestId/)
  assert.match(docsSource, /correlationId/)
  assert.match(docsSource, /occurredAt/)
})
