import 'dotenv/config';
import * as mariadb from 'mariadb';

function normalizeMySqlHost(host: string): string {
  const h = host.trim();
  if (!h) return h;
  const preferLiteralLocalhost = (process.env.DB_PREFER_LITERAL_LOCALHOST ?? '').trim().toUpperCase() === 'ON';
  if (!preferLiteralLocalhost && h.toLowerCase() === 'localhost') return '127.0.0.1';
  return h;
}

function envFlag(name: string, fallback = false): boolean {
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

function buildAppConnConfig() {
  const host = process.env.DATABASE_HOST ?? process.env.MYSQL_HOST;
  const portRaw = process.env.DATABASE_PORT ?? process.env.MYSQL_PORT;
  const user = process.env.DATABASE_USER ?? process.env.MYSQL_USER;
  const password = process.env.DATABASE_PASSWORD ?? process.env.MYSQL_PASSWORD;
  const database = process.env.DATABASE_NAME ?? process.env.MYSQL_DB;

  if (host && user && database) {
    return {
      host: normalizeMySqlHost(host),
      port: portRaw ? Number(portRaw) : 3306,
      user,
      password,
      database,
    };
  }

  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('Missing DATABASE_URL or split DATABASE_* env for app probe');
  const u = new URL(stripQuotes(raw));
  return {
    host: normalizeMySqlHost(u.hostname),
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

async function main() {
  const cfg = buildAppConnConfig();
  const conn = await mariadb.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    allowPublicKeyRetrieval: true,
    ssl: false,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5000),
  } as any);

  try {
    const who = await conn.query(`SELECT CURRENT_USER() AS currentUser, USER() AS loginUser, DATABASE() AS db`);
    console.log(who?.[0] ?? null);

    try {
      const grants = await conn.query(`SHOW GRANTS`);
      console.log(
        'SHOW GRANTS:',
        (Array.isArray(grants) ? grants : []).map((row: Record<string, unknown>) => String(Object.values(row)[0] ?? '')),
      );
    } catch (e: any) {
      console.warn('SHOW GRANTS failed:', e?.message ?? e);
    }

    try {
      const probe = await conn.query(`SELECT COUNT(*) AS cnt FROM gate_passage_sessions`);
      console.log({ gate_passage_sessions_count: Number(probe?.[0]?.cnt ?? 0) });
    } catch (e: any) {
      console.warn('gate_passage_sessions probe failed:', e?.message ?? e);
    }

    const runtimeFallback = envFlag('DB_RUNTIME_FALLBACK_TO_ADMIN', process.env.NODE_ENV === 'production' ? false : true);
    console.log({
      dbRuntimeFallbackToAdmin: runtimeFallback,
      note: runtimeFallback
        ? 'Server/scripts that import src/lib/prisma.ts will run with admin DB creds in local dev.'
        : 'Runtime fallback is OFF; server/scripts should use parking_app DB creds.',
    });
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
