/**
 * lane-lock.ts — Redis Distributed Lock Service
 *
 * Giải quyết Race Condition khi Camera và RFID gửi request song song
 * cho cùng một lane. Mỗi lane có một lock riêng biệt:
 *
 *   Lock key:  locks:gate:lane:{siteCode}:{laneCode}
 *   TTL:       3 giây (đủ thời gian cho 1 chu trình Capture → Decision Engine)
 *   Retry:     3 lần, mỗi lần cách nhau 200ms, với jitter ±50ms
 *
 * Thuật toán:
 *  1. Xin lock (SET NX EX). Nếu thành công → proceed.
 *  2. Nếu lock đang bị giữ bởi request khác → thử lại (retry).
 *  3. Nếu retry hết 3 lần → trả lỗi LANE_BUSY → device sẽ thử lại sau.
 *
 * Kết hợp với SELECT FOR UPDATE SKIP LOCKED trong DB transaction để
 * đảm bảo serialization ở cả Redis (lock) và MySQL (SKIP LOCKED).
 */

import { randomUUID } from 'node:crypto';

import { getRedisClient } from './redis';
import { config } from '../server/config';

const LOCK_PREFIX = 'locks:gate:lane';

/* ─── Config ──────────────────────────────────────────────────── */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const LOCK_TTL_MS          = intEnv('GATE_LANE_LOCK_TTL_MS',          3000);
const LOCK_RETRY_COUNT     = intEnv('GATE_LANE_LOCK_RETRY_COUNT',     3);
const LOCK_RETRY_DELAY_MS  = intEnv('GATE_LANE_LOCK_RETRY_DELAY_MS',  200);
const LOCK_RETRY_JITTER_MS = intEnv('GATE_LANE_LOCK_RETRY_JITTER_MS', 50);

/* ─── Types ──────────────────────────────────────────────────── */

export type LaneLockHandle = {
  /** Key đã acquire (dùng cho logging/tracing) */
  resource: string;
  /** Lock value – dùng để verify ownership khi release */
  value: string;
  /** Thời điểm acquire thành công */
  acquiredAt: number;
  /** TTL còn lại (ms) */
  ttlMs: number;
};

export type LaneLockAcquireOptions = {
  /** siteCode để build lock key */
  siteCode: string;
  /** laneCode để build lock key */
  laneCode: string;
  /**
   * TTL của lock (ms).
   * Mặc định 3000ms — đủ cho Capture + Decision Engine.
   * Tăng lên nếu decision engine mất nhiều thời gian hơn.
   */
  ttlMs?: number;
  /**
   * Retry count. Mặc định 3.
   * Set 0 để không retry (fire-and-forget, ví dụ non-critical reads).
   */
  retryCount?: number;
  /**
   * Retry delay base (ms). Mặc định 200ms.
   */
  retryDelayMs?: number;
  /**
   * Retry jitter (ms). Mặc định 50ms.
   * Randomize để tránh thundering herd.
   */
  retryJitterMs?: number;
  /**
   * Trace ID để log. Nếu không truyền sẽ tự sinh.
   */
  traceId?: string;
};

export type LaneLockResult =
  | { acquired: true;  lock: LaneLockHandle }
  | { acquired: false; reason: 'LOCK_BUSY' | 'REDIS_ERROR'; attempts: number; error?: Error };

/* ─── Core acquire (SET NX EX pattern) ──────────────────────── */

async function tryAcquire(
  redisKey: string,
  lockValue: string,
  ttlMs: number,
): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;
  // SET key value NX PX milliseconds
  // NX: only set if not exists
  // PX: expiry in milliseconds
  const result = await redis.set(redisKey, lockValue, 'PX', ttlMs, 'NX');
  return result === 'OK';
}

async function tryRelease(redisKey: string, lockValue: string): Promise<boolean> {
  // Lua script để release chỉ khi value match (ownership check)
  const redis = await getRedisClient();
  if (!redis) return false;
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;
  const result = await redis.eval(script, 1, redisKey, lockValue);
  return result === 1;
}

async function extendLock(
  redisKey: string,
  lockValue: string,
  additionalMs: number,
): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("PEXPIRE", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;
  const result = await redis.eval(script, 1, redisKey, lockValue, additionalMs);
  return result === 1;
}

/* ─── Public API ─────────────────────────────────────────────── */

/**
 * acquireLaneLock — Xin cấp distributed lock cho một lane.
 *
 * Sử dụng:
 * ```ts
 * const result = await acquireLaneLock({
 *   siteCode: 'SITE_HCM_01',
 *   laneCode: 'ENTRY',
 * });
 * if (!result.acquired) {
 *   throw new ApiError({ code: 'CONFLICT', message: 'Lane đang bận xử lý. Thử lại sau.' });
 * }
 * try {
 *   // ... xử lý capture ...
 * } finally {
 *   await releaseLaneLock(result.lock);
 * }
 * ```
 */
