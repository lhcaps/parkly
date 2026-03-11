import { runRedisCommand } from '../lib/redis'

type IncrementResult = {
  totalHits: number
  resetTime: Date
}

const RATE_LIMIT_INCREMENT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])

if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end

return { current, ttl }
`

export class RedisRateLimitStore {
  private readonly prefix: string
  private windowMs: number

  constructor(opts: { prefix: string; windowMs: number }) {
    this.prefix = String(opts.prefix ?? '').trim() || 'parkly:rate-limit'
    this.windowMs = Math.max(1, Number(opts.windowMs ?? 60_000) || 60_000)
  }

  init(options: { windowMs?: number } = {}) {
    if (options.windowMs != null) {
      this.windowMs = Math.max(1, Number(options.windowMs) || this.windowMs)
    }
  }

  private buildKey(key: string) {
    return `${this.prefix}:${String(key ?? '').trim()}`
  }

  async increment(key: string): Promise<IncrementResult> {
    const raw = await runRedisCommand('EVAL', async (client) => {
      return await client.eval(RATE_LIMIT_INCREMENT_SCRIPT, 1, this.buildKey(key), String(this.windowMs))
    })

    const tuple = Array.isArray(raw) ? raw : [1, this.windowMs]
    const totalHits = Math.max(0, Number(tuple[0] ?? 0) || 0)
    const ttlMs = Math.max(0, Number(tuple[1] ?? this.windowMs) || this.windowMs)

    return {
      totalHits,
      resetTime: new Date(Date.now() + ttlMs),
    }
  }

  async decrement(key: string): Promise<void> {
    const redisKey = this.buildKey(key)
    await runRedisCommand('DECR', async (client) => {
      const next = await client.decr(redisKey)
      if (next <= 0) {
        await client.del(redisKey)
      }
    })
  }

  async resetKey(key: string): Promise<void> {
    await runRedisCommand('DEL', async (client) => {
      await client.del(this.buildKey(key))
    })
  }

  async resetAll(): Promise<void> {
    return
  }

  async shutdown(): Promise<void> {
    return
  }
}

export function createRedisRateLimitStore(opts: { prefix: string; windowMs: number }) {
  return new RedisRateLimitStore(opts)
}

export default {
  RedisRateLimitStore,
  createRedisRateLimitStore,
}