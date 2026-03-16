import test from 'node:test'
import assert from 'node:assert/strict'

import { evaluateGateDecision } from '@parkly/gate-core'

const thresholds = {
  ocrApproveMin: 0.9,
  ocrReviewMin: 0.75,
  degradedHeartbeatAgeSeconds: 120,
  offlineHeartbeatAgeSeconds: 300,
} as const

test('entry happy path -> approve', () => {
  const result = evaluateGateDecision(
    {
      plateValidity: 'STRICT_VALID',
      ocrConfidence: 0.98,
      rfidUid: 'RFID-ENTRY-01',
      laneDirection: 'ENTRY',
      presenceActive: true,
      openTicket: null,
      activePresence: null,
      paymentStatus: 'NOT_APPLICABLE',
      deviceHealth: 'HEALTHY',
      credentialStatus: 'ACTIVE',
    },
    thresholds,
  )

  assert.equal(result.decisionCode, 'AUTO_APPROVED')
  assert.equal(result.recommendedAction, 'APPROVE')
  assert.equal(result.reasonCode, 'ENTRY_CLEAR')
})

test('duplicate entry active presence -> anti-passback blocked', () => {
  const result = evaluateGateDecision(
    {
      plateValidity: 'STRICT_VALID',
      ocrConfidence: 0.97,
      rfidUid: 'RFID-ENTRY-02',
      laneDirection: 'ENTRY',
      presenceActive: true,
      openTicket: null,
      activePresence: {
        presenceId: '501',
        sessionId: '701',
        ticketId: '901',
        plateCompact: '51A12345',
        rfidUid: 'RFID-ENTRY-02',
        entryLaneCode: 'GATE_01_ENTRY',
        enteredAt: '2026-03-07T10:00:00.000Z',
        lastSeenAt: '2026-03-07T10:00:02.000Z',
        evidenceReadEventId: '3001',
        matchedBy: ['RFID'],
      },
      paymentStatus: 'NOT_APPLICABLE',
      deviceHealth: 'HEALTHY',
      credentialStatus: 'ACTIVE',
    },
    thresholds,
  )

  assert.equal(result.decisionCode, 'ANTI_PASSBACK_BLOCKED')
  assert.equal(result.recommendedAction, 'DENY')
  assert.equal(result.reasonCode, 'ACTIVE_PRESENCE_EXISTS')
})

test('lost rfid -> denied clearly', () => {
  const result = evaluateGateDecision(
    {
      plateValidity: 'STRICT_VALID',
      ocrConfidence: 0.99,
      rfidUid: 'RFID-LOST-01',
      laneDirection: 'ENTRY',
      presenceActive: true,
      openTicket: null,
      activePresence: null,
      paymentStatus: 'NOT_APPLICABLE',
      deviceHealth: 'HEALTHY',
      credentialStatus: 'LOST',
    },
    thresholds,
  )

  assert.equal(result.decisionCode, 'AUTO_DENIED')
  assert.equal(result.recommendedAction, 'DENY')
  assert.equal(result.reasonCode, 'RFID_CREDENTIAL_LOST')
})
