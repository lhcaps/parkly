/**
 * decision-engine.ts — Local Decision Engine for Parkly Edge Node
 *
 * Works offline. Makes pass/reject decisions based on:
 *  - Subscriptions stored in local SQLite
 *  - Active tariffs stored in local SQLite
 *  - Vehicle type detection
 *
 * The decision is immediate — no network call needed.
 */

import { randomUUID } from 'node:crypto';
import type {
  CaptureAlprBody,
  CaptureRfidBody,
  CaptureSensorBody,
} from './types.js';
import {
  findSubscriptionByPlate,
  findSubscriptionByRfid,
  findActiveSessionByLane,
  createOfflineSession,
  appendToSession,
  closeSession,
  findActiveTariff,
  timeoutStaleSessions,
} from './local-db.js';
import type { CaptureResult } from './types.js';

/* ─── Types ─────────────────────────────────────────────────── */

type DecisionContext = {
  siteCode: string;
  laneCode: string;
  direction: 'ENTRY' | 'EXIT';
  deviceCode: string;
  occurredAt: Date;
};

/* ─── Plate canonicalization (simplified) ────────────────────── */

function canonicalizePlate(raw: string): { compact: string; valid: boolean } {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^VI|^V[0-9]/, '')
    .trim();

  if (cleaned.length < 4) return { compact: cleaned, valid: false };
  return { compact: cleaned, valid: true };
}

/* ─── Ticket number generator ───────────────────────────────── */

function generateTicketNumber(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `E-${ts}${rand}`;
}

/* ─── Tariff calculator (simplified) ────────────────────────── */

function calculateOfflineCharge(openedAt: Date, tariff: { base_rate: number; daily_cap: number; overnight_cap: number }): number {
  const minutes = Math.floor((Date.now() - openedAt.getTime()) / 60_000);
  if (minutes <= 0) return 0;

  const hours = Math.ceil(minutes / 60);
  const hourly = hours * tariff.base_rate;
  const charge = Math.min(hourly, tariff.daily_cap);
  return charge;
}

/* ─── Core decision logic ───────────────────────────────────── */

type DecisionOutcome =
  | { decision: 'OPEN'; reason: string; sessionId: string; ticketNumber: null | string; tariffApplied: null | string; amount: null | number }
  | { decision: 'REJECT'; reason: string; sessionId: string; ticketNumber: null | string; tariffApplied: null | string; amount: null | number }
  | { decision: 'REVIEW'; reason: string; sessionId: string; ticketNumber: null | string; tariffApplied: null | string; amount: null | number };

