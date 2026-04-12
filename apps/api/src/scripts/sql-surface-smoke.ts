import * as dotenv from 'dotenv';
dotenv.config();

import path from 'node:path';
import fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import * as mariadb from 'mariadb';

import { prisma } from '../lib/prisma';
import type { AuthenticatedServicePrincipal } from '../modules/auth/application/auth-service';
import {
  cleanupSqlAuthSessions,
  createSqlManualReview,
  forceSqlLaneRecovery,
  getSqlSurfaceSnapshot,
  quoteSqlTicketPrice,
  revokeSqlUserSessions,
} from '../modules/system/application/sql-surface.service';

const STATE_PATH = path.resolve(process.cwd(), 'output', 'sql-surface-smoke-state.json');
const PASSWORD_HASH =
  'scrypt$IqKE8utO4vMlIyFYmg_DDQ$M0-wGGkDDBHuRbUPqX7Klz-3LNEJwIZBsX6sfZvW123pXj6A4zslCcV6TATNH9wMYgoYjxXyGj6OPe6eHPbtFQ';
const ACTIVE_GATE_SESSION_STATUSES = ['OPEN', 'WAITING_READ', 'WAITING_DECISION', 'APPROVED', 'WAITING_PAYMENT'];

type SmokeState = {
  createdAt: string;
  username: string;
  userId: string;
  siteId: string;
  siteCode: string;
  laneId: string;
  laneCode: string;
  gateCode: string;
  laneDirection: 'ENTRY' | 'EXIT';
  originalLaneStatus: string;
  activeSessionIds: string[];
  cleanupExpiredSessionId: string;
  cleanupRevokedSessionId: string;
  queueSessionId: string;
  barrierCommandId: string;
  manualReviewIds: string[];
};

type AdminConn = mariadb.Connection;

const principal: AuthenticatedServicePrincipal = {
  principalType: 'SERVICE',
  role: 'WORKER',
  actorLabel: 'SQL_SURFACE_SMOKE:WORKER',
  serviceCode: 'SQL_SURFACE_SMOKE',
  siteScopes: [],
};

function normalizeMySqlHost(host: string) {
  const trimmed = host.trim();
  if (!trimmed) return trimmed;
  const preferLiteralLocalhost = String(process.env.DB_PREFER_LITERAL_LOCALHOST ?? '').trim().toUpperCase() === 'ON';
  if (!preferLiteralLocalhost && trimmed.toLowerCase() === 'localhost') return '127.0.0.1';
  return trimmed;
}

function requiredEnv(name: string) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function sqlDateTime(value: Date) {
  return value.toISOString().slice(0, 19).replace('T', ' ');
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function asString(value: unknown) {
  return value == null ? '' : String(value);
}

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, current) => (typeof current === 'bigint' ? current.toString() : current)));
}

function assertThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function ensureStateDir() {
  await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
}

