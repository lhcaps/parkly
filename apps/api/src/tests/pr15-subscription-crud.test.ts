import test from 'node:test';
import assert from 'node:assert/strict';

import { compactPlate, resolveEffectiveSubscriptionStatus } from '../modules/subscriptions/application/admin-subscriptions';

test('compactPlate chuẩn hóa biển số về dạng compact', () => {
  assert.equal(compactPlate('51A-123.45'), '51A12345');
  assert.equal(compactPlate(' 43a 99999 '), '43A99999');
});

test('resolveEffectiveSubscriptionStatus trả EXPIRED khi quá hạn dù status ACTIVE', () => {
  const now = new Date('2026-03-12T10:00:00.000Z');
  const status = resolveEffectiveSubscriptionStatus({
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: '2026-03-11',
    now,
  });
  assert.equal(status, 'EXPIRED');
});

test('resolveEffectiveSubscriptionStatus giữ SUSPENDED là trạng thái ưu tiên', () => {
  const status = resolveEffectiveSubscriptionStatus({
    status: 'SUSPENDED',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    now: new Date('2026-03-12T10:00:00.000Z'),
  });
  assert.equal(status, 'SUSPENDED');
});
