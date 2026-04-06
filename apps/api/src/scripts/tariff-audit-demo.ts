import * as dotenv from 'dotenv';
dotenv.config();

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getDemoSiteCode, resolveSiteIdByCode } from './_resolve-ids';

/**
 * Demo audit triggers cho tariffs/tariff_rules.
 *
 * IMPORTANT:
 * - Cần chạy migrations đến V7.
 * - Cần quyền bảng tariffs/tariff_rules/audit_logs (profile MVP trong grants_parking_app.sql).
 */

async function main() {
  // 0) Resolve siteId từ site_code
  const siteCode = getDemoSiteCode();
  const siteId = await resolveSiteIdByCode(siteCode);
  console.log(`Resolved siteId: ${siteId} for site_code=${siteCode}`);

  // set actor session variable để audit_logs có đúng người thao tác
  await prisma.$executeRaw(Prisma.sql`SET @actor_user_id = 1`);

  // 1) Insert tariff
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tariffs(site_id, name, applies_to, vehicle_type, is_active, valid_from)
    VALUES (${siteId}, 'Bảng giá demo', 'TICKET', 'CAR', 1, '2026-02-24 00:00:00')
  `);

  const t = await prisma.$queryRaw<{ tariff_id: any }[]>(
    Prisma.sql`SELECT tariff_id FROM tariffs WHERE site_id = ${siteId} AND name = 'Bảng giá demo' ORDER BY tariff_id DESC LIMIT 1`
  );
  
  if (!t[0]?.tariff_id) {
    throw new Error("Failed to retrieve created tariff_id");
  }
  const tariffId = BigInt(t[0].tariff_id);

  // 2) Insert rule
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tariff_rules(tariff_id, rule_type, param_json, priority)
    VALUES (${tariffId}, 'FREE_MINUTES', JSON_OBJECT('minutes', 15), 1)
  `);

  // 3) Update tariff (trigger UPDATE)
  await prisma.$executeRaw(Prisma.sql`
    UPDATE tariffs SET is_active = 0 WHERE tariff_id = ${tariffId}
  `);

  // 4) Read last audit rows
  const audits = await prisma.$queryRaw<any[]>(Prisma.sql`
    SELECT audit_id, site_id, actor_user_id, action, entity_table, entity_id, created_at
    FROM audit_logs
    WHERE site_id = ${siteId}
      AND entity_table IN ('tariffs', 'tariff_rules')
    ORDER BY audit_id DESC
    LIMIT 10
  `);

  console.log('Latest audits:', audits);
}

main()
  .catch((e) => {
    console.error('Error running demo:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });