/**
 * Error hierarchy + global error handler — Vitest test suite.
 */

import { describe, it, expect } from 'vitest'
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ValidationError,
  UnauthenticatedError,
  ForbiddenError,
  PayloadTooLargeError,
  ERROR_CODE_CATALOG,
} from '../server/errors'
import { ApiError } from '../server/http'

describe('Error hierarchy', () => {
  it('NotFoundError extends ApiError with 404', () => {
    const err = new NotFoundError('Lane', 'LANE-A1')
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('Lane (LANE-A1) not found')
    expect(err.name).toBe('NotFoundError')
  })

  it('NotFoundError without identifier', () => {
    const err = new NotFoundError('Session')
    expect(err.message).toBe('Session not found')
  })

  it('ConflictError extends ApiError with 409', () => {
    const err = new ConflictError('Lane code already exists', { field: 'laneCode' })
    expect(err.statusCode).toBe(409)
    expect(err.code).toBe('CONFLICT')
    expect(err.details).toEqual({ field: 'laneCode' })
  })

  it('BusinessRuleError extends ApiError with 422', () => {
    const err = new BusinessRuleError('ANTI_PASSBACK', 'Vehicle already inside')
    expect(err.statusCode).toBe(422)
    expect(err.code).toBe('UNPROCESSABLE_ENTITY')
    expect(err.ruleCode).toBe('ANTI_PASSBACK')
  })

  it('ValidationError extends ApiError with 400', () => {
    const err = new ValidationError('plateRaw is required')
    expect(err.statusCode).toBe(400)
    expect(err.code).toBe('BAD_REQUEST')
  })

  it('UnauthenticatedError defaults message', () => {
    const err = new UnauthenticatedError()
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Authentication required')
  })

  it('ForbiddenError defaults message', () => {
    const err = new ForbiddenError()
    expect(err.statusCode).toBe(403)
    expect(err.code).toBe('FORBIDDEN')
  })

  it('PayloadTooLargeError formats MB', () => {
    const err = new PayloadTooLargeError(10 * 1024 * 1024)
    expect(err.statusCode).toBe(413)
    expect(err.message).toContain('10.0 MB')
  })
})

describe('Error code catalog', () => {
  it('has 11 entries covering all codes', () => {
    expect(ERROR_CODE_CATALOG.length).toBe(11)
  })

  it('each entry has required fields', () => {
    for (const entry of ERROR_CODE_CATALOG) {
      expect(entry.code).toBeTruthy()
      expect(entry.status).toBeGreaterThanOrEqual(400)
      expect(entry.description).toBeTruthy()
      expect(entry.example).toBeTruthy()
    }
  })
})
