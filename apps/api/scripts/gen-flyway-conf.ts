import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";

/**
 * Generate db/flyway.conf from .env / environment variables.
 *
 * Priority (highest -> lowest):
 * 1) FLYWAY_URL (must start with "jdbc:")
 * 2) DATABASE_ADMIN_* (split vars)
 * 3) DATABASE_URL_ADMIN (mysql://user:pass@host:port/db)
 * 4) DATABASE_* (fallback, for local convenience)
 *
 * Always writes a JDBC URL (jdbc:mysql://...). If it cannot, it fails fast.
 */

function trimQuotes(v: string | undefined | null): string | undefined {
  if (v == null) return undefined;
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function getEnv(key: string): string | undefined {
  return trimQuotes(process.env[key]);
}

function ensureJdbc(url: string): boolean {
  return /^jdbc:(mysql|mariadb):\/\//i.test(url);
}

function loadDotEnv(root: string) {
  const envPath = path.join(root, ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

function parseMysqlUrl(raw: string): { user: string; pass: string; host: string; port: number; db: string } {
  const s = trimQuotes(raw) ?? "";

  // Prefer WHATWG URL (Node handles mysql:// well)
  try {
    const u = new URL(s);
    const user = decodeURIComponent(u.username || "");
    const pass = decodeURIComponent(u.password || "");
    const host = u.hostname || "localhost";
    const port = u.port ? Number(u.port) : 3306;
    const db = (u.pathname || "").replace(/^\//, "");
    if (!user) throw new Error("missing username");
    if (!db) throw new Error("missing database");
    return { user, pass, host, port, db };
  } catch {
    // Fallback regex
    const re = /^mysql:\/\/(?<user>[^:\/\?#]+)(:(?<pass>[^@\/?#]*))?@(?<host>[^:\/?#]+)(:(?<port>\d+))?\/(?<db>[^\/?#]+)$/i;
    const m = s.match(re);
    if (!m?.groups?.user || !m.groups.host || !m.groups.db) {
      throw new Error(`DATABASE_URL_ADMIN invalid. Expected mysql://user:pass@host:port/db. Current: ${s}`);
    }
    return {
      user: decodeURIComponent(m.groups.user),
      pass: decodeURIComponent(m.groups.pass ?? ""),
      host: m.groups.host,
      port: m.groups.port ? Number(m.groups.port) : 3306,
      db: m.groups.db,
    };
  }
}

function main() {
  const root = path.resolve(__dirname, "..");
  loadDotEnv(root);

  // Params can be overridden by env
  const jdbcParams = getEnv("FLYWAY_JDBC_PARAMS") || "useSSL=false&allowPublicKeyRetrieval=true";

  // 1) Accept explicit JDBC URL
  const envFlywayUrl = getEnv("FLYWAY_URL");
  const flywayUrlFromEnv = envFlywayUrl && ensureJdbc(envFlywayUrl) ? envFlywayUrl : undefined;

  // 2) split admin
  let dbHost = getEnv("DATABASE_ADMIN_HOST");
  let dbPort = getEnv("DATABASE_ADMIN_PORT");
  let dbUser = getEnv("DATABASE_ADMIN_USER");
  let dbPass = getEnv("DATABASE_ADMIN_PASSWORD");
  let dbName = getEnv("DATABASE_ADMIN_NAME");

  // 3) URL admin
  if (!dbHost || !dbUser || !dbName) {
    const adminUrl = getEnv("DATABASE_URL_ADMIN");
    if (adminUrl) {
      const p = parseMysqlUrl(adminUrl);
      dbHost = dbHost || p.host;
      dbPort = dbPort || String(p.port);
      dbUser = dbUser || p.user;
      dbPass = dbPass ?? p.pass;
      dbName = dbName || p.db;
    }
  }

  // 4) fallback local vars
  dbHost = dbHost || getEnv("DATABASE_HOST") || "localhost";
  dbPort = dbPort || getEnv("DATABASE_PORT") || "3306";
  dbName = dbName || getEnv("DATABASE_NAME") || "parking_mgmt";

  const flywayUser = getEnv("FLYWAY_USER") || dbUser;
  const flywayPass = getEnv("FLYWAY_PASSWORD") ?? dbPass ?? "";

  if (!flywayUrlFromEnv) {
    if (!flywayUser) {
      throw new Error(
        "Missing admin DB user. Set DATABASE_URL_ADMIN or DATABASE_ADMIN_USER (or FLYWAY_USER)."
      );
    }
  }

  const jdbcBase = `jdbc:mysql://${dbHost}:${Number(dbPort)}/${dbName}`;
  const finalFlywayUrl = flywayUrlFromEnv || `${jdbcBase}?${jdbcParams}`;

  if (!ensureJdbc(finalFlywayUrl)) {
    throw new Error(`flyway.url must be JDBC (jdbc:mysql://...). Got: ${finalFlywayUrl}`);
  }

  const outPath = path.join(root, "db", "flyway.conf");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const content = [
    `flyway.url=${finalFlywayUrl}`,
    `flyway.user=${flywayUser || ""}`,
    `flyway.password=${flywayPass}`,
    "flyway.locations=filesystem:db/migrations",
    "flyway.baselineOnMigrate=true",
    "flyway.validateOnMigrate=true",
    "",
  ].join("\n");

  fs.writeFileSync(outPath, content, "utf8");
  console.log(`[OK] Generated db/flyway.conf (user=${flywayUser || ""})`);
}

main();
