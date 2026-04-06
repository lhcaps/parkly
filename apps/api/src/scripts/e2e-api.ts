import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import type { AuthRole } from '@parkly/contracts';
import { buildApp } from '../server/app';
import { config } from '../server/config';

type Role = Extract<AuthRole, 'SUPER_ADMIN' | 'OPERATOR' | 'GUARD' | 'CASHIER'>;

function authHeader(role: Role) {
  const token = config.tokens[role];
  if (!token) throw new Error(`Missing token for role=${role}. Set API_${role}_TOKEN in .env`);
  return { authorization: `Bearer ${token}` };
}

async function main() {
  const app: any = await buildApp();
  await app.ready();

  const prefix = config.prefix;
  const eventTime = '2026-03-01T08:00:00.000Z';
  const idempotencyKey = `idem_${randomUUID().slice(0, 16)}`;

  // 0) Debug auth
  const me = await app.inject({ method: 'GET', url: `${prefix}/me`, headers: { ...authHeader('GUARD') } });
  if (me.statusCode !== 200) throw new Error(`/me failed: ${me.statusCode} ${me.body}`);

  // 1) Log gate event
  const r1 = await app.inject({
    method: 'POST',
    url: `${prefix}/gate-events`,
    headers: { ...authHeader('GUARD') },
    payload: {
      direction: 'ENTRY',
      eventTime,
      idempotencyKey,
      rfidUid: 'RFID_DEMO_001',
      simulatePlate: true,
    },
  });
  if (r1.statusCode !== 200) throw new Error(`gate-events #1 failed: ${r1.statusCode} ${r1.body}`);
  const b1 = (r1.json() as any)?.data;
  if (!b1) throw new Error(`gate-events #1 missing data envelope: ${r1.body}`);

  const r2 = await app.inject({
    method: 'POST',
    url: `${prefix}/gate-events`,
    headers: { ...authHeader('GUARD') },
    payload: {
      direction: 'ENTRY',
      eventTime,
      idempotencyKey,
      rfidUid: 'RFID_DEMO_001',
      simulatePlate: true,
    },
  });
  if (r2.statusCode !== 200) throw new Error(`gate-events #2 failed: ${r2.statusCode} ${r2.body}`);
  const b2 = (r2.json() as any)?.data;
  if (!b2) throw new Error(`gate-events #2 missing data envelope: ${r2.body}`);

  if (String(b1.eventId) != String(b2.eventId) || String(b1.outboxId) != String(b2.outboxId)) {
    throw new Error(`Idempotency mismatch: #1=${JSON.stringify(b1)} #2=${JSON.stringify(b2)}`);
  }

  // 2) Drain outbox (Mongo optional)
  const d = await app.inject({
    method: 'POST',
    url: `${prefix}/outbox/drain?limit=10`,
    headers: { ...authHeader('OPERATOR') },
  });
  if (d.statusCode !== 200) throw new Error(`outbox/drain failed: ${d.statusCode} ${d.body}`);
  const drain = (d.json() as any)?.data;
  if (!drain) throw new Error(`outbox/drain missing data envelope: ${d.body}`);

  // 3) List outbox (cursor)
  const l = await app.inject({
    method: 'GET',
    url: `${prefix}/outbox?limit=10`,
    headers: { ...authHeader('OPERATOR') },
  });
  if (l.statusCode !== 200) throw new Error(`outbox list failed: ${l.statusCode} ${l.body}`);

  // 4) Optional full demo (requires MVP grants)
  const full = process.env.PARKLY_E2E_FULL === '1' || process.env.PARKLY_E2E_FULL === 'true';
  if (full) {
    const createTariff = await app.inject({
      method: 'POST',
      url: `${prefix}/tariffs`,
      headers: { ...authHeader('SUPER_ADMIN') },
      payload: {
        name: `Tariff API demo ${Date.now()}`,
        appliesTo: 'TICKET',
        vehicleType: 'CAR',
        isActive: true,
        validFrom: '2026-03-01T00:00:00.000Z',
      },
    });
    if (createTariff.statusCode !== 200)
      throw new Error(`create tariff failed: ${createTariff.statusCode} ${createTariff.body}`);
    const { tariffId } = ((createTariff.json() as any)?.data ?? {}) as any;
    if (!tariffId) throw new Error(`create tariff missing data envelope: ${createTariff.body}`);

    const addRule = await app.inject({
      method: 'POST',
      url: `${prefix}/tariffs/${tariffId}/rules`,
      headers: { ...authHeader('SUPER_ADMIN') },
      payload: { ruleType: 'FREE_MINUTES', paramJson: { minutes: 15 }, priority: 1 },
    });
    if (addRule.statusCode !== 200) throw new Error(`add rule failed: ${addRule.statusCode} ${addRule.body}`);

    const quote = await app.inject({
      method: 'POST',
      url: `${prefix}/tariffs/quote`,
      headers: { ...authHeader('OPERATOR') },
      payload: {
        vehicleType: 'CAR',
        entryTime: '2026-03-01T08:00:00.000Z',
        exitTime: '2026-03-01T09:35:00.000Z',
      },
    });
    if (quote.statusCode !== 200) throw new Error(`quote failed: ${quote.statusCode} ${quote.body}`);

    const closeShiftSeed = await app.inject({
      method: 'POST',
      url: `${prefix}/shift/demo-seed`,
      headers: { ...authHeader('SUPER_ADMIN') },
      payload: {},
    });
    if (closeShiftSeed.statusCode !== 200)
      throw new Error(`shift demo-seed failed: ${closeShiftSeed.statusCode} ${closeShiftSeed.body}`);

    const shiftCode = `SHIFT_API_${Date.now()}`.slice(0, 32);
    const idemShift = `idem_shift_${randomUUID().slice(0, 12)}`;
    const closeShiftRes = await app.inject({
      method: 'POST',
      url: `${prefix}/shift/close`,
      headers: { ...authHeader('CASHIER') },
      payload: {
        shiftCode,
        startTime: '2026-02-24T07:00:00.000Z',
        endTime: '2026-02-24T12:00:00.000Z',
        idempotencyKey: idemShift,
      },
    });
    if (closeShiftRes.statusCode !== 200)
      throw new Error(`shift close failed: ${closeShiftRes.statusCode} ${closeShiftRes.body}`);

    // idempotency hit
    const closeShiftRes2 = await app.inject({
      method: 'POST',
      url: `${prefix}/shift/close`,
      headers: { ...authHeader('CASHIER') },
      payload: {
        shiftCode,
        startTime: '2026-02-24T07:00:00.000Z',
        endTime: '2026-02-24T12:00:00.000Z',
        idempotencyKey: idemShift,
      },
    });
    if (closeShiftRes2.statusCode !== 200)
      throw new Error(`shift close #2 failed: ${closeShiftRes2.statusCode} ${closeShiftRes2.body}`);
  }

  // Print evidence
  // eslint-disable-next-line no-console
  console.log('[api-e2e] OK', {
    eventId: b1.eventId,
    outboxId: b1.outboxId,
    drain,
  });

  await app.close();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[api-e2e] FAIL', e);
  process.exitCode = 1;
});
