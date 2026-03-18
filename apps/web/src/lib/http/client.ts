import {
  ApiError,
  extractRequestId,
  formatApiErrorMessage,
  isRecord,
  normalizeApiError,
  toApiErrorDisplay,
  type ApiEnvelope,
} from '@/lib/http/errors'

const AUTH_TOKEN_STORAGE_KEY = 'parkly_token'
const REFRESH_TOKEN_STORAGE_KEY = 'parkly_refresh_token'
const AUTH_EXPIRED_EVENT = 'parkly:http-auth-expired'
const AUTH_CHANGED_EVENT = 'parkly:http-auth-changed'

let refreshPromise: Promise<string | null> | null = null

export type QueryPrimitive = string | number | boolean | Date | null | undefined
export type QueryValue = QueryPrimitive | QueryPrimitive[]
export type QueryParams = Record<string, QueryValue>
export type AuthExpiredSurface = 'shell' | 'device-signed' | 'unknown'

export function normalizeBase(raw?: string) {
  const value = String(raw ?? '').trim().replace(/\/+$/, '')
  if (!value) return ''
  return value.endsWith('/api') ? value.slice(0, -4) : value
}

export function buildUrl(path: string) {
  const base = normalizeBase(import.meta.env.VITE_API_BASE_URL)
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function getApiBasePreview() {
  return normalizeBase(import.meta.env.VITE_API_BASE_URL) || '(relative via Vite proxy)'
}

export function getToken(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || ''
}

export function getRefreshToken(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || ''
}

function emitAuthChanged(status: 'updated' | 'cleared', reason?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, {
    detail: { status, reason: reason || undefined },
  }))
}

function writeToken(key: string, value: string) {
  if (typeof window === 'undefined') return
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    window.localStorage.removeItem(key)
    return
  }
  window.localStorage.setItem(key, normalized)
}

export function storeAuthTokens(args: { accessToken: string; refreshToken?: string | null }, reason = 'updated') {
  if (typeof window === 'undefined') return
  writeToken(AUTH_TOKEN_STORAGE_KEY, args.accessToken)
  if (args.refreshToken === undefined) {
    // preserve current refresh token
  } else if (args.refreshToken) {
    writeToken(REFRESH_TOKEN_STORAGE_KEY, args.refreshToken)
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  }
  emitAuthChanged('updated', reason)
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return
  const normalized = String(token ?? '').trim()
  if (!normalized) {
    clearAuthTokens('manual-clear')
    return
  }
  writeToken(AUTH_TOKEN_STORAGE_KEY, normalized)
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  emitAuthChanged('updated', 'manual-token')
}

export function setRefreshToken(token: string) {
  if (typeof window === 'undefined') return
  const normalized = String(token ?? '').trim()
  if (!normalized) {
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
    emitAuthChanged('updated', 'manual-refresh-clear')
    return
  }
  writeToken(REFRESH_TOKEN_STORAGE_KEY, normalized)
  emitAuthChanged('updated', 'manual-refresh')
}

export function clearAuthTokens(reason = 'manual-clear') {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  emitAuthChanged('cleared', reason)
}

export function clearToken() {
  clearAuthTokens('manual-clear')
}

export function jsonHeaders(init?: HeadersInit) {
  const headers = new Headers(init)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return headers
}

function appendQueryValue(target: URLSearchParams, key: string, value: QueryPrimitive) {
  if (value === undefined || value === null) return
  if (typeof value === 'string' && value.trim() === '') return
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) target.append(key, value.toISOString())
    return
  }
  target.append(key, String(value))
}

export function buildQuery(params?: QueryParams) {
  const qs = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(params ?? {})) {
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) appendQueryValue(qs, key, value)
      continue
    }
    appendQueryValue(qs, key, rawValue)
  }

  return qs.toString()
}

function mergeHeaders(token: string, headers?: HeadersInit) {
  const merged = new Headers(headers)
  if (token && !merged.has('Authorization')) {
    merged.set('Authorization', `Bearer ${token}`)
  }
  return merged
}

function shouldExpectJsonResponse(contentType: string) {
  return contentType.includes('application/json') || contentType.includes('+json')
}

async function readResponsePayload(response: Response) {
  if (response.status === 204 || response.status === 205) {
    return { payload: undefined, rawText: '' }
  }

  const rawText = await response.text()
  const contentType = response.headers.get('content-type') || ''

  if (!rawText) {
    return { payload: undefined, rawText }
  }

  if (!shouldExpectJsonResponse(contentType)) {
    return { payload: rawText, rawText }
  }

  try {
    return {
      payload: JSON.parse(rawText) as unknown,
      rawText,
    }
  } catch (error) {
    throw new ApiError({
      status: response.status,
      code: 'INVALID_JSON',
      message: `Invalid JSON from API: ${rawText}`,
      cause: error,
    })
  }
}

