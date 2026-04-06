const DEFAULT_FALLBACK = '-'

export function resolveAppLocaleTag() {
  if (typeof document === 'undefined') return 'vi-VN'
  return document.documentElement.lang === 'en' ? 'en-GB' : 'vi-VN'
}

export function formatDateTimeValue(
  value?: string | null,
  options?: Intl.DateTimeFormatOptions,
  fallback = DEFAULT_FALLBACK,
) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleString(resolveAppLocaleTag(), options)
}

export function formatTimeValue(
  value?: string | null,
  options?: Intl.DateTimeFormatOptions,
  fallback = DEFAULT_FALLBACK,
) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleTimeString(resolveAppLocaleTag(), options)
}

export function formatNumberValue(
  value?: number | null,
  options?: Intl.NumberFormatOptions,
  fallback = DEFAULT_FALLBACK,
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return new Intl.NumberFormat(resolveAppLocaleTag(), options).format(value)
}
