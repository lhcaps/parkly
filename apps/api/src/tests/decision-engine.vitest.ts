/**
 * Decision Engine — expanded Vitest test suite.
 *
 * Covers all 19 decision paths in `evaluateGateDecision()`:
 * - Presence checks
 * - Device health (OFFLINE, DEGRADED)
 * - Credential status (LOST, BLOCKED)
 * - PLATE_RFID mismatch
 * - Anti-passback
 * - Ticket not found on exit
 * - Plate validity (INVALID, REVIEW)
 * - OCR confidence thresholds (below review, between review/approve, above approve)
 * - Payment status (UNPAID, PENDING, WAIVED, SUBSCRIPTION_COVERED, UNKNOWN)
 * - Happy path: EXIT approve & ENTRY approve
 * - Threshold normalization edge cases
 */

import { describe, it, expect } from 'vitest'
import { evaluateGateDecision, normalizeGateDecisionThresholds, DEFAULT_GATE_DECISION_THRESHOLDS } from '@parkly/gate-core'
import type { GateDecisionRuleInput, GateDecisionThresholds } from '@parkly/gate-core'

const T: GateDecisionThresholds = {
  ocrApproveMin: 0.9,
  ocrReviewMin: 0.75,
  degradedHeartbeatAgeSeconds: 120,
  offlineHeartbeatAgeSeconds: 300,
}

function input(overrides: Partial<GateDecisionRuleInput> = {}): GateDecisionRuleInput {
  return {
    plateValidity: 'STRICT_VALID',
    ocrConfidence: 0.98,
    rfidUid: 'RFID-001',
    laneDirection: 'EXIT',
    presenceActive: true,
    openTicket: {
      ticketId: '100',
      ticketCode: 'T-100',
      matchedBy: 'BOTH',
      entryTime: '2026-03-10T08:00:00.000Z',
    },
    paymentStatus: 'PAID',
    deviceHealth: 'HEALTHY',
    ...overrides,
  }
}

// ─── Presence ─────────────────────────────────────────────────────────────────

describe('Presence checks', () => {
  it('no presence → REVIEW_REQUIRED', () => {
    const r = evaluateGateDecision(input({ presenceActive: false }), T)
    expect(r.decisionCode).toBe('REVIEW_REQUIRED')
    expect(r.reasonCode).toBe('PRESENCE_NOT_ACTIVE')
    expect(r.reviewRequired).toBe(true)
  })
})

// ─── Device Health ────────────────────────────────────────────────────────────

describe('Device health', () => {
  it('OFFLINE → DEVICE_DEGRADED review', () => {
    const r = evaluateGateDecision(input({ deviceHealth: 'OFFLINE' }), T)
    expect(r.decisionCode).toBe('DEVICE_DEGRADED')
    expect(r.reasonCode).toBe('DEVICE_OFFLINE')
    expect(r.recommendedAction).toBe('REVIEW')
  })

  it('DEGRADED → DEVICE_DEGRADED review', () => {
    const r = evaluateGateDecision(input({ deviceHealth: 'DEGRADED' }), T)
    expect(r.decisionCode).toBe('DEVICE_DEGRADED')
    expect(r.reasonCode).toBe('DEVICE_HEALTH_DEGRADED')
  })

  it('UNKNOWN health passes through (not blocked)', () => {
    const r = evaluateGateDecision(input({ deviceHealth: 'UNKNOWN' }), T)
    // UNKNOWN is not OFFLINE/DEGRADED, so it falls through
    expect(r.decisionCode).not.toBe('DEVICE_DEGRADED')
  })
})

// ─── Credential Status ────────────────────────────────────────────────────────

describe('Credential status', () => {
  it('LOST → AUTO_DENIED', () => {
    const r = evaluateGateDecision(input({ credentialStatus: 'LOST' }), T)
    expect(r.decisionCode).toBe('AUTO_DENIED')
    expect(r.reasonCode).toBe('RFID_CREDENTIAL_LOST')
    expect(r.recommendedAction).toBe('DENY')
  })

  it('BLOCKED → AUTO_DENIED', () => {
    const r = evaluateGateDecision(input({ credentialStatus: 'BLOCKED' }), T)
    expect(r.decisionCode).toBe('AUTO_DENIED')
    expect(r.reasonCode).toBe('RFID_CREDENTIAL_BLOCKED')
  })

  it('ACTIVE credential passes through', () => {
    const r = evaluateGateDecision(input({ credentialStatus: 'ACTIVE' }), T)
    expect(r.decisionCode).not.toBe('AUTO_DENIED')
  })
})

// ─── Plate-RFID Mismatch ─────────────────────────────────────────────────────

