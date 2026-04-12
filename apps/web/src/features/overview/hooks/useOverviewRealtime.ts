import { useMemo } from 'react'
import { useSseSnapshot } from '@/features/_shared/use-sse-snapshot'
import { makeSseUrl, type DeviceHealthSnapshot, type LaneStatusSnapshot } from '@/lib/api'

export type OverviewLaneProblem = {
  siteCode: string
  laneCode: string
  gateCode: string
  direction: string
  aggregateHealth: string
  aggregateReason: string
  lastSessionStatus: string | null
  lastBarrierStatus: string | null
}

function laneSeverity(row: LaneStatusSnapshot['rows'][number]) {
  if (row.aggregateHealth === 'OFFLINE') return 4
  if (row.aggregateHealth === 'BARRIER_FAULT') return 3
  if (row.aggregateHealth.startsWith('DEGRADED')) return 2
  return 1
}

export function useOverviewLaneRealtime() {
  const { data: laneSnapshot, state: laneState } = useSseSnapshot<LaneStatusSnapshot>({
    url: makeSseUrl('/api/stream/lane-status'),
    eventName: 'lane_status_snapshot',
  })

  const liveLaneSummary = useMemo(() => {
    const rows = laneSnapshot?.rows ?? []
    const ordered = [...rows].sort((a, b) => laneSeverity(b) - laneSeverity(a) || a.laneCode.localeCompare(b.laneCode))
    const problemLanes: OverviewLaneProblem[] = ordered
      .filter((row) => row.aggregateHealth !== 'HEALTHY')
      .map((row) => ({
        siteCode: row.siteCode,
        laneCode: row.laneCode,
        gateCode: row.gateCode,
        direction: row.direction,
        aggregateHealth: row.aggregateHealth,
        aggregateReason: row.aggregateReason,
        lastSessionStatus: row.lastSessionStatus,
        lastBarrierStatus: row.lastBarrierStatus,
      }))

    return {
      total: rows.length,
      attention: problemLanes.length,
      offline: rows.filter((row) => row.aggregateHealth === 'OFFLINE').length,
      barrierFault: rows.filter((row) => row.aggregateHealth === 'BARRIER_FAULT').length,
      openSessions: rows.reduce((sum, row) => sum + (row.lastSessionStatus && row.lastSessionStatus !== 'PASSED' && row.lastSessionStatus !== 'CANCELLED' ? 1 : 0), 0),
      problemLanes,
      topProblemLanes: problemLanes.slice(0, 5),
    }
  }, [laneSnapshot?.rows])

  return {
    laneState,
    liveLaneSummary,
  }
}

export function useOverviewDeviceRealtime() {
  const { data: deviceHealthSnapshot, state: deviceHealthState } = useSseSnapshot<DeviceHealthSnapshot>({
    url: makeSseUrl('/api/stream/device-health'),
    eventName: 'device_health_snapshot',
  })

  const deviceAlertSummary = useMemo(() => {
    const rows = deviceHealthSnapshot?.rows ?? []
    const deduped = new Map<string, typeof rows[number]>()

    for (const row of rows) {
      const key = [
        row.siteCode,
        row.gateCode ?? 'NA',
        row.laneCode ?? 'UNASSIGNED',
        row.deviceCode,
        row.deviceRole ?? row.deviceType ?? 'NA',
      ].join(':')
      if (!deduped.has(key)) deduped.set(key, row)
    }

    const normalized = Array.from(deduped.values())
    const offline = normalized.filter((row) => row.derivedHealth === 'OFFLINE').length
    const degraded = normalized.filter((row) => row.derivedHealth === 'DEGRADED').length
    const online = normalized.filter((row) => row.derivedHealth === 'ONLINE').length

    return {
      total: normalized.length,
      offline,
      degraded,
      online,
      attention: offline + degraded,
    }
  }, [deviceHealthSnapshot?.rows])

  return {
    deviceHealthState,
    deviceAlertSummary,
  }
}
