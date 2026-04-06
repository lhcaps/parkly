import 'dotenv/config';
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const SCRYPT_KEY_LENGTH = 64;
const HASH_PREFIX = 'scrypt';

function toBase64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function hashPassword(password: string) {
  const normalized = String(password ?? '').trim();
  if (!normalized) throw new Error('Password không được rỗng');
  const salt = toBase64Url(randomBytes(16));
  const derived = scryptSync(normalized, salt, SCRYPT_KEY_LENGTH);
  return `${HASH_PREFIX}$${salt}$${toBase64Url(derived)}`;
}

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
  const targetPassword = 'Admin@123';
  const hash = hashPassword(targetPassword);

  console.log(`Password: ${targetPassword}`);
  console.log(`Hash:    ${hash}`);
  console.log('');

  const prisma = new PrismaClient({ adapter: buildMariaDbAdapter() });

  const users = await prisma.$queryRawUnsafe<Array<{ user_id: bigint; username: string; role_code: string }>>(
    `SELECT DISTINCT u.user_id, u.username, r.role_code
     FROM users u
     JOIN user_roles ur ON u.user_id = ur.user_id
     JOIN roles r ON ur.role_id = r.role_id
     ORDER BY u.username`
  );

  if (users.length === 0) {
    console.log('Không tìm thấy user nào trong DB.');
  } else {
    for (const user of users) {
      await prisma.$executeRawUnsafe(
        `UPDATE users SET password_hash = ? WHERE user_id = ?`,
        hash,
        user.user_id.toString()
      );
      console.log(`✅ ${String(user.username).padEnd(25)} | ${user.role_code.padEnd(15)}`);
    }
  }

  console.log(`\nĐã cập nhật ${users.length} user(s) với password: ${targetPassword}`);
  await prisma.$disconnect();
}

main().catch(console.error);
