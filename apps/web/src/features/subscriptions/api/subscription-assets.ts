// Backend routes:
// GET  /api/admin/subscription-spots
// POST /api/admin/subscription-spots
// PATCH /api/admin/subscription-spots/:id
// GET  /api/admin/subscription-vehicles
// POST /api/admin/subscription-vehicles
// PATCH /api/admin/subscription-vehicles/:id
// Roles: ADMIN, OPS

import { apiFetch, buildQuery, patchJson, postJson } from '@/lib/http/client'
import { normalizeSubscriptionSpotList, normalizeSubscriptionVehicleList } from '../mappers'
import type {
  SubscriptionSpotListRes,
  SubscriptionVehicleListRes,
  SubscriptionSpotRow,
  SubscriptionVehicleRow,
  SubscriptionSpotStatus,
  SubscriptionVehicleStatus,
} from '../types'

// ─── Spots ───────────────────────────────────────────────────

export function getSubscriptionSpots(params?: {
  siteCode?: string
  subscriptionId?: string
  status?: SubscriptionSpotStatus | ''
  limit?: number
  cursor?: string
}) {
  const qs = buildQuery(params)
  return apiFetch<SubscriptionSpotListRes>(
    `/api/admin/subscription-spots${qs ? `?${qs}` : ''}`,
    undefined,
    normalizeSubscriptionSpotList,
  )
}

export function patchSubscriptionSpot(
  subscriptionSpotId: string,
  body: {
    status?: SubscriptionSpotStatus
    assignedMode?: 'ASSIGNED' | 'PREFERRED'
    isPrimary?: boolean
    assignedFrom?: string | null
    assignedUntil?: string | null
    note?: string | null
  },
) {
  return patchJson<SubscriptionSpotRow>(
    `/api/admin/subscription-spots/${encodeURIComponent(subscriptionSpotId)}`,
    body,
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
}) {
  const qs = buildQuery(params)
  return apiFetch<SubscriptionVehicleListRes>(
    `/api/admin/subscription-vehicles${qs ? `?${qs}` : ''}`,
    undefined,
    normalizeSubscriptionVehicleList,
  )
}

export function patchSubscriptionVehicle(
  subscriptionVehicleId: string,
  body: {
    status?: SubscriptionVehicleStatus
    isPrimary?: boolean
    validFrom?: string | null
    validTo?: string | null
    note?: string | null
  },
) {
  return patchJson<SubscriptionVehicleRow>(
    `/api/admin/subscription-vehicles/${encodeURIComponent(subscriptionVehicleId)}`,
    body,
  )
}
