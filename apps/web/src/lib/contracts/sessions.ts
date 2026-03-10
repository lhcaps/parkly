import type {
  ManualReviewActionResponse,
  SessionAllowedAction,
  SessionDetail,
  SessionSummaryDto,
  SessionStatus,
} from '@parkly/contracts'
import type { PlateCanonicalDto } from '@parkly/contracts'
import type { Direction, GateReadType, SensorState } from '@/lib/contracts/common'

export type {
  ManualReviewActionResponse,
  SessionAllowedAction,
  SessionDetail,
  SessionSummaryDto as SessionSummary,
  SessionStatus as SessionState,
} from '@parkly/contracts'

export type OpenSessionPayload = {
  requestId: string
  idempotencyKey: string
  siteCode: string
  laneCode: string
  direction: Direction
  occurredAt?: string
  presenceActive?: boolean
  correlationId?: string
  plateRaw?: string
  rfidUid?: string
  deviceCode?: string
  readType?: GateReadType
  sensorState?: SensorState
  ocrConfidence?: number
  rawPayload?: unknown
}

export type OpenSessionRes = {
  reused: boolean
  reuseWindowMs: number
  session: SessionSummaryDto
  plate: PlateCanonicalDto | null
}

export type ResolveSessionPayload = {
  requestId: string
  idempotencyKey: string
  sessionId?: string
  siteCode?: string
  laneCode?: string
  direction?: Direction
  occurredAt?: string
  deviceCode?: string
  readType?: GateReadType
  sensorState?: SensorState
  plateRaw?: string
  ocrConfidence?: number
  rfidUid?: string
  presenceActive?: boolean
  approved?: boolean
  denied?: boolean
  paymentRequired?: boolean
  reasonCode?: string
  reasonDetail?: string
  autoOpenIfMissing?: boolean
  rawPayload?: unknown
}

export type ResolveSessionRes = {
  session: SessionSummaryDto
  plate: PlateCanonicalDto | null
  decision: {
    decisionCode: string
    recommendedAction: string
    finalAction: string
    reasonCode: string
    reasonDetail: string | null
    reviewRequired: boolean
    explanation: string
    inputSnapshot: unknown
    thresholdSnapshot: unknown
  } | null
}

export type MutateSessionRes = {
  session: SessionSummaryDto
  changed: boolean
}
