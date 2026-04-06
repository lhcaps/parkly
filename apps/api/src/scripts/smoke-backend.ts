import 'dotenv/config'

import { once } from 'node:events'
import { createServer, type Server } from 'node:http'

import { normalizeAcceptedAuthRole } from '@parkly/contracts'

import { computeZonePresenceSignature } from '../modules/presence/application/ingest-zone-presence-event'
import { applyParkingAppGrants } from './apply-grants-parking-app'
import { buildSmokePresenceBody, getReleaseFixtureFromEnv, RELEASE_GRANT_PROFILE } from './release-bundle'

type Envelope<T> = {
  requestId: string
  data?: T
  code?: string
  message?: string
  details?: unknown
}

type LoginPayload = {
  accessToken: string
  refreshToken: string
  principal: {
    principalType: string
    role: string
    siteScopes?: Array<{ siteCode: string }>
  }
}

type DashboardPayload = {
  overview?: unknown
  incidents?: unknown
}

type MediaUploadPayload = {
  viewUrl?: string | null
  storageKind?: string | null
  storageProvider?: string | null
}

type IncidentsPayload = {
  rows: Array<{ incidentId: string; status: string; sourceKey?: string | null }>
}

type AuditPayload = {
  rows: Array<{ auditId: string; entityTable?: string | null; entityId?: string | null; action?: string | null }>
}

function envFlag(name: string, fallback = false) {
  const raw = String(process.env[name] ?? '').trim().toUpperCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'TRUE' || raw === 'ON' || raw === 'YES'
}

async function startServer() {
  const { buildApp } = await import('../server/app')
  const { config } = await import('../server/config')
  const app = await buildApp()
  const server = createServer(app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Không resolve được cổng smoke server')
  return { app, server, baseUrl: `http://127.0.0.1:${address.port}${config.prefix}` }
}

async function stopServer(server: Server, app: any) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  if (typeof app?.close === 'function') {
    await app.close()
  }
}

