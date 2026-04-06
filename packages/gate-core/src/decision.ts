import type { PlateValidity } from './plate-rules'

export type GateDecisionCode =
  | 'AUTO_APPROVED'
  | 'REVIEW_REQUIRED'
  | 'AUTO_DENIED'
  | 'PAYMENT_REQUIRED'
  | 'TICKET_NOT_FOUND'
  | 'PLATE_RFID_MISMATCH'
  | 'ANTI_PASSBACK_BLOCKED'
  | 'DEVICE_DEGRADED'

export type GateRecommendedAction = 'APPROVE' | 'REVIEW' | 'DENY' | 'PAYMENT_HOLD'
export type GateDeviceHealth = 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN'
export type GatePaymentStatus =
  | 'PAID'
  | 'UNPAID'
  | 'PENDING'
  | 'WAIVED'
  | 'SUBSCRIPTION_COVERED'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN'
export type GateDecisionMatchedBy = 'PLATE' | 'RFID' | 'BOTH'
export type GateCredentialStatus = 'ACTIVE' | 'BLOCKED' | 'LOST' | 'UNKNOWN'

export type GateOpenTicketContext = {
  ticketId: string
  ticketCode: string | null
  matchedBy: GateDecisionMatchedBy
  entryTime: string | null
} | null

export type GateActivePresenceContext = {
  presenceId: string
  sessionId: string | null
  ticketId: string | null
  plateCompact: string | null
  rfidUid: string | null
  entryLaneCode: string
  enteredAt: string | null
  lastSeenAt: string | null
  evidenceReadEventId: string | null
  matchedBy: Array<'TICKET' | 'PLATE' | 'RFID'>
} | null

export type GateDecisionThresholds = {
  ocrApproveMin: number
  ocrReviewMin: number
  degradedHeartbeatAgeSeconds: number
  offlineHeartbeatAgeSeconds: number
}

export type GateDecisionRuleInput = {
  plateValidity: PlateValidity | 'UNKNOWN'
  ocrConfidence: number | null
  rfidUid: string | null
  laneDirection: 'ENTRY' | 'EXIT'
  presenceActive: boolean
  openTicket: GateOpenTicketContext
  activePresence?: GateActivePresenceContext
  paymentStatus: GatePaymentStatus
  deviceHealth: GateDeviceHealth
  credentialStatus?: GateCredentialStatus
  plateTicketId?: string | null
  rfidTicketId?: string | null
}

export type GateDecisionRuleOutput = {
  decisionCode: GateDecisionCode
  reasonCode: string
  recommendedAction: GateRecommendedAction
  reasonDetail: string
  reviewRequired: boolean
}

export const DEFAULT_GATE_DECISION_THRESHOLDS: GateDecisionThresholds = {
  ocrApproveMin: 0.9,
  ocrReviewMin: 0.75,
  degradedHeartbeatAgeSeconds: 120,
  offlineHeartbeatAgeSeconds: 300,
}

function clamp01(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(1, value))
}

function clampPositiveInt(value: number, fallback: number) {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.trunc(value)
}

export function normalizeGateDecisionThresholds(
  raw?: Partial<GateDecisionThresholds> | null,
): GateDecisionThresholds {
  const approve = clamp01(raw?.ocrApproveMin ?? DEFAULT_GATE_DECISION_THRESHOLDS.ocrApproveMin, DEFAULT_GATE_DECISION_THRESHOLDS.ocrApproveMin)
  const review = clamp01(raw?.ocrReviewMin ?? DEFAULT_GATE_DECISION_THRESHOLDS.ocrReviewMin, DEFAULT_GATE_DECISION_THRESHOLDS.ocrReviewMin)
  const boundedReview = review > approve ? approve : review

  return {
    ocrApproveMin: approve,
    ocrReviewMin: boundedReview,
    degradedHeartbeatAgeSeconds: clampPositiveInt(
      raw?.degradedHeartbeatAgeSeconds ?? DEFAULT_GATE_DECISION_THRESHOLDS.degradedHeartbeatAgeSeconds,
      DEFAULT_GATE_DECISION_THRESHOLDS.degradedHeartbeatAgeSeconds,
    ),
    offlineHeartbeatAgeSeconds: clampPositiveInt(
      raw?.offlineHeartbeatAgeSeconds ?? DEFAULT_GATE_DECISION_THRESHOLDS.offlineHeartbeatAgeSeconds,
      DEFAULT_GATE_DECISION_THRESHOLDS.offlineHeartbeatAgeSeconds,
    ),
  }
}

