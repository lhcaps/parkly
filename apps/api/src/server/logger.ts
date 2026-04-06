import { Writable } from 'node:stream'

import pino, { type Logger, type LoggerOptions } from 'pino'
import pinoHttp, { type Options as PinoHttpOptions } from 'pino-http'
import type { NextFunction, Request, Response } from 'express'

import { ApiError, statusToCode } from './http'

export type LogLevelName = 'debug' | 'info' | 'warn' | 'error'
export type LogSurface = 'public' | 'user-auth' | 'device-signed' | 'stream' | 'internal'

type RequestLike = Partial<Request> & Record<string, any>
type ResponseLike = Partial<Response> & Record<string, any>

export type LogFieldContext = {
  requestId?: string | null
  correlationId?: string | null
  actorId?: string | null
  actorRole?: string | null
  actorLabel?: string | null
  deviceCode?: string | null
  siteCode?: string | null
  gateCode?: string | null
  laneCode?: string | null
  sessionId?: string | null
  reviewId?: string | null
  outboxId?: string | null
}

const DEV_FORMAT = 'dev'
const JSON_FORMAT = 'json'

function resolveLogFormat() {
  const raw = String(process.env.LOG_FORMAT ?? '').trim().toLowerCase()
  if (raw === JSON_FORMAT) return JSON_FORMAT
  if (raw === DEV_FORMAT) return DEV_FORMAT
  return process.env.NODE_ENV === 'production' ? JSON_FORMAT : DEV_FORMAT
}

function isoNow() {
  return `,"ts":"${new Date().toISOString()}"`
}

