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

  if (error instanceof Error) {
    return new ApiError({ message: error.message, cause: error })
  }

  return new ApiError({ message: typeof error === 'string' ? error : 'Unknown API error', cause: error })
}

export function classifyAppError(error: unknown, opts?: { realtimeStale?: boolean }): AppErrorKind {
  if (opts?.realtimeStale) return 'realtimeStale'

  const normalized = normalizeApiError(error)

  if (normalized.code === 'REALTIME_STALE') return 'realtimeStale'
  if (normalized.status === 401 || normalized.code === 'UNAUTHENTICATED') return 'unauthorized'
  if (normalized.status === 403 || normalized.code === 'FORBIDDEN') return 'forbidden'
  if (normalized.status === 409 || normalized.code === 'CONFLICT') return 'conflict'
  if (
    normalized.status === 422
    || normalized.code === 'UNPROCESSABLE_ENTITY'
    || (normalized.status === 400 && extractValidationFieldErrors(normalized.details).length > 0)
  ) return 'validation'
  if (
    normalized.status === 503
    || normalized.code === 'SERVICE_UNAVAILABLE'
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

  switch (kind) {
    case 'unauthorized':
      return {
        kind,
        title: 'Session expired',
        message: withRequestId(`Backend returned 401. Sign in again to restore the session.${detailSuffix}`.trim(), normalized.requestId),
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
        message: withRequestId(`Backend returned 403. Switch to an account with the required role.oặc màn hình đúng trách nhiệm vận hành.${detailSuffix}`.trim(), normalized.requestId),
        tone: 'warning',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction: 'Keep the current shell, switch role, or ask someone with the required permissions.',
        fieldErrors,
      }
    case 'validation':
      return {
        kind,
        title: 'Invalid payload',
        message: withRequestId(`Backend rejected the request due to invalid input.${detailSuffix}`.trim(), normalized.requestId),
        tone: 'warning',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction: 'Fix the reported fields and resubmit.',
        fieldErrors,
      }
    case 'conflict':
      return {
        kind,
        title: 'State conflict',
        message: withRequestId(`Backend returned 409 conflict. The data may be stale or modified concurrently. tác đồng thời.${detailSuffix}`.trim(), normalized.requestId),
        tone: 'warning',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction: 'Refresh the detail snapshot and confirm the action again.',
        fieldErrors,
      }
    case 'dependencyDown':
      return {
        kind,
        title: 'Dependency degraded',
        message: withRequestId(`Request could not complete — downstream, worker, or network is unstable.${detailSuffix}`.trim(), normalized.requestId),
        tone: 'error',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction: 'Retry after checking API logs and dependent services.',
        fieldErrors,
      }
    case 'realtimeStale':
      return {
        kind,
        title: 'Realtime stale',
        message: withRequestId(normalized.message || 'The stream is no longer reliable for current state. live hiện tại.', normalized.requestId),
        tone: 'warning',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction: 'Manual resync to reload the authoritative snapshot.',
        fieldErrors,
      }
    case 'internal':
      return {
        kind,
        title: 'Internal server error',
        message: withRequestId(`Backend trả về ${normalized.status || 500}. The UI shell is intact but cannot continue the current flow.ể tin vào kết quả của request này.${detailSuffix}`.trim(), normalized.requestId),
        tone: 'error',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction: 'Retry. If it persists, note the request ID and check backend logs.',
        fieldErrors,
      }
    default:
      return {
        kind: 'unknown',
        title: fallbackTitle,
        message: withRequestId(normalized.message || 'An unexpected error occurred calling the API.', normalized.requestId),
        tone: 'error',
        status: normalized.status || null,
        code: normalized.code,
        requestId: normalized.requestId,
        nextAction: 'Retry or open the debug screen to check the current context.',
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
  const code = normalized.code || ''
  return (
    normalized.status === 401 &&
    (
      code === 'AUTH_INVALID_CREDENTIALS' ||
      code === 'INVALID_CREDENTIALS' ||
      code === 'UNAUTHENTICATED' ||
      code === 'AUTH_FAILED'
    )
  )
}
