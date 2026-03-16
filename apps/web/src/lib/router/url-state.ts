import type { SetURLSearchParams } from 'react-router-dom'

type QueryValue = string | number | boolean | null | undefined

type NumberParamOptions = {
  fallback: number
  min?: number
  max?: number
  allowed?: readonly number[]
}

function toEnumSet<T extends string>(values: readonly T[]) {
  return new Set(values)
}

export function readTrimmedSearchParam(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)
  return value ? value.trim() : ''
}

export function readEnumSearchParam<T extends string>(searchParams: URLSearchParams, key: string, allowed: readonly T[], fallback: T): T {
  const raw = readTrimmedSearchParam(searchParams, key)
  if (!raw) return fallback
  return toEnumSet(allowed).has(raw as T) ? (raw as T) : fallback
}

export function readNumberSearchParam(searchParams: URLSearchParams, key: string, options: NumberParamOptions) {
  const raw = readTrimmedSearchParam(searchParams, key)
  if (!raw) return options.fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) return options.fallback
  const rounded = Math.trunc(value)
  if (options.allowed && !options.allowed.includes(rounded)) return options.fallback
  if (typeof options.min === 'number' && rounded < options.min) return options.fallback
  if (typeof options.max === 'number' && rounded > options.max) return options.fallback
  return rounded
}

export function normalizeDatetimeLocalParam(value: string) {
  return value.trim()
}

export function setQueryValue(searchParams: URLSearchParams, key: string, value: QueryValue) {
  if (value === null || value === undefined) {
    searchParams.delete(key)
    return
  }

  if (typeof value === 'boolean') {
    if (!value) {
      searchParams.delete(key)
      return
    }
    searchParams.set(key, '1')
    return
  }

  const normalized = String(value).trim()
  if (!normalized) {
    searchParams.delete(key)
    return
  }

  searchParams.set(key, normalized)
}

export function buildSearchParams(record: Record<string, QueryValue>) {
  const searchParams = new URLSearchParams()
  Object.entries(record).forEach(([key, value]) => setQueryValue(searchParams, key, value))
  return searchParams
}

export function syncSearchParams(current: URLSearchParams, next: URLSearchParams, setSearchParams: SetURLSearchParams, replace = true) {
  if (current.toString() === next.toString()) return
  setSearchParams(next, { replace })
}

export function buildRoutePath(pathname: string, record?: Record<string, QueryValue>) {
  if (!record) return pathname
  const searchParams = buildSearchParams(record)
  const query = searchParams.toString()
  return query ? `${pathname}?${query}` : pathname
}
