import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deriveStatusFromRead,
  getAllowedActions,
  resolveStatusFromSignal,
  shouldReuseSession,
} from '../modules/gate/domain/session'

test('sensor PRESENT drives OPEN -> WAITING_READ without decision', () => {
  const result = resolveStatusFromSignal({
    currentStatus: 'OPEN',
    readType: 'SENSOR',
    sensorState: 'PRESENT',
    presenceActive: true,
  })

  assert.equal(result.nextStatus, 'WAITING_READ')
  assert.equal(result.decisionCode, null)
  assert.equal(result.finalAction, null)
})

test('ALPR after WAITING_READ drives session to WAITING_DECISION', () => {
  const result = resolveStatusFromSignal({
    currentStatus: 'WAITING_READ',
    readType: 'ALPR',
    hasEvidence: true,
    reviewRequired: false,
    presenceActive: true,
  })

  assert.equal(result.nextStatus, 'WAITING_DECISION')
  assert.equal(result.decisionCode, 'REVIEW_REQUIRED')
  assert.equal(result.finalAction, 'REVIEW')
})

test('approved and waiting payment sessions do not regress on extra reads', () => {
  assert.equal(
    deriveStatusFromRead({
      currentStatus: 'APPROVED',
      readType: 'ALPR',
      hasEvidence: true,
      presenceActive: true,
    }),
    'APPROVED',
  )

  assert.equal(
    deriveStatusFromRead({
      currentStatus: 'WAITING_PAYMENT',
      readType: 'RFID',
      hasEvidence: true,
      presenceActive: true,
    }),
    'WAITING_PAYMENT',
  )
})

test('allowedActions come from backend state machine, not UI guessing', () => {
  assert.deepEqual(getAllowedActions('WAITING_READ'), ['CANCEL'])
  assert.deepEqual(getAllowedActions('WAITING_DECISION'), ['APPROVE', 'REQUIRE_PAYMENT', 'DENY', 'CANCEL'])
  assert.deepEqual(getAllowedActions('APPROVED'), ['CONFIRM_PASS', 'DENY', 'CANCEL'])
  assert.deepEqual(getAllowedActions('PASSED'), [])
})

test('reuse window still depends on openedAt/lastReadAt anchor', () => {
  const now = new Date('2026-03-07T10:00:30.000Z')

  assert.equal(
    shouldReuseSession({
      openedAt: new Date('2026-03-07T10:00:00.000Z'),
      lastReadAt: new Date('2026-03-07T10:00:20.000Z'),
      now,
      windowMs: 15_000,
    }),
    true,
  )

  assert.equal(
    shouldReuseSession({
      openedAt: new Date('2026-03-07T09:59:00.000Z'),
      lastReadAt: new Date('2026-03-07T09:59:10.000Z'),
      now,
      windowMs: 15_000,
    }),
    false,
  )
})
