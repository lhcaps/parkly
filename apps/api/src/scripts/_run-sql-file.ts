import fs from 'node:fs';
import path from 'node:path';
// NOTE: mariadb driver is CommonJS; default import can be undefined depending on TS/ESM interop.
// Use namespace import to be safe under tsx.
import * as mariadb from 'mariadb';

type ConnConfig = {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
};

export type RunSqlOptions = {
  /**
   * Dùng credentials admin (nếu có) để chạy các script mang tính destructive như reset seed.
   * - Ưu tiên DATABASE_ADMIN_* hoặc DATABASE_URL_ADMIN
   * - Nếu không cấu hình admin creds, sẽ fallback về DATABASE_* / DATABASE_URL
   */
  useAdmin?: boolean;
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') throw new Error(`Missing env ${name}`);
  return v;
}


function stripQuotes(v: string): string {
  const s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function maskUser(u: string): string {
  return u || '(unknown)';
}

function normalizeMySqlHost(host: string): string {
  const h = host.trim();
  if (!h) return h;
  const preferLiteralLocalhost = (process.env.DB_PREFER_LITERAL_LOCALHOST ?? '').trim().toUpperCase() === 'ON';
  if (!preferLiteralLocalhost && h.toLowerCase() === 'localhost') return '127.0.0.1';
  return h;
}

function buildConnConfig(opts?: RunSqlOptions): ConnConfig {
  const useAdmin = Boolean(opts?.useAdmin);

  // =============================
  // 1) Admin creds (seed reset / destructive)
  // =============================
  if (useAdmin) {
    const ahost = process.env.DATABASE_ADMIN_HOST;
    const aportRaw = process.env.DATABASE_ADMIN_PORT;
    const auser = process.env.DATABASE_ADMIN_USER;
    const apassword = process.env.DATABASE_ADMIN_PASSWORD;
    const adatabase = process.env.DATABASE_ADMIN_NAME;

    if (ahost && auser && adatabase) {
      console.log(`[run-sql] using ADMIN creds (DATABASE_ADMIN_*): user=${maskUser(auser)} host=${ahost}:${aportRaw ?? '3306'} db=${adatabase}`);
      return {
        host: normalizeMySqlHost(ahost),
        port: aportRaw ? Number(aportRaw) : 3306,
        user: auser,
        password: apassword,
        database: adatabase,
      };
    }

    const adminUrlRaw = process.env.DATABASE_URL_ADMIN;
    const adminUrl = adminUrlRaw ? stripQuotes(adminUrlRaw) : undefined;
    if (adminUrl) {
      const u = new URL(adminUrl);
      const dbName = u.pathname.replace(/^\//, '');
      if (!dbName) throw new Error('DATABASE_URL_ADMIN is missing database name (e.g. /parking_mgmt)');
      console.log(`[run-sql] using ADMIN creds (DATABASE_URL_ADMIN): user=${maskUser(decodeURIComponent(u.username))} host=${u.hostname}:${u.port || '3306'} db=${dbName}`);
      return {
        host: normalizeMySqlHost(u.hostname),
        port: u.port ? Number(u.port) : 3306,
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: dbName,
      };
    }

    // Fallback: run bằng app creds (có thể fail permission) — log rõ để user biết.
    console.warn(
      '[run-sql] WARN: Admin DB credentials not configured (DATABASE_URL_ADMIN or DATABASE_ADMIN_*). Falling back to app credentials.\n' +
        '           If you see "DELETE command denied", set DATABASE_URL_ADMIN or grant DELETE privileges in dev.'
    );
  }

  // =============================
  // 2) App creds (theo SPEC v2.1)
  // =============================
  const host = process.env.DATABASE_HOST ?? process.env.MYSQL_HOST;
  const portRaw = process.env.DATABASE_PORT ?? process.env.MYSQL_PORT;
  const user = process.env.DATABASE_USER ?? process.env.MYSQL_USER;
  const password = process.env.DATABASE_PASSWORD ?? process.env.MYSQL_PASSWORD;
  const database = process.env.DATABASE_NAME ?? process.env.MYSQL_DB;

  if (host && user && database) {
    return { host: normalizeMySqlHost(host), port: portRaw ? Number(portRaw) : 3306, user, password, database };
  }

  // Fallback: parse DATABASE_URL (mysql://user:pass@host:port/db)
  const urlRaw = process.env.DATABASE_URL;
  const url = urlRaw ? stripQuotes(urlRaw) : undefined;
  if (!url) {
    // throw with clear message
    requiredEnv('DATABASE_HOST');
    requiredEnv('DATABASE_USER');
    requiredEnv('DATABASE_NAME');
    throw new Error('Unreachable');
  }
  const u = new URL(url);
  const dbName = u.pathname.replace(/^\//, '');
  if (!dbName) throw new Error('DATABASE_URL is missing database name (e.g. /parking_mgmt)');

  return {
    host: normalizeMySqlHost(u.hostname),
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: dbName,
  };
}

// Split SQL by semicolons, skipping ones inside quotes/backticks.
// Seed scripts trong repo được viết để tương thích với splitter này (KHÔNG dùng DELIMITER).
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = '';

  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const n = sql[i + 1];

    if (inLineComment) {
      buf += c;
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      buf += c;
      if (c === '*' && n === '/') {
        buf += n;
        i++;
        inBlockComment = false;
      }
      continue;
    }

    // start comments (only when not in quotes)
    if (!inSingle && !inDouble && !inBacktick) {
      if (c === '-' && n === '-') {
        inLineComment = true;
        buf += c;
        continue;
      }
      if (c === '#') {
        inLineComment = true;
        buf += c;
        continue;
      }
      if (c === '/' && n === '*') {
        inBlockComment = true;
        buf += c;
        continue;
      }
    }

    // toggle quotes
    if (!inDouble && !inBacktick && c === "'" && sql[i - 1] !== '\\') inSingle = !inSingle;
    else if (!inSingle && !inBacktick && c === '"' && sql[i - 1] !== '\\') inDouble = !inDouble;
    else if (!inSingle && !inDouble && c === '`') inBacktick = !inBacktick;

    if (!inSingle && !inDouble && !inBacktick && c === ';') {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
      continue;
    }

    buf += c;
  }

  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

export async function runSqlFile(relativePath: string, opts?: RunSqlOptions): Promise<void> {
  const filePath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`SQL file not found: ${filePath}`);

  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');

  function stripLeadingComments(input: string): string {
    let s = input.trim();
    // Remove leading comments only (enough to avoid "query was empty").
    // Seed scripts trong repo không dùng DELIMITER nên safe.
    while (true) {
      if (s.startsWith('--')) {
        const idx = s.indexOf('\n');
        s = (idx === -1 ? '' : s.slice(idx + 1)).trim();
        continue;
      }
      if (s.startsWith('#')) {
        const idx = s.indexOf('\n');
        s = (idx === -1 ? '' : s.slice(idx + 1)).trim();
        continue;
      }
      if (s.startsWith('/*')) {
        const end = s.indexOf('*/');
        s = (end === -1 ? '' : s.slice(end + 2)).trim();
        continue;
      }
      break;
    }
    return s;
  }

  const statements = splitSqlStatements(raw)
    .map((s) => stripLeadingComments(s))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (statements.length === 0) {
    console.log(`[run-sql] No statements in ${relativePath}`);
    return;
  }

  const cfg = buildConnConfig(opts);
  const conn = await mariadb.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    multipleStatements: true,
    allowPublicKeyRetrieval: true,
    ssl: false,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5000),
  } as any);

  try {
    console.log(`[run-sql] file=${relativePath} statements=${statements.length}`);
    for (let i = 0; i < statements.length; i++) {
      await conn.query(statements[i]);
    }
    console.log(`[run-sql] OK: ${relativePath}`);
  } finally {
    await conn.end();
  }
}
