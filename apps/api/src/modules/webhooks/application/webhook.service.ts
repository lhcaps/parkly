import { randomUUID } from 'node:crypto';
import { createHmac } from 'node:crypto';
import axios, { type AxiosError } from 'axios';

import { prisma } from '../../../lib/prisma';
import { ApiError } from '../../../server/http';

// ── Prisma enum types (not in generated @prisma/client until .prisma/client is fixed) ──
const _webhook_event_type = [
  'GATE_SESSION_OPENED', 'GATE_SESSION_PASSED', 'GATE_SESSION_DENIED', 'GATE_SESSION_REVIEW',
  'GATE_SESSION_CANCELLED', 'GATE_SESSION_TIMEOUT', 'TICKET_CREATED', 'TICKET_CLOSED',
  'PAYMENT_COMPLETED', 'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_EXPIRED',
  'INCIDENT_OPENED', 'INCIDENT_RESOLVED', 'SHIFT_CLOSED',
] as const;
const _webhook_status = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
const _webhook_delivery_status = ['PENDING', 'SUCCESS', 'FAILED', 'RETRYING'] as const;
export type WebhookEventType = typeof _webhook_event_type[number];
export type WebhookStatus = typeof _webhook_status[number];
export type WebhookDeliveryStatus = typeof _webhook_delivery_status[number];

const MAX_DELIVERY_RETRIES = 5;
const DELIVERY_TIMEOUT_MS = 5000;

export type CreateWebhookInput = {
  siteId: bigint;
  name: string;
  description?: string;
  endpointUrl: string;
  subscribedEvents: WebhookEventType[];
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  retryCount?: number;
  timeoutMs?: number;
  rateLimitRpm?: number;
  createdByUserId?: bigint;
};

export type WebhookRow = {
  webhookId: string;
  siteId: string;
  name: string;
  description: string | null;
  endpointUrl: string;
  secretKey: string;
  subscribedEvents: WebhookEventType[];
  status: string;
  isVerified: boolean;
  retryCount: number;
  timeoutMs: number;
  rateLimitRpm: number | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WebhookDeliveryRow = {
  deliveryId: string;
  webhookId: string;
  eventType: string;
  eventId: string | null;
  payloadJson: unknown;
  responseStatus: number | null;
  responseBody: string | null;
  status: string;
  attemptCount: number;
  deliveredAt: string | null;
  lastError: string | null;
  durationMs: number | null;
  createdAt: string;
};

function generateSecretKey(): string {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 32);
}

function toDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function resolveSiteId(siteCodeOrId: string | bigint): Promise<bigint> {
  const text = String(siteCodeOrId);
  const rows = await prisma.$queryRawUnsafe<any[]>(
    text.length > 20 && /^\d+$/.test(text)
      ? `SELECT site_id FROM parking_sites WHERE site_id = ? LIMIT 1`
      : `SELECT site_id FROM parking_sites WHERE site_code = ? LIMIT 1`,
    text,
  );
  if (!rows[0]) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy site', details: { siteCodeOrId } });
  }
  return BigInt(rows[0].site_id);
}

async function ensureSiteWebhook(args: { siteId: bigint; endpointUrl: string }): Promise<void> {
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT webhook_id FROM webhooks WHERE site_id = ? AND endpoint_url = ? LIMIT 1`,
    args.siteId.toString(),
    args.endpointUrl,
  );
  if (existing[0]) {
    throw new ApiError({
      code: 'CONFLICT',
      message: 'Webhook với endpoint này đã tồn tại cho site',
      details: { endpointUrl: args.endpointUrl },
    });
  }
}

export async function createWebhook(input: CreateWebhookInput): Promise<WebhookRow> {
  await ensureSiteWebhook({ siteId: input.siteId, endpointUrl: input.endpointUrl });

  const secretKey = generateSecretKey();
  const subscribedEvents = JSON.stringify(input.subscribedEvents);

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO webhooks (site_id, name, description, endpoint_url, secret_key, subscribed_events,
                          status, is_verified, retry_count, timeout_ms, rate_limit_rpm, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `,
    input.siteId.toString(),
    input.name,
    input.description ?? null,
    input.endpointUrl,
    secretKey,
    subscribedEvents,
    input.status ?? 'ACTIVE',
    (input.retryCount ?? 3).toString(),
    (input.timeoutMs ?? DELIVERY_TIMEOUT_MS).toString(),
    input.rateLimitRpm?.toString() ?? null,
    input.createdByUserId?.toString() ?? null,
  );

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT LAST_INSERT_ID() AS id`,
  );
  const webhookId = String(rows[0].id);

  return getWebhookById(webhookId);
}

export async function getWebhookById(webhookId: string): Promise<WebhookRow> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM webhooks WHERE webhook_id = ? LIMIT 1`,
    webhookId,
  );
  if (!rows[0]) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy webhook', details: { webhookId } });
  }
  return mapWebhookRow(rows[0]);
}

