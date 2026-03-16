import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

import { ApiError, buildCursorPageInfo, fail } from '../server/http'
import { errEnvelope } from '../server/openapi'
import { parseBigIntCursor, validateOrThrow } from '../server/validation'

function resolveApiSrcRoot() {
  const cwd = process.cwd()
  const candidates = [
    path.resolve(cwd, 'src'),
    path.resolve(cwd, 'apps/api/src'),
    path.resolve(__dirname, '..'),
  ]
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error('Không resolve được apps/api/src cho contract test')
  return found
}

const srcRoot = resolveApiSrcRoot()

function readSource(relPath: string) {
  return fs.readFileSync(path.join(srcRoot, relPath), 'utf8')
}

test('error envelope phẳng gồm requestId + code + message + details', () => {
  const payload = fail('req-pr21', {
    code: 'BAD_REQUEST',
    message: 'Cursor không hợp lệ',
    details: { cursor: 'abc' },
  })

  assert.deepEqual(payload, {
    requestId: 'req-pr21',
    code: 'BAD_REQUEST',
    message: 'Cursor không hợp lệ',
    details: { cursor: 'abc' },
  })
})

test('validateOrThrow chuẩn hóa validation error thành ApiError BAD_REQUEST', () => {
  assert.throws(
    () => validateOrThrow(z.object({ limit: z.coerce.number().int().positive() }), { limit: 0 }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.code, 'BAD_REQUEST')
      assert.equal(error.statusCode, 400)
      assert.ok((error.details as any)?.fieldErrors || (error.details as any)?.validation)
      return true
    },
  )
})

test('cursor page info được canonical hóa ổn định', () => {
  const pageInfo = buildCursorPageInfo({
    limit: 50,
    nextCursor: 999n,
    hasMore: true,
    sort: ' siteCode:asc, gateCode:asc , laneCode:asc ',
  })

  assert.deepEqual(pageInfo, {
    type: 'CURSOR',
    limit: 50,
    nextCursor: '999',
    hasMore: true,
    sort: 'siteCode:asc,gateCode:asc,laneCode:asc',
  })
})

test('cursor numeric parser reject format sai', () => {
  assert.equal(parseBigIntCursor('42')?.toString(), '42')
  assert.throws(
    () => parseBigIntCursor('oops'),
    (error: unknown) => error instanceof ApiError && error.code === 'BAD_REQUEST',
  )
})

test('openapi error schema phản ánh envelope phẳng mới', () => {
  const schema = errEnvelope()
  assert.deepEqual(schema.required, ['requestId', 'code', 'message'])
  assert.equal(schema.properties.requestId.type, 'string')
  assert.ok(Array.isArray(schema.properties.code.enum))
  assert.equal(schema.properties.message.type, 'string')
  assert.equal(schema.properties.details !== undefined, true)
})

test('source regression: app register subscription admin routes và list endpoint trả pageInfo ổn định', () => {
  const appSource = readSource('server/app.ts')
  const sessionRouteSource = readSource('modules/gate/interfaces/http/register-gate-session-routes.ts')
  const opsRouteSource = readSource('modules/gate/interfaces/http/register-gate-ops-query-routes.ts')
  const incidentRouteSource = readSource('modules/incidents/interfaces/http/register-gate-incident-routes.ts')
  const subscriptionRouteSource = readSource('modules/subscriptions/interfaces/http/register-subscription-admin-routes.ts')

  assert.match(appSource, /registerSubscriptionAdminRoutes\(api\)/)
  assert.match(appSource, /const parsed = validateOrThrow\(OutboxListQuery, req\.query \?\? \{\}\)/)
  assert.match(appSource, /withCursorPage\(data\.items\.map\(sanitizeOutboxItem\), \{/)
  assert.match(appSource, /buildCursorPageInfo\(\{\s*limit,\s*nextCursor: items.length === limit && items.length > 0 \? items\[items.length - 1\]\.eventId : null,/s)

  assert.match(sessionRouteSource, /const parsed = validateOrThrow\(SessionListQuery, req\.query \?\? \{\}\)/)
  assert.match(sessionRouteSource, /const pageInfo = buildCursorPageInfo\(\{\s*limit: parsed\.limit \?\? 50,\s*nextCursor: data\.nextCursor,\s*sort: 'sessionId:desc',/s)
  assert.match(sessionRouteSource, /const parsed = validateOrThrow\(ReviewQueueQuery, req\.query \?\? \{\}\)/)

  assert.match(opsRouteSource, /const parsed = validateOrThrow\(SnapshotQuery, req\.query \?\? \{\}\)/)
  assert.match(opsRouteSource, /nextCursor: pageInfo\.nextCursor/)

  assert.match(incidentRouteSource, /const parsed = validateOrThrow\(QuerySchema, req\.query \?\? \{\}\)/)
  assert.match(incidentRouteSource, /const pageInfo = buildCursorPageInfo\(/)

  assert.match(subscriptionRouteSource, /withCursorPage\(data\.items, \{ limit: parsed\.limit \?\? 50, nextCursor: data\.nextCursor, sort: 'subscriptionId:desc' \}\)/)
  assert.match(subscriptionRouteSource, /withCursorPage\(data\.items, \{ limit: parsed\.limit \?\? 50, nextCursor: data\.nextCursor, sort: 'subscriptionSpotId:desc' \}\)/)
  assert.match(subscriptionRouteSource, /withCursorPage\(data\.items, \{ limit: parsed\.limit \?\? 50, nextCursor: data\.nextCursor, sort: 'subscriptionVehicleId:desc' \}\)/)
})

test('docs/API.md chốt rõ snapshot query và realtime delta', () => {
  const docsSource = fs.readFileSync(path.resolve(srcRoot, '../../../docs/API.md'), 'utf8')
  assert.match(docsSource, /Snapshot\/state query/)
  assert.match(docsSource, /Realtime delta stream/)
  assert.match(docsSource, /Error envelope/)
  assert.match(docsSource, /GET \/api\/stream\/lane-status/)
  assert.match(docsSource, /GET \/api\/gate-sessions/)
})
