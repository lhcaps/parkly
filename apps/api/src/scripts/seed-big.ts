import * as dotenv from 'dotenv';
dotenv.config();

import { runSqlFile } from './_run-sql-file';

/**
 * Seed dataset lớn để demo EXPLAIN/partitioning/reporting.
 * Khuyến nghị chạy trên DB mới migrate (không chứa dữ liệu thật).
 */
async function main() {
  await runSqlFile('db/seed/seed_big.sql', { useAdmin: true });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
