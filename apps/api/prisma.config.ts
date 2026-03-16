import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

// Nạp các biến từ file .env vào process.env
dotenv.config();

/**
 * Prisma CLI (db pull / introspection) cần quyền cao để đọc full schema.
 * Trong mô hình least-privilege, runtime dùng parking_app, còn Prisma CLI dùng parking_root.
 *
 * Quy ước:
 * - Nếu có DATABASE_ADMIN_* => build URL admin cho Prisma CLI.
 * - Nếu không có => fallback DATABASE_URL.
 */
function buildAdminUrlFromParts(): string | undefined {
  const host = process.env.DATABASE_ADMIN_HOST;
  const port = process.env.DATABASE_ADMIN_PORT;
  const user = process.env.DATABASE_ADMIN_USER;
  const pass = process.env.DATABASE_ADMIN_PASSWORD;
  const db = process.env.DATABASE_ADMIN_NAME;

  if (!host || !user || !db) return undefined;

  const u = encodeURIComponent(user);
  const p = pass ? encodeURIComponent(pass) : '';
  const auth = p ? `${u}:${p}` : u;
  const prt = port ? `:${port}` : '';

  return `mysql://${auth}@${host}${prt}/${db}?useSSL=false&allowPublicKeyRetrieval=true`;
}

const prismaCliUrl = buildAdminUrlFromParts() ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    // Prisma CLI should prefer admin URL (parking_root) when available.
    url: prismaCliUrl,
  },
});