function clip(value: string, max = 160) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function stringifyScalar(value: unknown) {
  if (value == null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  return null
}

function sanitizeNullableString(value: unknown) {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function readPathname(urlValue: string | undefined) {
  const source = String(urlValue ?? '').trim()
  if (!source) return '/'
  const queryIndex = source.indexOf('?')
  return queryIndex >= 0 ? source.slice(0, queryIndex) : source
}

function shouldRedactIp() {
  return String(process.env.LOG_REDACT_IP ?? 'OFF').trim().toUpperCase() === 'ON'
}

function maybeRedactIp(value: unknown) {
  const text = sanitizeNullableString(value)
  if (!text) return null
  return shouldRedactIp() ? '[REDACTED_IP]' : text
}

function readFromContainer(container: unknown, key: string) {
  if (!container || typeof container !== 'object' || Array.isArray(container)) return null
  return stringifyScalar((container as Record<string, unknown>)[key])
}

function readFromRequest(req: RequestLike, key: string) {
  return readFromContainer(req.params, key)
    ?? readFromContainer(req.query, key)
    ?? readFromContainer(req.body, key)
}

function readHeader(req: RequestLike, name: string) {
  if (typeof req.header === 'function') return req.header(name)
  if (typeof req.get === 'function') return req.get(name)
  const headers = req.headers as Record<string, unknown> | undefined
  if (!headers) return undefined
  const direct = headers[name] ?? headers[name.toLowerCase()]
  if (Array.isArray(direct)) return direct[0] as string | undefined
  return typeof direct === 'string' ? direct : undefined
}

function resolveActorContext(req: RequestLike) {
  const auth = req.auth as { principalType?: string; actorUserId?: unknown; role?: string | null; actorLabel?: string | null } | undefined
  if (!auth) return { actorId: null, actorRole: null, actorLabel: null }
  return {
    actorId: auth.principalType === 'USER' ? stringifyScalar(auth.actorUserId) : null,
    actorRole: auth.role ?? null,
    actorLabel: auth.actorLabel ?? null,
  }
}

function resolveRequestId(req: RequestLike) {
  return sanitizeNullableString(req.id) ?? null
}

function resolveCorrelationId(req: RequestLike) {
  return sanitizeNullableString(req.correlationId) ?? resolveRequestId(req)
}

function resolveRequestPath(req: RequestLike) {
  return readPathname((req.originalUrl as string | undefined) ?? (req.path as string | undefined) ?? (req.url as string | undefined))
}

function resolveRequestIp(req: RequestLike) {
  return maybeRedactIp(req.ip ?? req.socket?.remoteAddress ?? req.connection?.remoteAddress ?? null)
}

export function classifyLogSurface(req: RequestLike): LogSurface {
  const path = resolveRequestPath(req)
  if (path.startsWith('/api/stream/')) return 'stream'
  if (
    path.startsWith('/api/devices/') ||
    path.startsWith('/api/gate-reads/') ||
    path.startsWith('/api/mobile-capture/') ||
    path.startsWith('/api/device-control/')
  ) {
    return 'device-signed'
  }
  if (path.startsWith('/api/auth/') || path === '/api/auth/me' || path === '/api/me') return 'user-auth'
  if (path.startsWith('/api/internal/')) return 'internal'
  return 'public'
}

export function buildLogFieldContext(req: RequestLike): LogFieldContext {
  const actor = resolveActorContext(req)
  return {
    requestId: resolveRequestId(req),
    correlationId: resolveCorrelationId(req),
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    actorLabel: actor.actorLabel,
    deviceCode: readFromRequest(req, 'deviceCode'),
    siteCode: readFromRequest(req, 'siteCode'),
    gateCode: readFromRequest(req, 'gateCode'),
    laneCode: readFromRequest(req, 'laneCode'),
    sessionId: readFromRequest(req, 'sessionId'),
    reviewId: readFromRequest(req, 'reviewId'),
    outboxId: readFromRequest(req, 'outboxId'),
  }
}

function buildReqSerializer(req: RequestLike) {
  return {
    requestId: resolveRequestId(req),
    correlationId: resolveCorrelationId(req),
    method: req.method ?? null,
    path: resolveRequestPath(req),
    ip: resolveRequestIp(req),
    host: readHeader(req, 'host') ?? null,
    userAgent: readHeader(req, 'user-agent') ?? null,
    surface: classifyLogSurface(req),
    ...buildLogFieldContext(req),
  }
}

function buildResSerializer(res: ResponseLike) {
  return {
    statusCode: Number.isFinite(res.statusCode) ? Number(res.statusCode) : null,
  }
}

function buildErrSerializer(err: any) {
  return {
    type: String(err?.name ?? 'Error'),
    message: String(err?.message ?? 'Unknown error'),
    code: stringifyScalar(err?.code) ?? stringifyScalar(err?.details?.reason) ?? null,
    statusCode: Number.isFinite(err?.statusCode) ? Number(err.statusCode) : Number.isFinite(err?.status) ? Number(err.status) : null,
    stack: typeof err?.stack === 'string' ? err.stack : undefined,
  }
}

function buildRedactionPaths() {
  return [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers.x-internal-api-key',
    'req.headers.x-internal-signature',
    'req.headers.x-device-secret',
    'req.body.password',
    'req.body.refreshToken',
    'req.body.signature',
    'req.body.deviceSecret',
    'req.body.secret',
    'req.query.deviceSecret',
    'req.query.signature',
    'req.query.token',
    'res.headers["set-cookie"]',
    '*.authorization',
    '*.cookie',
    '*.password',
    '*.refreshToken',
    '*.signature',
    '*.deviceSecret',
    '*.secret',
  ]
}

function renderDevLine(record: Record<string, any>) {
  const ts = typeof record.ts === 'string' ? record.ts.replace('T', ' ').replace('Z', '') : new Date().toISOString().replace('T', ' ').replace('Z', '')
  const level = String(record.level ?? 'info').toUpperCase().padEnd(5)
  const type = clip(String(record.type ?? record.msg ?? 'log'), 32)

  let summary = ''
  if (record.type === 'access') {
    summary = `${record.method ?? 'GET'} ${record.path ?? '/'} -> ${record.status ?? '-'} ${record.durationMs ?? 0}ms`
  } else {
    summary = String(record.msg ?? '')
  }

  const contextParts = [
    record.requestId ? `rid=${String(record.requestId).slice(0, 8)}` : null,
    record.actorRole ? `role=${record.actorRole}` : null,
    record.deviceCode ? `device=${record.deviceCode}` : null,
    record.siteCode ? `site=${record.siteCode}` : null,
    record.laneCode ? `lane=${record.laneCode}` : null,
    record.sessionId ? `session=${record.sessionId}` : null,
    record.reviewId ? `review=${record.reviewId}` : null,
    record.errorCode ? `code=${record.errorCode}` : null,
  ].filter(Boolean)

  const detail = contextParts.length ? ` ${contextParts.join(' ')}` : ''
  const header = `${ts} ${level} ${type} ${clip(summary, 180)}${detail}`.trimEnd()

  if (!record.err || typeof record.err !== 'object') return header

  const errLine = [
    record.err.type ? `type=${record.err.type}` : null,
    record.err.code ? `code=${record.err.code}` : null,
    record.err.message ? `message=${clip(String(record.err.message), 200)}` : null,
  ].filter(Boolean).join(' ')

  if (!errLine) return header
  return `${header}\n  ↳ ${errLine}`
}

class DevPrettyStream extends Writable {
  override _write(chunk: any, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    try {
      const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
      const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)
          process.stdout.write(`${renderDevLine(parsed)}\n`)
        } catch {
          process.stdout.write(`${line}\n`)
        }
      }
      callback()
    } catch (error) {
      callback(error as Error)
    }
  }
}

function buildLoggerOptions(): LoggerOptions {
  return {
    level: process.env.LOG_LEVEL ?? 'info',
    messageKey: 'msg',
    base: {
      service: 'parkly-api',
      env: process.env.NODE_ENV ?? 'development',
    },
    timestamp: isoNow,
    formatters: {
      level(label) {
        return { level: label }
      },
    },
    redact: {
      paths: buildRedactionPaths(),
      censor: '[REDACTED]',
    },
    serializers: {
      req: buildReqSerializer,
      res: buildResSerializer,
      err: buildErrSerializer,
    },
  }
}

