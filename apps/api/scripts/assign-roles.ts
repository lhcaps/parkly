import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function buildMariaDbAdapter() {
  const host = process.env.DATABASE_HOST ?? process.env.MYSQL_HOST ?? '127.0.0.1';
  const port = Number(process.env.DATABASE_PORT ?? process.env.MYSQL_PORT ?? 3306);
  const user = process.env.DATABASE_USER ?? process.env.MYSQL_USER ?? 'parking_app';
  const password = process.env.DATABASE_PASSWORD ?? process.env.MYSQL_PASSWORD ?? '';
  const database = process.env.DATABASE_NAME ?? process.env.MYSQL_DB ?? 'parking_mgmt';

  return new PrismaMariaDb({
    host,
    port,
    user,
    password,
    database,
    charset: 'utf8mb4',
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
    ssl: false,
  });
}

async function main() {
  const prisma = new PrismaClient({ adapter: buildMariaDbAdapter() });

  const userRoleMap: Record<string, string> = {
    admin: 'SUPER_ADMIN',
    manager_hcm: 'MANAGER',
    manager_dn: 'MANAGER',
    manager_hn: 'MANAGER',
    cashier_hcm_01: 'CASHIER',
    cashier_hcm_02: 'CASHIER',
    cashier_dn_01: 'CASHIER',
    guard_hcm_01_1: 'GUARD',
    guard_hcm_01_2: 'GUARD',
    guard_dn_01_1: 'GUARD',
  };

  const roleRows = await prisma.$queryRawUnsafe<Array<{ role_id: bigint; role_code: string }>>(
    `SELECT role_id, role_code FROM roles`
  );
  const roleMap: Record<string, bigint> = {};
  for (const r of roleRows) roleMap[r.role_code] = r.role_id;

  let assigned = 0;
  for (const [username, roleCode] of Object.entries(userRoleMap)) {
    const userRows = await prisma.$queryRawUnsafe<Array<{ user_id: bigint }>>(
      `SELECT user_id FROM users WHERE username = ? LIMIT 1`,
      username
    );
    const roleId = roleMap[roleCode];
    if (userRows[0] && roleId) {
      await prisma.$executeRawUnsafe(
        `INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`,
        userRows[0].user_id.toString(),
        roleId.toString()
      );
      console.log(`✅ ${username.padEnd(20)} -> ${roleCode}`);
      assigned++;
    } else {
      console.log(`⚠️  ${username.padEnd(20)} -> ${roleCode} (NOT FOUND)`);
    }
  }

  console.log(`\nĐã gán role cho ${assigned} user(s).`);
  await prisma.$disconnect();
}

main().catch(console.error);
