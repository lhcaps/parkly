import type { PlateCanonicalDto } from '@parkly/contracts'
import type { Direction } from '@/lib/contracts/common'
import type { OpenSessionRes, ResolveSessionRes } from '@/lib/contracts/sessions'
import type { AlprPreviewStatus } from '@/lib/contracts/alpr'

export type LaneFlowSubmitPayload = {
  requestId: string
  idempotencyKey: string
  siteCode: string
  laneCode: string
  direction: Direction
  deviceCode: string
  sensorDeviceCode?: string
  imageUrl?: string
  plateConfirmed?: string
  previewSnapshot?: {
    recognizedPlate?: string
    confidence?: number
    previewStatus?: AlprPreviewStatus
    raw?: Record<string, unknown>
    winner?: unknown
  }
  rawPayload?: unknown
}

export type LaneFlowSubmitRes = {
  previewPlate: PlateCanonicalDto | null
  open: OpenSessionRes
  event: {
    changed: boolean
    eventId: string | number
    eventTime: string
    outboxId: string | number
    siteCode: string
    deviceCode: string
    laneCode: string
  }
  resolved: ResolveSessionRes
}
