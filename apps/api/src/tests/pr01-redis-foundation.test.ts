import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const appRoot = process.cwd()
const appEntryUrl = pathToFileURL(path.resolve(appRoot, 'src/server/app.ts')).href
const redisLibUrl = pathToFileURL(path.resolve(appRoot, 'src/lib/redis.ts')).href

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

test('boot API vẫn lên khi REDIS_REQUIRED=OFF và Redis không khả dụng', async () => {
  const result = await runTsxInline(
    `
      const appModule = await import(${JSON.stringify(appEntryUrl)});
      const buildApp = appModule.buildApp ?? appModule.default?.buildApp;
      if (typeof buildApp !== 'function') {
        throw new Error('buildApp export not found');
      }
      const app = await buildApp();
      await app.close?.();
      console.log('APP_READY');
    `,
    {
      REDIS_URL: 'redis://127.0.0.1:6399',
      REDIS_REQUIRED: 'OFF',
      REDIS_DB: '0',
      REDIS_PREFIX: 'parkly:test:off',
      REDIS_TLS: 'OFF',
    },
  )

  assert.equal(result.code, 0)
  assert.match(result.stdout, /APP_READY/)
})

test('boot API fail-fast khi REDIS_REQUIRED=ON và Redis không khả dụng', async () => {
  const result = await runTsxInline(
    `
      const appModule = await import(${JSON.stringify(appEntryUrl)});
      const buildApp = appModule.buildApp ?? appModule.default?.buildApp;
      if (typeof buildApp !== 'function') {
        throw new Error('buildApp export not found');
      }
      await buildApp();
      console.log('UNEXPECTED_SUCCESS');
    `,
    {
      REDIS_URL: 'redis://127.0.0.1:6399',
      REDIS_REQUIRED: 'ON',
      REDIS_DB: '0',
      REDIS_PREFIX: 'parkly:test:on',
      REDIS_TLS: 'OFF',
    },
  )

  assert.notEqual(result.code, 0)
  assert.doesNotMatch(result.stdout, /UNEXPECTED_SUCCESS/)
  assert.match(`${result.stdout}\n${result.stderr}`, /Redis is required but unavailable/i)
})

test('ping Redis thật khi có REDIS_TEST_URL hoặc REDIS_URL chạy sẵn', async (t) => {
  const redisUrl = process.env.REDIS_TEST_URL ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'

  const result = await runTsxInline(
    `
      const redisModule = await import(${JSON.stringify(redisLibUrl)});
      const getRedisHealth = redisModule.getRedisHealth ?? redisModule.default?.getRedisHealth;
      const closeRedis = redisModule.closeRedis ?? redisModule.default?.closeRedis;
      if (typeof getRedisHealth !== 'function' || typeof closeRedis !== 'function') {
        throw new Error('Redis exports not found');
      }
      const health = await getRedisHealth({ forceRefresh: true });
      console.log(JSON.stringify(health));
      await closeRedis();
    `,
    {
      REDIS_URL: redisUrl,
      REDIS_REQUIRED: 'ON',
      REDIS_DB: process.env.REDIS_DB ?? '0',
      REDIS_PREFIX: process.env.REDIS_PREFIX ?? 'parkly:test:integration',
      REDIS_TLS: process.env.REDIS_TLS ?? 'OFF',
    },
  )

  if (result.code !== 0) {
    t.skip(`Không có Redis thật để ping tại ${redisUrl}. stderr=${result.stderr || 'n/a'}`)
    return
  }

  const lines = result.stdout.trim().split(/\r?\n/)
  const payload = JSON.parse(lines.at(-1) ?? '{}')

  assert.equal(payload.available, true)
  assert.equal(payload.ready, true)
  assert.equal(payload.required, true)
  assert.equal(typeof payload.latencyMs, 'number')
})
