/**
 * local-db.ts — SQLite local database for Parkly Edge Node
 *
 * Stores:
 *  - Subscriptions (active plates + RFID whitelist)
 *  - Tariffs (pricing config)
 *  - Offline sessions (passage events during offline)
 *  - Outbox (pending events to sync to cloud)
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type {
  SubscriptionRecord,
  TariffRecord,
  OfflineSession,
  OutboxEvent,
} from './types.js';

let db: Database.Database | null = null;

export function initLocalDb(dbPath: string): Database.Database {
  if (db) return db;

  db = new Database(dbPath);

  // Performance tuning
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = 10000');
  db.pragma('temp_store = MEMORY');

  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      subscription_id TEXT PRIMARY KEY,
      site_id         TEXT NOT NULL,
      site_code       TEXT NOT NULL,
      vehicle_plate   TEXT NOT NULL,
      plate_compact   TEXT NOT NULL,
      rfid_uid        TEXT,
      vehicle_type    TEXT NOT NULL,
      status          TEXT NOT NULL,
      valid_from      TEXT NOT NULL,
      valid_until     TEXT NOT NULL,
      owner_name      TEXT NOT NULL,
      synced_at       TEXT NOT NULL,
      UNIQUE(site_code, plate_compact)
    );

    CREATE INDEX IF NOT EXISTS idx_subs_plate
      ON subscriptions(site_code, plate_compact);

    CREATE INDEX IF NOT EXISTS idx_subs_rfid
      ON subscriptions(site_code, rfid_uid)
      WHERE rfid_uid IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_subs_status
      ON subscriptions(site_code, status);

    CREATE TABLE IF NOT EXISTS tariffs (
      tariff_id      TEXT PRIMARY KEY,
      site_id        TEXT NOT NULL,
      site_code      TEXT NOT NULL,
      name           TEXT NOT NULL,
      applies_to     TEXT NOT NULL,
      vehicle_type   TEXT NOT NULL,
      is_active      INTEGER NOT NULL DEFAULT 1,
      base_rate      REAL NOT NULL,
      daily_cap      REAL NOT NULL,
      overnight_cap  REAL NOT NULL,
      zone_code      TEXT,
      valid_from     TEXT NOT NULL,
      synced_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tariffs_site
      ON tariffs(site_code, is_active, applies_to);

    CREATE TABLE IF NOT EXISTS offline_sessions (
      session_id       TEXT PRIMARY KEY,
      site_code        TEXT NOT NULL,
      lane_code        TEXT NOT NULL,
      direction        TEXT NOT NULL,
      vehicle_plate    TEXT,
      plate_compact    TEXT,
      rfid_uid         TEXT,
      device_code      TEXT NOT NULL,
      read_type        TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'ACTIVE',
      opened_at        TEXT NOT NULL,
      last_read_at     TEXT NOT NULL,
      closed_at        TEXT,
      barrier_decision TEXT,
      decision_reason  TEXT,
      ticket_number    TEXT,
      tariff_applied   TEXT,
      amount_charged   REAL,
      sync_status      TEXT NOT NULL DEFAULT 'PENDING',
      sync_attempts    INTEGER NOT NULL DEFAULT 0,
      sync_error       TEXT,
      created_at       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_site
      ON offline_sessions(site_code, status);

    CREATE INDEX IF NOT EXISTS idx_sessions_sync
      ON offline_sessions(sync_status, sync_attempts);

    CREATE TABLE IF NOT EXISTS outbox (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type      TEXT NOT NULL,
      payload         TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      attempts        INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      error_message   TEXT,
      status          TEXT NOT NULL DEFAULT 'PENDING'
    );

    CREATE INDEX IF NOT EXISTS idx_outbox_status
      ON outbox(status, attempts);
  `);

  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initLocalDb first.');
  return db;
}

/* ─── Subscriptions ─────────────────────────────────────────── */

