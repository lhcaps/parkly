import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.WEB_BASE_URL || '',
    apiUrl: process.env.SMOKE_API_URL || '',
    host: process.env.SMOKE_WEB_HOST || '127.0.0.1',
    port: Number(process.env.SMOKE_WEB_PORT || '4173'),
    serveDist: false,
    holdOpen: false,
    strictApi: false,
    jsonOut: process.env.SMOKE_JSON_OUT || '',
    waitMs: Number(process.env.SMOKE_WAIT_MS || '12000'),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--baseUrl') options.baseUrl = argv[index + 1] || options.baseUrl
    if (value === '--apiUrl') options.apiUrl = argv[index + 1] || options.apiUrl
    if (value === '--host') options.host = argv[index + 1] || options.host
    if (value === '--port') options.port = Number(argv[index + 1] || options.port)
    if (value === '--jsonOut') options.jsonOut = argv[index + 1] || options.jsonOut
    if (value === '--waitMs') options.waitMs = Number(argv[index + 1] || options.waitMs)
    if (value === '--serve-dist') options.serveDist = true
    if (value === '--hold-open') options.holdOpen = true
    if (value === '--strict-api') options.strictApi = true
  }

  return options
}

const DIST_DIR = path.resolve(process.cwd(), 'dist')
const INDEX_HTML = path.join(DIST_DIR, 'index.html')

const ROUTES = [
  { name: 'login', path: '/login' },
  { name: 'overview', path: '/overview' },
  { name: 'run-lane', path: '/run-lane?siteCode=SITE_HCM_01&gateCode=GATE_01&laneCode=GATE_01_ENTRY' },
  { name: 'review-queue', path: '/review-queue?siteCode=SITE_HCM_01&status=OPEN&q=43A&reviewId=RV-1001' },
  { name: 'session-history', path: '/session-history?siteCode=SITE_HCM_01&status=OPEN&q=43A&sessionId=GS-1001' },
  { name: 'audit-viewer', path: '/audit-viewer?siteCode=SITE_HCM_01&quick=request&requestId=req-demo-001&auditId=AU-1001' },
  { name: 'sync-outbox', path: '/sync-outbox?siteCode=SITE_HCM_01&status=FAILED&quick=failed&outboxId=OB-1001' },
  { name: 'reports', path: '/reports?siteCode=SITE_HCM_01&days=7' },
  { name: 'mobile-camera-pair', path: '/mobile-camera-pair' },
  { name: 'mobile-capture', path: '/mobile-capture?siteCode=SITE_HCM_01&laneCode=GATE_01_ENTRY' },
]

function mimeType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8'
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8'
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8'
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg'
  if (filePath.endsWith('.woff2')) return 'font/woff2'
  return 'application/octet-stream'
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withLocalhostFallback(baseUrl) {
  try {
    const url = new URL(baseUrl)
    if (url.hostname === '127.0.0.1') {
      url.hostname = 'localhost'
      return url.toString().replace(/\/$/, '')
    }
  } catch {
    return ''
  }
  return ''
}

function apiHealthTargets(apiUrl) {
  const base = new URL(apiUrl)
  const origin = `${base.protocol}//${base.host}`
  const pathname = base.pathname.replace(/\/$/, '')
  const candidates = [
    new URL('/api/health', origin).toString(),
    new URL('/health', origin).toString(),
  ]

  if (pathname && pathname !== '/api') {
    candidates.unshift(new URL(`${pathname}/health`, origin).toString())
  }

  return Array.from(new Set(candidates))
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath)
    return info.isFile()
  } catch {
    return false
  }
}

async function serveFile(response, filePath) {
  const body = await readFile(filePath)
  response.writeHead(200, {
    'content-type': mimeType(filePath),
    'cache-control': 'no-store',
  })
  response.end(body)
}

