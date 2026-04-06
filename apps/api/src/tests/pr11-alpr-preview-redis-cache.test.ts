import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const appRoot = process.cwd()
const redisLibUrl = pathToFileURL(path.resolve(appRoot, 'src/lib/redis.ts')).href
const rateLimitStoreUrl = pathToFileURL(path.resolve(appRoot, 'src/server/rate-limit-store.ts')).href
const previewCacheUrl = pathToFileURL(path.resolve(appRoot, 'src/server/services/alpr-preview-cache.ts')).href

function runTsxInline(script: string, env: Record<string, string | undefined>) {
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', '--eval', script],
      {
        env: {
          ...process.env,
          ...env,
        },
        cwd: appRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('close', (code, signal) => {
      resolve({ code, signal, stdout, stderr })
    })
  })
}

function buildEnv(scope: string, extra: Record<string, string> = {}) {
  const redisUrl = process.env.REDIS_TEST_URL ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'

  return {
    REDIS_URL: redisUrl,
    REDIS_REQUIRED: 'ON',
    REDIS_DB: process.env.REDIS_DB ?? '0',
    REDIS_PREFIX: `parkly:test:pr11:${scope}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    REDIS_TLS: process.env.REDIS_TLS ?? 'OFF',
    API_RATE_LIMIT_BACKEND: 'REDIS',
    PREVIEW_CACHE_BACKEND: 'REDIS',
    PREVIEW_CACHE_DEDUPE_TTL_MS: '3000',
    PREVIEW_CACHE_RESPONSE_TTL_MS: '2000',
    PREVIEW_CACHE_POLL_INTERVAL_MS: '80',
    PREVIEW_CACHE_DEBUG_HEADERS: 'OFF',
    ...extra,
  }
}

async function ensureRedisAvailable(t: test.TestContext, env: Record<string, string>) {
  const script =
    "const redisModule = await import(" + JSON.stringify(redisLibUrl) + ");" +
    "const getRedisHealth = redisModule.getRedisHealth ?? redisModule.default?.getRedisHealth;" +
    "const closeRedis = redisModule.closeRedis ?? redisModule.default?.closeRedis;" +
    "const health = await getRedisHealth({ forceRefresh: true });" +
    "console.log(JSON.stringify(health));" +
    "await closeRedis();"

  const result = await runTsxInline(script, env)

  if (result.code !== 0) {
    t.skip(`Redis is unavailable for PR11 tests. stderr=${result.stderr || 'n/a'}`)
    return false
  }

  const payload = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1) ?? '{}')
  if (!payload.available) {
    t.skip(`Redis healthcheck is not available. payload=${JSON.stringify(payload)}`)
    return false
  }

  return true
}

test('multi-instance simulation shares the same Redis rate-limit counter', async (t) => {
  const env = buildEnv('rate-limit')
  if (!await ensureRedisAvailable(t, env)) return

  const script =
    "const storeModule = await import(" + JSON.stringify(rateLimitStoreUrl) + ");" +
    "const redisModule = await import(" + JSON.stringify(redisLibUrl) + ");" +
    "const createRedisRateLimitStore = storeModule.createRedisRateLimitStore ?? storeModule.default?.createRedisRateLimitStore;" +
    "const closeRedis = redisModule.closeRedis ?? redisModule.default?.closeRedis;" +
    "const store = createRedisRateLimitStore({ prefix: process.env.API_RATE_LIMIT_PREFIX ?? 'parkly:test:rate-limit', windowMs: 60000 });" +
    "const result = await store.increment('same-user-key');" +
    "console.log(JSON.stringify(result));" +
    "await closeRedis();"

  const envWithPrefix = {
    ...env,
    API_RATE_LIMIT_PREFIX: `${env.REDIS_PREFIX}:rl-store`,
  }

  const first = await runTsxInline(script, envWithPrefix)
  const second = await runTsxInline(script, envWithPrefix)

  assert.equal(first.code, 0, first.stderr)
  assert.equal(second.code, 0, second.stderr)

  const firstPayload = JSON.parse(first.stdout.trim().split(/\r?\n/).at(-1) ?? '{}')
  const secondPayload = JSON.parse(second.stdout.trim().split(/\r?\n/).at(-1) ?? '{}')

  assert.equal(firstPayload.totalHits, 1)
  assert.equal(secondPayload.totalHits, 2)
})

test('preview dedupe suppresses duplicate in-flight OCR work via Redis', async (t) => {
  const env = buildEnv('preview-dedupe')
  if (!await ensureRedisAvailable(t, env)) return

  const script =
    "const cacheModule = await import(" + JSON.stringify(previewCacheUrl) + ");" +
    "const redisModule = await import(" + JSON.stringify(redisLibUrl) + ");" +
    "const resolveAlprPreviewCached = cacheModule.resolveAlprPreviewCached ?? cacheModule.default?.resolveAlprPreviewCached;" +
    "const closeRedis = redisModule.closeRedis ?? redisModule.default?.closeRedis;" +
    "let computeCount = 0;" +
    "const scope = {" +
      "surface: 'POST /api/alpr/preview'," +
      "siteCode: 'SITE_DN_01'," +
      "laneCode: 'GATE_01_ENTRY'," +
      "imageUrl: '/uploads/sample-preview-01.jpg'," +
      "plateHint: '51A12345'" +
    "};" +
    "const compute = async () => {" +
      "computeCount += 1;" +
      "await new Promise((resolve) => setTimeout(resolve, 250));" +
      "return {" +
        "recognizedPlate: '51A12345'," +
        "confidence: 0.98," +
        "previewStatus: 'STRICT_VALID'" +
      "};" +
    "};" +
    "const results = await Promise.all([" +
      "resolveAlprPreviewCached(scope, compute)," +
      "resolveAlprPreviewCached(scope, compute)" +
    "]);" +
    "console.log(JSON.stringify({" +
      "computeCount," +
      "statuses: results.map((item) => item.meta.status)," +
      "values: results.map((item) => item.value)" +
    "}));" +
    "await closeRedis();"

  const result = await runTsxInline(script, env)

  assert.equal(result.code, 0, result.stderr)

  const payload = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1) ?? '{}')
  assert.equal(payload.computeCount, 1)
  assert.match(payload.statuses.join(','), /MISS/)
  assert.match(payload.statuses.join(','), /DEDUPED/)
  assert.equal(payload.values[0].recognizedPlate, '51A12345')
  assert.equal(payload.values[1].recognizedPlate, '51A12345')
})

test('preview response cache returns HIT inside TTL and MISS again after TTL expiry', async (t) => {
  const env = buildEnv('preview-cache-ttl', {
    PREVIEW_CACHE_DEDUPE_TTL_MS: '3000',
    PREVIEW_CACHE_RESPONSE_TTL_MS: '1000',
    PREVIEW_CACHE_POLL_INTERVAL_MS: '50',
  })
  if (!await ensureRedisAvailable(t, env)) return

  const script =
    "const cacheModule = await import(" + JSON.stringify(previewCacheUrl) + ");" +
    "const redisModule = await import(" + JSON.stringify(redisLibUrl) + ");" +
    "const resolveAlprPreviewCached = cacheModule.resolveAlprPreviewCached ?? cacheModule.default?.resolveAlprPreviewCached;" +
    "const closeRedis = redisModule.closeRedis ?? redisModule.default?.closeRedis;" +
    "let computeCount = 0;" +
    "const scope = {" +
      "surface: 'POST /api/alpr/recognize'," +
      "siteCode: 'SITE_HCM_01'," +
      "laneCode: 'LANE_A'," +
      "imageUrl: '/uploads/recognize-01.jpg'," +
      "plateHint: '30F99999'" +
    "};" +
    "const compute = async () => {" +
      "computeCount += 1;" +
      "return {" +
        "recognizedPlate: '30F99999'," +
        "confidence: 0.91," +
        "previewStatus: 'STRICT_VALID'" +
      "};" +
    "};" +
    "const first = await resolveAlprPreviewCached(scope, compute);" +
    "const second = await resolveAlprPreviewCached(scope, compute);" +
    "await new Promise((resolve) => setTimeout(resolve, 1200));" +
    "const third = await resolveAlprPreviewCached(scope, compute);" +
    "console.log(JSON.stringify({" +
      "computeCount," +
      "statuses: [first.meta.status, second.meta.status, third.meta.status]" +
    "}));" +
    "await closeRedis();"

  const result = await runTsxInline(script, env)

  assert.equal(result.code, 0, result.stderr)

  const payload = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1) ?? '{}')
  assert.equal(payload.computeCount, 2)
  assert.deepEqual(payload.statuses, ['MISS', 'HIT', 'MISS'])
})