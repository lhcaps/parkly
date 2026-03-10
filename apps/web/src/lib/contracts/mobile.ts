import type { PlateCanonicalDto } from '@parkly/contracts'
import type { Direction, GateReadType, SensorState } from '@/lib/contracts/common'

export type GateEventStreamItem = {
  ts: number
  siteCode: string | null
  deviceCode: string | null
  laneCode: string | null
  eventId: string
  direction: Direction | null
  eventTime: string
  licensePlateRaw: string | null
  plateCompact: string | null
  plateDisplay: string | null
  plateValidity: string | null
  reviewRequired: boolean
  imageUrl: string | null
  outboxId: string
}


export type GateEventWriteRes = PlateCanonicalDto & {
  plate: PlateCanonicalDto | null
  siteCode: string
  deviceCode: string
  laneCode: string
  eventId: string | number
  outboxId: string | number
  changed: boolean
  alreadyExists: boolean
  mappedSessionId?: string | null
  mappedSessionStatus?: string | null
  mappedDecisionCode?: string | null
}

export type CaptureReadRes = PlateCanonicalDto & {
  plate: PlateCanonicalDto | null
  siteCode: string
  laneCode: string
  deviceCode: string
  direction: Direction
  readType: GateReadType
  occurredAt: string
  sessionId: string
  sessionStatus: string
  readEventId: string | number
  changed: boolean
  alreadyExists: boolean
  imageUrl: string | null
  ocrConfidence: number | null
  rfidUid: string | null
  sensorState: SensorState | null
}

export type DeviceHeartbeatRes = {
  siteCode: string
  deviceCode: string
  deviceType: string
  direction: Direction
  laneCode: string | null
  heartbeatId: string | number
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE'
  reportedAt: string
  receivedAt: string
  latencyMs: number | null
  firmwareVersion: string | null
  ipAddress: string | null
  changed: boolean
  alreadyExists: boolean
}

export type CaptureSignatureArgs = {
  surface: string
  readType: GateReadType | 'HEARTBEAT'
  siteCode: string
  deviceCode: string
  requestId: string
  idempotencyKey: string
  timestamp: string
  laneCode?: string | null
  direction?: Direction | null
  eventTime?: string | null
  reportedAt?: string | null
  plateRaw?: string | null
  rfidUid?: string | null
  sensorState?: SensorState | null
  heartbeatStatus?: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | null
}