function normalizeEnvelope(payload: unknown): ApiEnvelope<unknown> | null {
  if (!isRecord(payload)) return null
  if ('data' in payload || 'error' in payload || 'requestId' in payload) {
    return payload as ApiEnvelope<unknown>
  }
  return null
}

function createHttpError(response: Response, payload: unknown, rawText: string) {
  const envelope = normalizeEnvelope(payload)
  const requestId = extractRequestId(envelope ?? payload)
  const envelopeError = envelope && isRecord((envelope as { error?: unknown }).error)
    ? (envelope as { error: Record<string, unknown> }).error
    : null

  if (envelopeError) {
    const args = {
      status: response.status,
      code: typeof envelopeError.code === 'string' ? envelopeError.code : `HTTP_${response.status}`,
      message: formatApiErrorMessage({
        code: envelopeError.code,
        message: envelopeError.message,
        details: envelopeError.details,
        status: response.status,
      }),
      details: envelopeError.details,
      requestId,
    }
    return new ApiError({
      ...args,
      message: toApiErrorDisplay(new ApiError(args)).message,
    })
  }

  if (isRecord(payload)) {
    const message = typeof payload.message === 'string' && payload.message.trim()
      ? payload.message.trim()
      : typeof payload.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : ''

    // Prefer top-level code (backend fail() envelope) over generic HTTP code
    const topCode = typeof payload.code === 'string' && payload.code.trim()
      ? payload.code.trim()
      : null

    const args = {
      status: response.status,
      code: topCode ?? `HTTP_${response.status}`,
      message: message ? `HTTP ${response.status}: ${message}` : `HTTP ${response.status} ${response.statusText}`,
      details: 'details' in payload ? payload.details : undefined,
      requestId,
    }

    return new ApiError({
      ...args,
      message: toApiErrorDisplay(new ApiError(args)).message,
    })
  }

  const args = {
    status: response.status,
    code: `HTTP_${response.status}`,
    message: rawText ? `HTTP ${response.status} ${response.statusText}: ${rawText}` : `HTTP ${response.status} ${response.statusText}`,
    requestId,
  }

  return new ApiError({
    ...args,
    message: toApiErrorDisplay(new ApiError(args)).message,
  })
}

export function getAuthExpiredEventName() {
  return AUTH_EXPIRED_EVENT
}

export function getAuthChangedEventName() {
  return AUTH_CHANGED_EVENT
}

export type AuthExpiredDetail = {
  code?: string
  requestId?: string
  status?: number
  surface?: AuthExpiredSurface
  path?: string
}

export function notifyAuthExpired(detail?: AuthExpiredDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
    detail: {
      code: detail?.code,
      requestId: detail?.requestId,
      status: detail?.status,
      surface: detail?.surface ?? 'unknown',
      path: detail?.path,
    },
  }))
}

export function invalidateAuthSession(reason = 'auth-invalid', detail?: AuthExpiredDetail) {
  clearAuthTokens(reason)
  notifyAuthExpired({
    ...detail,
    surface: detail?.surface ?? 'shell',
  })
}

function isAuthSessionMutation(path: string) {
  const normalized = normalizeRequestPath(path)
  return normalized.startsWith('/api/auth/login') || normalized.startsWith('/api/auth/refresh') || normalized.startsWith('/api/auth/logout')
}

const DEVICE_SIGNED_PATH_PREFIXES: readonly string[] = [
  '/api/gate-reads/alpr',
  '/api/gate-reads/rfid',
  '/api/gate-reads/sensor',
  '/api/devices/heartbeat',
]

function normalizeRequestPath(path: string) {
  const raw = String(path ?? '').trim()
  if (!raw) return ''

  try {
    const parsed = new URL(raw, 'http://local')
    return parsed.pathname || raw
  } catch {
    return raw.split('?')[0]?.split('#')[0] ?? raw
  }
}

function isDeviceSignedPath(path: string): boolean {
  const normalized = normalizeRequestPath(path)
  return DEVICE_SIGNED_PATH_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))
}

function shouldAttachAccessToken(path: string) {
  return !isDeviceSignedPath(path)
}