export function upsertSubscriptions(subs: SubscriptionRecord[]): number {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO subscriptions
      (subscription_id, site_id, site_code, vehicle_plate, plate_compact,
       rfid_uid, vehicle_type, status, valid_from, valid_until, owner_name, synced_at)
    VALUES
      (@subscription_id, @site_id, @site_code, @vehicle_plate, @plate_compact,
       @rfid_uid, @vehicle_type, @status, @valid_from, @valid_until, @owner_name, @synced_at)
    ON CONFLICT(site_code, plate_compact) DO UPDATE SET
      status = excluded.status,
      valid_until = excluded.valid_until,
      rfid_uid = excluded.rfid_uid,
      synced_at = excluded.synced_at
  `);

  const insertMany = db.transaction((rows: SubscriptionRecord[]) => {
    let count = 0;
    for (const row of rows) { upsert.run(row); count++; }
    return count;
  });

  return insertMany(subs);
}

export function findSubscriptionByPlate(siteCode: string, plateCompact: string): SubscriptionRecord | null {
  const db = getDb();
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT * FROM subscriptions
    WHERE site_code = ?
      AND plate_compact = ?
      AND status = 'ACTIVE'
      AND valid_from <= ?
      AND valid_until > ?
    LIMIT 1
  `).get(siteCode, plateCompact.toUpperCase(), now, now) as SubscriptionRecord | null;
}

export function findSubscriptionByRfid(siteCode: string, rfidUid: string): SubscriptionRecord | null {
  const db = getDb();
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT * FROM subscriptions
    WHERE site_code = ?
      AND rfid_uid = ?
      AND status = 'ACTIVE'
      AND valid_from <= ?
      AND valid_until > ?
    LIMIT 1
  `).get(siteCode, rfidUid.toUpperCase(), now, now) as SubscriptionRecord | null;
}

export function pruneExpiredSubscriptions(siteCode: string): number {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM subscriptions
    WHERE site_code = ? AND valid_until < ?
  `).run(siteCode, new Date().toISOString());
  return result.changes;
}

export function getSubscriptionCount(siteCode: string): number {
  const db = getDb();
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM subscriptions
    WHERE site_code = ? AND status = 'ACTIVE'
  `).get(siteCode) as { cnt: number };
  return row.cnt;
}

/* ─── Tariffs ──────────────────────────────────────────────── */

export function upsertTariffs(tariffs: TariffRecord[]): number {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO tariffs
      (tariff_id, site_id, site_code, name, applies_to, vehicle_type,
       is_active, base_rate, daily_cap, overnight_cap, zone_code, valid_from, synced_at)
    VALUES
      (@tariff_id, @site_id, @site_code, @name, @applies_to, @vehicle_type,
       @is_active, @base_rate, @daily_cap, @overnight_cap, @zone_code, @valid_from, @synced_at)
    ON CONFLICT(tariff_id) DO UPDATE SET
      is_active = excluded.is_active,
      base_rate = excluded.base_rate,
      daily_cap = excluded.daily_cap,
      overnight_cap = excluded.overnight_cap,
      synced_at = excluded.synced_at
  `);

  const insertMany = db.transaction((rows: TariffRecord[]) => {
    let count = 0;
    for (const row of rows) { upsert.run(row); count++; }
    return count;
  });

  return insertMany(tariffs);
}

