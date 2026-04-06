/**
 * Webhook-Outbox Integration
 *
 * Integrates webhook delivery into the outbox event pipeline.
 * When the outbox worker picks up a gate_event_outbox record, this module
 * determines which webhooks are subscribed to that event type and delivers
 * the payload to each active webhook.
 *
 * The actual delivery is handled by deliverWebhookEvent() in webhook.service.ts.
 */

import { gate_event_outbox_status } from '@prisma/client';
import { createHmac } from 'node:crypto';

import { prisma } from '../../lib/prisma';
import {
  deliverWebhookEvent,
  findActiveWebhooksForSite,
  type WebhookEventType,
} from '../../modules/webhooks/application/webhook.service';

/**
 * Map gate_event_outbox mongo_collection + event payload to a WebhookEventType.
 * Returns null if the event should not trigger any webhook.
 */
export function mapOutboxEventToWebhookEvent(args: {
  mongoCollection: string;
  payloadJson: unknown;
}): WebhookEventType | null {
  const payload = args.payloadJson as Record<string, unknown> | undefined;
  const eventType = payload?.eventType as string | undefined;
  const action = payload?.action as string | undefined;

  // gate_events → GATE_SESSION_*
  if (args.mongoCollection === 'device_events' || args.mongoCollection === 'gate_events') {
    if (eventType === 'gate.session.opened' || action === 'SESSION_OPENED') return 'GATE_SESSION_OPENED';
    if (eventType === 'gate.session.passed' || action === 'SESSION_PASSED') return 'GATE_SESSION_PASSED';
    if (eventType === 'gate.session.denied' || action === 'SESSION_DENIED') return 'GATE_SESSION_DENIED';
    if (eventType === 'gate.session.review' || action === 'SESSION_REVIEW') return 'GATE_SESSION_REVIEW';
    if (eventType === 'gate.session.cancelled' || action === 'SESSION_CANCELLED') return 'GATE_SESSION_CANCELLED';
    if (eventType === 'gate.session.timeout' || action === 'SESSION_TIMEOUT') return 'GATE_SESSION_TIMEOUT';
  }

  // tickets
  if (args.mongoCollection === 'tickets') {
    if (eventType === 'ticket.created' || action === 'TICKET_CREATED') return 'TICKET_CREATED';
    if (eventType === 'ticket.closed' || action === 'TICKET_CLOSED') return 'TICKET_CLOSED';
  }

  // payments
  if (args.mongoCollection === 'payments') {
    if (eventType === 'payment.completed' || action === 'PAYMENT_COMPLETED') return 'PAYMENT_COMPLETED';
  }

  // subscriptions
  if (args.mongoCollection === 'subscriptions') {
    if (eventType === 'subscription.created' || action === 'SUBSCRIPTION_CREATED') return 'SUBSCRIPTION_CREATED';
    if (eventType === 'subscription.expired' || action === 'SUBSCRIPTION_EXPIRED') return 'SUBSCRIPTION_EXPIRED';
  }

  // incidents
  if (args.mongoCollection === 'incidents') {
    if (eventType === 'incident.opened' || action === 'INCIDENT_OPENED') return 'INCIDENT_OPENED';
    if (eventType === 'incident.resolved' || action === 'INCIDENT_RESOLVED') return 'INCIDENT_RESOLVED';
  }

  // shift
  if (args.mongoCollection === 'shifts') {
    if (eventType === 'shift.closed' || action === 'SHIFT_CLOSED') return 'SHIFT_CLOSED';
  }

  return null;
}

/**
 * Build the webhook payload from an outbox record.
 * This is the canonical shape delivered to webhook subscribers.
 */
export function buildWebhookPayload(args: {
  siteId: bigint;
  outboxId: bigint;
  eventType: WebhookEventType;
  payloadJson: unknown;
}): Record<string, unknown> {
  const payload = args.payloadJson as Record<string, unknown> | undefined;
  return {
    event: args.eventType,
    timestamp: new Date().toISOString(),
    outboxId: args.outboxId.toString(),
    siteId: args.siteId.toString(),
    data: payload ?? {},
  };
}

/**
 * Process a single outbox event for webhook delivery.
 * Called by the outbox worker after MongoDB sync succeeds.
 *
 * Returns: { delivered: number, failed: number }
 */
export async function deliverWebhooksForOutboxEvent(args: {
  outboxId: bigint;
  siteId: bigint;
  mongoCollection: string;
  payloadJson: unknown;
  eventId?: string;
}): Promise<{ delivered: number; failed: number; skipped: number }> {
  const eventType = mapOutboxEventToWebhookEvent({
    mongoCollection: args.mongoCollection,
    payloadJson: args.payloadJson,
  });

  if (!eventType) {
    // This event type has no webhook subscribers
    return { delivered: 0, failed: 0, skipped: 1 };
  }

  const webhooks = await findActiveWebhooksForSite(args.siteId, eventType);
  if (webhooks.length === 0) {
    return { delivered: 0, failed: 0, skipped: 1 };
  }

  const payload = buildWebhookPayload({
    siteId: args.siteId,
    outboxId: args.outboxId,
    eventType,
    payloadJson: args.payloadJson,
  });

  let delivered = 0;
  let failed = 0;

  for (const webhook of webhooks) {
    try {
      const result = await deliverWebhookEvent({
        webhookId: webhook.webhookId,
        eventType,
        eventId: args.eventId ?? args.outboxId.toString(),
        payload,
        attemptNumber: 1,
      });

      if (result.delivered) {
        delivered++;
      } else {
        failed++;
        console.warn(
          `[WebhookOutbox] Delivery failed for webhook ${webhook.webhookId} (${webhook.name}): ${(result as any).error ?? 'unknown'}`,
        );
      }
    } catch (err) {
      failed++;
      console.error(`[WebhookOutbox] Exception delivering to webhook ${webhook.webhookId}:`, err);
    }
  }

  console.log(
    `[WebhookOutbox] Event ${eventType} for outbox ${args.outboxId}: ${delivered} delivered, ${failed} failed, ${webhooks.length - delivered - failed} skipped`,
  );

  return { delivered, failed, skipped: 0 };
}

/**
 * Outbox event enricher: generate X-Parkly-Signature for webhook verification.
 *
 * External systems can verify the authenticity of Parkly webhook deliveries
 * by computing HMAC-SHA256(payload_body, webhook_secret_key) and comparing
 * to the X-Parkly-Signature header.
 *
 * Signature format: HMAC-SHA256(raw_json_body, secret_key).hex()
 */
export function signWebhookPayload(body: unknown, secretKey: string): string {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return createHmac('sha256', secretKey).update(raw).digest('hex');
}

/**
 * Utility for external systems to verify webhook signatures.
 * Usage in external system:
 *   const expected = signWebhookPayload(req.body, webhookSecret);
 *   const provided = req.headers['x-parkly-signature'];
 *   if (expected !== provided) throw new Error('Invalid signature');
 */
export function verifyWebhookSignature(body: unknown, secretKey: string, providedSignature: string): boolean {
  const expected = signWebhookPayload(body, secretKey);
  // Timing-safe comparison
  if (expected.length !== providedSignature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ providedSignature.charCodeAt(i);
  }
  return diff === 0;
}
