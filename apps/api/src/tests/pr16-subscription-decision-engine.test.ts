import test from 'node:test'
import assert from 'node:assert/strict'

import { applySubscriptionDecisionOverride } from '../modules/gate/application/decision-engine'
import type { DecisionRuleOutput } from '../modules/gate/domain/decision'
import type { SubscriptionDecisionContext } from '../server/services/ticket-service'

function buildDecision(overrides: Partial<DecisionRuleOutput> = {}): DecisionRuleOutput {
  return {
    decisionCode: 'AUTO_APPROVED',
    recommendedAction: 'APPROVE',
    reasonCode: 'AUTO_APPROVED',
    reasonDetail: 'base',
    reviewRequired: false,
    ...overrides,
  }
}

function buildSubscriptionMatch(overrides: Partial<NonNullable<SubscriptionDecisionContext>> = {}): NonNullable<SubscriptionDecisionContext> {
  return {
    lookupEnabled: true,
    subscriptionId: '1001',
    customerId: '2001',
    customerName: 'VIP Demo',
    planType: 'VIP',
    matchedBy: 'BOTH',
    subscriptionStatus: 'ACTIVE',
    subscriptionStartDate: '2026-03-01T00:00:00.000Z',
    subscriptionEndDate: '2026-12-31T00:00:00.000Z',
    credentialId: '3001',
    credentialStatus: 'ACTIVE',
    credentialRfidUid: 'VIP-HCM-0001',
    vehicleId: '4001',
    vehiclePlateCompact: '51A12345',
    vehicleBindingStatus: 'ACTIVE',
    vehicleValidFrom: '2026-03-01T00:00:00.000Z',
    vehicleValidTo: '2026-12-31T00:00:00.000Z',
    assignedSpotId: '5001',
    assignedSpotCode: 'HCM-VIP-01',
    assignedSpotStatus: 'ACTIVE',
    assignedMode: 'ASSIGNED',
    assignedFrom: '2026-03-01T00:00:00.000Z',
    assignedUntil: '2026-12-31T00:00:00.000Z',
    remainingDays: 294,
    plateMatched: true,
    rfidMatched: true,
    assignedRuleStatus: 'NOT_CHECKED',
    eligibleEntry: true,
    eligibleExit: true,
    reviewRequired: false,
    statusCode: 'ACTIVE_MATCH',
    reasonCode: 'SUBSCRIPTION_ACTIVE_MATCH',
    reasonDetail: 'Subscription VIP hợp lệ và đủ điều kiện fast-path.',
    raw: {},
    ...overrides,
  }
}

test('ordinary flow giữ nguyên khi không có subscription match', () => {
  const base = buildDecision()
  const out = applySubscriptionDecisionOverride({
    direction: 'ENTRY',
    baseDecision: base,
    paymentStatus: 'NOT_APPLICABLE',
    presenceActive: true,
    openTicketId: null,
    exitPresenceTicketId: null,
    subscriptionMatch: null,
  })

  assert.deepEqual(out, base)
})

test('ENTRY active subscription -> subscription auto approved', () => {
  const out = applySubscriptionDecisionOverride({
    direction: 'ENTRY',
    baseDecision: buildDecision(),
    paymentStatus: 'NOT_APPLICABLE',
    presenceActive: true,
    openTicketId: null,
    exitPresenceTicketId: null,
    subscriptionMatch: buildSubscriptionMatch(),
  })

  assert.equal(out.decisionCode, 'SUBSCRIPTION_AUTO_APPROVED')
  assert.equal(out.recommendedAction, 'APPROVE')
  assert.equal(out.reasonCode, 'SUBSCRIPTION_AUTO_APPROVED')
})