async function createSpaServer({ host, port }) {
  if (!(await fileExists(INDEX_HTML))) {
    throw new Error(`Không tìm thấy dist/index.html tại ${INDEX_HTML}. Hãy chạy pnpm build trước.`)
  }

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`)
      const requestPath = decodeURIComponent(url.pathname)
      const candidate = path.resolve(DIST_DIR, `.${requestPath}`)
      const safeInsideDist = candidate === DIST_DIR || candidate.startsWith(`${DIST_DIR}${path.sep}`)

      if (safeInsideDist && await fileExists(candidate)) {
        await serveFile(response, candidate)
        return
      }

      await serveFile(response, INDEX_HTML)
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(error instanceof Error ? error.message : String(error))
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => resolve())
  })

  return server
}

async function tryFetch(url, init) {
  return fetch(url, init)
}

async function waitForBaseUrl(baseUrl, waitMs) {
  const startedAt = Date.now()
  const candidates = [baseUrl]
  const localhostFallback = withLocalhostFallback(baseUrl)
  if (localhostFallback) candidates.push(localhostFallback)

  let lastError = null
  while (Date.now() - startedAt < waitMs) {
    for (const candidate of candidates) {
      try {
        const response = await tryFetch(candidate, {
          method: 'GET',
          headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
        })
        const body = await response.text()
        if (response.ok && (body.includes('id="root"') || body.includes("id='root'") || body.includes('/assets/'))) {
          return candidate
        }
        lastError = new Error(`Base URL trả về ${response.status} nhưng không giống shell SPA.`)
      } catch (error) {
        lastError = error
      }
    }
    await sleep(400)
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError ?? 'Unknown startup error')
  throw new Error(`Không kết nối được web dev server sau ${waitMs}ms. Hãy giữ pnpm dev đang chạy ở terminal khác. Chi tiết: ${detail}`)
}

async function checkRoute(baseUrl, route) {
  const url = new URL(route.path, baseUrl)
  const startedAt = Date.now()
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  })
  const body = await response.text()
  const ok = response.ok && (body.includes('id="root"') || body.includes("id='root'") || body.includes('/assets/'))

  return {
    name: route.name,
    path: route.path,
    status: response.status,
    ok,
    durationMs: Date.now() - startedAt,
    bodyHint: body.slice(0, 120).replace(/\s+/g, ' '),
  }
}

async function checkApi(apiUrl) {
  if (!apiUrl) {
    return { skipped: true, ok: true, message: 'Bỏ qua API health vì chưa truyền --apiUrl hoặc SMOKE_API_URL.' }
  }

  const startedAt = Date.now()
  const attempts = []
  for (const target of apiHealthTargets(apiUrl)) {
    try {
      const response = await fetch(target)
      const payload = await response.text()
      const result = {
        skipped: false,
        ok: response.ok,
        status: response.status,
        durationMs: Date.now() - startedAt,
        target,
        bodyHint: payload.slice(0, 160).replace(/\s+/g, ' '),
        attempts,
      }
      attempts.push({ target, status: response.status, ok: response.ok })
      if (response.ok) return result
    } catch (error) {
      attempts.push({ target, ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  const last = attempts[attempts.length - 1] || null
  return {
    skipped: false,
    ok: false,
    target: last?.target || apiUrl,
    durationMs: Date.now() - startedAt,
    bodyHint: last?.error || `Không endpoint health nào trong ${apiHealthTargets(apiUrl).join(', ')} trả về 2xx.`,
    attempts,
  }
}

async function writeJson(filePath, payload) {
  if (!filePath) return
  const fs = await import('node:fs/promises')
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function printRoute(result) {
  const prefix = result.ok ? 'PASS' : 'FAIL'
  console.log(`[${prefix}] ${result.name.padEnd(18)} ${String(result.status).padEnd(4)} ${String(result.durationMs).padStart(4)}ms  ${result.path}`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const startedAt = new Date().toISOString()
  let server = null
  let baseUrl = options.baseUrl

  try {
    if (options.serveDist) {
      server = await createSpaServer({ host: options.host, port: options.port })
      baseUrl = `http://${options.host}:${options.port}`
      console.log(`[info] Đang serve dist theo kiểu SPA fallback tại ${baseUrl}`)
    }

    if (!baseUrl) {
      baseUrl = `http://${options.host}:${options.port}`
    }

    if (!options.serveDist) {
      baseUrl = await waitForBaseUrl(baseUrl, options.waitMs)
      console.log(`[info] Smoke đang kiểm web tại ${baseUrl}`)
    }

    const results = []
    for (const route of ROUTES) {
      const result = await checkRoute(baseUrl, route)
      results.push(result)
      printRoute(result)
    }

    const api = await checkApi(options.apiUrl)
    console.log(api.skipped ? `[skip] ${api.message}` : `[${api.ok ? 'PASS' : 'WARN'}] api-health ${api.status ?? '-'} ${api.durationMs ?? 0}ms ${api.target}`)

    const summary = {
      startedAt,
      baseUrl,
      api,
      routes: results,
      passCount: results.filter((item) => item.ok).length,
      failCount: results.filter((item) => !item.ok).length,
    }

    if (!options.jsonOut && options.serveDist) {
      options.jsonOut = path.resolve(process.cwd(), 'docs/frontend/evidence/latest-smoke.json')
    }
    await writeJson(options.jsonOut, summary)

    if (options.holdOpen) {
      console.log('[info] Server đang giữ mở để bạn tự test thủ công. Nhấn Ctrl+C để dừng.')
      return
    }

    if (summary.failCount > 0) {
      process.exitCode = 1
      return
    }

    if (!api.ok && options.strictApi) {
      process.exitCode = 1
    }
  } finally {
    if (server && !options.holdOpen) {
      await new Promise((resolve) => server.close(resolve))
    }
  }
}

main().catch((error) => {
  console.error(`[smoke-web] failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
