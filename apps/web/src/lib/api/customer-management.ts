import { apiFetch, buildQuery } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import type { ListCustomersResponse, CustomerDetail } from '@parkly/contracts'

export type { CustomerSummary } from '@parkly/contracts'

// ─── List Customers ─────────────────────────────────────────────────────────────

export type ListCustomersOptions = {
  search?: string
  status?: 'ACTIVE' | 'SUSPENDED'
  vehicleType?: 'CAR' | 'MOTORBIKE'
  cursor?: string
  limit?: number
}

export function listCustomers(options: ListCustomersOptions = {}) {
  const qs = buildQuery({
    ...(options.search && { search: options.search }),
    ...(options.status && { status: options.status }),
    ...(options.vehicleType && { vehicleType: options.vehicleType }),
    ...(options.cursor && { cursor: options.cursor }),
    ...(options.limit && { limit: String(options.limit) }),
  })
  return apiFetch<ListCustomersResponse>(
    `/api/admin/customers${qs ? `?${qs}` : ''}`,
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

// ─── Get Customer Detail ───────────────────────────────────────────────────────

export function getCustomerDetail(customerId: string) {
  return apiFetch<CustomerDetail>(`/api/admin/customers/${customerId}`, undefined, (value) => {
    return isRecord(value) ? (value as CustomerDetail) : ({} as CustomerDetail)
  })
}

// ─── Create Customer ───────────────────────────────────────────────────────────

export type CreateCustomerPayload = {
  fullName: string
  phone?: string
  email?: string
}

export function createCustomer(body: CreateCustomerPayload) {
  return apiFetch<{ customerId: string; fullName: string }>('/api/admin/customers', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Update Customer ───────────────────────────────────────────────────────────

export type UpdateCustomerPayload = {
  fullName?: string
  phone?: string | null
  email?: string | null
  status?: 'ACTIVE' | 'SUSPENDED'
}

export function updateCustomer(customerId: string, body: UpdateCustomerPayload) {
  return apiFetch<{ customerId: string; fullName: string }>(`/api/admin/customers/${customerId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Delete Customer ───────────────────────────────────────────────────────────

export function deleteCustomer(customerId: string) {
  return apiFetch<{ customerId: string }>(`/api/admin/customers/${customerId}`, {
    method: 'DELETE',
  })
}
