import 'dotenv/config'

import { once } from 'node:events'
import { createServer, type Server } from 'node:http'

import { getReleaseFixtureFromEnv } from './release-bundle'

type Envelope<T> = {
  requestId: string
  data?: T
  code?: string
  message?: string
}

type LoginPayload = {
  accessToken: string
  principal: { role: string }
}

type DashboardPayload = {
  overview?: unknown
  incidents?: unknown
}

type IncidentsPayload = {
  rows: unknown[]
}

type AuditPayload = {
  rows: unknown[]
}

function withCorrelation(root: string, step: string, headers: Record<string, string> = {}) {
  return {
    'x-correlation-id': `${root}:${step}`,
    ...headers,
  }
}

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` }
}

async function startServer() {
  const { buildApp } = await import('../server/app')
  const { config } = await import('../server/config')
  const app = await buildApp()
  const server = createServer(app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Không resolve được cổng restore verify server')
  return { app, server, baseUrl: `http://127.0.0.1:${address.port}${config.prefix}` }
}

async function stopServer(server: Server, app: any) {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  if (typeof app?.close === 'function') await app.close()
}

async function readEnvelope<T>(response: Response, step: string) {
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
  if (!payload.requestId) throw new Error(`[${step}] thiếu requestId envelope`)
  return payload.data as T
}

export async function performRestoreVerification(options?: { env?: NodeJS.ProcessEnv }) {
  const env = options?.env ?? process.env
  const fixture = getReleaseFixtureFromEnv()
  const correlationRoot = String(env.RESTORE_VERIFY_CORRELATION_ID ?? `restore:${Date.now()}`).trim()
  const { app, server, baseUrl } = await startServer()

  try {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: withCorrelation(correlationRoot, 'auth.login', { 'content-type': 'application/json' }),
      body: JSON.stringify({ username: fixture.username, password: fixture.password, role: fixture.role }),
    })
    const login = await readEnvelope<LoginPayload>(loginRes, 'auth/login')
    if (!login.accessToken) throw new Error('[auth/login] thiếu accessToken')

    const dashboardRes = await fetch(`${baseUrl}/ops/dashboard/summary?siteCode=${encodeURIComponent(fixture.siteCode)}`, {
      headers: withCorrelation(correlationRoot, 'dashboard.summary', { ...authHeader(login.accessToken) }),
    })
    const dashboard = await readEnvelope<DashboardPayload>(dashboardRes, 'ops/dashboard/summary')
    if (dashboard.overview == null && dashboard.incidents == null) {
      throw new Error('[ops/dashboard/summary] thiếu payload overview/incidents sau restore')
    }

    const incidentsRes = await fetch(`${baseUrl}/ops/incidents?siteCode=${encodeURIComponent(fixture.siteCode)}&limit=20`, {
      headers: withCorrelation(correlationRoot, 'incidents.list', { ...authHeader(login.accessToken) }),
    })
    const incidents = await readEnvelope<IncidentsPayload>(incidentsRes, 'ops/incidents')
    if (!Array.isArray(incidents.rows)) throw new Error('[ops/incidents] thiếu rows payload')

    const auditRes = await fetch(`${baseUrl}/ops/audit?siteCode=${encodeURIComponent(fixture.siteCode)}&entityTable=gate_incidents&limit=20`, {
      headers: withCorrelation(correlationRoot, 'audit.list', { ...authHeader(login.accessToken) }),
    })
    const audit = await readEnvelope<AuditPayload>(auditRes, 'ops/audit')
    if (!Array.isArray(audit.rows)) throw new Error('[ops/audit] thiếu rows payload')

    return {
      baseUrl,
      role: fixture.role,
      siteCode: fixture.siteCode,
      incidents: incidents.rows.length,
      auditRows: audit.rows.length,
      correlationRoot,
    }
  } finally {
    await stopServer(server, app)
  }
}

async function main() {
  const result = await performRestoreVerification()
  console.log('[restore:verify] OK', JSON.stringify(result, null, 2))
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[restore:verify] FAIL', error)
    process.exitCode = 1
  })
}