async function readStateFile() {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf8');
    return JSON.parse(raw) as SmokeState;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeStateFile(state: SmokeState) {
  await ensureStateDir();
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

async function removeStateFile() {
  await fs.rm(STATE_PATH, { force: true });
}

async function createAdminConnection(): Promise<AdminConn> {
  return mariadb.createConnection({
    host: normalizeMySqlHost(requiredEnv('DATABASE_ADMIN_HOST')),
    port: Number(process.env.DATABASE_ADMIN_PORT ?? 3306),
    user: requiredEnv('DATABASE_ADMIN_USER'),
    password: requiredEnv('DATABASE_ADMIN_PASSWORD'),
    database: requiredEnv('DATABASE_ADMIN_NAME'),
    charset: 'utf8mb4',
    allowPublicKeyRetrieval: true,
    ssl: false,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5000),
  } as any);
}

async function resolveManagerRoleId(conn: AdminConn) {
  const rows = await conn.query(`SELECT role_id AS roleId FROM roles WHERE role_code = 'MANAGER' LIMIT 1`);
  const roleId = rows[0]?.roleId;
  assertThat(roleId != null, 'MANAGER role not found');
  return asString(roleId);
}

async function pickLaneCandidate(conn: AdminConn) {
  const snapshot = await getSqlSurfaceSnapshot({ principal });

  for (const previewLane of snapshot.previews.laneHealth) {
    const rows = await conn.query(
      `
        SELECT
          gl.lane_id AS laneId,
          gl.site_id AS siteId,
          ps.site_code AS siteCode,
          gl.gate_code AS gateCode,
          gl.lane_code AS laneCode,
          gl.direction AS laneDirection,
          gl.status AS laneStatus,
          (
            SELECT COUNT(*)
            FROM gate_passage_sessions gps
            WHERE gps.lane_id = gl.lane_id
              AND gps.status IN ('OPEN', 'WAITING_READ', 'WAITING_DECISION', 'APPROVED', 'WAITING_PAYMENT')
          ) AS activeSessionCount,
          (
            SELECT COUNT(*)
            FROM gate_barrier_commands gbc
            WHERE gbc.lane_id = gl.lane_id
              AND gbc.status IN ('PENDING', 'SENT')
          ) AS pendingCommandCount
        FROM gate_lanes gl
        JOIN parking_sites ps
          ON ps.site_id = gl.site_id
        WHERE gl.lane_id = ?
        LIMIT 1
      `,
      [previewLane.laneId],
    );

    const lane = rows[0];
    if (!lane) continue;
    if (Number(lane.activeSessionCount ?? 0) > 0) continue;
    if (Number(lane.pendingCommandCount ?? 0) > 0) continue;

    return {
      laneId: asString(lane.laneId),
      siteId: asString(lane.siteId),
      siteCode: asString(lane.siteCode),
      gateCode: asString(lane.gateCode),
      laneCode: asString(lane.laneCode),
      laneDirection: asString(lane.laneDirection) as 'ENTRY' | 'EXIT',
      laneStatus: asString(lane.laneStatus),
    };
  }

  throw new Error('No safe lane candidate found inside the visible SQL surface lane preview');
}

async function insertAuthSession(conn: AdminConn, args: {
  userId: string;
  roleCode: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
  lastSeenAt?: Date | null;
  lastRefreshedAt?: Date | null;
  revokedAt?: Date | null;
  revokeReason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const sessionId = randomUUID();
  const accessTokenHash = sha256(`sql-surface-smoke:access:${sessionId}`);
  const refreshTokenHash = sha256(`sql-surface-smoke:refresh:${sessionId}`);

  await conn.query(
    `
      INSERT INTO auth_user_sessions (
        session_id,
        user_id,
        role_code,
        access_token_hash,
        refresh_token_hash,
        access_expires_at,
        refresh_expires_at,
        last_seen_at,
        last_refreshed_at,
        revoked_at,
        revoke_reason,
        last_ip_address,
        last_user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      sessionId,
      args.userId,
      args.roleCode,
      accessTokenHash,
      refreshTokenHash,
      sqlDateTime(args.accessExpiresAt),
      sqlDateTime(args.refreshExpiresAt),
      args.lastSeenAt ? sqlDateTime(args.lastSeenAt) : null,
      args.lastRefreshedAt ? sqlDateTime(args.lastRefreshedAt) : null,
      args.revokedAt ? sqlDateTime(args.revokedAt) : null,
      args.revokeReason ?? null,
      args.ipAddress ?? '127.0.0.1',
      args.userAgent ?? 'sql-surface-smoke',
    ],
  );

  return sessionId;
}

async function setupSmokeState(conn: AdminConn): Promise<SmokeState> {
  const roleId = await resolveManagerRoleId(conn);
  const lane = await pickLaneCandidate(conn);
  const username = `sql_surface_smoke_${Date.now()}`;

  const userInsert = await conn.query(
    `INSERT INTO users (username, password_hash, status) VALUES (?, ?, 'ACTIVE')`,
    [username, PASSWORD_HASH],
  );
  const userId = asString(userInsert.insertId);

  await conn.query(
    `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`,
    [userId, roleId],
  );
  await conn.query(
    `INSERT INTO user_site_scopes (user_id, site_id, scope_level) VALUES (?, ?, 'MANAGER')`,
    [userId, lane.siteId],
  );

  const now = new Date();
  const activeSessionIds = [
    await insertAuthSession(conn, {
      userId,
      roleCode: 'MANAGER',
      accessExpiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      refreshExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      lastSeenAt: now,
      lastRefreshedAt: now,
    }),
    await insertAuthSession(conn, {
      userId,
      roleCode: 'MANAGER',
      accessExpiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      refreshExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      lastSeenAt: new Date(now.getTime() - 60_000),
      lastRefreshedAt: new Date(now.getTime() - 60_000),
    }),
  ];

  const cleanupExpiredSessionId = await insertAuthSession(conn, {
    userId,
    roleCode: 'MANAGER',
    accessExpiresAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    refreshExpiresAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    lastSeenAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    lastRefreshedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
  });

  const cleanupRevokedSessionId = await insertAuthSession(conn, {
    userId,
    roleCode: 'MANAGER',
    accessExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    refreshExpiresAt: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
    lastSeenAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
    lastRefreshedAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
    revokedAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
    revokeReason: 'SQL_SURFACE_SMOKE_OLD_REVOKED',
  });

  await conn.query(`UPDATE gate_lanes SET status = 'MAINTENANCE' WHERE lane_id = ?`, [lane.laneId]);

  const queueInsert = await conn.query(
    `
      INSERT INTO gate_passage_sessions (
        site_id,
        lane_id,
        direction,
        status,
        correlation_id,
        opened_at,
        plate_compact,
        presence_active,
        review_required
      ) VALUES (?, ?, ?, 'OPEN', ?, ?, ?, 1, 0)
    `,
    [
      lane.siteId,
      lane.laneId,
      lane.laneDirection,
      `SQL_SURFACE_SMOKE:${randomUUID()}`,
      sqlDateTime(now),
      'SQLSMOKE35',
    ],
  );
  const queueSessionId = asString(queueInsert.insertId);

  const barrierInsert = await conn.query(
    `
      INSERT INTO gate_barrier_commands (
        session_id,
        site_id,
        lane_id,
        command_type,
        status,
        request_id,
        reason_code,
        issued_at
      ) VALUES (?, ?, ?, 'OPEN', 'PENDING', ?, 'SQL_SURFACE_SMOKE', ?)
    `,
    [
      queueSessionId,
      lane.siteId,
      lane.laneId,
      `SQL_SURFACE_SMOKE:${randomUUID()}`,
      sqlDateTime(now),
    ],
  );

  return {
    createdAt: now.toISOString(),
    username,
    userId,
    siteId: lane.siteId,
    siteCode: lane.siteCode,
    laneId: lane.laneId,
    laneCode: lane.laneCode,
    gateCode: lane.gateCode,
    laneDirection: lane.laneDirection,
    originalLaneStatus: lane.laneStatus,
    activeSessionIds,
    cleanupExpiredSessionId,
    cleanupRevokedSessionId,
    queueSessionId,
    barrierCommandId: asString(barrierInsert.insertId),
    manualReviewIds: [],
  };
}

async function cleanupSmokeState(conn: AdminConn, state: SmokeState | null, options?: { preserveFile?: boolean }) {
  if (!state) {
    if (!options?.preserveFile) await removeStateFile();
    return;
  }

  await conn.query(`DELETE FROM gate_manual_reviews WHERE session_id = ? OR queue_reason_code = 'SQL_SURFACE_SMOKE'`, [state.queueSessionId]);
  await conn.query(`DELETE FROM gate_barrier_commands WHERE session_id = ? OR command_id = ?`, [state.queueSessionId, state.barrierCommandId]);
  await conn.query(`DELETE FROM gate_passage_sessions WHERE session_id = ?`, [state.queueSessionId]);
  await conn.query(`UPDATE gate_lanes SET status = ? WHERE lane_id = ?`, [state.originalLaneStatus, state.laneId]);
  await conn.query(
    `DELETE FROM auth_user_sessions WHERE user_id = ? OR session_id IN (?, ?, ?, ?)`,
    [
      state.userId,
      state.activeSessionIds[0] ?? '',
      state.activeSessionIds[1] ?? '',
      state.cleanupExpiredSessionId,
      state.cleanupRevokedSessionId,
    ],
  );
  await conn.query(`DELETE FROM user_site_scopes WHERE user_id = ?`, [state.userId]);
  await conn.query(`DELETE FROM user_roles WHERE user_id = ?`, [state.userId]);
  await conn.query(`DELETE FROM users WHERE user_id = ?`, [state.userId]);

  if (!options?.preserveFile) await removeStateFile();
}

async function runFullSmoke(conn: AdminConn, state: SmokeState) {
  const summary: Record<string, unknown> = {
    state,
    checks: {},
  };

  const setupSnapshot = await getSqlSurfaceSnapshot({ principal });
  const activeSessionsVisible = setupSnapshot.previews.activeSessions.some((row) => row.userId === state.userId);
  const laneVisible = setupSnapshot.previews.laneHealth.some((row) => row.laneId === state.laneId);
  const queueVisible = setupSnapshot.previews.activeQueue.some((row) => row.sessionId === state.queueSessionId);

  assertThat(activeSessionsVisible, 'Temp auth sessions are not visible in SQL surface preview');
  assertThat(laneVisible, 'Temp lane is not visible in SQL surface preview');
  assertThat(queueVisible, 'Temp queue session is not visible in SQL surface preview');

  summary.checks = {
    previewVisible: {
      activeSessionsVisible,
      laneVisible,
      queueVisible,
    },
  };

  const cleanupResult = await cleanupSqlAuthSessions();
  summary.cleanup = cleanupResult;

  const cleanupRows = await conn.query(
    `
      SELECT session_id AS sessionId
      FROM auth_user_sessions
      WHERE session_id IN (?, ?)
    `,
    [state.cleanupExpiredSessionId, state.cleanupRevokedSessionId],
  );
  assertThat(cleanupRows.length === 0, 'Cleanup-only sessions were not deleted from auth_user_sessions');

  const revokeResult = await revokeSqlUserSessions({
    principal,
    targetUserId: state.userId,
    reason: 'SQL_SURFACE_SMOKE',
  });
  assertThat(revokeResult.revokedSessionIds.length === state.activeSessionIds.length, 'Expected both active temp sessions to be revoked');
  summary.revoke = revokeResult;

  const revokedRows = await conn.query(
    `
      SELECT session_id AS sessionId, revoked_at AS revokedAt
      FROM auth_user_sessions
      WHERE session_id IN (?, ?)
    `,
    [state.activeSessionIds[0], state.activeSessionIds[1]],
  );
  assertThat(revokedRows.every((row: any) => row.revokedAt != null), 'Revoked temp sessions are still missing revoked_at');

  const recoveryResult = await forceSqlLaneRecovery({
    principal,
    laneId: state.laneId,
  });
  assertThat(recoveryResult.after?.laneOperationalStatus === 'ACTIVE', 'Lane did not recover back to ACTIVE');
  summary.forceRecovery = recoveryResult;

  const laneRows = await conn.query(
    `
      SELECT status AS laneStatus
      FROM gate_lanes
      WHERE lane_id = ?
      LIMIT 1
    `,
    [state.laneId],
  );
  const commandRows = await conn.query(
    `
      SELECT status AS commandStatus
      FROM gate_barrier_commands
      WHERE command_id = ?
      LIMIT 1
    `,
    [state.barrierCommandId],
  );
  const queueRows = await conn.query(
    `
      SELECT review_required AS reviewRequired
      FROM gate_passage_sessions
      WHERE session_id = ?
      LIMIT 1
    `,
    [state.queueSessionId],
  );
  assertThat(asString(laneRows[0]?.laneStatus) === 'ACTIVE', 'Lane row did not switch to ACTIVE');
  assertThat(asString(commandRows[0]?.commandStatus) === 'CANCELLED', 'Barrier command did not switch to CANCELLED');
  assertThat(Number(queueRows[0]?.reviewRequired ?? 0) === 1, 'Queue session did not flip review_required to 1');

  const reviewResult = await createSqlManualReview({
    principal,
    sessionId: state.queueSessionId,
    queueReasonCode: 'SQL_SURFACE_SMOKE',
    note: 'SQL surface smoke review',
  });
  assertThat(reviewResult.openManualReviewCount >= 1, 'Manual review count did not increase');
  summary.manualReview = reviewResult;

  const reviewRows = await conn.query(
    `
      SELECT review_id AS reviewId, status AS reviewStatus
      FROM gate_manual_reviews
      WHERE session_id = ?
        AND status IN ('OPEN', 'CLAIMED')
      ORDER BY created_at DESC, review_id DESC
    `,
    [state.queueSessionId],
  );
  assertThat(reviewRows.length >= 1, 'Manual review row was not created');

  let reviewConflict = '';
  try {
    await createSqlManualReview({
      principal,
      sessionId: state.queueSessionId,
      queueReasonCode: 'SQL_SURFACE_SMOKE',
      note: 'SQL surface smoke review duplicate',
    });
  } catch (error: any) {
    reviewConflict = String(error?.message ?? error);
  }
  assertThat(reviewConflict.length > 0, 'Expected duplicate manual review to be blocked');
  summary.manualReviewConflict = reviewConflict;

  const quoteResult = await quoteSqlTicketPrice({
    principal,
    siteCode: state.siteCode,
    vehicleType: 'CAR',
    entryTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    exitTime: new Date(),
  });
  summary.quote = quoteResult;

  return jsonSafe(summary);
}

async function queryLatestManualReviewIds(conn: AdminConn, sessionId: string) {
  const rows = await conn.query(
    `
      SELECT review_id AS reviewId
      FROM gate_manual_reviews
      WHERE session_id = ?
      ORDER BY created_at DESC, review_id DESC
    `,
    [sessionId],
  );
  return rows.map((row: any) => asString(row.reviewId));
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const setupOnly = args.has('--setup-only');
  const cleanupOnly = args.has('--cleanup-only');

  const conn = await createAdminConnection();
  try {
    if (cleanupOnly) {
      const existing = await readStateFile();
      await cleanupSmokeState(conn, existing);
      console.log(JSON.stringify({ mode: 'cleanup-only', cleaned: Boolean(existing), statePath: STATE_PATH }, null, 2));
      return;
    }

    const stale = await readStateFile();
    if (stale) {
      await cleanupSmokeState(conn, stale);
    }

    const state = await setupSmokeState(conn);
    await writeStateFile(state);

    if (setupOnly) {
      console.log(JSON.stringify({ mode: 'setup-only', statePath: STATE_PATH, state: jsonSafe(state) }, null, 2));
      return;
    }

    try {
      const result = await runFullSmoke(conn, state);
      const reviewIds = await queryLatestManualReviewIds(conn, state.queueSessionId);
      state.manualReviewIds = reviewIds;
      await writeStateFile(state);
      console.log(JSON.stringify({ mode: 'full', result }, null, 2));
    } finally {
      const latest = await readStateFile();
      await cleanupSmokeState(conn, latest);
    }
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
