import { apiFetch, buildQuery } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import type { ListUsersResponse, MyProfile, SiteRow, UserDetail, UserSummary } from '@parkly/contracts'

export type { ListUsersResponse, MyProfile, UserDetail, UserSummary }

// ─── List Users ───────────────────────────────────────────────────────────────

export type ListUsersOptions = {
  siteCode?: string
  role?: string
  status?: 'ACTIVE' | 'DISABLED'
  search?: string
  cursor?: string
  limit?: number
}

export function listUsers(options: ListUsersOptions = {}) {
  const qs = buildQuery({
    ...(options.siteCode && { siteCode: options.siteCode }),
    ...(options.role && { role: options.role }),
    ...(options.status && { status: options.status }),
    ...(options.search && { search: options.search }),
    ...(options.cursor && { cursor: options.cursor }),
    ...(options.limit && { limit: String(options.limit) }),
  })
  return apiFetch<ListUsersResponse>(
    `/api/admin/users${qs ? `?${qs}` : ''}`,
    undefined,
    (value) => {
      const row = isRecord(value) ? value : {}
      return {
        rows: Array.isArray(row.rows) ? row.rows : [],
        nextCursor: row.nextCursor ? String(row.nextCursor) : null,
        hasMore: Boolean(row.hasMore),
      }
    },
  )
}

// ─── Get User Detail ──────────────────────────────────────────────────────────

export function getUserDetail(userId: string) {
  return apiFetch<UserDetail>(`/api/admin/users/${userId}`, undefined, (value) => {
    return isRecord(value) ? (value as UserDetail) : ({} as UserDetail)
  })
}

// ─── Create User ───────────────────────────────────────────────────────────────

export type CreateUserPayload = {
  username: string
  password: string
  role: string
  siteScopes?: Array<{ siteCode: string; scopeLevel: string }>
}

export function createUser(body: CreateUserPayload) {
  return apiFetch<{ userId: string; username: string }>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Update User ──────────────────────────────────────────────────────────────

export type UpdateUserPayload = {
  username?: string
  password?: string
  role?: string
  mustChangePassword?: boolean
  reason?: string
}

export function updateUser(userId: string, body: UpdateUserPayload) {
  return apiFetch<{ userId: string; username: string }>(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Enable / Disable User ────────────────────────────────────────────────────

export function enableUser(userId: string, reason?: string) {
  return apiFetch<{ userId: string; username: string; status: string }>(
    `/api/admin/users/${userId}/enable`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

export function disableUser(userId: string, reason?: string) {
  return apiFetch<{ userId: string; username: string; status: string }>(
    `/api/admin/users/${userId}/disable`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

// ─── Set Site Scopes ──────────────────────────────────────────────────────────

export function setUserSiteScopes(userId: string, siteScopes: Array<{ siteCode: string; scopeLevel: string }>) {
  return apiFetch<{ userId: string; siteScopes: Array<{ siteCode: string; scopeLevel: string }> }>(
    `/api/admin/users/${userId}/site-scopes`,
    {
      method: 'PUT',
      body: JSON.stringify({ siteScopes }),
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

// ─── Revoke Sessions ──────────────────────────────────────────────────────────

export function revokeUserSessions(userId: string, reason?: string) {
  return apiFetch<{ userId: string; revokedSessionCount: number; revokedSessionIds: string[] }>(
    `/api/admin/users/${userId}/revoke-sessions`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

// ─── My Profile ────────────────────────────────────────────────────────────────

export function getMyProfile() {
  return apiFetch<MyProfile>('/api/users/me/profile', undefined, (value) => {
    return isRecord(value) ? (value as MyProfile) : ({} as MyProfile)
  })
}

export function updateMyProfile(body: { password?: string }) {
  return apiFetch<{ userId: string }>('/api/users/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Helper: role label ───────────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  SITE_ADMIN: { label: 'Site Admin', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  MANAGER: { label: 'Manager', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  OPERATOR: { label: 'Operator', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  GUARD: { label: 'Guard', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  CASHIER: { label: 'Cashier', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  VIEWER: { label: 'Viewer', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
  WORKER: { label: 'Worker', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
}

export const SCOPE_LEVELS = ['ADMIN', 'MANAGER', 'CASHIER', 'GUARD', 'VIEWER'] as const
