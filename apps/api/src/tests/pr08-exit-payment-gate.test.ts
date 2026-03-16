import test from 'node:test'
import assert from 'node:assert/strict'

import { evaluateGateDecision } from '@parkly/gate-core'

const thresholds = {
  ocrApproveMin: 0.9,
  ocrReviewMin: 0.75,
  degradedHeartbeatAgeSeconds: 120,
  offlineHeartbeatAgeSeconds: 300,
} as const

test('exit unpaid -> payment hold', () => {
  const result = evaluateGateDecision(
    {
      plateValidity: 'STRICT_VALID',
      ocrConfidence: 0.96,
      rfidUid: 'TAG-0001',
      laneDirection: 'EXIT',
      presenceActive: true,
      openTicket: {
        ticketId: '5001',
        ticketCode: 'TK-5001',
        matchedBy: 'RFID',
        entryTime: '2026-03-07T08:00:00.000Z',
      },
      paymentStatus: 'UNPAID',
      deviceHealth: 'HEALTHY',
      plateTicketId: '5001',
      rfidTicketId: '5001',
    },
    thresholds,
  )

  assert.equal(result.decisionCode, 'PAYMENT_REQUIRED')
  assert.equal(result.recommendedAction, 'PAYMENT_HOLD')
  assert.equal(result.reasonCode, 'PAYMENT_REQUIRED')
})

test('exit subscription covered -> approve', () => {
  const result = evaluateGateDecision(
    {
      plateValidity: 'STRICT_VALID',
      ocrConfidence: 0.97,
      rfidUid: 'TAG-0002',
      laneDirection: 'EXIT',
      presenceActive: true,
      openTicket: {
        ticketId: '5002',
        ticketCode: 'TK-5002',
        matchedBy: 'BOTH',
        entryTime: '2026-03-07T08:00:00.000Z',
      },
      paymentStatus: 'SUBSCRIPTION_COVERED',
      deviceHealth: 'HEALTHY',
      plateTicketId: '5002',
      rfidTicketId: '5002',
    },
    thresholds,
  )

  assert.equal(result.decisionCode, 'AUTO_APPROVED')
  assert.equal(result.recommendedAction, 'APPROVE')
  assert.equal(result.reasonCode, 'EXIT_SUBSCRIPTION_COVERED')
})

test('exit ticket not found -> review instead of silent fail', () => {
  const result = evaluateGateDecision(
    {
      plateValidity: 'STRICT_VALID',
      ocrConfidence: 0.95,
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

test('exit RFID and plate mismatch -> review', () => {
  const result = evaluateGateDecision(
    {
      plateValidity: 'STRICT_VALID',
      ocrConfidence: 0.95,
      rfidUid: 'TAG-0003',
      laneDirection: 'EXIT',
      presenceActive: true,
      openTicket: {
        ticketId: '5003',
        ticketCode: 'TK-5003',
        matchedBy: 'RFID',
        entryTime: '2026-03-07T08:00:00.000Z',
      },
      paymentStatus: 'PAID',
      deviceHealth: 'HEALTHY',
      plateTicketId: '1111',
      rfidTicketId: '5003',
    },
    thresholds,
  )

  assert.equal(result.decisionCode, 'PLATE_RFID_MISMATCH')
  assert.equal(result.recommendedAction, 'REVIEW')
})
