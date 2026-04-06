// Backend routes: GET /api/admin/subscriptions, GET /api/admin/subscriptions/:id
// POST /api/admin/subscriptions, PATCH /api/admin/subscriptions/:id
// Roles required: ADMIN, OPS

import { apiFetch, buildQuery, jsonHeaders } from '@/lib/http/client'
import {
  normalizeSubscriptionDetail,
  normalizeSubscriptionList,
} from '../mappers'
import type {
  PatchSubscriptionBody,
  SubscriptionCreateInput,
  SubscriptionDetail,
  SubscriptionEffectiveStatus,
  SubscriptionListRes,
} from '../types'

export function getSubscriptions(params?: {
  siteCode?: string
  status?: SubscriptionEffectiveStatus | ''
  plate?: string
  limit?: number
  cursor?: string
}, options?: { signal?: AbortSignal }) {
  const qs = buildQuery(params)
  return apiFetch<SubscriptionListRes>(
    `/api/admin/subscriptions${qs ? `?${qs}` : ''}`,
    options?.signal ? { signal: options.signal } : undefined,
    normalizeSubscriptionList,
  )
}

export function getSubscriptionDetail(subscriptionId: string, options?: { signal?: AbortSignal }) {
  return apiFetch<SubscriptionDetail>(
    `/api/admin/subscriptions/${encodeURIComponent(subscriptionId)}`,
    options?.signal ? { signal: options.signal } : undefined,
    (raw) => {
      const result = normalizeSubscriptionDetail(raw)
      if (!result) throw new Error('Invalid subscription detail response')
      return result
    },
  )
}

export function createSubscription(body: SubscriptionCreateInput) {
  return apiFetch<SubscriptionDetail>(
    '/api/admin/subscriptions',
    {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    },
    (raw) => {
      const result = normalizeSubscriptionDetail(raw)
      if (!result) throw new Error('Invalid create subscription response')
      return result
    },
  )
}

export function patchSubscription(subscriptionId: string, body: PatchSubscriptionBody) {
  return apiFetch<SubscriptionDetail>(
    `/api/admin/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    },
    (raw) => {
      const result = normalizeSubscriptionDetail(raw)
      if (!result) throw new Error('Invalid patch subscription response')
      return result
    },
  )
}
