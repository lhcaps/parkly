import http from 'node:http'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

function parseArgs(argv) {
  const requestedMode = process.env.SMOKE_MODE || ''
  const options = {
    mode: requestedMode === 'dist' ? 'dist' : 'dev',
    baseUrl: process.env.WEB_BASE_URL || '',
    apiUrl: process.env.SMOKE_API_URL || '',
    host: process.env.SMOKE_WEB_HOST || '127.0.0.1',
    port: Number(process.env.SMOKE_WEB_PORT || (requestedMode === 'dist' ? '4173' : '5173')),
    serveDist: requestedMode === 'dist',
    holdOpen: false,
    strictApi: false,
    jsonOut: process.env.SMOKE_JSON_OUT || '',
    evidenceDir: process.env.SMOKE_EVIDENCE_DIR || '',
    waitMs: Number(process.env.SMOKE_WAIT_MS || '12000'),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--baseUrl') options.baseUrl = argv[index + 1] || options.baseUrl
    if (value === '--apiUrl') options.apiUrl = argv[index + 1] || options.apiUrl
    if (value === '--host') options.host = argv[index + 1] || options.host
    if (value === '--port') options.port = Number(argv[index + 1] || options.port)
    if (value === '--jsonOut') options.jsonOut = argv[index + 1] || options.jsonOut
    if (value === '--evidenceDir') options.evidenceDir = argv[index + 1] || options.evidenceDir
    if (value === '--waitMs') options.waitMs = Number(argv[index + 1] || options.waitMs)
    if (value === '--serve-dist' || value === '--dist') {
      options.mode = 'dist'
      options.serveDist = true
      if (!process.env.SMOKE_WEB_PORT) options.port = 4173
    }
    if (value === '--dev') {
      options.mode = 'dev'
      options.serveDist = false
      if (!process.env.SMOKE_WEB_PORT) options.port = 5173
    }
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
  { name: 'sync-outbox', path: '/sync-outbox?siteCode=SITE_HCM_01&status=FAILED&quick=failed&outboxId=OB-1001' },
  { name: 'reports', path: '/reports?siteCode=SITE_HCM_01&days=7' },
  { name: 'subscriptions', path: '/subscriptions?siteCode=SITE_HCM_01&id=sub_demo_01&tab=vehicles' },
  { name: 'parking-live', path: '/parking-live?siteCode=SITE_HCM_01&floor=F1&density=compact' },
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
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function writeText(filePath, body) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, body, 'utf8')
}

function printRoute(result) {
  const prefix = result.ok ? 'PASS' : 'FAIL'
  console.log(`[${prefix}] ${result.name.padEnd(18)} ${String(result.status).padEnd(4)} ${String(result.durationMs).padStart(4)}ms  ${result.path}`)
}

function summaryNotes(summary) {
  const notes = []
  if (summary.failCount > 0) {
    notes.push('Có route shell fail. Chưa được phép chuyển sang manual smoke trên mobile/review.')
  }
  if (!summary.api.ok) {
    notes.push('API health chưa xanh hoàn toàn. Manual smoke vẫn có thể tiếp tục nếu service cần thiết cho flow đang reachable.')
  }
  notes.push('Smoke script này chỉ chứng minh shell route + health availability. Nó không thay thế operator flow pair -> heartbeat -> capture -> review.')
  notes.push('Evidence thủ công phải lưu thêm screenshot QR origin, mobile context summary, requestId của heartbeat/capture và terminal lock banner nếu có.')
  return notes
}

