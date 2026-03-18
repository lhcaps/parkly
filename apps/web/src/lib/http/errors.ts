export type ApiEnvelope<T> =
  | { requestId?: string; data: T }
  | { requestId?: string; error: { code?: string; message?: string; details?: unknown } }

export type ApiErrorKind = 'auth' | 'forbidden' | 'validation' | 'server' | 'network' | 'aborted' | 'unknown'
export type AppErrorKind = 'unauthorized' | 'forbidden' | 'validation' | 'conflict' | 'dependencyDown' | 'realtimeStale' | 'internal' | 'unknown'
export type ApiErrorTone = 'error' | 'warning' | 'info'

export type ApiErrorDisplay = {
  title: string
  message: string
  tone: ApiErrorTone
  status: number | null
  code: string
  requestId?: string
}

export type AppErrorDisplay = ApiErrorDisplay & {
  kind: AppErrorKind
  nextAction?: string
  fieldErrors: Array<{ field: string; message: string }>
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  readonly requestId?: string

  constructor(args: {
    status?: number
    code?: string
    message: string
    details?: unknown
    requestId?: string
    cause?: unknown
  }) {
    super(args.message)
    this.name = 'ApiError'
    this.status = args.status ?? 0
    this.code = args.code ?? 'UNKNOWN_ERROR'
    this.details = args.details
    this.requestId = args.requestId
    if (args.cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = args.cause
    }
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readDetailString(details: unknown, key: string) {
  if (!isRecord(details)) return ''
  const value = details[key]
  return typeof value === 'string' ? value.trim() : ''
}

function pushFieldError(target: Array<{ field: string; message: string }>, field: string, message: string) {
  const normalizedField = String(field || '').trim()
  const normalizedMessage = String(message || '').trim()
  if (!normalizedField || !normalizedMessage) return
  if (target.some((entry) => entry.field === normalizedField && entry.message === normalizedMessage)) return
  target.push({ field: normalizedField, message: normalizedMessage })
}

function containsAnyNeedle(value: string, needles: readonly string[]) {
  const haystack = value.toUpperCase()
  return needles.some((needle) => haystack.includes(needle))
}

function isDeviceSignatureCode(code: string) {
  return containsAnyNeedle(code, [
    'DEVICE_SIGNATURE_INVALID',
    'DEVICE_AUTH_INVALID',
    'DEVICE_SECRET_INVALID',
    'DEVICE_SIGNING_INVALID',
    'DEVICE_UNAUTHORIZED',
  ])
}

function isInvalidCredentialCode(code: string) {
  return containsAnyNeedle(code, [
    'AUTH_INVALID_CREDENTIALS',
    'INVALID_CREDENTIALS',
    'AUTH_FAILED',
  ])
}

function isWorkflowConflictCode(code: string) {
  return containsAnyNeedle(code, [
    'CONFLICT',
    'STATE_CHANGED',
    'STALE_STATE',
    'SESSION_TERMINAL',
    'SESSION_NOT_ACTIONABLE',
    'ACTION_NOT_ALLOWED',
    'INVALID_STATE_TRANSITION',
    'REVIEW_ALREADY_CLAIMED',
    'REVIEW_NOT_ACTIONABLE',
    'REVIEW_LOCKED',
    'MANUAL_ACTION_BLOCKED',
  ])
}

function isAnonymousBootstrapCode(code: string) {
  return containsAnyNeedle(code, [
    'ANONYMOUS_BOOTSTRAP_FAILED',
    'BOOTSTRAP_FAILED',
    'AUTH_BOOTSTRAP_FAILED',
  ])
}

export function extractErrorHint(details: unknown): string {
  return readDetailString(details, 'hint')
}

export function extractFieldError(details: unknown): string {
  const field = readDetailString(details, 'field')
  const reason = readDetailString(details, 'reason')
  const message = readDetailString(details, 'message')

  if (field && reason) return `${field}: ${reason}`
  if (field && message) return `${field}: ${message}`
  return ''
}

export function extractRequestId(input: unknown): string | undefined {
  if (!isRecord(input)) return undefined
  return typeof input.requestId === 'string' && input.requestId.trim() ? input.requestId.trim() : undefined
}

export function extractValidationFieldErrors(details: unknown) {
  const fieldErrors: Array<{ field: string; message: string }> = []

  if (isRecord(details)) {
    const nestedValidation = details.validation
    if (isRecord(nestedValidation)) {
      const fromFields = nestedValidation.fieldErrors
      if (isRecord(fromFields)) {
        for (const [field, value] of Object.entries(fromFields)) {
          if (Array.isArray(value)) {
            for (const item of value) {
              if (typeof item === 'string' && item.trim()) pushFieldError(fieldErrors, field, item)
            }
          } else if (typeof value === 'string' && value.trim()) {
            pushFieldError(fieldErrors, field, value)
          }
        }
      }

      const formErrors = nestedValidation.formErrors
      if (Array.isArray(formErrors)) {
        for (const entry of formErrors) {
          if (typeof entry === 'string' && entry.trim()) pushFieldError(fieldErrors, 'form', entry)
        }
      }
    }

    const directField = readDetailString(details, 'field')
    const directReason = readDetailString(details, 'reason') || readDetailString(details, 'message')
    if (directField && directReason) pushFieldError(fieldErrors, directField, directReason)
  }

  return fieldErrors
}

export function formatApiErrorMessage(input: { code?: unknown; message?: unknown; details?: unknown; status?: number }) {
  const code = typeof input.code === 'string' && input.code.trim() ? input.code.trim() : input.status ? `HTTP_${input.status}` : 'UNKNOWN_ERROR'
  const message = typeof input.message === 'string' && input.message.trim() ? input.message.trim() : 'API request failed'
  const hint = extractErrorHint(input.details) || extractFieldError(input.details)
  return hint ? `${code}: ${message} — ${hint}` : `${code}: ${message}`
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiError({
      code: 'REQUEST_ABORTED',
      message: 'The request was cancelled before completing.',
      cause: error,
    })
  }

  // Handle raw response objects from fetch() that may contain the backend's error envelope.
  // This catches DEP_UNAVAILABLE, NOT_FOUND, BAD_REQUEST, etc. returned by the API
  // before they get wrapped in a generic Error by the caller.
  if (
    error
    && typeof error === 'object'
    && !Array.isArray(error)
    && typeof (error as any).code === 'string'
  ) {
    const raw = error as any
    // Map server error codes to HTTP-like status
    const statusFromCode: Record<string, number> = {
      DEP_UNAVAILABLE: 503,
      SERVICE_UNAVAILABLE: 503,
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      BAD_REQUEST: 400,
      CONFLICT: 409,
      UNPROCESSABLE_ENTITY: 422,
      PAYLOAD_TOO_LARGE: 413,
      UNSUPPORTED_MEDIA_TYPE: 415,
      INTERNAL_ERROR: 500,
    }
    const KNOWN_CODES = new Set([
      'BAD_REQUEST', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND',
      'CONFLICT', 'UNPROCESSABLE_ENTITY', 'UNSUPPORTED_MEDIA_TYPE',
      'PAYLOAD_TOO_LARGE', 'SERVICE_UNAVAILABLE', 'DEP_UNAVAILABLE',
      'INTERNAL_ERROR', 'REQUEST_ABORTED',
    ])
    return new ApiError({
      code: KNOWN_CODES.has(raw.code) ? raw.code : 'INTERNAL_ERROR',
      message: typeof raw.message === 'string' ? raw.message : 'API request failed',
      // Prefer: 1. explicit .status on the object, 2. code→status mapping, 3. undefined
      status: typeof raw.status === 'number'
        ? raw.status
        : (statusFromCode[raw.code] ?? undefined),
      details: raw.details,
      requestId: typeof raw.requestId === 'string' ? raw.requestId : undefined,
      cause: error,
    })
  }

  if (error instanceof Error) {
    return new ApiError({ message: error.message, cause: error })
  }

  return new ApiError({ message: typeof error === 'string' ? error : 'Unknown API error', cause: error })
}

export function isDeviceSignedAuthError(error: unknown): boolean {
  const normalized = normalizeApiError(error)
  return normalized.status === 401 && isDeviceSignatureCode(normalized.code)
}

function isWorkflowConflictError(error: unknown): boolean {
  const normalized = normalizeApiError(error)
  return normalized.status === 409 || isWorkflowConflictCode(normalized.code)
}

export function classifyAppError(error: unknown, opts?: { realtimeStale?: boolean }): AppErrorKind {
  if (opts?.realtimeStale) return 'realtimeStale'

  const normalized = normalizeApiError(error)

  if (normalized.code === 'REALTIME_STALE') return 'realtimeStale'
  if (isWorkflowConflictError(normalized)) return 'conflict'
  if (normalized.status === 403 || normalized.code === 'FORBIDDEN') return 'forbidden'
  if (normalized.status === 401 || normalized.code === 'UNAUTHENTICATED' || isAnonymousBootstrapCode(normalized.code)) return 'unauthorized'
  if (
    normalized.status === 422
    || normalized.code === 'UNPROCESSABLE_ENTITY'
    || (normalized.status === 400 && extractValidationFieldErrors(normalized.details).length > 0)
  ) return 'validation'
  if (
    normalized.status === 503
    || normalized.code === 'SERVICE_UNAVAILABLE'
    || normalized.code === 'DEP_UNAVAILABLE'
    || normalized.code === 'NETWORK_ERROR'
    || normalized.status === 0
  ) return 'dependencyDown'
  if (normalized.status >= 500 || normalized.code === 'INTERNAL_ERROR') return 'internal'
  return 'unknown'
}

export function classifyApiError(error: unknown): ApiErrorKind {
  const normalized = normalizeApiError(error)
  if (normalized.code === 'REQUEST_ABORTED') return 'aborted'

  const kind = classifyAppError(error)
  if (kind === 'unauthorized') return 'auth'
  if (kind === 'forbidden') return 'forbidden'
  if (kind === 'validation') return 'validation'
  if (kind === 'dependencyDown' && (normalized.code === 'NETWORK_ERROR' || normalized.status === 0)) return 'network'
  if (kind === 'internal' || kind === 'dependencyDown' || kind === 'conflict' || kind === 'realtimeStale') return 'server'
  return 'unknown'
}

function withRequestId(message: string, requestId?: string) {
  return requestId ? `${message} (requestId: ${requestId})` : message
}

export function toAppErrorDisplay(error: unknown, fallbackTitle = 'Unable to complete request', opts?: { realtimeStale?: boolean }): AppErrorDisplay {
  const normalized = normalizeApiError(error)
  const fieldErrors = extractValidationFieldErrors(normalized.details)
  const hint = extractErrorHint(normalized.details)
  const fieldError = extractFieldError(normalized.details)
  const fieldSummary = fieldErrors.length > 0 ? `${fieldErrors[0].field}: ${fieldErrors[0].message}` : ''
  const suffix = hint || fieldError || fieldSummary
  const detailSuffix = suffix ? ` ${suffix}.` : ''
  const kind = classifyAppError(normalized, opts)

  if (isDeviceSignedAuthError(normalized)) {
    return {
      kind: 'unauthorized',
      title: 'Device authentication failed',
      message: withRequestId(`The device signature or device secret is invalid for this request.${detailSuffix}`.trim(), normalized.requestId),
      tone: 'warning',
      status: normalized.status || null,
      code: normalized.code,
      requestId: normalized.requestId,
      nextAction: 'Verify site, lane, device code, and device secret on the mobile surface, then retry.',
      fieldErrors,
    }
  }

  if (isInvalidCredentialCode(normalized.code) && normalized.status === 401) {
    return {
      kind: 'unauthorized',
      title: 'Authentication failed',
      message: 'Username or password is incorrect.',
      tone: 'warning',
      status: normalized.status || null,
      code: normalized.code,
      requestId: normalized.requestId,
      nextAction: 'Check the credentials and try again.',
      fieldErrors,
    }
  }

  switch (kind) {
    case 'unauthorized':
      return {
        kind,
        title: 'Session expired',
        message: withRequestId(`The current user session is no longer valid.${detailSuffix}`.trim(), normalized.requestId),
        tone: 'warning',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction: 'Sign in again and retry the action.',
        fieldErrors,
      }
    case 'forbidden':
      return {
        kind,
        title: 'Role not permitted',
        message: withRequestId(`The current role is not allowed to perform this action.${detailSuffix}`.trim(), normalized.requestId),
        tone: 'warning',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction: 'Use a role with the required permission or move to the correct workflow.',
        fieldErrors,
      }
    case 'validation':
      return {
        kind,
        title: 'Invalid input',
        message: withRequestId(`The request payload is incomplete or invalid.${detailSuffix}`.trim(), normalized.requestId),
        tone: 'warning',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction: 'Fix the reported fields and submit again.',
        fieldErrors,
      }
    case 'conflict':
      return {
        kind,
        title: 'State changed',
        message: withRequestId(`The workflow state changed before this action completed.${detailSuffix}`.trim(), normalized.requestId),
        tone: 'warning',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction: 'Refresh the live detail, confirm the latest state, then retry only if the action is still allowed.',
        fieldErrors,
      }
    case 'dependencyDown': {
      const isNetworkError = normalized.code === 'NETWORK_ERROR' || normalized.status === 0
      const depName = normalized.details && typeof normalized.details === 'object' && !Array.isArray(normalized.details)
        ? (normalized.details as any).dependency as string | undefined
        : undefined
      const hint = normalized.details && typeof normalized.details === 'object' && !Array.isArray(normalized.details)
        ? (normalized.details as any).hint as string | undefined
        : undefined
      const extraDetails = normalized.details && typeof normalized.details === 'object' && !Array.isArray(normalized.details)
        ? (normalized.details as any).extra as string | undefined
        : undefined
      const detailSuffix = hint || extraDetails ? ` ${hint || extraDetails}.` : ''
      const depNote = depName && depName !== 'UNKNOWN'
        ? ` (${depName})`
        : ''
      const nextAction = isNetworkError
        ? 'Retry after checking connectivity. If using from another device (e.g. phone), set VITE_API_BASE_URL to the API URL (e.g. http://<host-ip>:3000) and ensure the API is running with API_HOST=0.0.0.0.'
        : depName
          ? `Check that ${depName} is running and reachable.`
          : 'Retry after checking connectivity and dependent services.'
      return {
        kind,
        title: 'Service temporarily unavailable',
        message: withRequestId(`The request could not complete because the API, worker, or network path is unstable${depNote}.${detailSuffix}`.trim(), normalized.requestId),
        tone: 'error',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction,
        fieldErrors,
      }
    }
    case 'realtimeStale':
      return {
        kind,
        title: 'Realtime stale',
        message: withRequestId(normalized.message || 'The live stream is stale and should not be treated as authoritative current state.', normalized.requestId),
        tone: 'warning',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction: 'Resync the snapshot before acting on live state.',
        fieldErrors,
      }
    case 'internal':
      return {
        kind,
        title: 'Internal server error',
        message: withRequestId(`The backend rejected the request with a server-side error.${detailSuffix}`.trim(), normalized.requestId),
        tone: 'error',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction: 'Retry. If it happens again, note the request ID and inspect backend logs.',
        fieldErrors,
      }
    default:
      return {
        kind: 'unknown',
        title: fallbackTitle,
        message: withRequestId(normalized.message || 'An unexpected API error occurred.', normalized.requestId),
        tone: 'error',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction: 'Retry or open diagnostics to inspect the current context.',
        fieldErrors,
      }
  }
}

export function toApiErrorDisplay(error: unknown, fallbackTitle = 'Unable to complete request'): ApiErrorDisplay {
  const display = toAppErrorDisplay(error, fallbackTitle)
  return {
    title: display.title,
    message: display.message,
    tone: display.tone,
    status: display.status,
    code: display.code,
    requestId: display.requestId,
  }
}

export function formatInlineApiError(error: unknown, fallbackTitle?: string) {
  const display = toAppErrorDisplay(error, fallbackTitle)
  return `${display.title}. ${display.message}`.trim()
}

/**
 * Returns true when the error is an authentication failure that means
 * "wrong username or password" — used to show a safe, non-leaking message.
 */
export function isAuthInvalidCredentials(error: unknown): boolean {
  const normalized = error instanceof ApiError ? error : normalizeApiError(error)
  return normalized.status === 401 && isInvalidCredentialCode(normalized.code)
}

export function getSafeLoginErrorMessage(error: unknown): string {
  if (isAuthInvalidCredentials(error)) return 'Incorrect username or password.'

  const kind = classifyAppError(error)
  if (kind === 'dependencyDown' || kind === 'internal') {
    return 'Unable to sign in right now. Check API availability or connectivity, then retry.'
  }
  if (kind === 'forbidden') {
    return 'This account is not allowed to open the current console workspace.'
  }
  return 'Sign-in failed. Retry after checking the current session state.'
}
