/**
 * types.ts — Shared types and Zod schemas for Parkly Edge Node
 */

import { z } from 'zod';

/* ─── Configuration ─────────────────────────────────────────── */

export const EdgeNodeConfigSchema = z.object({
  EDGE_NODE_ID: z.string().min(1),
  EDGE_SITE_CODE: z.string().min(1),
  EDGE_CLOUD_API_URL: z.string().url(),
  EDGE_CLOUD_API_KEY: z.string().min(1),
  EDGE_SYNC_INTERVAL_MS: z.number().int().positive().default(300_000),   // 5 min
  EDGE_OFFLINE_SESSION_TTL_HOURS: z.number().int().positive().default(24),
  EDGE_SQLITE_PATH: z.string().default('./parkly-edge.db'),
  EDGE_PORT: z.number().int().positive().default(8080),
  EDGE_LAN_SUBNET: z.string().default('192.168.1.0/24'),
  EDGE_BARRIER_ENDPOINT: z.string().default('http://192.168.1.100:9090/command'),
  EDGE_PRINTER_ENDPOINT: z.string().default('http://192.168.1.101:9091/print'),
  EDGE_MIN_HEALTHY_SUBSCRIPTIONS: z.number().int().min(0).default(5),
});

export type EdgeNodeConfig = z.infer<typeof EdgeNodeConfigSchema>;

/* ─── Local DB Models ──────────────────────────────────────── */

export type SubscriptionRecord = {
  subscription_id: string;
  site_id: string;
  site_code: string;
  vehicle_plate: string;
  plate_compact: string;
  rfid_uid: string | null;
  vehicle_type: 'MOTORBIKE' | 'CAR' | 'TRUCK';
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
  valid_from: string;   // ISO8601
  valid_until: string;  // ISO8601
  owner_name: string;
  synced_at: string;    // ISO8601 when downloaded from cloud
};

export type TariffRecord = {
  tariff_id: string;
  site_id: string;
  site_code: string;
  name: string;
  applies_to: 'TICKET' | 'SUBSCRIPTION';
  vehicle_type: 'MOTORBIKE' | 'CAR' | 'TRUCK';
  is_active: boolean;
  base_rate: number;    // VND per minute
  daily_cap: number;    // VND
  overnight_cap: number; // VND
  zone_code: string | null;
  valid_from: string;   // ISO8601
  synced_at: string;    // ISO8601
};

export type OfflineSession = {
  session_id: string;       // UUID generated locally
  site_code: string;
  lane_code: string;
  direction: 'ENTRY' | 'EXIT';
  vehicle_plate: string | null;
  plate_compact: string | null;
  rfid_uid: string | null;
  device_code: string;
  read_type: 'ALPR' | 'RFID' | 'SENSOR';
  status: 'ACTIVE' | 'COMPLETED' | 'SYNCED' | 'TIMEOUT';
  opened_at: string;        // ISO8601
  last_read_at: string;     // ISO8601
  closed_at: string | null; // ISO8601
  barrier_decision: 'OPEN' | 'REJECT' | 'REVIEW' | null;
  decision_reason: string | null;
  ticket_number: string | null;
  tariff_applied: string | null;
  amount_charged: number | null;
  sync_status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  sync_attempts: number;
  sync_error: string | null;
  created_at: string;
};

export type OutboxEvent = {
  id: number;              // SQLite auto-increment
  event_type: string;
  payload: string;         // JSON
  created_at: string;      // ISO8601
  attempts: number;
  last_attempt_at: string | null;
  error_message: string | null;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
};

/* ─── API Payloads ────────────────────────────────────────── */

export const CaptureAlprBodySchema = z.object({
  siteCode: z.string().min(1),
  deviceCode: z.string().min(1),
  laneCode: z.string().optional(),
  direction: z.enum(['ENTRY', 'EXIT']),
  requestId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  eventTime: z.string().datetime().optional(),
  timestamp: z.string().datetime().optional(),
  plateRaw: z.string().optional(),
  imageUrl: z.string().url().optional(),
  ocrConfidence: z.number().min(0).max(1).optional(),
  signature: z.string().min(1),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
});

export const CaptureRfidBodySchema = z.object({
  siteCode: z.string().min(1),
  deviceCode: z.string().min(1),
  laneCode: z.string().optional(),
  direction: z.enum(['ENTRY', 'EXIT']),
  requestId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  eventTime: z.string().datetime().optional(),
  timestamp: z.string().datetime().optional(),
  rfidUid: z.string().min(1),
  signature: z.string().min(1),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
});

export const CaptureSensorBodySchema = z.object({
  siteCode: z.string().min(1),
  deviceCode: z.string().min(1),
  laneCode: z.string().optional(),
  direction: z.enum(['ENTRY', 'EXIT']),
  requestId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  eventTime: z.string().datetime().optional(),
  timestamp: z.string().datetime().optional(),
  sensorState: z.enum(['PRESENT', 'CLEARED', 'TRIGGERED']),
  signature: z.string().min(1),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
});

export type CaptureAlprBody = z.infer<typeof CaptureAlprBodySchema>;
export type CaptureRfidBody = z.infer<typeof CaptureRfidBodySchema>;
export type CaptureSensorBody = z.infer<typeof CaptureSensorBodySchema>;

/* ─── Internal Event Types ─────────────────────────────────── */

export type CaptureResult = {
  sessionId: string;
  decision: 'OPEN' | 'REJECT' | 'REVIEW';
  reason: string;
  plateCompact: string | null;
  rfidUid: string | null;
  ticketNumber: string | null;
  barrierDecision: 'OPEN' | 'REJECT' | 'REVIEW';
  syncStatus: 'PENDING' | 'SYNCED';
};

/* ─── Sync Payloads ───────────────────────────────────────── */

export const BulkSyncPayloadSchema = z.object({
  edgeNodeId: z.string(),
  siteCode: z.string(),
  sessions: z.array(z.object({
    localSessionId: z.string(),
    siteCode: z.string(),
    laneCode: z.string(),
    direction: z.enum(['ENTRY', 'EXIT']),
    vehiclePlate: z.string().nullable(),
    plateCompact: z.string().nullable(),
    rfidUid: z.string().nullable(),
    deviceCode: z.string(),
    readType: z.enum(['ALPR', 'RFID', 'SENSOR']),
    status: z.enum(['ACTIVE', 'COMPLETED', 'TIMEOUT']),
    openedAt: z.string(),
    lastReadAt: z.string(),
    closedAt: z.string().nullable(),
    barrierDecision: z.string().nullable(),
    decisionReason: z.string().nullable(),
    ticketNumber: z.string().nullable(),
    tariffApplied: z.string().nullable(),
    amountCharged: z.number().nullable(),
  })),
});

export type BulkSyncPayload = z.infer<typeof BulkSyncPayloadSchema>;
