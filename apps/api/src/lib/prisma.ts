import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

type DbConnOptions = {
  host: string;
  port?: number;
  user: string;
  password?: string;
  database: string;
};

function normalizeMySqlHost(host: string): string {
  const h = host.trim();
  if (!h) return h;
  const preferLiteralLocalhost = (process.env.DB_PREFER_LITERAL_LOCALHOST ?? '').trim().toUpperCase() === 'ON';
  if (!preferLiteralLocalhost && h.toLowerCase() === 'localhost') return '127.0.0.1';
  return h;
}

function envFlag(name: string, fallback: boolean): boolean {
  const raw = (process.env[name] ?? '').trim().toUpperCase();
  if (!raw) return fallback;
  return ['1', 'ON', 'TRUE', 'YES'].includes(raw);
}

function stripQuotes(v: string): string {
  const s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseSplitConn(prefix: 'DATABASE' | 'DATABASE_ADMIN'): DbConnOptions | null {
  const host = process.env[`${prefix}_HOST`] ?? (prefix === 'DATABASE' ? process.env.MYSQL_HOST : undefined);
  const portRaw = process.env[`${prefix}_PORT`] ?? (prefix === 'DATABASE' ? process.env.MYSQL_PORT : undefined);
  const user = process.env[`${prefix}_USER`] ?? (prefix === 'DATABASE' ? process.env.MYSQL_USER : undefined);
  const password = process.env[`${prefix}_PASSWORD`] ?? (prefix === 'DATABASE' ? process.env.MYSQL_PASSWORD : undefined);
  const database = process.env[`${prefix}_NAME`] ?? (prefix === 'DATABASE' ? process.env.MYSQL_DB : undefined);

  if (!host || !user || !database) return null;
  return {
    host: normalizeMySqlHost(host),
    port: portRaw ? Number(portRaw) : undefined,
    user,
    password,
    database,
  };
}

function parseUrlConn(rawUrl?: string): DbConnOptions | null {
  const url = rawUrl ? stripQuotes(rawUrl) : '';
  if (!url) return null;
  const u = new URL(url);
  const proto = u.protocol.replace(':', '');
  if (proto !== 'mysql' && proto !== 'mariadb') {
    throw new Error(`Unsupported DATABASE_URL protocol: ${u.protocol}. Use mysql:// or mariadb://`);
  }
  const database = u.pathname.replace(/^\//, '');
  if (!database) throw new Error('DATABASE_URL is missing database name (e.g. /parking_mgmt).');
  return {
    host: normalizeMySqlHost(u.hostname),
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
  };
}

function buildMariaDbAdapter() {
  const connectionLimit = Number(process.env.DB_POOL_LIMIT ?? 5);
  const acquireTimeout = Number(process.env.DB_ACQUIRE_TIMEOUT_MS ?? 30_000);
  const connectTimeout = Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5_000);
  const idleTimeout = Number(process.env.DB_IDLE_TIMEOUT_S ?? 300);

  const appConn = parseSplitConn('DATABASE') ?? parseUrlConn(process.env.DATABASE_URL);
  const adminConn = parseSplitConn('DATABASE_ADMIN') ?? parseUrlConn(process.env.DATABASE_URL_ADMIN);

  const devFallbackDefault = process.env.NODE_ENV === 'production' ? false : true;
  const useAdminFallback = envFlag('DB_RUNTIME_FALLBACK_TO_ADMIN', devFallbackDefault);

  const chosen = useAdminFallback && adminConn ? adminConn : appConn ?? adminConn;
  if (!chosen) {
    throw new Error(
      'Missing database runtime configuration. Set DATABASE_* or DATABASE_URL (or DATABASE_ADMIN_* / DATABASE_URL_ADMIN for local dev fallback).'
    );
  }

  if (useAdminFallback && adminConn) {
    const adminHost = `${chosen.host}:${chosen.port ?? 3306}`;
    console.warn(`[prisma] local-dev runtime is using ADMIN DB credentials (${chosen.user}@${adminHost}) because DB_RUNTIME_FALLBACK_TO_ADMIN=ON.`);
  }

  const options: any = {
    host: chosen.host,
    port: chosen.port,
    user: chosen.user,
    password: chosen.password,
    database: chosen.database,
    connectionLimit,
    acquireTimeout,
    connectTimeout,
    idleTimeout,
    allowPublicKeyRetrieval: true,
    ssl: false,
  };
  return new PrismaMariaDb(options);
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: buildMariaDbAdapter(),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
