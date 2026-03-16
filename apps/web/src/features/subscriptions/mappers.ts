import { isRecord } from '@/lib/http/errors'
import type {
  SubscriptionEffectiveStatus,
  SubscriptionRow,
  SubscriptionSpotRow,
  SubscriptionVehicleRow,
  SubscriptionDetail,
  SubscriptionListRes,
  SubscriptionSpotListRes,
  SubscriptionVehicleListRes,
} from './types'

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function strNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function bool(v: unknown): boolean {
  return v === true || v === 1 || v === '1'
}

function effectiveStatus(v: unknown): SubscriptionEffectiveStatus {
  const s = str(v).toUpperCase()
  if (s === 'SUSPENDED') return 'SUSPENDED'
  if (s === 'CANCELLED') return 'CANCELLED'
  if (s === 'EXPIRED') return 'EXPIRED'
  return 'ACTIVE'
}

export function normalizeSubscriptionRow(raw: unknown): SubscriptionRow | null {
  if (!isRecord(raw)) return null
  const id = str(raw.subscriptionId)
  if (!id) return null
  return {
    subscriptionId: id,
    siteCode: str(raw.siteCode),
    siteName: str(raw.siteName),
    customerId: str(raw.customerId),
    customerName: str(raw.customerName),
    customerPhone: strNull(raw.customerPhone),
    planType: str(raw.planType) === 'VIP' ? 'VIP' : 'MONTHLY',
    startDate: strNull(raw.startDate),
    endDate: strNull(raw.endDate),
    status: str(raw.status),
    effectiveStatus: effectiveStatus(raw.effectiveStatus ?? raw.status),
  }
}

export function normalizeSubscriptionSpotRow(raw: unknown): SubscriptionSpotRow | null {
  if (!isRecord(raw)) return null
  const id = str(raw.subscriptionSpotId)
  if (!id) return null
  return {
    subscriptionSpotId: id,
    subscriptionId: str(raw.subscriptionId),
    siteCode: str(raw.siteCode),
    spotId: str(raw.spotId),
    spotCode: str(raw.spotCode),
    zoneCode: str(raw.zoneCode),
    assignedMode: str(raw.assignedMode) || 'ASSIGNED',
    status: str(raw.status) || 'ACTIVE',
    isPrimary: bool(raw.isPrimary),
    assignedFrom: strNull(raw.assignedFrom),
    assignedUntil: strNull(raw.assignedUntil),
    note: strNull(raw.note),
  }
}

export function normalizeSubscriptionVehicleRow(raw: unknown): SubscriptionVehicleRow | null {
  if (!isRecord(raw)) return null
  const id = str(raw.subscriptionVehicleId)
  if (!id) return null
  return {
    subscriptionVehicleId: id,
    subscriptionId: str(raw.subscriptionId),
    siteCode: str(raw.siteCode),
    vehicleId: str(raw.vehicleId),
    plateCompact: strNull(raw.plateCompact),
    status: str(raw.status) || 'ACTIVE',
    isPrimary: bool(raw.isPrimary),
    validFrom: strNull(raw.validFrom),
    validTo: strNull(raw.validTo),
    note: strNull(raw.note),
  }
}

export function normalizeSubscriptionDetail(raw: unknown): SubscriptionDetail | null {
  const base = normalizeSubscriptionRow(raw)
  if (!base) return null
  const r = raw as Record<string, unknown>
  return {
    ...base,
    spots: Array.isArray(r.spots)
      ? r.spots.map(normalizeSubscriptionSpotRow).filter((x): x is SubscriptionSpotRow => x !== null)
      : [],
    vehicles: Array.isArray(r.vehicles)
      ? r.vehicles.map(normalizeSubscriptionVehicleRow).filter((x): x is SubscriptionVehicleRow => x !== null)
      : [],
  }
}

export function normalizeSubscriptionList(raw: unknown): SubscriptionListRes {
  const r = isRecord(raw) ? raw : {}
  const page = isRecord(r.data) ? r.data : r
  const items = Array.isArray(page.rows) ? page.rows : Array.isArray(page.items) ? page.items : []
  return {
    rows: items.map(normalizeSubscriptionRow).filter((x): x is SubscriptionRow => x !== null),
    nextCursor: strNull(page.nextCursor),
  }
}

export function normalizeSubscriptionSpotList(raw: unknown): SubscriptionSpotListRes {
  const r = isRecord(raw) ? raw : {}
  const page = isRecord(r.data) ? r.data : r
  const items = Array.isArray(page.rows) ? page.rows : Array.isArray(page.items) ? page.items : []
  return {
    rows: items.map(normalizeSubscriptionSpotRow).filter((x): x is SubscriptionSpotRow => x !== null),
    nextCursor: strNull(page.nextCursor),
  }
}

export function normalizeSubscriptionVehicleList(raw: unknown): SubscriptionVehicleListRes {
  const r = isRecord(raw) ? raw : {}
  const page = isRecord(r.data) ? r.data : r
  const items = Array.isArray(page.rows) ? page.rows : Array.isArray(page.items) ? page.items : []
  return {
    rows: items.map(normalizeSubscriptionVehicleRow).filter((x): x is SubscriptionVehicleRow => x !== null),
    nextCursor: strNull(page.nextCursor),
  }
}