describe('Plate-RFID ticket mismatch', () => {
  it('different ticket IDs → PLATE_RFID_MISMATCH', () => {
    const r = evaluateGateDecision(input({ plateTicketId: '100', rfidTicketId: '200' }), T)
    expect(r.decisionCode).toBe('PLATE_RFID_MISMATCH')
    expect(r.recommendedAction).toBe('REVIEW')
  })

  it('same ticket IDs → passes through', () => {
    const r = evaluateGateDecision(input({ plateTicketId: '100', rfidTicketId: '100' }), T)
    expect(r.decisionCode).not.toBe('PLATE_RFID_MISMATCH')
  })

  it('only plate ticket set (no RFID) → passes through', () => {
    const r = evaluateGateDecision(input({ plateTicketId: '100', rfidTicketId: null }), T)
    expect(r.decisionCode).not.toBe('PLATE_RFID_MISMATCH')
  })
})

// ─── Anti-passback ────────────────────────────────────────────────────────────

describe('Anti-passback', () => {
  it('ENTRY with active presence → ANTI_PASSBACK_BLOCKED', () => {
    const r = evaluateGateDecision(
      input({
        laneDirection: 'ENTRY',
        openTicket: null,
        paymentStatus: 'NOT_APPLICABLE',
        activePresence: {
          presenceId: 'p-001',
          sessionId: 's-001',
          ticketId: 't-001',
          plateCompact: '51AB12345',
          rfidUid: 'RFID-001',
          entryLaneCode: 'LANE-A1',
          enteredAt: '2026-03-10T08:00:00Z',
          lastSeenAt: '2026-03-10T08:05:00Z',
          evidenceReadEventId: null,
          matchedBy: ['PLATE', 'RFID'],
        },
      }),
      T,
    )
    expect(r.decisionCode).toBe('ANTI_PASSBACK_BLOCKED')
    expect(r.recommendedAction).toBe('DENY')
  })

  it('ENTRY without active presence → allows', () => {
    const r = evaluateGateDecision(
      input({
        laneDirection: 'ENTRY',
        openTicket: null,
        paymentStatus: 'NOT_APPLICABLE',
      }),
      T,
    )
    expect(r.decisionCode).toBe('AUTO_APPROVED')
    expect(r.reasonCode).toBe('ENTRY_CLEAR')
  })
})

// ─── Ticket Not Found (EXIT) ─────────────────────────────────────────────────

describe('Ticket not found on EXIT', () => {
  it('EXIT with no open ticket → TICKET_NOT_FOUND', () => {
    const r = evaluateGateDecision(input({ openTicket: null }), T)
    expect(r.decisionCode).toBe('TICKET_NOT_FOUND')
    expect(r.reasonCode).toBe('OPEN_TICKET_NOT_FOUND')
  })
})

// ─── Plate Validity ──────────────────────────────────────────────────────────

describe('Plate validity', () => {
  it('INVALID plate → AUTO_DENIED', () => {
    const r = evaluateGateDecision(input({ plateValidity: 'INVALID' }), T)
    expect(r.decisionCode).toBe('AUTO_DENIED')
    expect(r.reasonCode).toBe('PLATE_INVALID')
  })

  it('REVIEW plate → REVIEW_REQUIRED', () => {
    const r = evaluateGateDecision(input({ plateValidity: 'REVIEW', ocrConfidence: 0.95 }), T)
    expect(r.decisionCode).toBe('REVIEW_REQUIRED')
    expect(r.reasonCode).toBe('PLATE_REVIEW_REQUIRED')
  })
})

// ─── OCR Confidence ──────────────────────────────────────────────────────────

describe('OCR confidence thresholds', () => {
  it('below review threshold → OCR_CONFIDENCE_TOO_LOW', () => {
    const r = evaluateGateDecision(input({ ocrConfidence: 0.60 }), T)
    expect(r.decisionCode).toBe('REVIEW_REQUIRED')
    expect(r.reasonCode).toBe('OCR_CONFIDENCE_TOO_LOW')
  })

  it('between review and approve → OCR_CONFIDENCE_REVIEW', () => {
    const r = evaluateGateDecision(input({ ocrConfidence: 0.85 }), T)
    expect(r.decisionCode).toBe('REVIEW_REQUIRED')
    expect(r.reasonCode).toBe('OCR_CONFIDENCE_REVIEW')
  })

  it('above approve threshold → passes through', () => {
    const r = evaluateGateDecision(input({ ocrConfidence: 0.95 }), T)
    expect(r.decisionCode).toBe('AUTO_APPROVED')
  })

  it('null confidence → passes through (no OCR check)', () => {
    const r = evaluateGateDecision(input({ ocrConfidence: null }), T)
    expect(r.decisionCode).toBe('AUTO_APPROVED')
  })
})

