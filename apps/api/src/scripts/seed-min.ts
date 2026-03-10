import * as dotenv from 'dotenv';
dotenv.config();

import { runSqlFile } from './_run-sql-file';

/**
 * Seed tối thiểu để chạy test scripts + UI demo.
 * PR-03: seed_min đã chạm vào master/config tables như gate_lanes, gate_lane_devices,
 * nên phải chạy bằng admin creds thay vì parking_app.
 */
async function main() {
  const adminConfigured =
    process.env.DATABASE_URL_ADMIN ||
    process.env.DATABASE_ADMIN_HOST ||
    process.env.DATABASE_ADMIN_USER;

  console.log(`[seed-min] useAdmin=true adminConfigured=${adminConfigured ? 'YES' : 'NO'}`);

  await runSqlFile('db/seed/seed_min.sql', { useAdmin: true });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