export function findActiveTariff(
  siteCode: string,
  vehicleType: string,
  appliesTo: 'TICKET' | 'SUBSCRIPTION' = 'TICKET',
  zoneCode: string | null = null,
): TariffRecord | null {
  const db = getDb();
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT * FROM tariffs
    WHERE site_code = ?
      AND is_active = 1
      AND applies_to = ?
      AND vehicle_type = ?
      AND valid_from <= ?
      AND (zone_code IS NULL OR zone_code = ?)
    ORDER BY zone_code DESC NULLS LAST
    LIMIT 1
  `).get(siteCode, appliesTo, vehicleType, now, zoneCode ?? null) as TariffRecord | null;
}

/* ─── Offline Sessions ──────────────────────────────────────── */

export function createOfflineSession(
  data: Omit<OfflineSession, 'session_id' | 'status' | 'sync_status' | 'sync_attempts' | 'sync_error' | 'created_at'>,
): OfflineSession {
  const db = getDb();
  const session: OfflineSession = {
    session_id: randomUUID(),
    status: 'ACTIVE',
    sync_status: 'PENDING',
    sync_attempts: 0,
    sync_error: null,
    created_at: new Date().toISOString(),
    ...data,
  };

  db.prepare(`
    INSERT INTO offline_sessions(
      session_id, site_code, lane_code, direction,
      vehicle_plate, plate_compact, rfid_uid,
      device_code, read_type, status,
      opened_at, last_read_at, closed_at,
      barrier_decision, decision_reason,
      ticket_number, tariff_applied, amount_charged,
      sync_status, sync_attempts, sync_error, created_at
    ) VALUES (
      @session_id, @site_code, @lane_code, @direction,
      @vehicle_plate, @plate_compact, @rfid_uid,
      @device_code, @read_type, @status,
      @opened_at, @last_read_at, @closed_at,
      @barrier_decision, @decision_reason,
      @ticket_number, @tariff_applied, @amount_charged,
      @sync_status, @sync_attempts, @sync_error, @created_at
    )
  `).run(session);

  return session;
}

export function findActiveSessionByLane(
  siteCode: string,
  laneCode: string,
  windowSeconds = 120,
): OfflineSession | null {
  const db = getDb();
  const cutoff = new Date(Date.now() - windowSeconds * 1000).toISOString();
  return db.prepare(`
    SELECT * FROM offline_sessions
    WHERE site_code = ?
      AND lane_code = ?
      AND status = 'ACTIVE'
      AND opened_at >= ?
    ORDER BY opened_at DESC
    LIMIT 1
  `).get(siteCode, laneCode, cutoff) as OfflineSession | null;
}

export function appendToSession(sessionId: string, data: Partial<OfflineSession>): void {
  const db = getDb();
  const fields = Object.keys(data)
    .map((k) => `${k} = @${k}`)
    .join(', ');

  db.prepare(`
    UPDATE offline_sessions
    SET ${fields}, last_read_at = @last_read_at
    WHERE session_id = @session_id
  `).run({ ...data, session_id: sessionId, last_read_at: new Date().toISOString() });
}

export function closeSession(
  sessionId: string,
  decision: 'OPEN' | 'REJECT' | 'REVIEW',
  reason: string,
  ticketNumber?: string,
  tariffApplied?: string,
  amountCharged?: number,
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE offline_sessions
    SET status = 'COMPLETED',
        closed_at = ?,
        barrier_decision = ?,
        decision_reason = ?,
        ticket_number = ?,
        tariff_applied = ?,
        amount_charged = ?,
        last_read_at = ?
    WHERE session_id = ?
  `).run(now, decision, reason, ticketNumber ?? null, tariffApplied ?? null, amountCharged ?? null, now, sessionId);
}

export function timeoutStaleSessions(windowSeconds = 300): number {
  const db = getDb();
  const cutoff = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const result = db.prepare(`
    UPDATE offline_sessions
    SET status = 'TIMEOUT'
    WHERE status = 'ACTIVE' AND opened_at < ?
  `).run(cutoff);
  return result.changes;
}

export function getSessionsForSync(limit = 100): OfflineSession[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM offline_sessions
    WHERE sync_status = 'PENDING'
    ORDER BY created_at ASC
    LIMIT ?
  `).all(limit) as OfflineSession[];
}

export function markSessionSyncing(sessionId: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE offline_sessions
    SET sync_status = 'SYNCING'
    WHERE session_id = ?
  `).run(sessionId);
}

export function markSessionSynced(sessionId: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE offline_sessions
    SET sync_status = 'SYNCED'
    WHERE session_id = ?
  `).run(sessionId);
}

export function markSessionSyncFailed(sessionId: string, error: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE offline_sessions
    SET sync_status = 'FAILED',
        sync_attempts = sync_attempts + 1,
        sync_error = ?
    WHERE session_id = ?
  `).run(error, sessionId);
}

/* ─── Outbox ────────────────────────────────────────────────── */

export function enqueueEvent(eventType: string, payload: unknown): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO outbox(event_type, payload, created_at, attempts, status)
    VALUES (?, ?, ?, 0, 'PENDING')
  `).run(eventType, JSON.stringify(payload), new Date().toISOString());
}

export function getPendingOutboxEvents(limit = 50): OutboxEvent[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM outbox
    WHERE status IN ('PENDING', 'FAILED')
      AND attempts < 5
    ORDER BY created_at ASC
    LIMIT ?
  `).all(limit) as OutboxEvent[];
}

export function markOutboxSent(id: number): void {
  const db = getDb();
  db.prepare(`UPDATE outbox SET status = 'SENT' WHERE id = ?`).run(id);
}

export function markOutboxFailed(id: number, error: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE outbox
    SET status = CASE WHEN attempts >= 4 THEN 'FAILED' ELSE 'PENDING' END,
        attempts = attempts + 1,
        last_attempt_at = ?,
        error_message = ?
    WHERE id = ?
  `).run(new Date().toISOString(), error, id);
}
