/**
 * User Management — shared Zod schemas and inferred types.
 *
 * These schemas are the SINGLE SOURCE OF TRUTH for user management types
 * used by both `apps/api` (validation) and `apps/web` (API client + UI).
 *
 * Import from `@parkly/contracts` in `apps/web` instead of duplicating types.
 */
import { z } from 'zod'

// ─── Shared enums ───────────────────────────────────────────────────────────────

/** Role values accepted on user-management endpoints. */
export const UserManagementRoleSchema = z.enum([
  'SUPER_ADMIN',
  'SITE_ADMIN',
  'MANAGER',
  'OPERATOR',
  'GUARD',
  'CASHIER',
  'VIEWER',
  'WORKER',
])
export type UserManagementRole = z.infer<typeof UserManagementRoleSchema>

export const UserStatusSchema = z.enum(['ACTIVE', 'DISABLED'])
export type UserStatus = z.infer<typeof UserStatusSchema>

/** Scope levels for site access grants. */
export const ScopeLevelSchema = z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'GUARD', 'VIEWER'])
export type ScopeLevel = z.infer<typeof ScopeLevelSchema>

// ─── Query / params ────────────────────────────────────────────────────────────

export const ListUsersQuerySchema = z.object({
  siteCode: z.string().trim().min(1).max(32).optional(),
  role: z.string().trim().max(32).optional(),
  status: UserStatusSchema.optional(),
  search: z.string().trim().max(128).optional(),
  cursor: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})
export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>

export const UserIdParamSchema = z.object({ userId: z.string().trim().min(1) })
export type UserIdParam = z.infer<typeof UserIdParamSchema>

// ─── Body schemas ──────────────────────────────────────────────────────────────

export const SiteScopeItemSchema = z.object({
  siteCode: z.string().trim().min(1).max(32),
  scopeLevel: ScopeLevelSchema.default('VIEWER'),
})
export type SiteScopeItem = z.infer<typeof SiteScopeItemSchema>

export const CreateUserBodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, 'username must be alphanumeric, dash, or underscore'),
  password: z.string().min(8).max(128),
  role: UserManagementRoleSchema,
  siteScopes: z.array(SiteScopeItemSchema).optional(),
  mustChangePassword: z.boolean().optional().default(false),
})
export type CreateUserBody = z.infer<typeof CreateUserBodySchema>

export const UpdateUserBodySchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/, 'username must be alphanumeric, dash, or underscore')
      .optional(),
    password: z.string().min(8).max(128).optional(),
    role: UserManagementRoleSchema.optional(),
    mustChangePassword: z.boolean().optional(),
    reason: z.string().trim().min(1).max(255).optional(),
  })
  .refine((d) => Object.keys(d).filter((k) => k !== 'reason').length > 0, {
    message: 'At least one field must be provided to update',
  })
export type UpdateUserBody = z.infer<typeof UpdateUserBodySchema>

export const SetUserStatusBodySchema = z.object({
  reason: z.string().trim().min(1).max(255).optional(),
})
export type SetUserStatusBody = z.infer<typeof SetUserStatusBodySchema>

export const SetSiteScopesBodySchema = z.object({
  siteScopes: z.array(SiteScopeItemSchema),
})
export type SetSiteScopesBody = z.infer<typeof SetSiteScopesBodySchema>

export const RevokeSessionsBodySchema = z.object({
  reason: z.string().trim().min(1).max(255).optional(),
})
export type RevokeSessionsBody = z.infer<typeof RevokeSessionsBodySchema>

// ─── Response types (aligned with user-management.service + HTTP envelopes) ───

/** One row from GET /admin/users (cursor list). */
export const UserSummarySchema = z.object({
  userId: z.string().trim().min(1),
  username: z.string().trim().min(1),
  status: UserStatusSchema,
  roles: z.array(z.string()),
  siteScopes: z.array(
    z.object({
      siteCode: z.string(),
      scopeLevel: z.string(),
    }),
  ),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
  activeSessionCount: z.number().int().nonnegative(),
})
export type UserSummary = z.infer<typeof UserSummarySchema>

export const UserSessionRowSchema = z.object({
  sessionId: z.string(),
  role: z.string(),
  createdAt: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  expiresAt: z.string(),
})

export const UserDetailSchema = UserSummarySchema.extend({
  sessions: z.array(UserSessionRowSchema),
})
export type UserDetail = z.infer<typeof UserDetailSchema>

export const ListUsersResponseSchema = z.object({
  rows: z.array(UserSummarySchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
})
export type ListUsersResponse = z.infer<typeof ListUsersResponseSchema>

export const RevokeSessionsResponseSchema = z.object({
  userId: z.string(),
  revokedSessionCount: z.number().int().nonnegative(),
  revokedSessionIds: z.array(z.string()),
})
export type RevokeSessionsResponse = z.infer<typeof RevokeSessionsResponseSchema>

export const MyProfileSchema = z.object({
  userId: z.string().trim().min(1),
  username: z.string().trim().min(1),
  status: UserStatusSchema,
  roles: z.array(z.string()),
  siteScopes: z.array(
    z.object({
      siteCode: z.string(),
      scopeLevel: z.string(),
    }),
  ),
  createdAt: z.string().nullable(),
})
export type MyProfile = z.infer<typeof MyProfileSchema>

export const UpdateMyProfileBodySchema = z
  .object({
    password: z.string().min(8).max(128).optional(),
    reason: z.string().trim().min(1).max(255).optional(),
  })
  .refine((d) => Object.keys(d).filter((k) => k !== 'reason').length > 0, {
    message: 'At least one field must be provided',
  })
export type UpdateMyProfileBody = z.infer<typeof UpdateMyProfileBodySchema>