// ─── Payment Status (EXIT) ───────────────────────────────────────────────────

describe('Payment status on EXIT', () => {
  it('UNPAID → PAYMENT_REQUIRED', () => {
    const r = evaluateGateDecision(input({ paymentStatus: 'UNPAID' }), T)
    expect(r.decisionCode).toBe('PAYMENT_REQUIRED')
    expect(r.reasonCode).toBe('PAYMENT_REQUIRED')
    expect(r.recommendedAction).toBe('PAYMENT_HOLD')
  })

  it('PENDING → PAYMENT_REQUIRED (PAYMENT_PENDING)', () => {
    const r = evaluateGateDecision(input({ paymentStatus: 'PENDING' }), T)
    expect(r.decisionCode).toBe('PAYMENT_REQUIRED')
    expect(r.reasonCode).toBe('PAYMENT_PENDING')
  })

  it('WAIVED → AUTO_APPROVED (EXIT_WAIVED)', () => {
    const r = evaluateGateDecision(input({ paymentStatus: 'WAIVED' }), T)
    expect(r.decisionCode).toBe('AUTO_APPROVED')
    expect(r.reasonCode).toBe('EXIT_WAIVED')
  })

  it('SUBSCRIPTION_COVERED → AUTO_APPROVED', () => {
    const r = evaluateGateDecision(input({ paymentStatus: 'SUBSCRIPTION_COVERED' }), T)
    expect(r.decisionCode).toBe('AUTO_APPROVED')
    expect(r.reasonCode).toBe('EXIT_SUBSCRIPTION_COVERED')
  })

  it('UNKNOWN → REVIEW_REQUIRED', () => {
    const r = evaluateGateDecision(input({ paymentStatus: 'UNKNOWN' }), T)
    expect(r.decisionCode).toBe('REVIEW_REQUIRED')
    expect(r.reasonCode).toBe('PAYMENT_STATUS_UNKNOWN')
  })

  it('NOT_APPLICABLE → REVIEW_REQUIRED', () => {
    const r = evaluateGateDecision(input({ paymentStatus: 'NOT_APPLICABLE' }), T)
    expect(r.decisionCode).toBe('REVIEW_REQUIRED')
    expect(r.reasonCode).toBe('PAYMENT_STATUS_UNKNOWN')
  })

  it('PAID → AUTO_APPROVED (EXIT_TICKET_READY)', () => {
    const r = evaluateGateDecision(input({ paymentStatus: 'PAID' }), T)
    expect(r.decisionCode).toBe('AUTO_APPROVED')
    expect(r.reasonCode).toBe('EXIT_TICKET_READY')
  })
})

// ─── Happy Paths ─────────────────────────────────────────────────────────────

describe('Happy path decisions', () => {
  it('EXIT with PAID ticket → AUTO_APPROVED', () => {
    const r = evaluateGateDecision(input(), T)
    expect(r.decisionCode).toBe('AUTO_APPROVED')
    expect(r.reasonCode).toBe('EXIT_TICKET_READY')
    expect(r.reviewRequired).toBe(false)
  })

  it('ENTRY clear → AUTO_APPROVED', () => {
    const r = evaluateGateDecision(
      input({ laneDirection: 'ENTRY', openTicket: null, paymentStatus: 'NOT_APPLICABLE' }),
      T,
    )
    expect(r.decisionCode).toBe('AUTO_APPROVED')
    expect(r.reasonCode).toBe('ENTRY_CLEAR')
  })
})

// ─── Threshold Normalization ─────────────────────────────────────────────────

describe('normalizeGateDecisionThresholds', () => {
  it('defaults when null input', () => {
    const t = normalizeGateDecisionThresholds(null)
    expect(t).toEqual(DEFAULT_GATE_DECISION_THRESHOLDS)
  })

  it('clamps review below approve', () => {
    const t = normalizeGateDecisionThresholds({ ocrApproveMin: 0.8, ocrReviewMin: 0.9 })
    // review must be <= approve
    expect(t.ocrReviewMin).toBeLessThanOrEqual(t.ocrApproveMin)
  })

  it('handles NaN / negative values with defaults', () => {
    const t = normalizeGateDecisionThresholds({
      ocrApproveMin: NaN,
      degradedHeartbeatAgeSeconds: -100,
    })
    expect(t.ocrApproveMin).toBe(DEFAULT_GATE_DECISION_THRESHOLDS.ocrApproveMin)
    expect(t.degradedHeartbeatAgeSeconds).toBe(DEFAULT_GATE_DECISION_THRESHOLDS.degradedHeartbeatAgeSeconds)
  })
})