function buildLoggerDestination() {
  return resolveLogFormat() === DEV_FORMAT ? new DevPrettyStream() : process.stdout
}

export const apiLogger: Logger = pino(buildLoggerOptions(), buildLoggerDestination())

export function buildHttpLoggerOptions(): PinoHttpOptions {
  return {
    logger: apiLogger,
    autoLogging: false,
    genReqId: (req) => (req as any).id,
    customProps: (req) => ({
      requestId: sanitizeNullableString((req as any).id) ?? null,
      correlationId: sanitizeNullableString((req as any).correlationId) ?? sanitizeNullableString((req as any).id) ?? null,
      surface: classifyLogSurface(req as unknown as RequestLike),
      ...buildLogFieldContext(req as unknown as RequestLike),
    }),
  }
}

export function createHttpLoggerMiddleware() {
  return pinoHttp(buildHttpLoggerOptions())
}

function errorReason(err: any) {
  return sanitizeNullableString(err?.details?.reason)
}

export function classifyApiError(err: unknown, req?: Request) {
  const apiErr = err instanceof ApiError ? err : null
  const status = apiErr?.statusCode ?? (Number.isFinite((err as any)?.statusCode) ? Number((err as any).statusCode) : Number.isFinite((err as any)?.status) ? Number((err as any).status) : 500)
  const code = sanitizeNullableString(apiErr?.code ?? (err as any)?.code) ?? statusToCode(status)
  const reason = errorReason(err as any)
  const surface = req ? classifyLogSurface(req as RequestLike) : 'public'

  let level: LogLevelName = 'info'
  let kind = 'client_error'

  if (status >= 500) {
    level = 'error'
    kind = 'server_error'
  } else if (status === 409 || status === 412 || status === 422) {
    level = 'warn'
    kind = 'workflow_conflict'
  } else if (status === 401 || status === 403) {
    level = 'warn'
    kind = surface === 'device-signed' || reason?.startsWith('DEVICE_') ? 'device_auth_failed' : 'auth_failed'
  } else if (status >= 400) {
    level = 'warn'
    kind = 'request_rejected'
  }

  return {
    level,
    status,
    code,
    reason,
    kind,
    surface,
  }
}

export function buildErrorLogPayload(err: unknown, req: Request) {
  const classification = classifyApiError(err, req)
  return {
    type: 'http.error',
    errorKind: classification.kind,
    errorCode: classification.code,
    errorReason: classification.reason,
    status: classification.status,
    surface: classification.surface,
    ...buildLogFieldContext(req as RequestLike),
    err,
  }
}

export function classifyAccessLogLevel(req: RequestLike, statusCode: number): LogLevelName {
  if (statusCode >= 500) return 'error'
  if (statusCode === 409 || statusCode === 412 || statusCode === 422) return 'warn'
  if (statusCode === 401 || statusCode === 403) return classifyLogSurface(req) === 'device-signed' ? 'warn' : 'info'
  if (statusCode >= 400) return 'warn'
  return 'info'
}

export function createAccessSummaryMiddleware() {
  return function accessSummaryMiddleware(req: Request, res: Response, next: NextFunction) {
    const startedAt = process.hrtime.bigint()
    let completed = false
    const reqAny = req as RequestLike
    const resAny = res as ResponseLike

    const flush = (event: 'finish' | 'close') => {
      if (completed) return
      completed = true

      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
      const writableEnded = Boolean(resAny.writableEnded)
      const status = event === 'close' && !writableEnded ? 499 : Number.isFinite(resAny.statusCode) ? Number(resAny.statusCode) : 200
      const level = classifyAccessLogLevel(reqAny, status)
      const routePath = sanitizeNullableString(reqAny.route?.path)
      const path = routePath
        ? `${sanitizeNullableString(reqAny.baseUrl) ?? ''}${routePath}`
        : resolveRequestPath(reqAny)

      const payload = {
        type: 'access',
        event,
        method: reqAny.method ?? null,
        path,
        status,
        durationMs: Number(elapsedMs.toFixed(1)),
        ip: resolveRequestIp(reqAny),
        host: readHeader(reqAny, 'host') ?? null,
        userAgent: readHeader(reqAny, 'user-agent') ?? null,
        surface: classifyLogSurface(reqAny),
        ...buildLogFieldContext(reqAny),
      }

      const logger = reqAny.log ?? apiLogger
      logger[level](payload, 'request completed')
    }

    resAny.on?.('finish', () => flush('finish'))
    resAny.on?.('close', () => {
      if (!resAny.writableEnded) flush('close')
    })

    next()
  }
}

export function logStartup(details: Record<string, unknown>) {
  apiLogger.info({ type: 'startup', ...details }, 'Parkly API started')
}

export type DomainLogLevel = 'info' | 'warn' | 'error'

export function logDomainEvent(level: DomainLogLevel, type: string, context: LogFieldContext & Record<string, unknown>, message?: string) {
  apiLogger[level]({ type, ...context }, message ?? type)
}
