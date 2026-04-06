import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';

import { getRedisClient, buildRedisKey } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { ApiError, fail } from '../server/http';

const IDEMPOTENCY_KEY_MAX_LEN = 255;
const REDIS_LOCK_TTL_SECONDS = 30;
const DB_EXPIRY_HOURS = 24;

type IdempotencyContext = {
  scope: string;
  key: string;
  requestHash: string;
  lockedAt: number;
};

declare global {
  namespace Express {
    interface Request {
      idempotencyContext?: IdempotencyContext;
    }
    interface Response {
      statusCode?: number;
    }
  }
}

function normalizeKey(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) throw new Error('Idempotency key is empty');
  if (text.length > IDEMPOTENCY_KEY_MAX_LEN) {
    throw new Error(`Idempotency key exceeds ${IDEMPOTENCY_KEY_MAX_LEN} characters`);
  }
  return text;
}

function buildRequestHash(req: Request): string {
  const payload = JSON.stringify({
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
  });
  return createHash('sha256').update(payload).digest('hex');
}

function buildRedisLockKey(scope: string, key: string): string {
  return buildRedisKey('idemp', scope, key);
}

function buildDbExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + DB_EXPIRY_HOURS);
  return expiry;
}

async function checkDbForSuccess(args: {
  scope: string;
  key: string;
}): Promise<{ found: true; responseJson: string } | { found: false }> {
  const row = await prisma.$queryRawUnsafe<any[]>(
    `SELECT response_json FROM api_idempotency_keys WHERE scope = ? AND idempotency_key = ? AND status = 'SUCCEEDED' LIMIT 1`,
    args.scope,
    args.key,
  );

  if (row[0]?.response_json) {
    return { found: true, responseJson: String(row[0].response_json) };
  }

  return { found: false };
}

async function tryAcquireRedisLock(key: string): Promise<boolean> {
  const redis = await getRedisClient({ connect: true });
  if (!redis) {
    // Redis unavailable — fall through to DB-only mode
    return false;
  }

  try {
    const result = await redis.set(key, 'IN_PROGRESS', 'EX', REDIS_LOCK_TTL_SECONDS, 'NX');
    return result === 'OK';
  } catch (err) {
    console.warn('[IdempotencyMiddleware] Redis SETNX failed:', err);
    return false;
  }
}

async function releaseRedisLock(key: string): Promise<void> {
  const redis = await getRedisClient({ connect: false });
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // non-fatal
  }
}

function patchResponseForIdempotency(req: Request, res: Response, scope: string, key: string): void {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const startTime = Date.now();

  res.json = function (body: unknown) {
    const durationMs = Date.now() - startTime;
    const rid = (req as any).id ?? 'unknown';

    const status = ((res as any).statusCode >= 200 && (res as any).statusCode < 300) ? 'SUCCEEDED' : 'FAILED';
    const responseText = JSON.stringify(body);

    // Fire-and-forget DB persistence + Redis release
    void persistResponseAsync({
      scope,
      key,
      requestHash: (req as any).idempotencyContext?.requestHash,
      status,
      responseJson: responseText,
      expiresAt: buildDbExpiry(),
      rid,
      durationMs,
    });

    return originalJson(body);
  };

  res.send = function (body?: unknown) {
    if (typeof body === 'string' && body.length > 0) {
      try {
        const parsed = JSON.parse(body);
        if (parsed && typeof parsed === 'object' && 'requestId' in parsed) {
          res.json(parsed);
          return originalSend(body);
        }
      } catch {
        // Not JSON — fall through
      }
    }

    const durationMs = Date.now() - startTime;
    const rid = (req as any).id ?? 'unknown';
    const status = ((res as any).statusCode >= 200 && (res as any).statusCode < 300) ? 'SUCCEEDED' : 'FAILED';

    void persistResponseAsync({
      scope,
      key,
      requestHash: (req as any).idempotencyContext?.requestHash,
      status,
      responseJson: typeof body === 'string' ? body : JSON.stringify(body),
      expiresAt: buildDbExpiry(),
      rid,
      durationMs,
    });

    return originalSend(body);
  };
}

