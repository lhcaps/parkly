import { canAccessRoute, getFirstAllowedRoute, getRoleHome } from '@/lib/auth/role-policy'
import type { AuthRole } from '@/lib/contracts/auth'

export type AuthRedirectState = {
  from?: {
    pathname?: string
    search?: string
  } | null
}

function normalizePathname(pathname?: string | null) {
  const value = String(pathname ?? '').trim()
  if (!value.startsWith('/')) return ''
  return value
}

function normalizeSearch(search?: string | null) {
  const value = String(search ?? '').trim()
  if (!value) return ''
  return value.startsWith('?') ? value : `?${value}`
}

export function readRequestedRoute(state?: AuthRedirectState | null) {
  const pathname = normalizePathname(state?.from?.pathname)
  if (!pathname || pathname === '/login' || pathname === '/forbidden') return null

  return {
    pathname,
    search: normalizeSearch(state?.from?.search),
    href: `${pathname}${normalizeSearch(state?.from?.search)}`,
  }
}

export function resolvePostLoginRoute(args: {
  role?: AuthRole | string | null
  state?: AuthRedirectState | null
  fallbackToFirstAllowed?: boolean
}) {
  const requested = readRequestedRoute(args.state)
  const role = args.role ?? undefined

  if (requested && canAccessRoute(role, requested.pathname)) {
    return requested.href
  }

  if (args.fallbackToFirstAllowed) {
    return getFirstAllowedRoute(role, { canonicalOnly: true })
  }

  return getRoleHome(role)
}

export function describeResolvedDestination(args: { role?: AuthRole | string | null; state?: AuthRedirectState | null }) {
  const requested = readRequestedRoute(args.state)
  if (requested && canAccessRoute(args.role ?? undefined, requested.pathname)) {
    return requested.href
  }
  return getRoleHome(args.role ?? undefined)
}
