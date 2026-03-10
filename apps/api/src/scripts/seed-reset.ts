import * as dotenv from 'dotenv';
dotenv.config();

import { runSqlFile } from './_run-sql-file';

/**
 * Reset dữ liệu SEED_* để có thể chạy seed_big lại.
 */
async function main() {
  const adminUrl = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_ADMIN_HOST;
  console.log(`[seed-reset] useAdmin=true adminConfigured=${adminUrl ? 'YES' : 'NO'}`);

  try {
    await runSqlFile('db/seed/reset_seed.sql', { useAdmin: true });
  } catch (e: any) {
    if (e?.code === 'ER_TABLEACCESS_DENIED_ERROR' || e?.errno === 1142) {
      console.error(
        '\n[seed-reset] Permission denied. Your current DB user likely follows least-privilege and cannot DELETE.\n' +
          'Fix (DEV):\n' +
          '  Option A (recommended): set DATABASE_URL_ADMIN (or DATABASE_ADMIN_*) in .env with an admin/root user, then rerun.\n' +
          '  Option B: grant DELETE on the seed tables for your app user. See docs/RUNBOOK.md section "Seed reset permissions".\n'
      );
    }
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