function decision(
  decisionCode: GateDecisionCode,
  recommendedAction: GateRecommendedAction,
  reasonCode: string,
  reasonDetail: string,
): GateDecisionRuleOutput {
  return {
    decisionCode,
    recommendedAction,
    reasonCode,
    reasonDetail,
    reviewRequired: recommendedAction === 'REVIEW',
  }
}

export function evaluateGateDecision(
  input: GateDecisionRuleInput,
  thresholdsInput?: Partial<GateDecisionThresholds> | null,
): GateDecisionRuleOutput {
  const thresholds = normalizeGateDecisionThresholds(thresholdsInput)

  if (!input.presenceActive) {
    return decision(
      'REVIEW_REQUIRED',
      'REVIEW',
      'PRESENCE_NOT_ACTIVE',
      'Lane sensor chưa xác nhận có xe hiện diện nên operator cần kiểm tra thủ công.',
    )
  }

  if (input.deviceHealth === 'OFFLINE') {
    return decision(
      'DEVICE_DEGRADED',
      'REVIEW',
      'DEVICE_OFFLINE',
      'Thiết bị lane đang OFFLINE hoặc heartbeat đã quá hạn offline threshold; không auto-approve.',
    )
  }

  if (input.deviceHealth === 'DEGRADED') {
    return decision(
      'DEVICE_DEGRADED',
      'REVIEW',
      'DEVICE_HEALTH_DEGRADED',
      'Thiết bị lane đang DEGRADED hoặc heartbeat đã quá degraded threshold; cần operator review.',
    )
  }

  if (input.credentialStatus === 'LOST') {
    return decision(
      'AUTO_DENIED',
      'DENY',
      'RFID_CREDENTIAL_LOST',
      'RFID credential đang ở trạng thái LOST nên lane phải chặn để tránh xe dùng thẻ thất lạc.',
    )
  }

  if (input.credentialStatus === 'BLOCKED') {
    return decision(
      'AUTO_DENIED',
      'DENY',
      'RFID_CREDENTIAL_BLOCKED',
      'RFID credential đang bị BLOCKED nên backend không cho phép tự động thông qua.',
    )
  }

  if (input.plateTicketId && input.rfidTicketId && input.plateTicketId !== input.rfidTicketId) {
    return decision(
      'PLATE_RFID_MISMATCH',
      'REVIEW',
      'PLATE_RFID_MISMATCH',
      'Plate và RFID đang trỏ tới hai open ticket khác nhau; operator phải kiểm tra trước khi quyết định.',
    )
  }

  if (input.laneDirection === 'ENTRY' && input.activePresence) {
    return decision(
      'ANTI_PASSBACK_BLOCKED',
      'DENY',
      'ACTIVE_PRESENCE_EXISTS',
      `Phát hiện active presence trong site cho ${input.activePresence.matchedBy.join('+') || 'CURRENT_VEHICLE'} từ lane ${input.activePresence.entryLaneCode}; entry mới bị chặn để chống anti-passback.`,
    )
  }

  if (input.laneDirection === 'EXIT' && !input.openTicket) {
    return decision(
      'TICKET_NOT_FOUND',
      'REVIEW',
      'OPEN_TICKET_NOT_FOUND',
      'Không tìm thấy open ticket cho lượt EXIT dựa trên RFID trước rồi plateCompact sau; cần operator review.',
    )
  }

  if (input.plateValidity === 'INVALID') {
    return decision(
      'AUTO_DENIED',
      'DENY',
      'PLATE_INVALID',
      'Biển số không vượt qua strict validation nên backend từ chối tự động.',
    )
  }

  if (input.ocrConfidence != null && input.ocrConfidence < thresholds.ocrReviewMin) {
    return decision(
      'REVIEW_REQUIRED',
      'REVIEW',
      'OCR_CONFIDENCE_TOO_LOW',
      `OCR confidence thấp hơn review threshold (${input.ocrConfidence.toFixed(2)} < ${thresholds.ocrReviewMin.toFixed(2)}).`,
    )
  }

  if (input.plateValidity === 'REVIEW') {
    return decision(
      'REVIEW_REQUIRED',
      'REVIEW',
      'PLATE_REVIEW_REQUIRED',
      'Plate canonicalization gắn cờ reviewRequired nên operator cần kiểm tra trước khi cho qua.',
    )
  }

  if (input.ocrConfidence != null && input.ocrConfidence < thresholds.ocrApproveMin) {
    return decision(
      'REVIEW_REQUIRED',
      'REVIEW',
      'OCR_CONFIDENCE_REVIEW',
      `OCR confidence chưa đạt approve threshold (${input.ocrConfidence.toFixed(2)} < ${thresholds.ocrApproveMin.toFixed(2)}).`,
    )
  }

  // NOTE: Anti-passback for ENTRY is enforced by the activePresence check above.
  // The openTicket condition (below) was removed — having an open ticket does not
  // by itself indicate the vehicle is still physically inside the site. The
  // presenceActive flag is the authoritative signal for anti-passback.

  if (input.laneDirection === 'EXIT') {
    if (input.paymentStatus === 'UNPAID') {
      return decision(
        'PAYMENT_REQUIRED',
        'PAYMENT_HOLD',
        'PAYMENT_REQUIRED',
        'Open ticket đã được tìm thấy nhưng hiện chưa đủ tiền thanh toán; barrier phải giữ đóng.',
      )
    }

    if (input.paymentStatus === 'PENDING') {
      return decision(
        'PAYMENT_REQUIRED',
        'PAYMENT_HOLD',
        'PAYMENT_PENDING',
        'Đã có giao dịch nhưng vẫn còn số dư chưa thanh toán hết; giữ ở WAITING_PAYMENT.',
      )
    }

    if (input.paymentStatus === 'WAIVED') {
      return decision(
        'AUTO_APPROVED',
        'APPROVE',
        'EXIT_WAIVED',
        'Phiên gửi xe không phát sinh phí phải thu hoặc đã được miễn phí theo tariff hiện hành.',
      )
    }

    if (input.paymentStatus === 'SUBSCRIPTION_COVERED') {
      return decision(
        'AUTO_APPROVED',
        'APPROVE',
        'EXIT_SUBSCRIPTION_COVERED',
        'Phiên gửi xe được subscription đang hiệu lực bao phủ nên EXIT có thể mở barrier.',
      )
    }

    if (input.paymentStatus === 'UNKNOWN' || input.paymentStatus === 'NOT_APPLICABLE') {
      return decision(
        'REVIEW_REQUIRED',
        'REVIEW',
        'PAYMENT_STATUS_UNKNOWN',
        'Hệ thống chưa xác định chắc chắn payment status của open ticket; cần operator review.',
      )
    }

    return decision(
      'AUTO_APPROVED',
      'APPROVE',
      'EXIT_TICKET_READY',
      'Open ticket hợp lệ đã được xác thực cho lượt EXIT và payment status cho phép cho xe qua.',
    )
  }

  return decision(
    'AUTO_APPROVED',
    'APPROVE',
    'ENTRY_CLEAR',
    'Lane ENTRY không có tín hiệu chặn, plate/RFID đạt ngưỡng và có thể auto-approve.',
  )
}
