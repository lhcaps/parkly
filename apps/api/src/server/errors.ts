/**
 * Domain-specific error subclasses.
 *
 * Extend the base `ApiError` with semantic convenience constructors so that
 * route handlers can `throw new NotFoundError('Lane', laneCode)` instead of
 * manually assembling the ApiError options bag every time.
 *
 * The global error handler middleware (`error-handler.ts`) catches these and
 * serialises the standard `ApiErrorEnvelope` automatically.
 */

import { ApiError, type ApiErrorCode } from './http'

// ─── Convenience subclasses ──────────────────────────────────────────────────

/** HTTP 404 — resource lookup failed. */
export class NotFoundError extends ApiError {
  constructor(resource: string, identifier?: string | number) {
    const id = identifier != null ? ` (${identifier})` : ''
    super({
      code: 'NOT_FOUND',
      message: `${resource}${id} not found`,
    })
    this.name = 'NotFoundError'
  }
}

/** HTTP 409 — write conflict (optimistic locking, duplicate key, etc.). */
export class ConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super({ code: 'CONFLICT', message, details })
    this.name = 'ConflictError'
  }
}

/** HTTP 422 — business rule violation. */
export class BusinessRuleError extends ApiError {
  public readonly ruleCode: string

  constructor(ruleCode: string, message: string, details?: unknown) {
    super({ code: 'UNPROCESSABLE_ENTITY', message, details })
    this.name = 'BusinessRuleError'
    this.ruleCode = ruleCode
  }
}

/** HTTP 400 — request validation / schema mismatch. */
export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super({ code: 'BAD_REQUEST', message, details })
    this.name = 'ValidationError'
  }
}

/** HTTP 401 — caller is not authenticated. */
export class UnauthenticatedError extends ApiError {
  constructor(message = 'Authentication required') {
    super({ code: 'UNAUTHENTICATED', message })
    this.name = 'UnauthenticatedError'
  }
}

/** HTTP 403 — caller does not have the required role/permission. */
export class ForbiddenError extends ApiError {
  constructor(message = 'You do not have permission to perform this action') {
    super({ code: 'FORBIDDEN', message })
    this.name = 'ForbiddenError'
  }
}

/** HTTP 413 — request body exceeds allowed size. */
export class PayloadTooLargeError extends ApiError {
  constructor(maxBytes: number) {
    super({
      code: 'PAYLOAD_TOO_LARGE',
      message: `Request payload exceeds the maximum allowed size (${(maxBytes / (1024 * 1024)).toFixed(1)} MB)`,
    })
    this.name = 'PayloadTooLargeError'
  }
}

// ─── Error code catalog (for spec/docs) ──────────────────────────────────────

export const ERROR_CODE_CATALOG: ReadonlyArray<{
  code: ApiErrorCode
  status: number
  description: string
  example: string
}> = [
  { code: 'BAD_REQUEST', status: 400, description: 'Malformed request or validation failure', example: 'Missing required field `plateRaw`' },
  { code: 'UNAUTHENTICATED', status: 401, description: 'No valid session or token', example: 'JWT expired or not provided' },
  { code: 'FORBIDDEN', status: 403, description: 'Insufficient role/permission', example: 'OPERATOR trying to delete a site' },
  { code: 'NOT_FOUND', status: 404, description: 'Resource does not exist', example: 'Session ID not found in database' },
  { code: 'CONFLICT', status: 409, description: 'Write conflict or duplicate', example: 'Lane code already exists on this site' },
  { code: 'PAYLOAD_TOO_LARGE', status: 413, description: 'Request body exceeds limit', example: 'Image upload > 10 MB' },
  { code: 'UNSUPPORTED_MEDIA_TYPE', status: 415, description: 'Content-Type not accepted', example: 'Sending XML instead of JSON' },
  { code: 'UNPROCESSABLE_ENTITY', status: 422, description: 'Business rule violation', example: 'Anti-passback detected for vehicle' },
  { code: 'SERVICE_UNAVAILABLE', status: 503, description: 'Server overloaded or in maintenance', example: 'Rate limit exceeded' },
  { code: 'DEP_UNAVAILABLE', status: 503, description: 'External dependency is down', example: 'Redis connection lost' },
  { code: 'INTERNAL_ERROR', status: 500, description: 'Unexpected server error', example: 'Unhandled exception in route handler' },
]
