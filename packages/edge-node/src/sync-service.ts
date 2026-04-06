/**
 * sync-service.ts — Cloud synchronization for Parkly Edge Node
 *
 * Responsibilities:
 *  1. Pull subscriptions + tariffs from cloud every EDGE_SYNC_INTERVAL_MS
 *  2. Push offline sessions to cloud via bulk-sync endpoint
 *  3. Handle connectivity monitoring
 */

import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'node:crypto';
import type { EdgeNodeConfig } from './types.js';
import {
  upsertSubscriptions,
  upsertTariffs,
  pruneExpiredSubscriptions,
  getSessionsForSync,
  markSessionSyncing,
  markSessionSynced,
  markSessionSyncFailed,
  getPendingOutboxEvents,
  markOutboxSent,
  markOutboxFailed,
  enqueueEvent,
  getSubscriptionCount,
} from './local-db.js';
import type { BulkSyncPayload } from './types.js';

export type ConnectivityState = 'ONLINE' | 'OFFLINE' | 'DEGRADED';

export type SyncHealth = {
  state: ConnectivityState;
  lastSyncAt: string | null;
  lastSyncResult: 'success' | 'failed' | null;
  lastError: string | null;
  pendingSessionCount: number;
  subscriptionCount: number;
  consecutiveFailures: number;
};

type SyncServiceDeps = {
  config: EdgeNodeConfig;
  onConnectivityChange?: (state: ConnectivityState) => void;
};

export class SyncService {
  private readonly http: AxiosInstance;
  private readonly config: EdgeNodeConfig;
  private readonly onConnectivityChange?: (state: ConnectivityState) => void;

  private health: SyncHealth = {
    state: 'OFFLINE',
    lastSyncAt: null,
    lastSyncResult: null,
    lastError: null,
    pendingSessionCount: 0,
    subscriptionCount: 0,
    consecutiveFailures: 0,
  };

  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private connectivityCheckTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(deps: SyncServiceDeps) {
    this.config = deps.config;
    this.onConnectivityChange = deps.onConnectivityChange;

    this.http = axios.create({
      baseURL: deps.config.EDGE_CLOUD_API_URL,
      timeout: 15_000,
      headers: {
        'X-Api-Key': deps.config.EDGE_CLOUD_API_KEY,
        'X-Edge-Node-Id': deps.config.EDGE_NODE_ID,
        'Content-Type': 'application/json',
      },
    });
  }

  /* ─── Health recording ────────────────────────────────────── */

  private recordSuccess() {
    this.health.lastSyncAt = new Date().toISOString();
    this.health.lastSyncResult = 'success';
    this.health.lastError = null;
    this.health.consecutiveFailures = 0;
  }

  private recordFailure(error: string) {
    this.health.lastSyncAt = new Date().toISOString();
    this.health.lastSyncResult = 'failed';
    this.health.lastError = error;
    this.health.consecutiveFailures++;
    if (this.health.consecutiveFailures >= 5) {
      this.health.state = 'DEGRADED';
      this.onConnectivityChange?.('DEGRADED');
    }
  }

  /* ─── Lifecycle ───────────────────────────────────────────── */

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Initial sync
    this.pullData().catch((err) => {
      console.error('[edge-sync] Initial pull failed:', err);
    });

    // Periodic pull (download subscriptions + tariffs)
    this.syncTimer = setInterval(() => {
      this.pullData().catch((err) => {
        console.error('[edge-sync] Periodic pull failed:', err);
      });
    }, this.config.EDGE_SYNC_INTERVAL_MS);

    // Periodic push (upload offline sessions + outbox events)
    setInterval(() => {
      this.pushData().catch((err) => {
        console.error('[edge-sync] Push failed:', err);
      });
    }, 60_000); // push every minute

