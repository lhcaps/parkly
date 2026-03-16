import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

/**
 * Chốt ca bằng stored procedure sp_close_shift.
 */
export async function closeShift(args: {
  siteId: bigint;
  shiftCode: string;
  startTime: Date;
  endTime: Date;
  actorUserId: bigint;
}): Promise<{ shiftCode: string }> {
  await prisma.$queryRaw<any[]>(Prisma.sql`
    CALL sp_close_shift(
      ${args.siteId},
      ${args.shiftCode},
      ${args.startTime},
      ${args.endTime},
      ${args.actorUserId}
    )
  `);

  return { shiftCode: args.shiftCode };
}

/**
 * Seed nghiệp vụ tối thiểu để kiểm tra procedure chốt ca.
 */
export async function seedShiftDemoData(args: {
  siteId: bigint;
  phone?: string;
  plate?: string;
  ticketCode?: string;
  paidAt?: Date;
  amount?: number;
}): Promise<{ customerId: bigint; vehicleId: bigint; ticketId: bigint }> {
  const phone = args.phone ?? '0900000001';
  const plate = args.plate ?? '51A-999.99';
  const ticketCode = args.ticketCode ?? 'TICKET_DEMO_001';
  const paidAt = args.paidAt ?? new Date('2026-02-24T09:12:00');
  const amount = args.amount ?? 25000;

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO customers(full_name, phone, email, status)
    VALUES ('Nguyen Van A', ${phone}, 'a@example.com', 'ACTIVE')
    ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)
  `);

  const cust = await prisma.$queryRaw<{ customer_id: any }[]>(
    Prisma.sql`SELECT customer_id FROM customers WHERE phone = ${phone} LIMIT 1`
  );
  const customerId = BigInt(cust[0].customer_id);

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO vehicles(license_plate, vehicle_type, owner_customer_id)
    VALUES (${plate}, 'CAR', ${customerId})
    ON DUPLICATE KEY UPDATE vehicle_type = VALUES(vehicle_type), owner_customer_id = VALUES(owner_customer_id)
  `);

  const veh = await prisma.$queryRaw<{ vehicle_id: any }[]>(
    Prisma.sql`SELECT vehicle_id FROM vehicles WHERE license_plate = ${plate} LIMIT 1`
  );
  const vehicleId = BigInt(veh[0].vehicle_id);

  const entry = new Date('2026-02-24T07:30:00');
  const exit = new Date('2026-02-24T09:10:00');

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tickets(site_id, ticket_code, vehicle_id, credential_id, entry_time, exit_time, status)
    VALUES (${args.siteId}, ${ticketCode}, ${vehicleId}, NULL, ${entry}, ${exit}, 'CLOSED')
    ON DUPLICATE KEY UPDATE exit_time = VALUES(exit_time), status = VALUES(status)
  `);

  const t = await prisma.$queryRaw<{ ticket_id: any }[]>(
    Prisma.sql`SELECT ticket_id FROM tickets WHERE site_id = ${args.siteId} AND ticket_code = ${ticketCode} LIMIT 1`
  );
  const ticketId = BigInt(t[0].ticket_id);

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO payments(site_id, ticket_id, amount, method, status, paid_at)
    VALUES (${args.siteId}, ${ticketId}, ${amount}, 'CASH', 'PAID', ${paidAt})
    ON DUPLICATE KEY UPDATE amount = VALUES(amount), status = VALUES(status)
  `);

  return { customerId, vehicleId, ticketId };
}

export async function getLatestShiftClosure(args: { siteId: bigint; shiftCode: string }) {
  const closures = await prisma.$queryRaw<any[]>(Prisma.sql`
    SELECT *
    FROM shift_closures
    WHERE site_id = ${args.siteId} AND shift_code = ${args.shiftCode}
    ORDER BY closure_id DESC
    LIMIT 1
  `);

  if (closures.length === 0) return null;
  const closure = closures[0];
  const breakdown = await prisma.$queryRaw<any[]>(Prisma.sql`
    SELECT * FROM shift_closure_breakdowns WHERE closure_id = ${closure.closure_id}
  `);
  return { closure, breakdown };
}

export async function listShiftClosures(args: {
  siteId: bigint;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const limit = Math.min(200, Math.max(1, args.limit ?? 50));

  const rows = await prisma.$queryRaw<any[]>(Prisma.sql`
    SELECT *
    FROM shift_closures
    WHERE site_id = ${args.siteId}
      AND (${args.from ?? null} IS NULL OR created_at >= ${args.from ?? null})
      AND (${args.to ?? null} IS NULL OR created_at < ${args.to ?? null})
    ORDER BY closure_id DESC
    LIMIT ${limit}
  `);

  return rows;
}