async function readEnvelope<T>(response: Response, step: string): Promise<T> {
  const text = await response.text()
  let payload: Envelope<T>
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(`[${step}] response không phải JSON: ${text}`)
  }

  if (!response.ok) {
    throw new Error(`[${step}] HTTP ${response.status} ${payload.code ?? ''} ${payload.message ?? text}`.trim())
  }
  if (!payload.requestId) {
    throw new Error(`[${step}] thiếu requestId envelope`)
  }
  return payload.data as T
}

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` }
}

function withCorrelation(root: string, step: string, headers: Record<string, string> = {}) {
  return {
    'x-correlation-id': `${root}:${step}`,
    ...headers,
  }
}

function normalizeSmokeRole(value: unknown) {
  return normalizeAcceptedAuthRole(String(value ?? '').trim().toUpperCase())
}

function tinyPngBuffer() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0M2ioAAAAASUVORK5CYII=',
    'base64',
  )
}

async function main() {
  const smokeMediaDriver = String(process.env.SMOKE_MEDIA_DRIVER ?? 'LOCAL').trim().toUpperCase() || 'LOCAL'
  if (smokeMediaDriver === 'LOCAL') {
    process.env.MEDIA_STORAGE_DRIVER = 'LOCAL'
    process.env.UPLOAD_DIR = String(process.env.UPLOAD_DIR ?? 'uploads').trim() || 'uploads'
  }
  const fixture = getReleaseFixtureFromEnv()
  const currentProfile = String(process.env.PARKLY_APP_PROFILE ?? '').trim().toUpperCase() || 'DEVLOG'
  if (currentProfile !== RELEASE_GRANT_PROFILE) {
    console.log(`[smoke:bundle] INFO forcing parking_app grants profile to ${RELEASE_GRANT_PROFILE} (current=${currentProfile})`)
  }
  await applyParkingAppGrants({ profile: RELEASE_GRANT_PROFILE })
  if (smokeMediaDriver === 'LOCAL') {
    console.log('[smoke:bundle] media driver = LOCAL (không phụ thuộc MinIO)')
  }
  const { app, server, baseUrl } = await startServer()
  const correlationRoot = String(process.env.SMOKE_CORRELATION_ID ?? `smoke:${Date.now()}`).trim()
  const requireIncident = envFlag('SMOKE_REQUIRE_INCIDENT', true)
  const resolveIncidentAction = String(process.env.SMOKE_RESOLVE_ACTION ?? 'RESOLVED').trim().toUpperCase()

  try {
    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: withCorrelation(correlationRoot, 'auth.login', { 'content-type': 'application/json' }),
      body: JSON.stringify({
        username: fixture.username,
        password: fixture.password,
        role: fixture.role,
      }),
    })
    const loginData = await readEnvelope<LoginPayload>(login, 'auth/login')
    if (!loginData.accessToken || !loginData.refreshToken) {
      throw new Error('[auth/login] thiếu accessToken hoặc refreshToken')
    }

    const me = await fetch(`${baseUrl}/auth/me`, {
      headers: withCorrelation(correlationRoot, 'auth.me', { ...authHeader(loginData.accessToken) }),
    })
    const meData = await readEnvelope<LoginPayload['principal']>(me, 'auth/me')
    const expectedRole = normalizeSmokeRole(fixture.role) ?? String(fixture.role).toUpperCase()
    const actualRole = normalizeSmokeRole(meData.role) ?? String(meData.role).toUpperCase()
    if (actualRole !== expectedRole) {
      throw new Error(`[auth/me] role mismatch: expected=${fixture.role} got=${String(meData.role)}`)
    }

    const dashboard = await fetch(`${baseUrl}/ops/dashboard/summary?siteCode=${encodeURIComponent(fixture.siteCode)}`, {
      headers: withCorrelation(correlationRoot, 'dashboard.summary', { ...authHeader(loginData.accessToken) }),
    })
    const dashboardData = await readEnvelope<DashboardPayload>(dashboard, 'ops/dashboard/summary')
    if (!dashboardData || (dashboardData.overview == null && dashboardData.incidents == null)) {
      throw new Error('[ops/dashboard/summary] thiếu overview payload')
    }

    const form = new FormData()
    form.set('file', new Blob([tinyPngBuffer()], { type: 'image/png' }), 'smoke.png')
    const upload = await fetch(`${baseUrl}/media/upload`, {
      method: 'POST',
      headers: withCorrelation(correlationRoot, 'media.upload', { ...authHeader(loginData.accessToken) }),
      body: form,
    })
    const uploadData = await readEnvelope<MediaUploadPayload>(upload, 'media/upload')
    if (!uploadData.viewUrl && !uploadData.storageKind) {
      throw new Error('[media/upload] thiếu viewUrl/storage metadata trong smoke LOCAL fallback')
    }

    const presenceBody = buildSmokePresenceBody(fixture)
    const timestamp = String(Math.floor(Date.now() / 1000))
    const secret = String(process.env.INTERNAL_PRESENCE_HMAC_SECRET ?? '').trim()
    const apiKey = String(process.env.INTERNAL_PRESENCE_API_KEY ?? '').trim()
    if (!secret || !apiKey) {
      throw new Error('Thiếu INTERNAL_PRESENCE_API_KEY hoặc INTERNAL_PRESENCE_HMAC_SECRET để chạy smoke bundle')
    }
    const signature = computeZonePresenceSignature({ body: presenceBody, timestamp, secret })
    const intake = await fetch(`${baseUrl}/internal/presence-events`, {
      method: 'POST',
      headers: withCorrelation(correlationRoot, 'intake.presence', {
        'content-type': 'application/json',
        'x-internal-api-key': apiKey,
        'x-internal-timestamp': timestamp,
        'x-internal-signature': signature,
      }),
      body: JSON.stringify(presenceBody),
    })
    const intakeData = await readEnvelope<any>(intake, 'internal/presence-events')
    if (!intakeData || !['ACCEPTED', 'DEDUPED'].includes(String(intakeData.status))) {
      throw new Error(`[internal/presence-events] status không hợp lệ: ${JSON.stringify(intakeData)}`)
    }

    const occupancy = await fetch(
      `${baseUrl}/ops/spot-occupancy/${encodeURIComponent(fixture.spotCode)}?siteCode=${encodeURIComponent(fixture.siteCode)}&refresh=true`,
      { headers: withCorrelation(correlationRoot, 'reconcile.refresh', { ...authHeader(loginData.accessToken) }) },
    )
    const occupancyData = await readEnvelope<any>(occupancy, 'ops/spot-occupancy/:spotCode')
    if (!occupancyData?.row?.spotCode) {
      throw new Error('[ops/spot-occupancy/:spotCode] thiếu row payload')
    }

    const incidentsRes = await fetch(`${baseUrl}/ops/incidents?siteCode=${encodeURIComponent(fixture.siteCode)}&limit=20`, {
      headers: withCorrelation(correlationRoot, 'incidents.list', { ...authHeader(loginData.accessToken) }),
    })
    const incidentsData = await readEnvelope<IncidentsPayload>(incidentsRes, 'ops/incidents')
    const incident = incidentsData.rows.find((row) => row.status === 'OPEN' || row.status === 'ACKED') ?? incidentsData.rows[0] ?? null
    if (!incident && requireIncident) {
      throw new Error('[ops/incidents] smoke không tạo được incident để resolve')
    }

    let resolvedIncidentId: string | null = null
    if (incident) {
      const resolveRes = await fetch(`${baseUrl}/ops/incidents/${incident.incidentId}/resolve`, {
        method: 'POST',
        headers: withCorrelation(correlationRoot, 'incidents.resolve', { 'content-type': 'application/json', ...authHeader(loginData.accessToken) }),
        body: JSON.stringify({ action: resolveIncidentAction, note: 'Smoke bundle incident resolution' }),
      })
      const resolveData = await readEnvelope<any>(resolveRes, 'ops/incidents/:incidentId/resolve')
      resolvedIncidentId = String(resolveData?.incidentId ?? incident.incidentId)
      if (!resolveData || String(resolveData.status).toUpperCase() !== 'RESOLVED') {
        throw new Error(`[ops/incidents/:incidentId/resolve] resolve không thành công: ${JSON.stringify(resolveData)}`)
      }
    }

    const auditRes = await fetch(`${baseUrl}/ops/audit?siteCode=${encodeURIComponent(fixture.siteCode)}&entityTable=gate_incidents&limit=20`, {
      headers: withCorrelation(correlationRoot, 'audit.list', { ...authHeader(loginData.accessToken) }),
    })
    const auditData = await readEnvelope<AuditPayload>(auditRes, 'ops/audit')
    if (!Array.isArray(auditData.rows)) {
      throw new Error('[ops/audit] thiếu rows payload')
    }
    if (resolvedIncidentId && !auditData.rows.some((row) => String(row.entityId ?? '') === resolvedIncidentId)) {
      throw new Error('[ops/audit] không thấy audit row cho incident vừa resolve')
    }

    console.log('[smoke:bundle] OK', {
      baseUrl,
      role: fixture.role,
      siteCode: fixture.siteCode,
      spotCode: fixture.spotCode,
      incidentId: resolvedIncidentId,
      auditRows: auditData.rows.length,
      correlationRoot,
    })
  } finally {
    await stopServer(server, app)
  }
}

main().catch((error) => {
  console.error('[smoke:bundle] FAIL', error)
  process.exitCode = 1
})