    // Connectivity health check every 30s
    this.connectivityCheckTimer = setInterval(() => {
      this.checkConnectivity().catch(console.error);
    }, 30_000);
  }

  stop() {
    this.isRunning = false;
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.connectivityCheckTimer) clearInterval(this.connectivityCheckTimer);
  }

  /* ─── Data Pull (Cloud → Edge) ────────────────────────────── */

  async pullData(): Promise<void> {
    console.log('[edge-sync] Pulling data from cloud...');

    const results = await Promise.allSettled([
      this.pullSubscriptions(),
      this.pullTariffs(),
    ]);

    const failures = results.filter((r) => {
      if (r.status === 'rejected') return true;
      return !(r as PromiseFulfilledResult<boolean>).value;
    });
    if (failures.length === 0) {
      this.recordSuccess();
    } else {
      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => (r as PromiseRejectedResult).reason?.message ?? 'unknown');
      this.recordFailure(errors.join('; '));
    }
  }

  private async pullSubscriptions(): Promise<boolean> {
    try {
      const response = await this.http.get('/api/admin/subscriptions', {
        params: {
          siteCode: this.config.EDGE_SITE_CODE,
          status: 'ACTIVE',
          take: 10_000,
        },
      });

      const rows = response.data?.data ?? response.data ?? [];

      // Transform cloud format → edge format
      const subs = rows.map((r: any) => ({
        subscription_id: String(r.subscriptionId ?? r.subscription_id),
        site_id: String(r.siteId ?? r.site_id),
        site_code: this.config.EDGE_SITE_CODE,
        vehicle_plate: String(r.vehiclePlate ?? r.vehicle_plate ?? ''),
        plate_compact: String(r.plateCompact ?? r.plate_compact ?? '').toUpperCase(),
        rfid_uid: r.rfidUid ?? r.rfid_uid ?? null,
        vehicle_type: (r.vehicleType ?? r.vehicle_type ?? 'CAR').toUpperCase(),
        status: String(r.status ?? 'ACTIVE').toUpperCase(),
        valid_from: r.validFrom ?? r.valid_from ?? new Date().toISOString(),
        valid_until: r.validUntil ?? r.valid_until ?? new Date(Date.now() + 86400_000).toISOString(),
        owner_name: String(r.ownerName ?? r.owner_name ?? 'Unknown'),
        synced_at: new Date().toISOString(),
      }));

      upsertSubscriptions(subs);

      // Prune expired
      pruneExpiredSubscriptions(this.config.EDGE_SITE_CODE);

      const count = getSubscriptionCount(this.config.EDGE_SITE_CODE);
      console.log(`[edge-sync] Subscriptions synced: ${subs.length} active=${count}`);

      return true;
    } catch (err) {
      console.error('[edge-sync] Failed to pull subscriptions:', err);
      return false;
    }
  }

  private async pullTariffs(): Promise<boolean> {
    try {
      const response = await this.http.get('/api/tariffs', {
        params: {
          siteCode: this.config.EDGE_SITE_CODE,
          isActive: true,
          take: 1000,
        },
      });

      const rows = response.data?.data ?? response.data ?? [];

      const tariffs = rows.map((r: any) => ({
        tariff_id: String(r.tariffId ?? r.tariff_id),
        site_id: String(r.siteId ?? r.site_id),
        site_code: this.config.EDGE_SITE_CODE,
        name: String(r.name ?? ''),
        applies_to: String(r.appliesTo ?? r.applies_to ?? 'TICKET').toUpperCase(),
        vehicle_type: String(r.vehicleType ?? r.vehicle_type ?? 'CAR').toUpperCase(),
        is_active: r.isActive ?? r.is_active ?? true,
        base_rate: Number(r.baseRate ?? r.base_rate ?? r.hourly_rate ?? r.hourlyRate ?? 3000),
        daily_cap: Number(r.dailyCap ?? r.daily_cap ?? 50000),
        overnight_cap: Number(r.overnightCap ?? r.overnight_cap ?? 25000),
        zone_code: r.zoneCode ?? r.zone_code ?? null,
        valid_from: r.validFrom ?? r.valid_from ?? new Date().toISOString(),
        synced_at: new Date().toISOString(),
      }));

      upsertTariffs(tariffs);
      console.log(`[edge-sync] Tariffs synced: ${tariffs.length}`);

      return true;
    } catch (err) {
      console.error('[edge-sync] Failed to pull tariffs:', err);
      return false;
    }
  }

  /* ─── Data Push (Edge → Cloud) ────────────────────────────── */

  async pushData(): Promise<void> {
    if (this.health.state === 'OFFLINE') {
      console.log('[edge-sync] Skipping push — offline');
      return;
    }

    // Push offline sessions
    await this.pushSessions();

    // Push outbox events
    await this.pushOutbox();
  }

  private async pushSessions(): Promise<void> {
    const sessions = getSessionsForSync(100);
    if (sessions.length === 0) return;

    const payload: BulkSyncPayload = {
      edgeNodeId: this.config.EDGE_NODE_ID,
      siteCode: this.config.EDGE_SITE_CODE,
      sessions: sessions.map((s) => ({
        localSessionId: s.session_id,
        siteCode: s.site_code,
        laneCode: s.lane_code,
        direction: s.direction as 'ENTRY' | 'EXIT',
        vehiclePlate: s.vehicle_plate,
        plateCompact: s.plate_compact,
        rfidUid: s.rfid_uid,
        deviceCode: s.device_code,
        readType: s.read_type as 'ALPR' | 'RFID' | 'SENSOR',
        status: s.status as 'ACTIVE' | 'COMPLETED' | 'TIMEOUT',
        openedAt: s.opened_at,
        lastReadAt: s.last_read_at,
        closedAt: s.closed_at,
        barrierDecision: s.barrier_decision,
        decisionReason: s.decision_reason,
        ticketNumber: s.ticket_number,
        tariffApplied: s.tariff_applied,
        amountCharged: s.amount_charged,
      })),
    };

    for (const session of sessions) {
      markSessionSyncing(session.session_id);
    }

    try {
      await this.http.post('/api/edge/sessions/bulk-sync', payload);

      for (const session of sessions) {
        markSessionSynced(session.session_id);
        // Enqueue outbox event
        enqueueEvent('SESSION_SYNCED', { sessionId: session.session_id, syncedAt: new Date().toISOString() });
      }

      console.log(`[edge-sync] Pushed ${sessions.length} sessions to cloud`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      for (const session of sessions) {
        markSessionSyncFailed(session.session_id, errorMsg);
      }
      console.error(`[edge-sync] Failed to push sessions:`, errorMsg);
    }
  }

  private async pushOutbox(): Promise<void> {
    const events = getPendingOutboxEvents(50);
    if (events.length === 0) return;

    for (const event of events) {
      try {
        const payload = JSON.parse(event.payload);
        await this.http.post(`/api/edge/outbox/${event.event_type}`, payload);
        markOutboxSent(event.id);
        console.log(`[edge-sync] Outbox event ${event.id} sent: ${event.event_type}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        markOutboxFailed(event.id, errorMsg);
        console.warn(`[edge-sync] Outbox event ${event.id} failed: ${errorMsg}`);
      }
    }
  }

  /* ─── Connectivity ────────────────────────────────────────── */

  async checkConnectivity(): Promise<ConnectivityState> {
    try {
      const response = await this.http.get('/api/health', { timeout: 5_000 });
      const isHealthy = response.status === 200;

      if (isHealthy && this.health.state !== 'ONLINE') {
        this.health.state = 'ONLINE';
        this.onConnectivityChange?.('ONLINE');
        console.log('[edge-sync] Cloud connectivity: ONLINE');
      }

      return this.health.state;
    } catch {
      if (this.health.state !== 'OFFLINE') {
        this.health.state = 'OFFLINE';
        this.onConnectivityChange?.('OFFLINE');
        console.warn('[edge-sync] Cloud connectivity: OFFLINE — entering offline mode');
      }
      return 'OFFLINE';
    }
  }

  isOnline(): boolean {
    return this.health.state !== 'OFFLINE';
  }

  getHealth(): SyncHealth {
    return {
      ...this.health,
      pendingSessionCount: getSessionsForSync(1000).length,
    };
  }
}