function decide(
  ctx: DecisionContext,
  input: {
    plateCompact: string | null;
    rfidUid: string | null;
    readType: 'ALPR' | 'RFID' | 'SENSOR';
    sensorState?: string;
    ocrConfidence?: number;
    sessionId?: string;
  },
): DecisionOutcome {
  // Check for active session (append scenario)
  const existing = input.sessionId
    ? null // Will be handled by append
    : findActiveSessionByLane(ctx.siteCode, ctx.laneCode);

  if (existing) {
    // Append to existing session
    appendToSession(existing.session_id, {
      vehicle_plate: input.plateCompact ?? null,
      plate_compact: input.plateCompact ?? null,
      rfid_uid: input.rfidUid ?? null,
      read_type: input.readType,
    });

    return {
      decision: 'REVIEW',
      reason: `Appended to existing session ${existing.session_id}`,
      sessionId: existing.session_id,
      ticketNumber: existing.ticket_number,
      tariffApplied: existing.tariff_applied,
      amount: existing.amount_charged,
    };
  }

  // ── Active subscription check ────────────────────────────────
  let subscription = input.rfidUid
    ? findSubscriptionByRfid(ctx.siteCode, input.rfidUid)
    : input.plateCompact
      ? findSubscriptionByPlate(ctx.siteCode, input.plateCompact)
      : null;

  if (subscription) {
    const sessionId = randomUUID();
    createOfflineSession({
      site_code: ctx.siteCode,
      lane_code: ctx.laneCode,
      direction: ctx.direction,
      vehicle_plate: input.plateCompact ?? null,
      plate_compact: input.plateCompact ?? null,
      rfid_uid: input.rfidUid ?? null,
      device_code: ctx.deviceCode,
      read_type: input.readType,
      opened_at: ctx.occurredAt.toISOString(),
      last_read_at: ctx.occurredAt.toISOString(),
      closed_at: null,
      barrier_decision: 'OPEN',
      decision_reason: `SUBSCRIPTION_ACTIVE: ${subscription.owner_name}`,
      ticket_number: null,
      tariff_applied: null,
      amount_charged: null,
    });

    closeSession(sessionId, 'OPEN', `SUBSCRIPTION_ACTIVE: ${subscription.owner_name}`);

    return {
      decision: 'OPEN',
      reason: `Subscriber: ${subscription.owner_name} (${subscription.vehicle_type})`,
      sessionId,
      ticketNumber: null,
      tariffApplied: null,
      amount: null,
    };
  }

  // ── No subscription — pay-and-park (ticket) ──────────────────
  if (input.plateCompact) {
    const tariff = findActiveTariff(ctx.siteCode, 'CAR', 'TICKET');
    const sessionId = randomUUID();
    const ticketNumber = generateTicketNumber();
    const now = new Date(ctx.occurredAt);

    createOfflineSession({
      site_code: ctx.siteCode,
      lane_code: ctx.laneCode,
      direction: ctx.direction,
      vehicle_plate: input.plateCompact,
      plate_compact: input.plateCompact,
      rfid_uid: input.rfidUid ?? null,
      device_code: ctx.deviceCode,
      read_type: input.readType,
      opened_at: now.toISOString(),
      last_read_at: now.toISOString(),
      closed_at: null,
      barrier_decision: 'REVIEW',
      decision_reason: 'OFFLINE_TICKET_MODE',
      ticket_number: ticketNumber,
      tariff_applied: tariff?.name ?? null,
      amount_charged: null,
    });

    return {
      decision: 'REVIEW',
      reason: `Guest vehicle — ticket issued: ${ticketNumber}`,
      sessionId,
      ticketNumber,
      tariffApplied: tariff?.name ?? null,
      amount: null,
    };
  }

  // ── No plate, no RFID — requires manual review ───────────────
  const sessionId = randomUUID();
  createOfflineSession({
    site_code: ctx.siteCode,
    lane_code: ctx.laneCode,
    direction: ctx.direction,
    vehicle_plate: null,
    plate_compact: null,
    rfid_uid: input.rfidUid ?? null,
    device_code: ctx.deviceCode,
    read_type: input.readType,
    opened_at: ctx.occurredAt.toISOString(),
    last_read_at: ctx.occurredAt.toISOString(),
    closed_at: null,
    barrier_decision: 'REJECT',
    decision_reason: 'NO_IDENTITY — no plate or RFID detected',
    ticket_number: null,
    tariff_applied: null,
    amount_charged: null,
  });

  return {
    decision: 'REJECT',
    reason: 'Cannot identify vehicle — manual verification required',
    sessionId,
    ticketNumber: null,
    tariffApplied: null,
    amount: null,
  };
}

/* ─── Public API ────────────────────────────────────────────── */

export function processAlprCapture(ctx: DecisionContext, body: CaptureAlprBody): CaptureResult {
  // Timeout stale sessions first
  timeoutStaleSessions(300);

  const { compact } = canonicalizePlate(body.plateRaw ?? '');
  const ocrConfidence = body.ocrConfidence ?? 0;

  // If plate is valid enough
  const plateCompact = (ocrConfidence >= 0.6 && compact) ? compact : null;

  const outcome = decide(ctx, {
    plateCompact,
    rfidUid: null,
    readType: 'ALPR',
    ocrConfidence,
  });

  return {
    sessionId: outcome.sessionId,
    decision: outcome.decision,
    reason: outcome.reason,
    plateCompact,
    rfidUid: null,
    ticketNumber: outcome.ticketNumber,
    barrierDecision: outcome.decision,
    syncStatus: 'PENDING',
  };
}

export function processRfidCapture(ctx: DecisionContext, body: CaptureRfidBody): CaptureResult {
  timeoutStaleSessions(300);

  const outcome = decide(ctx, {
    plateCompact: null,
    rfidUid: body.rfidUid,
    readType: 'RFID',
  });

  return {
    sessionId: outcome.sessionId,
    decision: outcome.decision,
    reason: outcome.reason,
    plateCompact: null,
    rfidUid: body.rfidUid,
    ticketNumber: outcome.ticketNumber,
    barrierDecision: outcome.decision,
    syncStatus: 'PENDING',
  };
}

export function processSensorCapture(ctx: DecisionContext, body: CaptureSensorBody): CaptureResult {
  timeoutStaleSessions(60);

  const outcome = decide(ctx, {
    plateCompact: null,
    rfidUid: null,
    readType: 'SENSOR',
    sensorState: body.sensorState,
  });

  return {
    sessionId: outcome.sessionId,
    decision: outcome.decision,
    reason: outcome.reason,
    plateCompact: null,
    rfidUid: null,
    ticketNumber: outcome.ticketNumber,
    barrierDecision: outcome.decision,
    syncStatus: 'PENDING',
  };
}