export async function listWebhooks(args: {
  siteId?: bigint;
  status?: string;
  limit?: number;
  cursor?: string | null;
}): Promise<{ items: WebhookRow[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(200, Number(args.limit ?? 50)));
  const cursor = args.cursor
    ? String(args.cursor)
    : null;

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT *
    FROM webhooks
    WHERE (? IS NULL OR site_id = ?)
      AND (? IS NULL OR status = ?)
      AND (? IS NULL OR webhook_id < ?)
    ORDER BY webhook_id DESC
    LIMIT ?
    `,
    args.siteId?.toString() ?? null,
    args.siteId?.toString() ?? null,
    args.status ?? null,
    args.status ?? null,
    cursor,
    cursor,
    limit + 1,
  );

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: pageRows.map(mapWebhookRow),
    nextCursor: hasMore && pageRows[pageRows.length - 1]
      ? String(pageRows[pageRows.length - 1].webhook_id)
      : null,
  };
}

export async function updateWebhook(webhookId: string, patch: {
  name?: string;
  description?: string | null;
  endpointUrl?: string;
  subscribedEvents?: WebhookEventType[];
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  retryCount?: number;
  timeoutMs?: number;
  rateLimitRpm?: number | null;
}): Promise<WebhookRow> {
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM webhooks WHERE webhook_id = ? LIMIT 1`,
    webhookId,
  );
  if (!existing[0]) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy webhook', details: { webhookId } });
  }

  const fields: string[] = [];
  const values: any[] = [];

  if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name); }
  if (patch.description !== undefined) { fields.push('description = ?'); values.push(patch.description); }
  if (patch.endpointUrl !== undefined) { fields.push('endpoint_url = ?'); values.push(patch.endpointUrl); }
  if (patch.subscribedEvents !== undefined) { fields.push('subscribed_events = ?'); values.push(JSON.stringify(patch.subscribedEvents)); }
  if (patch.status !== undefined) { fields.push('status = ?'); values.push(patch.status); }
  if (patch.retryCount !== undefined) { fields.push('retry_count = ?'); values.push(patch.retryCount); }
  if (patch.timeoutMs !== undefined) { fields.push('timeout_ms = ?'); values.push(patch.timeoutMs); }
  if (patch.rateLimitRpm !== undefined) { fields.push('rate_limit_rpm = ?'); values.push(patch.rateLimitRpm); }

  if (fields.length > 0) {
    values.push(webhookId);
    await prisma.$executeRawUnsafe(
      `UPDATE webhooks SET ${fields.join(', ')} WHERE webhook_id = ?`,
      ...values,
    );
  }

  return getWebhookById(webhookId);
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT webhook_id FROM webhooks WHERE webhook_id = ? LIMIT 1`,
    webhookId,
  );
  if (!existing[0]) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy webhook', details: { webhookId } });
  }

  await prisma.$executeRawUnsafe(`DELETE FROM webhooks WHERE webhook_id = ?`, webhookId);
}

export async function regenerateWebhookSecret(webhookId: string): Promise<WebhookRow> {
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM webhooks WHERE webhook_id = ? LIMIT 1`,
    webhookId,
  );
  if (!existing[0]) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy webhook', details: { webhookId } });
  }

  const newSecret = generateSecretKey();
  await prisma.$executeRawUnsafe(
    `UPDATE webhooks SET secret_key = ?, is_verified = 0 WHERE webhook_id = ?`,
    newSecret,
    webhookId,
  );

  return getWebhookById(webhookId);
}