async function persistResponseAsync(args: {
  scope: string;
  key: string;
  requestHash?: string;
  status: 'SUCCEEDED' | 'FAILED';
  responseJson: string;
  expiresAt: Date;
  rid: string;
  durationMs: number;
}): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO api_idempotency_keys (scope, idempotency_key, request_hash, status, response_json, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        response_json = VALUES(response_json),
        expires_at = VALUES(expires_at)
      `,
      args.scope,
      args.key,
      args.requestHash ?? null,
      args.status,
      args.responseJson,
      args.expiresAt,
    );

    const lockKey = buildRedisLockKey(args.scope, args.key);
    await releaseRedisLock(lockKey);

    console.debug(`[Idempotency] Persisted ${args.status} for ${args.scope}:${args.key} (${args.durationMs}ms)`);
  } catch (err) {
    console.error('[Idempotency] Failed to persist response:', err);
    // Don't throw — response already sent to client
    void releaseRedisLock(buildRedisLockKey(args.scope, args.key));
  }
}

function extractScopeFromPath(path: string): string {
  return path
    .replace(/^\/api\//, '')
    .replace(/\/:[^/]+/g, '')
    .replace(/\//g, ':')
    .replace(/^:+/, '')
    || 'default';
}

export function requireIdempotency(opts?: {
  ttlSeconds?: number;
  scope?: string;
}) {
  return async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
    const rawKey = req.headers['x-idempotency-key'] as string | undefined;

    if (!rawKey) {
      return res.status(400).json(
        fail((req as any).id ?? 'unknown', {
          code: 'BAD_REQUEST',
          message: 'Missing required header: x-idempotency-key',
          details: { header: 'x-idempotency-key', hint: 'All mutation endpoints require this header for idempotent request processing' },
        }),
      );
    }

    let key: string;
    try {
      key = normalizeKey(rawKey);
    } catch (err) {
      return res.status(400).json(
        fail((req as any).id ?? 'unknown', {
          code: 'BAD_REQUEST',
          message: String((err as Error).message),
          details: { header: 'x-idempotency-key' },
        }),
      );
    }

    const scope = opts?.scope ?? extractScopeFromPath(req.path ?? '');
    const requestHash = buildRequestHash(req);
    const rid = (req as any).id ?? 'unknown';

    // Step 1: Fast-path DB check for already-succeeded requests
    try {
      const existing = await checkDbForSuccess({ scope, key });
      if (existing.found) {
        console.debug(`[Idempotency] Fast-path replay for ${scope}:${key}`);
        res.setHeader('X-Idempotency-Replayed', 'true');
        res.setHeader('X-Idempotency-Key', key);
        return res.status(200).json(JSON.parse(existing.responseJson));
      }
    } catch (err) {
      console.warn('[Idempotency] DB check failed — proceeding without idempotency guarantee:', err);
    }

    // Step 2: Try Redis fast-fail lock
    const lockKey = buildRedisLockKey(scope, key);
    let lockAcquired = false;

    try {
      lockAcquired = await tryAcquireRedisLock(lockKey);
    } catch (err) {
      console.warn('[Idempotency] Redis lock attempt failed — proceeding without Redis lock:', err);
    }

    if (!lockAcquired) {
      return res.status(409).json(
        fail(rid, {
          code: 'CONFLICT',
          message: 'Request with this idempotency key is already being processed',
          details: { idempotencyKey: key, scope, hint: 'Retry after the in-progress request completes' },
        }),
      );
    }

    // Step 3: Re-check DB after acquiring lock (another process might have completed)
    try {
      const recheck = await checkDbForSuccess({ scope, key });
      if (recheck.found) {
        await releaseRedisLock(lockKey);
        res.setHeader('X-Idempotency-Replayed', 'true');
        res.setHeader('X-Idempotency-Key', key);
        return res.status(200).json(JSON.parse(recheck.responseJson));
      }
    } catch (err) {
      console.warn('[Idempotency] DB recheck failed:', err);
    }

    // Step 4: Mark IN_PROGRESS in DB for durability
    try {
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO api_idempotency_keys (scope, idempotency_key, request_hash, status, expires_at)
        VALUES (?, ?, ?, 'IN_PROGRESS', ?)
        ON DUPLICATE KEY UPDATE
          status = CASE WHEN status = 'SUCCEEDED' THEN 'SUCCEEDED' ELSE 'IN_PROGRESS' END,
          request_hash = COALESCE(?, request_hash)
        `,
        scope,
        key,
        requestHash,
        buildDbExpiry(),
        requestHash,
      );
    } catch (err) {
      console.warn('[Idempotency] DB IN_PROGRESS write failed (non-fatal):', err);
    }

    // Step 5: Attach context and patch response
    (req as any).idempotencyContext = {
      scope,
      key,
      requestHash,
      lockedAt: Date.now(),
    };

    patchResponseForIdempotency(req, res, scope, key);

    next();
  };
}

export function idempotencyKeyHeader(rid: string, code: string, message: string, details?: unknown) {
  return {
    requestId: rid,
    code,
    message,
    ...(details !== undefined ? { details } : {}),
  };
}
