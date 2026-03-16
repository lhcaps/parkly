// Subscription domain types derived from backend /api/admin/subscriptions routes.
// Source of truth: apps/api/src/modules/subscriptions/application/admin-subscriptions.ts

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED'
export type SubscriptionEffectiveStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED'
export type SubscriptionPlanType = 'MONTHLY' | 'VIP'
export type SubscriptionSpotStatus = 'ACTIVE' | 'SUSPENDED' | 'RELEASED'
export type SubscriptionVehicleStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED'
export type AssignedMode = 'ASSIGNED' | 'PREFERRED'

export type SubscriptionRow = {
  subscriptionId: string
  siteCode: string
  siteName: string
  customerId: string
  customerName: string
  customerPhone: string | null
  planType: SubscriptionPlanType
  startDate: string | null
  endDate: string | null
  status: string
  effectiveStatus: SubscriptionEffectiveStatus
}

export type SubscriptionSpotRow = {
  subscriptionSpotId: string
  subscriptionId: string
  siteCode: string
  spotId: string
  spotCode: string
  zoneCode: string
  assignedMode: AssignedMode | string
  status: SubscriptionSpotStatus | string
  isPrimary: boolean
  assignedFrom: string | null
  assignedUntil: string | null
  note: string | null
}

export type SubscriptionVehicleRow = {
  subscriptionVehicleId: string
  subscriptionId: string
  siteCode: string
  vehicleId: string
  plateCompact: string | null
  status: SubscriptionVehicleStatus | string
  isPrimary: boolean
  validFrom: string | null
  validTo: string | null
  note: string | null
}

export type SubscriptionDetail = SubscriptionRow & {
  spots: SubscriptionSpotRow[]
  vehicles: SubscriptionVehicleRow[]
}

export type SubscriptionListRes = {
  rows: SubscriptionRow[]
  nextCursor: string | null
}

export type SubscriptionSpotListRes = {
  rows: SubscriptionSpotRow[]
  nextCursor: string | null
}

export type SubscriptionVehicleListRes = {
  rows: SubscriptionVehicleRow[]
  nextCursor: string | null
}

export type PatchSubscriptionBody = {
  planType?: SubscriptionPlanType
  startDate?: string
  endDate?: string
  status?: SubscriptionStatus
}
