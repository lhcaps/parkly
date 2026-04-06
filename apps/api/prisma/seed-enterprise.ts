import * as dotenv from 'dotenv';
dotenv.config();

import { runSqlFile } from '../src/scripts/_run-sql-file';

/**
 * Enterprise Seed — SPEC v9.2 Compatible
 *
 * Wipes all seed tables and repopulates with realistic live data:
 *   3 parking sites, 6 zones, 6 spots,
 *   10 gate devices, 4 lanes, 5 customers,
 *   4 subscriptions, 3 credentials,
 *   500 vehicles, 500 tickets, 500 payments,
 *   1000 sessions (500 ENTRY + 500 EXIT),
 *   ~20 active presence records, ~50 ALPR read events,
 *   5 open sessions (currently parked).
 *
 * Requires admin DB credentials for TRUNCATE (set DATABASE_URL_ADMIN or
 * DATABASE_ADMIN_* env vars — same as seed-reset.ts).
 */
async function main() {
  const adminConfigured =
    process.env.DATABASE_URL_ADMIN ||
    process.env.DATABASE_ADMIN_HOST ||
    process.env.DATABASE_ADMIN_USER;

  console.log('\x1b[36m[seed-enterprise]\x1b[0m Starting enterprise seed...');
  console.log(
    `\x1b[90m  adminConfigured=${adminConfigured ? '\x1b[32mYES' : '\x1b[33mNO (may fail on TRUNCATE)'}\x1b[0m`
  );

  const start = Date.now();

  await runSqlFile('prisma/seed-enterprise.sql', { useAdmin: true });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\x1b[32m✓[seed-enterprise]\x1b[0m Done in ${elapsed}s`);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);

  if (
    /ER_(TABLEACCESS_DENIED|ACCESS_DENIED|command denied)/i.test(msg) ||
    String(e).includes('1142')
  ) {
    console.error(
      '\n\x1b[31m[seed-enterprise] Permission denied on TRUNCATE.\x1b[0m\n' +
        '  Fix (DEV): set DATABASE_URL_ADMIN (or DATABASE_ADMIN_HOST/USER/PASSWORD) in .env with an admin/root user.\n' +
        '  See docs/RUNBOOK.md section "Seed reset permissions".'
    );
  } else {
    console.error('\x1b[31m[seed-enterprise] Error:\x1b[0m', e);
  }

  process.exitCode = 1;
});
