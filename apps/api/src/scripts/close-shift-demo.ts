import * as dotenv from 'dotenv';
dotenv.config();

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getDemoSiteCode, resolveSiteIdByCode } from './_resolve-ids';

/**
 * Demo chốt ca (stored procedure sp_close_shift).
 *
 * IMPORTANT:
 * - Script này cần quyền trên các bảng nghiệp vụ (tickets/payments/vehicles...).
 * - Nếu bạn đang dùng profile LOG-ONLY cho parking_app, hãy chạy db/scripts/grants_parking_app.sql và bật profile MVP.
 */

async function main() {
  // 0) Resolve siteId
  const siteCode = getDemoSiteCode();
  const siteId = await resolveSiteIdByCode(siteCode);
  console.log(`Resolved siteId: ${siteId} for site_code=${siteCode}`);

  // 1) Seed nghiệp vụ tối thiểu (1 payment PAID)
  //    Dùng SQL raw vì Prisma schema hiện chỉ introspect subset tables.
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO customers(full_name, phone, email, status)
    VALUES ('Nguyen Van A', '0900000001', 'a@example.com', 'ACTIVE')
    ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)
  `);

  // resolve customer_id
  const cust = await prisma.$queryRaw<{ customer_id: any }[]>(
    Prisma.sql`SELECT customer_id FROM customers WHERE phone = '0900000001' LIMIT 1`
  );
  const customerId = BigInt(cust[0].customer_id);

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO vehicles(license_plate, vehicle_type, owner_customer_id)
    VALUES ('51A-999.99', 'CAR', ${customerId})
    ON DUPLICATE KEY UPDATE vehicle_type = VALUES(vehicle_type), owner_customer_id = VALUES(owner_customer_id)
  `);

  const veh = await prisma.$queryRaw<{ vehicle_id: any }[]>(
    Prisma.sql`SELECT vehicle_id FROM vehicles WHERE license_plate = '51A-999.99' LIMIT 1`
  );
  const vehicleId = BigInt(veh[0].vehicle_id);

  // Ticket CLOSED trong time range
  const entry = new Date('2026-02-24T07:30:00');
  const exit = new Date('2026-02-24T09:10:00');

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tickets(site_id, ticket_code, vehicle_id, credential_id, entry_time, exit_time, status)
    VALUES (${siteId}, 'TICKET_DEMO_001', ${vehicleId}, NULL, ${entry}, ${exit}, 'CLOSED')
    ON DUPLICATE KEY UPDATE exit_time = VALUES(exit_time), status = VALUES(status)
  `);

  const t = await prisma.$queryRaw<{ ticket_id: any }[]>(
    Prisma.sql`SELECT ticket_id FROM tickets WHERE site_id = ${siteId} AND ticket_code = 'TICKET_DEMO_001' LIMIT 1`
  );
  const ticketId = BigInt(t[0].ticket_id);

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO payments(site_id, ticket_id, amount, method, status, paid_at)
    VALUES (${siteId}, ${ticketId}, 25000.00, 'CASH', 'PAID', '2026-02-24 09:12:00')
    ON DUPLICATE KEY UPDATE amount = VALUES(amount), status = VALUES(status)
  `);

  // 2) Call procedure
  // sp_close_shift(p_site_id, p_shift_code, p_start_time, p_end_time, p_actor_user_id)
  const baseShiftCode = (process.env.DEMO_SHIFT_CODE ?? '').trim() || 'SHIFT_2026_02_24_MORNING';
  const shiftCode = await callCloseShiftWithRetry({ siteId, baseShiftCode });

  // 3) Show snapshot
  const closures = await prisma.$queryRaw<any[]>(Prisma.sql`
    SELECT * FROM shift_closures 
    WHERE site_id = ${siteId} AND shift_code = ${shiftCode}
    ORDER BY closure_id DESC LIMIT 1
  `);

  if (closures.length > 0) {
    const closure = closures[0];
    const breakdown = await prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT * FROM shift_closure_breakdowns WHERE closure_id = ${closure.closure_id}
    `);

    console.log('closure:', closure);
    console.log('breakdown:', breakdown);
  } else {
    console.log('No closure found. Check if sp_close_shift executed correctly.');
  }
}

async function callCloseShiftWithRetry(args: {
  siteId: bigint;
  baseShiftCode: string;
}): Promise<string> {
  // Nếu user set DEMO_SHIFT_CODE thì mình vẫn retry bằng cách thêm suffix,
  // để script rerun được (tránh fail "Shift already closed").
  const maxTries = 5;
  for (let i = 0; i < maxTries; i++) {
    const suffix = i === 0 ? '' : `_R${i}`;
    const shiftCode = `${args.baseShiftCode}${suffix}`;
    try {
      const rows = await prisma.$queryRaw<any[]>(Prisma.sql`
        CALL sp_close_shift(
          ${args.siteId},
          ${shiftCode},
          '2026-02-24 07:00:00',
          '2026-02-24 12:00:00',
          1
        )
      `);
      console.log('sp_close_shift result:', rows);
      return shiftCode;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      // MySQL SIGNAL in procedure -> errno 1644 in Prisma $queryRaw
      if (msg.includes('Shift already closed') || msg.includes('Code: `1644`')) {
        if (i === maxTries - 1) throw e;
        continue;
      }
      throw e;
    }
  }
  // unreachable
  return args.baseShiftCode;
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });