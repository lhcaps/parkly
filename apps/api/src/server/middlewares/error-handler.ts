/**
 * Global error handler middleware.
 *
 * Catches all errors thrown/rejected in route handlers and serialises
 * them into the standard `ApiErrorEnvelope` shape. Eliminates the need
 * for try/catch boilerplate in individual routes.
 *
 * Usage: register as the LAST middleware in Express, after all routes.
 *
 * ```ts
 * app.use(globalErrorHandler)
 * ```
 */

import type { Request, Response, NextFunction } from 'express-serve-static-core'
import { ApiError, DependencyUnavailableError, type ApiErrorEnvelope } from '../http'

function isZodError(err: unknown): err is { issues: Array<{ path: (string | number)[]; message: string }> } {
  return (
    err != null &&
    typeof err === 'object' &&
    'issues' in err &&
    Array.isArray((err as any).issues)
  )
}

function isPrismaKnownError(err: unknown): err is { code: string; meta?: any; message: string } {
  return (
    err != null &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as any).code === 'string' &&
    (err as any).code.startsWith('P')
  )
}

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req as any).id || 'unknown'
  const log = (req as any).log

  // ─── ApiError (including all subclasses) ─────────────────
  if (err instanceof ApiError) {
    const envelope: ApiErrorEnvelope = {
      requestId,
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    }
    if (err.statusCode >= 500) {
      log?.error({ err, envelope }, 'Server error')
    } else {
      log?.warn({ code: err.code, status: err.statusCode, message: err.message }, 'Client error')
    }
    res.status(err.statusCode).json(envelope)
    return
  }

  // ─── DependencyUnavailableError ──────────────────────────
  if (err instanceof DependencyUnavailableError) {
    log?.error({ err, dependency: err.dependency }, 'Dependency unavailable')
    res.status(503).json({
      requestId,
      code: 'DEP_UNAVAILABLE',
      message: err.message,
    })
    return
  }

  // ─── Zod validation errors ──────────────────────────────
  if (isZodError(err)) {
    const fieldErrors = (err as any).issues.map((issue: any) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    log?.warn({ fieldErrors }, 'Zod validation error')
    res.status(400).json({
      requestId,
      code: 'BAD_REQUEST',
      message: 'Validation failed',
      details: { fieldErrors },
    })
    return
  }

  // ─── Prisma known errors ────────────────────────────────
  if (isPrismaKnownError(err)) {
    const prismaErr = err as { code: string; meta?: any; message: string }
    if (prismaErr.code === 'P2002') {
      log?.warn({ prismaCode: prismaErr.code, meta: prismaErr.meta }, 'Unique constraint violation')
      res.status(409).json({
        requestId,
        code: 'CONFLICT',
        message: 'A record with this identifier already exists',
        details: { prismaCode: prismaErr.code, target: prismaErr.meta?.target },
      })
      return
    }
    if (prismaErr.code === 'P2025') {
      log?.warn({ prismaCode: prismaErr.code }, 'Record not found')
      res.status(404).json({
        requestId,
        code: 'NOT_FOUND',
        message: 'Record not found',
      })
      return
    }
    // Default Prisma error
    log?.error({ err: prismaErr }, 'Prisma error')
    res.status(500).json({
      requestId,
      code: 'INTERNAL_ERROR',
      message: 'Database operation failed',
    })
    return
  }

  // ─── Unknown errors ─────────────────────────────────────
  const errorMessage = err instanceof Error ? err.message : String(err)
  log?.error({ err }, 'Unhandled error in route handler')
  res.status(500).json({
    requestId,
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Unexpected server error' : errorMessage,
  })
}
