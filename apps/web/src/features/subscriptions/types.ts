// Subscription domain types derived from backend /api/admin/subscriptions routes.
// Source of truth: apps/api/src/modules/subscriptions/application/admin-subscriptions.ts

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED'
export type SubscriptionEffectiveStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED'
export type SubscriptionPlanType = 'MONTHLY' | 'VIP'
export type SubscriptionSpotStatus = 'ACTIVE' | 'SUSPENDED' | 'RELEASED'
export type SubscriptionVehicleStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED'
export type AssignedMode = 'ASSIGNED' | 'PREFERRED'
export type SubscriptionDetailTab = 'overview' | 'spots' | 'vehicles'

export type SubscriptionRiskFlag = 'EXPIRING_SOON' | 'SUSPENDED' | 'MISSING_VEHICLE' | 'MISSING_SPOT'

export function computeRiskFlags(detail: SubscriptionDetail): SubscriptionRiskFlag[] {
  const flags: SubscriptionRiskFlag[] = []
  
  if (detail.effectiveStatus === 'SUSPENDED') {
    flags.push('SUSPENDED')
  }
  
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  
  if (detail.endDate) {
    const endDate = new Date(detail.endDate)
    if (endDate <= thirtyDaysFromNow && detail.effectiveStatus === 'ACTIVE') {
      flags.push('EXPIRING_SOON')
    }
  }
  
  if (detail.vehicles.length === 0) {
    flags.push('MISSING_VEHICLE')
  }
  
  if (detail.spots.length === 0) {
    flags.push('MISSING_SPOT')
  }
  
  return flags
}

export function riskFlagLabel(flag: SubscriptionRiskFlag): string {
  switch (flag) {
    case 'EXPIRING_SOON': return 'Expiring soon'
    case 'SUSPENDED': return 'Suspended'
    case 'MISSING_VEHICLE': return 'Missing vehicle'
    case 'MISSING_SPOT': return 'Missing spot'
  }
}

export function riskFlagVariant(flag: SubscriptionRiskFlag): 'amber' | 'destructive' | 'secondary' | 'outline' {
  switch (flag) {
    case 'EXPIRING_SOON': return 'amber'
    case 'SUSPENDED': return 'amber'
    case 'MISSING_VEHICLE': return 'destructive'
    case 'MISSING_SPOT': return 'destructive'
  }
}

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
  licensePlate: string | null
  plateCompact: string | null
  vehicleType: string | null
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

export type SubscriptionCreateInput = {
  siteCode: string
  customerId: string
  planType: SubscriptionPlanType
  startDate: string
  endDate: string
}

export type SubscriptionVehicleMutationInput = {
  subscriptionId: string
  siteCode: string
  vehicleId: string
  status?: SubscriptionVehicleStatus
  isPrimary?: boolean
  validFrom?: string | null
  validTo?: string | null
  note?: string | null
}

export type SubscriptionVehiclePatchInput = {
  status?: SubscriptionVehicleStatus
  isPrimary?: boolean
  validFrom?: string | null
  validTo?: string | null
  note?: string | null
}

export type SubscriptionSpotMutationInput = {
  subscriptionId: string
  siteCode: string
  spotId: string
  assignedMode?: AssignedMode
  status?: SubscriptionSpotStatus
  isPrimary?: boolean
  assignedFrom?: string | null
  assignedUntil?: string | null
  note?: string | null
}

export type SubscriptionSpotPatchInput = {
  status?: SubscriptionSpotStatus
  assignedMode?: AssignedMode
  isPrimary?: boolean
  assignedFrom?: string | null
  assignedUntil?: string | null
  note?: string | null
}

export type SubscriptionMutationState = {
  busy: boolean
  error: string
  success: string
  action: string
}

export const SUBSCRIPTION_DETAIL_TABS: readonly SubscriptionDetailTab[] = ['overview', 'spots', 'vehicles'] as const
export const SUBSCRIPTION_STATUS_VALUES: readonly SubscriptionStatus[] = ['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'] as const
export const SUBSCRIPTION_MUTABLE_STATUS_VALUES: readonly SubscriptionStatus[] = ['ACTIVE', 'SUSPENDED', 'CANCELLED'] as const
export const SUBSCRIPTION_PLAN_VALUES: readonly SubscriptionPlanType[] = ['MONTHLY', 'VIP'] as const
export const SUBSCRIPTION_SPOT_STATUS_VALUES: readonly SubscriptionSpotStatus[] = ['ACTIVE', 'SUSPENDED', 'RELEASED'] as const
export const SUBSCRIPTION_VEHICLE_STATUS_VALUES: readonly SubscriptionVehicleStatus[] = ['ACTIVE', 'SUSPENDED', 'REMOVED'] as const
export const SUBSCRIPTION_ASSIGNED_MODE_VALUES: readonly AssignedMode[] = ['ASSIGNED', 'PREFERRED'] as const
