// Backend routes: GET /api/admin/subscriptions, GET /api/admin/subscriptions/:id
// POST /api/admin/subscriptions, PATCH /api/admin/subscriptions/:id
// Roles required: ADMIN, OPS

import { apiFetch, buildQuery, patchJson, postJson } from '@/lib/http/client'
import {
  normalizeSubscriptionDetail,
  normalizeSubscriptionList,
} from '../mappers'
import type {
  PatchSubscriptionBody,
  SubscriptionDetail,
  SubscriptionEffectiveStatus,
  SubscriptionListRes,
  SubscriptionPlanType,
} from '../types'

export function getSubscriptions(params?: {
  siteCode?: string
  status?: SubscriptionEffectiveStatus | ''
  plate?: string
  limit?: number
  cursor?: string
}) {
  const qs = buildQuery(params)
  return apiFetch<SubscriptionListRes>(
    `/api/admin/subscriptions${qs ? `?${qs}` : ''}`,
    undefined,
    normalizeSubscriptionList,
  )
}

export function getSubscriptionDetail(subscriptionId: string) {
  return apiFetch<SubscriptionDetail>(
    `/api/admin/subscriptions/${encodeURIComponent(subscriptionId)}`,
    undefined,
    (raw) => {
      const r = raw as Record<string, unknown>
      // Backend wraps in { data: {...} } envelope
      const inner = r.data ?? raw
      const result = normalizeSubscriptionDetail(inner)
      if (!result) throw new Error('Invalid subscription detail response')
      return result
    },
  )
}

export function createSubscription(body: {
  siteCode: string
  customerId: string
  planType: SubscriptionPlanType
  startDate: string
  endDate: string
}) {
  return postJson<SubscriptionDetail>(
    '/api/admin/subscriptions',
    body,
    (raw) => {
      const r = raw as Record<string, unknown>
      const inner = r.data ?? raw
      const result = normalizeSubscriptionDetail(inner)
      if (!result) throw new Error('Invalid create subscription response')
      return result
    },
  )
}

export function patchSubscription(subscriptionId: string, body: PatchSubscriptionBody) {
  return patchJson<SubscriptionDetail>(
    `/api/admin/subscriptions/${encodeURIComponent(subscriptionId)}`,
    body,
    (raw) => {
      const r = raw as Record<string, unknown>
      const inner = r.data ?? raw
      const result = normalizeSubscriptionDetail(inner)
      if (!result) throw new Error('Invalid patch subscription response')
      return result
    },
  )
}
