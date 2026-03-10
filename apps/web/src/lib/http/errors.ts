export type ApiEnvelope<T> =
  | { requestId?: string; data: T }
  | { requestId?: string; error: { code?: string; message?: string; details?: unknown } }

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

export function extractErrorHint(details: unknown): string {
  if (!isRecord(details)) return ''
  return typeof details.hint === 'string' ? details.hint.trim() : ''
}

export function formatApiErrorMessage(input: { code?: unknown; message?: unknown; details?: unknown; status?: number }) {
  const code = typeof input.code === 'string' && input.code.trim() ? input.code.trim() : input.status ? `HTTP_${input.status}` : 'UNKNOWN_ERROR'
  const message = typeof input.message === 'string' && input.message.trim() ? input.message.trim() : 'API request failed'
  const hint = extractErrorHint(input.details)
  return hint ? `${code}: ${message} — ${hint}` : `${code}: ${message}`
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof Error) return new ApiError({ message: error.message, cause: error })
  return new ApiError({ message: typeof error === 'string' ? error : 'Unknown API error', cause: error })
}
