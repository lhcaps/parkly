/**
 * Customer Management — shared Zod schemas.
 *
 * Single source of truth for customer CRUD types used by both
 * `apps/api` (validation) and `apps/web` (API client).
 */
import { z } from 'zod'

// ─── Enums ─────────────────────────────────────────────────────────────────────

export const CustomerStatusSchema = z.enum(['ACTIVE', 'SUSPENDED'])
export type CustomerStatus = z.infer<typeof CustomerStatusSchema>

export const VehicleTypeSchema = z.enum(['CAR', 'MOTORBIKE'])
export type VehicleType = z.infer<typeof VehicleTypeSchema>

export const CredentialStatusSchema = z.enum(['ACTIVE', 'BLOCKED', 'LOST'])
export type CredentialStatus = z.infer<typeof CredentialStatusSchema>

export const SubscriptionStatusSchema = z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED'])
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>

export const SubscriptionPlanTypeSchema = z.enum([
  'VIP_PLATINUM',
  'VIP_GOLD',
  'VIP_SILVER',
  'MONTHLY',
  'DAILY',
  'ADHOC',
])
export type SubscriptionPlanType = z.infer<typeof SubscriptionPlanTypeSchema>

// ─── Query / params ────────────────────────────────────────────────────────────

export const ListCustomersQuerySchema = z.object({
  search: z.string().trim().max(128).optional(),
  status: CustomerStatusSchema.optional(),
  vehicleType: VehicleTypeSchema.optional(),
  cursor: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})
export type ListCustomersQuery = z.infer<typeof ListCustomersQuerySchema>

export const CustomerIdParamSchema = z.object({ customerId: z.string().trim().min(1) })
export type CustomerIdParam = z.infer<typeof CustomerIdParamSchema>

// ─── Body schemas ──────────────────────────────────────────────────────────────

export const CreateCustomerBodySchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
})
export type CreateCustomerBody = z.infer<typeof CreateCustomerBodySchema>

export const UpdateCustomerBodySchema = z
  .object({
    fullName: z.string().trim().min(2).max(255).optional(),
    phone: z.string().trim().max(20).optional().nullable(),
    email: z.string().trim().email().max(255).optional().nullable(),
    status: CustomerStatusSchema.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided to update',
  })
export type UpdateCustomerBody = z.infer<typeof UpdateCustomerBodySchema>

// ─── Response types ─────────────────────────────────────────────────────────────

export const VehicleRowSchema = z.object({
  vehicleId: z.string(),
  licensePlate: z.string(),
  vehicleType: VehicleTypeSchema,
  createdAt: z.string().nullable(),
})
export type VehicleRow = z.infer<typeof VehicleRowSchema>

export const SubscriptionRowSchema = z.object({
  subscriptionId: z.string(),
  siteId: z.string(),
  siteCode: z.string(),
  planType: SubscriptionPlanTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  status: SubscriptionStatusSchema,
  createdAt: z.string().nullable(),
})
export type SubscriptionRow = z.infer<typeof SubscriptionRowSchema>

export const CredentialRowSchema = z.object({
  credentialId: z.string(),
  siteId: z.string(),
  siteCode: z.string(),
  rfidUid: z.string(),
  status: CredentialStatusSchema,
  lastDirection: z.string().nullable(),
  lastEventTime: z.string().nullable(),
})
export type CredentialRow = z.infer<typeof CredentialRowSchema>

export const CustomerSummarySchema = z.object({
  customerId: z.string(),
  fullName: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  status: CustomerStatusSchema,
  createdAt: z.string().nullable(),
  vehicleCount: z.number().int().nonnegative(),
  subscriptionCount: z.number().int().nonnegative(),
  activeCredentialCount: z.number().int().nonnegative(),
})
export type CustomerSummary = z.infer<typeof CustomerSummarySchema>

export const CustomerDetailSchema = CustomerSummarySchema.extend({
  vehicles: z.array(VehicleRowSchema),
  subscriptions: z.array(SubscriptionRowSchema),
  credentials: z.array(CredentialRowSchema),
})
export type CustomerDetail = z.infer<typeof CustomerDetailSchema>

export const ListCustomersResponseSchema = z.object({
  rows: z.array(CustomerSummarySchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
})
export type ListCustomersResponse = z.infer<typeof ListCustomersResponseSchema>
