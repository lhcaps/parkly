import { apiFetch, buildQuery } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type UnassignedDevice = {
  deviceId: string
  deviceCode: string
  deviceType: string
  direction: 'ENTRY' | 'EXIT'
  locationHint: string | null
  siteCode: string
}

export type LaneDeviceSyncItem = {
  deviceId: string
  deviceRole: 'PRIMARY' | 'CAMERA' | 'RFID' | 'LOOP_SENSOR' | 'BARRIER'
  isPrimary: boolean
  isRequired?: boolean
  sortOrder?: number
}

export type SyncLaneDevicesPayload = {
  devices: LaneDeviceSyncItem[]
}

// ─── Admin Topology API Functions ───────────────────────────────────────────────

export function getUnassignedDevices(siteCode: string) {
  const qs = buildQuery({ siteCode })
  return apiFetch<{ rows: UnassignedDevice[] }>(`/api/admin/topology/devices/unassigned${qs ? `?${qs}` : ''}`, undefined, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      rows: Array.isArray(row.rows) ? row.rows : [],
    }
  })
}

export function createSite(body: { siteCode: string; name: string; timezone?: string }) {
  return apiFetch<Record<string, unknown>>('/api/admin/topology/sites', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

export function updateSite(siteId: string, body: { name?: string; timezone?: string }) {
  return apiFetch<Record<string, unknown>>(`/api/admin/topology/sites/${siteId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

export function createDevice(body: {
  siteId?: string
  siteCode?: string
  deviceCode: string
  deviceType: string
  direction: string
  ipAddress?: string | null
  locationHint?: string | null
}) {
  return apiFetch<Record<string, unknown>>('/api/admin/topology/devices', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

export function updateDevice(deviceId: string, body: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>(`/api/admin/topology/devices/${deviceId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

export function createLane(body: {
  siteId?: string
  siteCode?: string
  gateCode: string
  laneCode: string
  name: string
  direction: string
  sortOrder?: number
}) {
  return apiFetch<Record<string, unknown>>('/api/admin/topology/lanes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

export function updateLane(laneId: string, body: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>(`/api/admin/topology/lanes/${laneId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

export function syncLaneDevices(laneId: string, payload: SyncLaneDevicesPayload) {
  return apiFetch<Record<string, unknown>>(`/api/admin/topology/lanes/${laneId}/devices`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
}
