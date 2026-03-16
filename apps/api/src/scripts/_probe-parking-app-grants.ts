import 'dotenv/config';
import * as mariadb from 'mariadb';

type ProbeResult = {
  ok: boolean;
  currentUser?: string;
  grants: string[];
  missing: string[];
  note?: string;
};

function stripQuotes(v: string): string {
  const s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function normalizeMySqlHost(host: string): string {
  const h = host.trim();
  if (!h) return h;
  const preferLiteralLocalhost = (process.env.DB_PREFER_LITERAL_LOCALHOST ?? '').trim().toUpperCase() === 'ON';
  if (!preferLiteralLocalhost && h.toLowerCase() === 'localhost') return '127.0.0.1';
  return h;
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

function canonicalizeGrant(line: string): string {
  return line.replace(/`/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function hasPrivilege(grants: string[], tableRef: string, needed: string[]): boolean {
  const wanted = tableRef.toUpperCase();
  for (const raw of grants) {
    const g = canonicalizeGrant(raw);
    if (!g.includes(` ON ${wanted} TO `)) continue;
    if (g.includes('ALL PRIVILEGES')) return true;
    const beforeOn = g.split(' ON ')[0] ?? '';
    const privPart = beforeOn.replace(/^GRANT\s+/, '');
    const privs = privPart.split(',').map((x) => x.trim());
    if (needed.every((p) => privs.includes(p.toUpperCase()))) return true;
  }
  return false;
}

export async function probeParkingAppGrants(): Promise<ProbeResult> {
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
    const who = await conn.query(`SELECT CURRENT_USER() AS currentUser`);
    const currentUser = Array.isArray(who) ? who?.[0]?.currentUser : undefined;
    const rows = await conn.query(`SHOW GRANTS`);
    const grants = (Array.isArray(rows) ? rows : [])
      .map((row: Record<string, unknown>) => String(Object.values(row)[0] ?? '').trim())
      .filter(Boolean);

    const requirements: Array<{ table: string; needed: string[] }> = [
      { table: 'PARKING_MGMT.PARKING_SITES', needed: ['SELECT'] },
      { table: 'PARKING_MGMT.GATE_DEVICES', needed: ['SELECT'] },
      { table: 'PARKING_MGMT.GATE_EVENTS', needed: ['SELECT', 'INSERT'] },
      { table: 'PARKING_MGMT.AUDIT_LOGS', needed: ['SELECT', 'INSERT'] },
      { table: 'PARKING_MGMT.GATE_EVENT_OUTBOX', needed: ['SELECT', 'INSERT', 'UPDATE'] },
      { table: 'PARKING_MGMT.GATE_LANES', needed: ['SELECT'] },
      { table: 'PARKING_MGMT.GATE_LANE_DEVICES', needed: ['SELECT'] },
      { table: 'PARKING_MGMT.GATE_PASSAGE_SESSIONS', needed: ['SELECT', 'INSERT', 'UPDATE'] },
      { table: 'PARKING_MGMT.GATE_READ_EVENTS', needed: ['SELECT', 'INSERT', 'UPDATE'] },
      { table: 'PARKING_MGMT.GATE_DECISIONS', needed: ['SELECT', 'INSERT', 'UPDATE'] },
      { table: 'PARKING_MGMT.GATE_BARRIER_COMMANDS', needed: ['SELECT', 'INSERT', 'UPDATE'] },
      { table: 'PARKING_MGMT.GATE_MANUAL_REVIEWS', needed: ['SELECT', 'INSERT', 'UPDATE'] },
      { table: 'PARKING_MGMT.DEVICE_HEARTBEATS', needed: ['SELECT', 'INSERT', 'UPDATE'] },
      { table: 'PARKING_MGMT.GATE_INCIDENTS', needed: ['SELECT', 'INSERT', 'UPDATE'] },
      { table: 'PARKING_MGMT.V_GATE_LANE_DEVICE_MAP', needed: ['SELECT'] },
    ];

    const missing = requirements
      .filter((r) => !hasPrivilege(grants, r.table, r.needed))
      .map((r) => `${r.table} [${r.needed.join(', ')}]`);

    return {
      ok: missing.length === 0,
      currentUser,
      grants,
      missing,
      note: missing.length === 0 ? 'parking_app grants look sufficient for gate v4 + e2e.' : 'parking_app grants still missing.',
    };
  } finally {
    await conn.end();
  }
}
