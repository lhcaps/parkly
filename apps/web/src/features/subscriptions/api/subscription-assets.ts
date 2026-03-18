// Backend routes:
// GET  /api/admin/subscription-spots
// POST /api/admin/subscription-spots
// PATCH /api/admin/subscription-spots/:id
// GET  /api/admin/subscription-vehicles
// POST /api/admin/subscription-vehicles
// PATCH /api/admin/subscription-vehicles/:id
// Roles: ADMIN, OPS

import { apiFetch, buildQuery, jsonHeaders } from '@/lib/http/client'
import {
  normalizeSubscriptionSpotList,
  normalizeSubscriptionSpotResult,
  normalizeSubscriptionVehicleList,
  normalizeSubscriptionVehicleResult,
} from '../mappers'
import type {
  SubscriptionSpotListRes,
  SubscriptionVehicleListRes,
  SubscriptionSpotRow,
  SubscriptionVehicleRow,
  SubscriptionSpotStatus,
  SubscriptionVehicleStatus,
  SubscriptionSpotMutationInput,
  SubscriptionSpotPatchInput,
  SubscriptionVehicleMutationInput,
  SubscriptionVehiclePatchInput,
  AssignedMode,
} from '../types'

// ─── Spots ───────────────────────────────────────────────────

export function getSubscriptionSpots(params?: {
  siteCode?: string
  subscriptionId?: string
  status?: SubscriptionSpotStatus | ''
  limit?: number
  cursor?: string
}, options?: { signal?: AbortSignal }) {
  const qs = buildQuery(params)
  return apiFetch<SubscriptionSpotListRes>(
    `/api/admin/subscription-spots${qs ? `?${qs}` : ''}`,
    options?.signal ? { signal: options.signal } : undefined,
    normalizeSubscriptionSpotList,
  )
}

export function createSubscriptionSpot(body: SubscriptionSpotMutationInput) {
  return apiFetch<SubscriptionSpotRow>(
    '/api/admin/subscription-spots',
    {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    },
    normalizeSubscriptionSpotResult,
  )
}

export function patchSubscriptionSpot(
  subscriptionSpotId: string,
  body: SubscriptionSpotPatchInput,
) {
  return apiFetch<SubscriptionSpotRow>(
    `/api/admin/subscription-spots/${encodeURIComponent(subscriptionSpotId)}`,
    {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    },
    normalizeSubscriptionSpotResult,
  )
}

// ─── Vehicles ────────────────────────────────────────────────

export function getSubscriptionVehicles(params?: {
  siteCode?: string
  subscriptionId?: string
  status?: SubscriptionVehicleStatus | ''
  plate?: string
  limit?: number
  cursor?: string
}, options?: { signal?: AbortSignal }) {
  const qs = buildQuery(params)
  return apiFetch<SubscriptionVehicleListRes>(
    `/api/admin/subscription-vehicles${qs ? `?${qs}` : ''}`,
    options?.signal ? { signal: options.signal } : undefined,
    normalizeSubscriptionVehicleList,
  )
}

export function createSubscriptionVehicle(body: SubscriptionVehicleMutationInput) {
  return apiFetch<SubscriptionVehicleRow>(
    '/api/admin/subscription-vehicles',
    {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    },
    normalizeSubscriptionVehicleResult,
  )
}

export function patchSubscriptionVehicle(
  subscriptionVehicleId: string,
  body: SubscriptionVehiclePatchInput,
) {
  return apiFetch<SubscriptionVehicleRow>(
    `/api/admin/subscription-vehicles/${encodeURIComponent(subscriptionVehicleId)}`,
    {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    },
    normalizeSubscriptionVehicleResult,
  )
}

export type SubscriptionSpotUpdateBody = {
  status?: SubscriptionSpotStatus
  assignedMode?: AssignedMode
  isPrimary?: boolean
  assignedFrom?: string | null
  assignedUntil?: string | null
  note?: string | null
}