export async function acquireLaneLock(
  options: LaneLockAcquireOptions,
): Promise<LaneLockResult> {
  const {
    siteCode,
    laneCode,
    ttlMs = LOCK_TTL_MS,
    retryCount = LOCK_RETRY_COUNT,
    retryDelayMs = LOCK_RETRY_DELAY_MS,
    retryJitterMs = LOCK_RETRY_JITTER_MS,
    traceId = randomUUID().slice(0, 8),
  } = options;

  const redisKey = `${LOCK_PREFIX}:${siteCode}:${laneCode}`;
  const lockValue = `${traceId}:${randomUUID()}`;

  let attempts = 0;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    attempts = attempt + 1;

    try {
      const acquired = await tryAcquire(redisKey, lockValue, ttlMs);

      if (acquired) {
        return {
          acquired: true,
          lock: {
            resource: redisKey,
            value: lockValue,
            acquiredAt: Date.now(),
            ttlMs,
          },
        };
      }

      // Lock đang bị giữ → thử lại (nếu còn quota)
      if (attempt < retryCount) {
        const jitter = Math.floor(Math.random() * retryJitterMs * 2); // 0..2×jitter
        const delay = retryDelayMs + jitter;
        await sleep(delay);
      }
    } catch (err) {
      // Redis error → không retry, trả lỗi ngay
      return {
        acquired: false,
        reason: 'REDIS_ERROR',
        attempts,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }

  // Hết retry
  return {
    acquired: false,
    reason: 'LOCK_BUSY',
    attempts,
  };
}

/**
 * releaseLaneLock — Giải phóng lock.
 *
 * Luôn gọi trong `finally {}` block để đảm bảo unlock dù có lỗi.
 * Lua script đảm bảo chỉ unlock nếu value match (không release lock
 * của request khác trong trường hợp TTL không kịp expire mà request
 * đã tự release rồi).
 */
export async function releaseLaneLock(lock: LaneLockHandle): Promise<boolean> {
  return tryRelease(lock.resource, lock.value);
}

/**
 * extendLaneLock — Gia hạn lock nếu cần (ví dụ: decision engine mất nhiều thời gian).
 *
 * Thường không cần gọi — lock 3s đủ cho hầu hết trường hợp.
 * Chỉ dùng khi có I/O nặng (gọi HTTP ALPR provider, DB query phức tạp...).
 */
export async function extendLaneLock(
  lock: LaneLockHandle,
  additionalMs?: number,
): Promise<boolean> {
  return extendLock(lock.resource, lock.value, additionalMs ?? Math.floor(lock.ttlMs * 0.8));
}

/**
 * isLaneLocked — Kiểm tra lock hiện tại của lane (non-blocking).
 * Dùng cho health check hoặc monitoring.
 */
export async function isLaneLocked(siteCode: string, laneCode: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;
  const redisKey = `${LOCK_PREFIX}:${siteCode}:${laneCode}`;
  const value = await redis.get(redisKey);
  return value !== null;
}

/**
 * getLaneLockInfo — Lấy thông tin lock hiện tại của lane.
 */
export async function getLaneLockInfo(
  siteCode: string,
  laneCode: string,
): Promise<{ locked: boolean; ttlMs: number | null; holder: string | null }> {
  const redis = await getRedisClient();
  if (!redis) return { locked: false, ttlMs: null, holder: null };
  const redisKey = `${LOCK_PREFIX}:${siteCode}:${laneCode}`;
  const [value, ttl] = await Promise.all([redis.get(redisKey), redis.pttl(redisKey)]);
  return {
    locked: value !== null,
    ttlMs: ttl > 0 ? ttl : null,
    holder: value,
  };
}

/* ─── Utilities ──────────────────────────────────────────────── */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * withLaneLock — Wrapper tiện dụng: acquire → execute → release.
 *
 * ```ts
 * const result = await withLaneLock(
 *   { siteCode, laneCode },
 *   async (lock) => {
 *     // ... xử lý ...
 *     return { sessionId, decision };
 *   }
 * );
 * ```
 *
 * Nếu lock không acquire được → throw ApiError CONFLICT.
 */
export async function withLaneLock<T>(
  options: LaneLockAcquireOptions,
  fn: (lock: LaneLockHandle) => Promise<T>,
): Promise<T> {
  const result = await acquireLaneLock(options);

  if (!result.acquired) {
    const { siteCode, laneCode } = options;
    // eslint-disable-next-line no-console
    console.warn(
      `[lane-lock] LOCK_BUSY site=${siteCode} lane=${laneCode} attempts=${result.attempts}`,
    );

    const { ApiError } = await import('../server/http');
    throw new ApiError({
      code: 'CONFLICT',
      message: 'Lane đang bận xử lý sự kiện khác. Vui lòng thử lại sau vài giây.',
      details: {
        reason: 'LANE_BUSY',
        siteCode,
        laneCode,
        retryAfterMs: LOCK_RETRY_DELAY_MS * 2,
        attempts: result.attempts,
        traceId: options.traceId,
      },
    });
  }

  try {
    return await fn(result.lock);
  } finally {
    const released = await releaseLaneLock(result.lock);
    if (!released) {
      // eslint-disable-next-line no-console
      console.warn(
        `[lane-lock] Release failed (TTL expired or already released) key=${result.lock.resource}`,
      );
    }
  }
}
