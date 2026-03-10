import test from 'node:test'
import assert from 'node:assert/strict'

import { evaluateGateDecision } from '@parkly/gate-core'

const thresholds = {
  ocrApproveMin: 0.9,
  ocrReviewMin: 0.75,
  degradedHeartbeatAgeSeconds: 120,
  offlineHeartbeatAgeSeconds: 300,
} as const

test('low confidence -> review', () => {
  const result = evaluateGateDecision(
    {
      plateValidity: 'STRICT_VALID',
      ocrConfidence: 0.62,
      rfidUid: null,
      laneDirection: 'EXIT',
      presenceActive: true,
      openTicket: {
        ticketId: '101',
        ticketCode: 'T-101',
        matchedBy: 'PLATE',
        entryTime: '2026-03-07T09:30:00.000Z',
      },
      paymentStatus: 'PAID',
      deviceHealth: 'HEALTHY',
    },
    thresholds,
  )

  assert.equal(result.decisionCode, 'REVIEW_REQUIRED')
  assert.equal(result.recommendedAction, 'REVIEW')
  assert.equal(result.reasonCode, 'OCR_CONFIDENCE_TOO_LOW')
  assert.equal(result.reviewRequired, true)
})

test('no ticket on exit -> ticket not found', () => {
  const result = evaluateGateDecision(
    {
      plateValidity: 'STRICT_VALID',
      ocrConfidence: 0.96,
      rfidUid: null,
      laneDirection: 'EXIT',
      presenceActive: true,
      openTicket: null,
      paymentStatus: 'NOT_APPLICABLE',
      deviceHealth: 'HEALTHY',
    },
    thresholds,
  )

  assert.equal(result.decisionCode, 'TICKET_NOT_FOUND')
  assert.equal(result.recommendedAction, 'REVIEW')
  assert.equal(result.reasonCode, 'OPEN_TICKET_NOT_FOUND')
})

test('bad device health -> degraded review', () => {
  const result = evaluateGateDecision(
    {
      plateValidity: 'STRICT_VALID',
      ocrConfidence: 0.97,
      rfidUid: null,
      laneDirection: 'EXIT',
      presenceActive: true,
      openTicket: {
        ticketId: '102',
        ticketCode: 'T-102',
        matchedBy: 'RFID',
        entryTime: '2026-03-07T08:00:00.000Z',
      },
      paymentStatus: 'PAID',
      deviceHealth: 'DEGRADED',
    },
    thresholds,
  )

  assert.equal(result.decisionCode, 'DEVICE_DEGRADED')
  assert.equal(result.recommendedAction, 'REVIEW')
  assert.equal(result.reasonCode, 'DEVICE_HEALTH_DEGRADED')
})

test('happy path exit -> approve', () => {
  const result = evaluateGateDecision(
    {
      plateValidity: 'STRICT_VALID',
      ocrConfidence: 0.98,
      rfidUid: 'RFID-0001',
      laneDirection: 'EXIT',
      presenceActive: true,
      openTicket: {
        ticketId: '103',
        ticketCode: 'T-103',
        matchedBy: 'BOTH',
        entryTime: '2026-03-07T07:00:00.000Z',
      },
      paymentStatus: 'PAID',
      deviceHealth: 'HEALTHY',
      plateTicketId: '103',
      rfidTicketId: '103',
    },
    thresholds,
  )

  assert.equal(result.decisionCode, 'AUTO_APPROVED')
  assert.equal(result.recommendedAction, 'APPROVE')
  assert.equal(result.reasonCode, 'EXIT_TICKET_READY')
  assert.equal(result.reviewRequired, false)
})
