import { ApiError, formatApiErrorMessage, isRecord, type ApiEnvelope } from '@/lib/http/errors'

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
  return localStorage.getItem('parkly_token') || ''
}

export function setToken(token: string) {
  localStorage.setItem('parkly_token', token)
}

export function clearToken() {
  localStorage.removeItem('parkly_token')
}

export function jsonHeaders(init?: HeadersInit) {
  return {
    'Content-Type': 'application/json',
    ...(init || {}),
  }
}

export function buildQuery(params?: Record<string, string | number | boolean | null | undefined>) {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue
    qs.set(key, String(value))
  }
  return qs.toString()
}

function mergeHeaders(token: string, headers?: HeadersInit) {
  return {
    ...(headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit, normalize?: (value: unknown) => T): Promise<T> {
  const token = getToken()
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: mergeHeaders(token, init?.headers),
  })

  const contentType = response.headers.get('content-type') || ''
  const text = await response.text()

  if (!contentType.includes('application/json')) {
    throw new ApiError({
      status: response.status,
      code: `HTTP_${response.status}`,
      message: `HTTP ${response.status} ${response.statusText}: ${text || '(empty response)'}`,
    })
  }

  let envelope: ApiEnvelope<unknown>
  try {
    envelope = JSON.parse(text) as ApiEnvelope<unknown>
  } catch (error) {
    throw new ApiError({
      status: response.status,
      code: 'INVALID_JSON',
      message: `Invalid JSON from API: ${text || '(empty response)'}`,
      cause: error,
    })
  }

  const requestId = isRecord(envelope) && typeof envelope.requestId === 'string' ? envelope.requestId : undefined
  const envelopeError = isRecord(envelope) && 'error' in envelope && isRecord(envelope.error)
    ? envelope.error
    : null

  if (!response.ok) {
    if (envelopeError) {
      throw new ApiError({
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
      })
    }

    throw new ApiError({
      status: response.status,
      code: `HTTP_${response.status}`,
      message: `HTTP ${response.status} ${response.statusText}`,
      requestId,
    })
  }

  if (envelopeError) {
    throw new ApiError({
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
    })
  }

  const data = isRecord(envelope) && 'data' in envelope ? envelope.data : undefined
  return normalize ? normalize(data) : (data as T)
}

export function postJson<T>(path: string, body: unknown, normalize?: (value: unknown) => T) {
  return apiFetch<T>(path, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  }, normalize)
}
