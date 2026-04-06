import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER ?? 'parking_app',
    password: process.env.DATABASE_PASSWORD ?? '',
    database: process.env.DATABASE_NAME ?? 'parking_mgmt',
    charset: 'utf8mb4',
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
    ssl: false,
  })
});

async function main() {
  // 1. Check raw DB state
  const allRoles = await prisma.$queryRawUnsafe<Array<{ role_id: bigint; role_code: string }>>(
    `SELECT role_id, role_code FROM roles ORDER BY role_id`
  );
  console.log('All roles:', allRoles);

  const adminRoles = await prisma.$queryRawUnsafe<Array<{ user_id: bigint; username: string; role_code: string }>>(
    `SELECT u.user_id, u.username, r.role_code
     FROM users u
     JOIN user_roles ur ON u.user_id = ur.user_id
     JOIN roles r ON ur.role_id = r.role_id
     WHERE u.username = 'admin'`
  );
  console.log('Admin role assignments (JOIN):', adminRoles);

  // 2. Check user_roles table directly
  const userRolesRaw = await prisma.$queryRawUnsafe<Array<{ user_id: bigint; role_id: bigint }>>(
    `SELECT ur.user_id, ur.role_id
     FROM user_roles ur
     JOIN users u ON u.user_id = ur.user_id
     WHERE u.username = 'admin'`
  );
  console.log('Admin user_roles rows:', userRolesRaw);

  // 3. Check all users + roles
  const allUserRoles = await prisma.$queryRawUnsafe<Array<{ username: string; role_code: string }>>(
    `SELECT u.username, r.role_code
     FROM users u
     JOIN user_roles ur ON u.user_id = ur.user_id
     JOIN roles r ON ur.role_id = r.role_id
     ORDER BY u.username`
  );
  console.log('\nAll user-role assignments:');
  for (const row of allUserRoles) {
    console.log(`  ${row.username} -> ${row.role_code}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
