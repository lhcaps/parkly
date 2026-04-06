import { apiFetch, buildQuery } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'

export type TopologyGate = {
  gateCode: string
  siteCode: string
  label: string
  laneCount: number
  directions: string[]
  lanes: TopologyLane[]
}

export type TopologyLane = {
  laneCode: string
  label: string
  direction: 'ENTRY' | 'EXIT'
  status: string
  sortOrder: number
  primaryDeviceCode: string | null
  devices: TopologyDevice[]
}

export type TopologyDevice = {
  siteCode: string
  gateCode: string | null
  laneCode: string | null
  laneLabel: string | null
  laneStatus: string | null
  deviceCode: string
  deviceType: string
  direction: string
  locationHint: string | null
  deviceRole: string | null
  isPrimary: boolean
  isRequired: boolean
  heartbeatStatus: string | null
  heartbeatReportedAt: string | null
  heartbeatReceivedAt: string | null
  heartbeatAgeSeconds: number | null
  latencyMs: number | null
  firmwareVersion: string | null
  ipAddress: string | null
}

export type TopologyData = {
  site: {
    siteCode: string
    name: string
    timezone: string
    isActive: boolean
  }
  gates: TopologyGate[]
}

export async function getTopology(siteCode: string): Promise<TopologyData> {
  const qs = buildQuery({ siteCode })
  const result = await apiFetch<TopologyData>(`/api/topology${qs ? `?${qs}` : ''}`, undefined, (value) => {
    const row = isRecord(value) ? value : {} as Record<string, unknown>
    return {
      site: isRecord(row.site) ? row.site : { siteCode, name: siteCode, timezone: 'Asia/Ho_Chi_Minh', isActive: true },
      gates: Array.isArray(row.gates) ? row.gates : [],
    } as TopologyData
  })
  return result
}
