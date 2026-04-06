import type { ActiveMobilePair } from '@/lib/api/mobile'
import type { DeviceRow } from '@/lib/contracts/devices'
import type { LaneRow } from '@/lib/contracts/topology'

export type PairReadiness = 'ready' | 'attention' | 'blocked'

export type PairDiagnostic = {
  tone: PairReadiness
  code: string
  label: string
  detail: string
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN')
}

export function formatRelativeMinutes(value: string | null | undefined) {
  if (!value) return '—'
  const ms = Date.now() - Date.parse(value)
  if (!Number.isFinite(ms)) return '—'
  const minutes = Math.max(0, Math.round(ms / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function heartbeatBadgeVariant(status: string | null | undefined) {
  if (status === 'ONLINE') return 'success' as const
  if (status === 'DEGRADED') return 'warning' as const
  if (status === 'OFFLINE') return 'error' as const
  return 'neutral' as const
}

export function derivePairDiagnostics(args: {
  lane: LaneRow | null
  device: DeviceRow | null
  siteCode: string
  laneCode: string
  direction: 'ENTRY' | 'EXIT'
  deviceCode: string
  deviceSecret: string
  token: string
}) {
  const rows: PairDiagnostic[] = []

  if (!args.siteCode) {
    rows.push({
      tone: 'blocked',
      code: 'missing-site',
      label: 'Site missing',
      detail: 'No site selected — pair link has no operational context.',
    })
  }

  if (!args.laneCode) {
    rows.push({
      tone: 'blocked',
      code: 'missing-lane',
      label: 'Lane missing',
      detail: 'Lane must be selected before handing off the mobile surface.',
    })
  }

  if (!args.deviceCode) {
    rows.push({
      tone: 'blocked',
      code: 'missing-device',
      label: 'Device missing',
      detail: 'Capture surface must be tied to a device code to sign requests and audit correctly.',
    })
  }

  if (!args.deviceSecret) {
    rows.push({
      tone: 'blocked',
      code: 'missing-secret',
      label: 'Device missing secret',
      detail: 'Without a secret, the mobile surface cannot sign heartbeat or ALPR capture requests.',
    })
  }

  if (!args.token) {
    rows.push({
      tone: 'attention',
      code: 'missing-token',
      label: 'Pair token missing',
      detail: 'Issue a separate token for each pairing session to trace the browser or mobile instance.',
    })
  }

  if (args.lane && args.lane.direction !== args.direction) {
    rows.push({
      tone: 'attention',
      code: 'direction-mismatch',
      label: 'Direction mismatch',
      detail: `Lane ${args.lane.laneCode} is declared ${args.lane.direction} but the pair draft is ${args.direction}.`,
    })
  }

  if (args.device && args.lane && args.device.laneCode && args.device.laneCode !== args.lane.laneCode) {
    rows.push({
      tone: 'attention',
      code: 'lane-device-mismatch',
      label: 'Device lane mismatch',
      detail: `Device ${args.device.deviceCode} is currently mapped to ${args.device.laneCode}, which does not match the selected lane.g chọn.`,
    })
  }

  if (args.device && args.device.heartbeatStatus === 'OFFLINE') {
    rows.push({
      tone: 'blocked',
      code: 'device-offline',
      label: 'Device offline',
      detail: 'Target device is OFFLINE — do not hand off the mobile surface until triaged.',
    })
  } else if (args.device && args.device.heartbeatStatus === 'DEGRADED') {
    rows.push({
      tone: 'attention',
      code: 'device-degraded',
      label: 'Device degraded',
      detail: 'Device has a heartbeat but is degraded — monitor latency and age before deploying.',
    })
  }

  if (args.device && !args.device.isPrimary && args.lane) {
    rows.push({
      tone: 'attention',
      code: 'non-primary-device',
      label: 'Non-primary device',
      detail: 'Permitted, but only use when the primary device is unavailable or being triaged.',
    })
  }

  const blocked = rows.some((item) => item.tone === 'blocked')
  const attention = rows.some((item) => item.tone === 'attention')
  return {
    readiness: blocked ? 'blocked' as const : attention ? 'attention' as const : 'ready' as const,
    rows,
  }
}

export function summarizePairRegistry(rows: ActiveMobilePair[], laneCode: string, deviceCode: string) {
  const sameLaneCount = rows.filter((row) => row.laneCode === laneCode).length
  const sameDeviceCount = rows.filter((row) => row.deviceCode === deviceCode).length
  const latestOpenedAt = rows[0]?.lastOpenedAt ?? null
  return {
    total: rows.length,
    sameLaneCount,
    sameDeviceCount,
    latestOpenedAt,
  }
}