export async function listWebhookDeliveries(args: {
  webhookId: string;
  status?: string;
  eventType?: string;
  limit?: number;
  cursor?: string | null;
}): Promise<{ items: WebhookDeliveryRow[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(200, Number(args.limit ?? 50)));
  const cursor = args.cursor ? String(args.cursor) : null;

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT *
    FROM webhook_deliveries
    WHERE webhook_id = ?
      AND (? IS NULL OR status = ?)
      AND (? IS NULL OR event_type = ?)
      AND (? IS NULL OR delivery_id < ?)
    ORDER BY delivery_id DESC
    LIMIT ?
    `,
    args.webhookId,
    args.status ?? null,
    args.status ?? null,
    args.eventType ?? null,
    args.eventType ?? null,
    cursor,
    cursor,
    limit + 1,
  );

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: pageRows.map(mapDeliveryRow),
    nextCursor: hasMore && pageRows[pageRows.length - 1]
      ? String(pageRows[pageRows.length - 1].delivery_id)
      : null,
  };
}

function mapWebhookRow(row: any): WebhookRow {
  let subscribedEvents: WebhookEventType[] = [];
  try {
    const raw = row.subscribed_events;
    subscribedEvents = typeof raw === 'string' ? JSON.parse(raw) : (raw ?? []);
  } catch {
    subscribedEvents = [];
  }

  return {
    webhookId: String(row.webhook_id),
    siteId: String(row.site_id),
    name: String(row.name ?? ''),
    description: row.description == null ? null : String(row.description),
    endpointUrl: String(row.endpoint_url ?? ''),
    secretKey: String(row.secret_key ?? ''),
    subscribedEvents,
    status: String(row.status ?? 'INACTIVE'),
    isVerified: Boolean(Number(row.is_verified)),
    retryCount: Number(row.retry_count ?? 3),
    timeoutMs: Number(row.timeout_ms ?? DELIVERY_TIMEOUT_MS),
    rateLimitRpm: row.rate_limit_rpm == null ? null : Number(row.rate_limit_rpm),
    createdByUserId: row.created_by_user_id == null ? null : String(row.created_by_user_id),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
  };
}

function mapDeliveryRow(row: any): WebhookDeliveryRow {
  return {
    deliveryId: String(row.delivery_id),
    webhookId: String(row.webhook_id),
    eventType: String(row.event_type ?? ''),
    eventId: row.event_id == null ? null : String(row.event_id),
    payloadJson: typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : (row.payload_json ?? {}),
    responseStatus: row.response_status == null ? null : Number(row.response_status),
    responseBody: row.response_body == null ? null : String(row.response_body),
    status: String(row.status ?? 'PENDING'),
    attemptCount: Number(row.attempt_count ?? 0),
    deliveredAt: toIsoString(row.delivered_at),
    lastError: row.last_error == null ? null : String(row.last_error),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
  };
}

// ============================================================
// Webhook Delivery Engine (called by Outbox Worker)
// ============================================================

export type WebhookDeliveryPayload = {
  webhookId: string;
  eventType: WebhookEventType;
  eventId?: string;
  payload: Record<string, unknown>;
  attemptNumber?: number;
};

export type DeliveryResult =
  | { delivered: true; statusCode: number; responseBody: string; durationMs: number }
  | { delivered: false; statusCode?: number; error: string; retryable: boolean; durationMs: number };

export async function deliverWebhookEvent(args: WebhookDeliveryPayload): Promise<DeliveryResult> {
  const webhookRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM webhooks WHERE webhook_id = ? AND status = 'ACTIVE' LIMIT 1`,
    args.webhookId,
  );
  const webhook = webhookRows[0];
  if (!webhook) {
    return { delivered: false, error: 'Webhook not found or inactive', retryable: false, durationMs: 0 };
  }

  let subscribedEvents: WebhookEventType[] = [];
  try {
    const raw = webhook.subscribed_events;
    subscribedEvents = typeof raw === 'string' ? JSON.parse(raw) : (raw ?? []);
  } catch {
    subscribedEvents = [];
  }

  if (!subscribedEvents.includes(args.eventType)) {
    return { delivered: true, statusCode: 200, responseBody: 'Event not subscribed', durationMs: 0 };
  }

  const payloadString = JSON.stringify(args.payload);
  const signature = createHmac('sha256', String(webhook.secret_key))
    .update(payloadString)
    .digest('hex');

  const timeoutMs = Number(webhook.timeout_ms ?? DELIVERY_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await axios.post(String(webhook.endpoint_url), args.payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Parkly-Signature': signature,
        'X-Parkly-Event-Type': args.eventType,
        'X-Parkly-Webhook-Id': args.webhookId,
        'X-Parkly-Event-Id': args.eventId ?? '',
        'User-Agent': 'Parkly-Webhook/1.0',
      },
      timeout: timeoutMs,
      validateStatus: () => true,
    });

    const durationMs = Date.now() - startedAt;
    const responseBody = typeof response.data === 'string'
      ? response.data.slice(0, 10000)
      : JSON.stringify(response.data).slice(0, 10000);

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO webhook_deliveries (webhook_id, event_type, event_id, payload_json, request_body,
                                      response_status, response_body, status, attempt_count,
                                      delivered_at, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?, ?, ?)
      `,
      args.webhookId,
      args.eventType,
      args.eventId ?? null,
      JSON.stringify(args.payload),
      payloadString.slice(0, 10000),
      String(response.status),
      responseBody,
      String((args.attemptNumber ?? 1)),
      new Date().toISOString(),
      String(durationMs),
    );

    return {
      delivered: true,
      statusCode: response.status,
      responseBody,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const error = err instanceof Error ? err.message : String(err);
    const axiosErr = err as unknown as any;
    const isRetryable = !(axiosErr && axiosErr.isAxiosError && axiosErr.response?.status === 410);

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO webhook_deliveries (webhook_id, event_type, event_id, payload_json, request_body,
                                      response_status, response_body, status, attempt_count,
                                      last_error, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'FAILED', ?, ?, ?)
      `,
      args.webhookId,
      args.eventType,
      args.eventId ?? null,
      JSON.stringify(args.payload),
      payloadString.slice(0, 10000),
      axiosErr?.response?.status ? String(axiosErr.response.status) : '500',
      String(error).slice(0, 5000),
      String((args.attemptNumber ?? 1)),
      error.slice(0, 2000),
      String(durationMs),
    );

    return { delivered: false, error, retryable: isRetryable, durationMs };
  }
}

export async function findActiveWebhooksForSite(siteId: bigint, eventType: WebhookEventType): Promise<WebhookRow[]> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT *
    FROM webhooks
    WHERE site_id = ? AND status = 'ACTIVE'
    ORDER BY created_at ASC
    LIMIT 50
    `,
    siteId.toString(),
  );

  return rows.map(mapWebhookRow).filter((w) =>
    w.subscribedEvents.includes(eventType),
  );
}