async function writeEvidenceScaffold(evidenceDir, summary) {
  if (!evidenceDir) return
  const latestSmoke = path.join(evidenceDir, `latest-smoke-${summary.mode}.json`)
  const runSheet = path.join(evidenceDir, 'manual-run-sheet.md')
  const closureNotes = path.join(evidenceDir, 'bug-closure-notes.md')

  await writeJson(latestSmoke, summary)
  const manualRunSheet = [
    '# Frontend mobile-review smoke run sheet',
    '',
    `- Started at: ${summary.startedAt}`,
    `- Base URL: ${summary.baseUrl}`,
    `- API target: ${summary.api.target ?? 'n/a'}`,
    `- Smoke pass/fail: ${summary.passCount}/${summary.routes.length}`,
    '',
    '## Preconditions',
    '- [ ] Desktop va iPhone cung subnet',
    '- [ ] Web bind 0.0.0.0 hoac origin LAN dung',
    '- [ ] API reachable tu iPhone',
    '- [ ] Device secret dung',
    '- [ ] User shell dang nhap hop le',
    '',
    '## Round 1 - happy path',
    '- [ ] Pair tao tu desktop co origin LAN dung',
    '- [ ] iPhone mo link pair thanh cong',
    '- [ ] Heartbeat thanh cong hoac fail dung secret hien tai',
    '- [ ] Capture di dung route device-signed',
    '- [ ] Session/review detail cap nhat dung',
    '',
    '## Round 2 - fresh pair token',
    '- [ ] Pair moi hoan toan',
    '- [ ] Khong drift ve origin cu',
    '- [ ] Khong reuse state cu sai',
    '',
    '## Round 3 - edit secret giua chung',
    '- [ ] Link pair ban dau co secret A',
    '- [ ] Form sua thanh secret B',
    '- [ ] Heartbeat theo secret B',
    '- [ ] Capture theo secret B',
    '- [ ] Shell khong logout do device 401',
    '',
    '## Terminal lock check',
    '- [ ] Session terminal hien thi lock banner',
    '- [ ] UI khong con action usable trai allowedActions',
    '',
    '## Evidence files',
    '- [ ] screenshot-pair-origin.png',
    '- [ ] screenshot-mobile-context.png',
    '- [ ] screenshot-heartbeat-status.png',
    '- [ ] screenshot-capture-status.png',
    '- [ ] screenshot-session-or-review-detail.png',
    '- [ ] screenshot-terminal-lock.png',
    `- [ ] latest-smoke-${summary.mode}.json`,
    '',
    '## Notes',
    '',
  ].join('\\n')

  const bugClosureTemplate = `# Bug closure notes\n\n## qr-localhost-drift\n- Status: OPEN\n- Verified on:\n- Build / patch:\n- Evidence:\n  - screenshot:\n  - requestId: n/a\n  - smoke run:\n- Notes:\n\n## stale-device-secret\n- Status: OPEN\n- Verified on:\n- Build / patch:\n- Evidence:\n  - screenshot:\n  - requestId:\n  - smoke run:\n- Notes:\n\n## wrong-media-upload-surface\n- Status: OPEN\n- Verified on:\n- Build / patch:\n- Evidence:\n  - screenshot:\n  - requestId: n/a\n  - smoke run:\n- Notes:\n\n## device-401-shell-logout\n- Status: OPEN\n- Verified on:\n- Build / patch:\n- Evidence:\n  - screenshot:\n  - requestId:\n  - smoke run:\n- Notes:\n\n## stale-review-session-actions\n- Status: OPEN\n- Verified on:\n- Build / patch:\n- Evidence:\n  - screenshot:\n  - requestId:\n  - smoke run:\n- Notes:\n`

  await writeText(runSheet, manualRunSheet)
  await writeText(closureNotes, bugClosureTemplate)
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
      mode: options.mode,
      baseUrl,
      api,
      routes: results,
      passCount: results.filter((item) => item.ok).length,
      failCount: results.filter((item) => !item.ok).length,
      preconditions: [
        'desktop và iPhone cùng subnet',
        'web bind 0.0.0.0 hoặc origin LAN đúng',
        'API reachable từ mobile device',
        'device secret đúng',
      ],
      notes: [],
    }

    summary.notes = summaryNotes(summary)

    if (!options.jsonOut) {
      options.jsonOut = path.resolve(process.cwd(), `docs/frontend/evidence/latest-smoke-${options.mode}.json`)
    }
    if (!options.evidenceDir) {
      options.evidenceDir = path.resolve(process.cwd(), '../../release-evidence/frontend-mobile-review')
    }

    await writeJson(options.jsonOut, summary)
    await writeEvidenceScaffold(options.evidenceDir, summary)

    for (const note of summary.notes) {
      console.log(`[note] ${note}`)
    }
    console.log(`[info] Smoke JSON: ${options.jsonOut}`)
    console.log(`[info] Evidence scaffold: ${options.evidenceDir}`)

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