test('EXIT active subscription + payment hold + active presence -> bypass payment', () => {
  const out = applySubscriptionDecisionOverride({
    direction: 'EXIT',
    baseDecision: buildDecision({
      decisionCode: 'PAYMENT_REQUIRED',
      recommendedAction: 'PAYMENT_HOLD',
      reasonCode: 'PAYMENT_REQUIRED',
      reasonDetail: 'pay first',
      reviewRequired: false,
    }),
    paymentStatus: 'UNPAID',
    presenceActive: true,
    openTicketId: '6001',
    exitPresenceTicketId: '6001',
    subscriptionMatch: buildSubscriptionMatch(),
  })

  assert.equal(out.decisionCode, 'SUBSCRIPTION_EXIT_BYPASS_PAYMENT')
  assert.equal(out.recommendedAction, 'APPROVE')
  assert.equal(out.reasonCode, 'SUBSCRIPTION_EXIT_BYPASS_PAYMENT')
})

test('subscription expired -> review instead of silent approve', () => {
  const out = applySubscriptionDecisionOverride({
    direction: 'ENTRY',
    baseDecision: buildDecision(),
    paymentStatus: 'NOT_APPLICABLE',
    presenceActive: true,
    openTicketId: null,
    exitPresenceTicketId: null,
    subscriptionMatch: buildSubscriptionMatch({
      eligibleEntry: false,
      eligibleExit: false,
      reviewRequired: true,
      statusCode: 'EXPIRED',
      reasonCode: 'SUBSCRIPTION_EXPIRED',
      reasonDetail: 'Subscription hết hạn.',
    }),
  })

  assert.equal(out.decisionCode, 'SUBSCRIPTION_REVIEW_REQUIRED')
  assert.equal(out.recommendedAction, 'REVIEW')
})

test('wrong spot -> review', () => {
  const out = applySubscriptionDecisionOverride({
    direction: 'ENTRY',
    baseDecision: buildDecision(),
    paymentStatus: 'NOT_APPLICABLE',
    presenceActive: true,
    openTicketId: null,
    exitPresenceTicketId: null,
    subscriptionMatch: buildSubscriptionMatch({
      eligibleEntry: false,
      eligibleExit: false,
      reviewRequired: true,
      assignedRuleStatus: 'WRONG_SPOT',
      statusCode: 'WRONG_SPOT',
      reasonCode: 'SUBSCRIPTION_WRONG_SPOT',
      reasonDetail: 'Assigned bay không khớp.',
    }),
  })

  assert.equal(out.decisionCode, 'SUBSCRIPTION_REVIEW_REQUIRED')
  assert.equal(out.recommendedAction, 'REVIEW')
})

test('subscription không override anti-passback/device safety hiện hữu', () => {
  const base = buildDecision({
    decisionCode: 'ANTI_PASSBACK_BLOCKED',
    recommendedAction: 'REVIEW',
    reasonCode: 'ANTI_PASSBACK_REVIEW_REQUIRED',
    reasonDetail: 'review anti passback',
    reviewRequired: true,
  })

  const out = applySubscriptionDecisionOverride({
    direction: 'ENTRY',
    baseDecision: base,
    paymentStatus: 'NOT_APPLICABLE',
    presenceActive: true,
    openTicketId: null,
    exitPresenceTicketId: null,
    subscriptionMatch: buildSubscriptionMatch(),
  })

  assert.deepEqual(out, base)
})

test('EXIT không có active presence hợp lệ thì không bypass payment', () => {
  const base = buildDecision({
    decisionCode: 'PAYMENT_REQUIRED',
    recommendedAction: 'PAYMENT_HOLD',
    reasonCode: 'PAYMENT_REQUIRED',
    reasonDetail: 'pay first',
    reviewRequired: false,
  })

  const out = applySubscriptionDecisionOverride({
    direction: 'EXIT',
    baseDecision: base,
    paymentStatus: 'UNPAID',
    presenceActive: true,
    openTicketId: '7001',
    exitPresenceTicketId: null,
    subscriptionMatch: buildSubscriptionMatch(),
  })

  assert.deepEqual(out, base)
})