async function sendRequest(path: string, init?: RequestInit, accessTokenOverride?: string) {
  const token = shouldAttachAccessToken(path) ? (accessTokenOverride ?? getToken()) : ''
  return fetch(buildUrl(path), {
    ...init,
    headers: mergeHeaders(token, init?.headers),
  })
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  if (!refreshPromise) {
    refreshPromise = (async () => {
      let response: Response
      try {
        response = await fetch(buildUrl('/api/auth/refresh'), {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({ refreshToken }),
        })
      } catch (error) {
        throw normalizeApiError(error)
      }

      const { payload, rawText } = await readResponsePayload(response)
      if (!response.ok) {
        throw createHttpError(response, payload, rawText)
      }

      const envelope = normalizeEnvelope(payload)
      const data = envelope && 'data' in envelope ? envelope.data : payload
      if (!isRecord(data) || typeof data.accessToken !== 'string' || !data.accessToken.trim()) {
        throw new ApiError({
          status: response.status,
          code: 'INVALID_AUTH_REFRESH',
          message: 'Auth refresh did not return a valid access token.',
          requestId: extractRequestId(envelope ?? data),
        })
      }

      storeAuthTokens({
        accessToken: data.accessToken,
        refreshToken: typeof data.refreshToken === 'string' ? data.refreshToken : refreshToken,
      }, 'refresh-success')

      return data.accessToken
    })()
      .catch((error) => {
        clearAuthTokens('refresh-failed')
        throw normalizeApiError(error)
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

async function apiFetchInternal<T>(path: string, init: RequestInit | undefined, normalize: ((value: unknown) => T) | undefined, allowRefresh: boolean): Promise<T> {
  let response: Response
  try {
    response = await sendRequest(path, init)
  } catch (error) {
    const normalized = normalizeApiError(error)
    if (normalized.code === 'REQUEST_ABORTED') throw normalized

    const args = {
      code: 'NETWORK_ERROR',
      message: 'Network request failed before receiving an HTTP response.',
      cause: error,
    }
    throw new ApiError({
      ...args,
      message: toApiErrorDisplay(new ApiError(args)).message,
    })
  }

  if (response.status === 401 && allowRefresh && !isAuthSessionMutation(path) && !isDeviceSignedPath(path) && getRefreshToken()) {
    try {
      const refreshedToken = await refreshAccessToken()
      if (refreshedToken) {
        response = await sendRequest(path, init, refreshedToken)
      }
    } catch {
      // handled below as a standard auth failure
    }
  }

  const { payload, rawText } = await readResponsePayload(response)
  const envelope = normalizeEnvelope(payload)
  const requestId = extractRequestId(envelope ?? payload)
  const envelopeError = envelope && isRecord((envelope as { error?: unknown }).error)
    ? (envelope as { error: Record<string, unknown> }).error
    : null

  if (!response.ok) {
    const error = createHttpError(response, payload, rawText)
    if (error.status === 401 && !isDeviceSignedPath(path) && !isAuthSessionMutation(path)) {
      invalidateAuthSession('http-401', {
        code: error.code,
        requestId: error.requestId,
        status: error.status,
        surface: 'shell',
        path: normalizeRequestPath(path),
      })
    }
    throw error
  }

  if (envelopeError) {
    const args = {
      status: response.status,
      code: typeof envelopeError.code === 'string' ? envelopeError.code : 'ENVELOPE_ERROR',
      message: formatApiErrorMessage({
        code: envelopeError.code,
        message: envelopeError.message,
        details: envelopeError.details,
        status: response.status,
      }),
      details: envelopeError.details,
      requestId,
    }
    throw new ApiError({
      ...args,
      message: toApiErrorDisplay(new ApiError(args)).message,
    })
  }

  const data = envelope && 'data' in envelope ? envelope.data : payload
  return normalize ? normalize(data) : (data as T)
}

export async function apiFetch<T>(path: string, init?: RequestInit, normalize?: (value: unknown) => T): Promise<T> {
  return apiFetchInternal(path, init, normalize, true)
}

export function postJson<T>(path: string, body: unknown, normalize?: (value: unknown) => T) {
  return apiFetch<T>(path, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  }, normalize)
}

export function putJson<T>(path: string, body: unknown, normalize?: (value: unknown) => T) {
  return apiFetch<T>(path, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  }, normalize)
}

export function patchJson<T>(path: string, body: unknown, normalize?: (value: unknown) => T) {
  return apiFetch<T>(path, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  }, normalize)
}

export function deleteJson<T>(path: string, body?: unknown, normalize?: (value: unknown) => T) {
  return apiFetch<T>(path, {
    method: 'DELETE',
    headers: jsonHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  }, normalize)
}
