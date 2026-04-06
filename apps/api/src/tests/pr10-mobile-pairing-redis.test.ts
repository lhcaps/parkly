import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const appRoot = process.cwd()
const redisLibUrl = pathToFileURL(path.resolve(appRoot, 'src/lib/redis.ts')).href
const pairingServiceUrl = pathToFileURL(path.resolve(appRoot, 'src/server/services/mobile-pairing.service.ts')).href
const authRevocationUrl = pathToFileURL(path.resolve(appRoot, 'src/server/services/auth-revocation.service.ts')).href

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildEnv(scope: string, extra: Record<string, string> = {}) {
  const redisUrl = process.env.REDIS_TEST_URL ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'

  return {
    NODE_ENV: 'test',
    DOTENV_CONFIG_QUIET: 'true',
    MOBILE_PAIRING_VERBOSE_LOGS: 'OFF',
    REDIS_URL: redisUrl,
    REDIS_REQUIRED: 'ON',
    REDIS_DB: process.env.REDIS_DB ?? '0',
    REDIS_PREFIX: `parkly:test:pr10:${scope}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    REDIS_TLS: process.env.REDIS_TLS ?? 'OFF',
    MOBILE_PAIR_TTL_SEC: '20',
    MOBILE_PAIR_REFRESH_ON_ACCESS: 'OFF',
    MOBILE_PAIR_REFRESH_THRESHOLD_SEC: '5',
    ...extra,
  }
}

async function ensureRedisAvailable(t: test.TestContext, env: Record<string, string>) {
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
    env,
  )

  if (result.code !== 0) {
    t.skip(`Redis is unavailable for PR10 tests. stderr=${result.stderr || 'n/a'}`)
    return false
  }

  const lines = result.stdout.trim().split(/\r?\n/)
  const payload = JSON.parse(lines.at(-1) ?? '{}')
  if (!payload.available) {
    t.skip(`Redis healthcheck is not available. payload=${JSON.stringify(payload)}`)
    return false
  }

  return true
}

test('create pair token and read it back from Redis', async (t) => {
  const env = buildEnv('create-read')
  if (!await ensureRedisAvailable(t, env)) return

  const result = await runTsxInline(
    `
      const pairingModule = await import(${JSON.stringify(pairingServiceUrl)});
      const redisModule = await import(${JSON.stringify(redisLibUrl)});
      const createMobilePairing = pairingModule.createMobilePairing ?? pairingModule.default?.createMobilePairing;
      const getMobilePairing = pairingModule.getMobilePairing ?? pairingModule.default?.getMobilePairing;
      const closeRedis = redisModule.closeRedis ?? redisModule.default?.closeRedis;
      if (typeof createMobilePairing !== 'function' || typeof getMobilePairing !== 'function') {
        throw new Error('Pairing exports not found');
      }
      const created = await createMobilePairing({
        siteCode: 'site_dn_01',
        laneCode: 'gate_01_entry',
        direction: 'ENTRY',
        deviceCode: 'gate_01_entry_cam_mobile',
      });
      const fetched = await getMobilePairing(created.pairToken, { refreshTtlOnAccess: false });
      console.log(JSON.stringify(created));
      console.log(JSON.stringify(fetched));
      await closeRedis();
    `,
    env,
  )

  assert.equal(result.code, 0, result.stderr)

  const lines = result.stdout.trim().split(/\r?\n/)
  const created = JSON.parse(lines.at(-2) ?? '{}')
  const fetched = JSON.parse(lines.at(-1) ?? '{}')

  assert.equal(created.siteCode, 'SITE_DN_01')
  assert.equal(created.laneCode, 'GATE_01_ENTRY')
  assert.equal(created.deviceCode, 'GATE_01_ENTRY_CAM_MOBILE')
  assert.equal(created.direction, 'ENTRY')
  assert.equal(fetched.pairToken, created.pairToken)
  assert.equal(fetched.siteCode, created.siteCode)
  assert.equal(fetched.laneCode, created.laneCode)
})

test('pair token survives process restart because Redis is the source of truth', async (t) => {
  const env = buildEnv('restart-safe')
  if (!await ensureRedisAvailable(t, env)) return

  const createResult = await runTsxInline(
    `
      const pairingModule = await import(${JSON.stringify(pairingServiceUrl)});
      const redisModule = await import(${JSON.stringify(redisLibUrl)});
      const createMobilePairing = pairingModule.createMobilePairing ?? pairingModule.default?.createMobilePairing;
      const closeRedis = redisModule.closeRedis ?? redisModule.default?.closeRedis;
      const created = await createMobilePairing({
        siteCode: 'HCM_01',
        laneCode: 'LANE_A',
        direction: 'EXIT',
        deviceCode: 'MOBILE_CAM_01',
      });
      console.log(JSON.stringify(created));
      await closeRedis();
    `,
    env,
  )

  assert.equal(createResult.code, 0, createResult.stderr)
  const created = JSON.parse(createResult.stdout.trim().split(/\r?\n/).at(-1) ?? '{}')

  const readResult = await runTsxInline(
    `
      const pairingModule = await import(${JSON.stringify(pairingServiceUrl)});
      const redisModule = await import(${JSON.stringify(redisLibUrl)});
      const getMobilePairing = pairingModule.getMobilePairing ?? pairingModule.default?.getMobilePairing;
      const closeRedis = redisModule.closeRedis ?? redisModule.default?.closeRedis;
      const pairing = await getMobilePairing(${JSON.stringify(created.pairToken)}, { refreshTtlOnAccess: false });
      console.log(JSON.stringify(pairing));
      await closeRedis();
    `,
    env,
  )

  assert.equal(readResult.code, 0, readResult.stderr)
  const fetched = JSON.parse(readResult.stdout.trim().split(/\r?\n/).at(-1) ?? '{}')

  assert.equal(fetched.pairToken, created.pairToken)
  assert.equal(fetched.siteCode, 'HCM_01')
  assert.equal(fetched.direction, 'EXIT')
})

test('expired pair token disappears after TTL', async (t) => {
  const env = buildEnv('ttl-expiry', {
    MOBILE_PAIR_TTL_SEC: '1',
    MOBILE_PAIR_REFRESH_ON_ACCESS: 'OFF',
  })
  if (!await ensureRedisAvailable(t, env)) return

  const createResult = await runTsxInline(
    `
      const pairingModule = await import(${JSON.stringify(pairingServiceUrl)});
      const redisModule = await import(${JSON.stringify(redisLibUrl)});
      const createMobilePairing = pairingModule.createMobilePairing ?? pairingModule.default?.createMobilePairing;
      const closeRedis = redisModule.closeRedis ?? redisModule.default?.closeRedis;
      const created = await createMobilePairing({
        siteCode: 'DN_01',
        laneCode: 'LANE_TTL',
        direction: 'ENTRY',
        deviceCode: 'CAM_TTL',
      });
      console.log(JSON.stringify(created));
      await closeRedis();
    `,
    env,
  )

  assert.equal(createResult.code, 0, createResult.stderr)
  const created = JSON.parse(createResult.stdout.trim().split(/\r?\n/).at(-1) ?? '{}')

  await sleep(1500)

  const readResult = await runTsxInline(
    `
      const pairingModule = await import(${JSON.stringify(pairingServiceUrl)});
      const redisModule = await import(${JSON.stringify(redisLibUrl)});
      const getMobilePairing = pairingModule.getMobilePairing ?? pairingModule.default?.getMobilePairing;
      const closeRedis = redisModule.closeRedis ?? redisModule.default?.closeRedis;
      const pairing = await getMobilePairing(${JSON.stringify(created.pairToken)}, { refreshTtlOnAccess: false });
      console.log(pairing === null ? 'NULL' : JSON.stringify(pairing));
      await closeRedis();
    `,
    env,
  )

  assert.equal(readResult.code, 0, readResult.stderr)
  assert.equal(readResult.stdout.trim().split(/\r?\n/).at(-1), 'NULL')
})

test('manual invalidation revokes the pair token and future reads return null', async (t) => {
  const env = buildEnv('revoke')
  if (!await ensureRedisAvailable(t, env)) return

  const createResult = await runTsxInline(
    `
      const pairingModule = await import(${JSON.stringify(pairingServiceUrl)});
      const redisModule = await import(${JSON.stringify(redisLibUrl)});
      const createMobilePairing = pairingModule.createMobilePairing ?? pairingModule.default?.createMobilePairing;
      const closeRedis = redisModule.closeRedis ?? redisModule.default?.closeRedis;
      const created = await createMobilePairing({
        siteCode: 'HCM_01',
        laneCode: 'LANE_REVOKE',
        direction: 'ENTRY',
        deviceCode: 'CAM_REVOKE',
      });
      console.log(JSON.stringify(created));
      await closeRedis();
    `,
    env,
  )

  assert.equal(createResult.code, 0, createResult.stderr)
  const created = JSON.parse(createResult.stdout.trim().split(/\r?\n/).at(-1) ?? '{}')

  const revokeResult = await runTsxInline(
    `
      const pairingModule = await import(${JSON.stringify(pairingServiceUrl)});
      const revocationModule = await import(${JSON.stringify(authRevocationUrl)});
      const redisModule = await import(${JSON.stringify(redisLibUrl)});
      const invalidateMobilePairing = pairingModule.invalidateMobilePairing ?? pairingModule.default?.invalidateMobilePairing;
      const getMobilePairing = pairingModule.getMobilePairing ?? pairingModule.default?.getMobilePairing;
      const isRevoked = revocationModule.isRevoked ?? revocationModule.default?.isRevoked;
      const closeRedis = redisModule.closeRedis ?? redisModule.default?.closeRedis;

      const invalidation = await invalidateMobilePairing(${JSON.stringify(created.pairToken)}, { reason: 'test-manual-revoke' });
      const revoked = await isRevoked(${JSON.stringify(created.pairToken)});
      const pairing = await getMobilePairing(${JSON.stringify(created.pairToken)}, { refreshTtlOnAccess: false });

      console.log(JSON.stringify(invalidation));
      console.log(JSON.stringify({ revoked, pairing }));
      await closeRedis();
    `,
    env,
  )

  assert.equal(revokeResult.code, 0, revokeResult.stderr)

  const lines = revokeResult.stdout.trim().split(/\r?\n/)
  const invalidation = JSON.parse(lines.at(-2) ?? '{}')
  const after = JSON.parse(lines.at(-1) ?? '{}')

  assert.equal(invalidation.revoked, true)
  assert.equal(invalidation.existed, true)
  assert.equal(after.revoked, true)
  assert.equal(after.pairing, null)
})
