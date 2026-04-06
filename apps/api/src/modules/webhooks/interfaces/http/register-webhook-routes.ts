import type { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

import { ADMIN_OPS_ROLES } from '../../../../server/auth-policies';
import { requireAuth } from '../../../../server/auth';
import { ApiError, ok, withCursorPage } from '../../../../server/http';
import { getRequestActor } from '../../../../server/auth';
import { validateOrThrow } from '../../../../server/validation';
import { writeAuditLog } from '../../../../server/services/audit-service';
import { buildAuditActorSnapshot } from '../../../../server/services/audit-service';
import {
  createWebhook,
  getWebhookById,
  listWebhooks,
  updateWebhook,
  deleteWebhook,
  regenerateWebhookSecret,
  listWebhookDeliveries,
  resolveSiteId,
  type WebhookEventType,
} from '../../application/webhook.service';
import { z } from 'zod';

// Use canonical role groups from auth-policies. SUPER_ADMIN bypasses all role checks.

const CreateWebhookBody = z.object({
  siteCode: z.string().trim().min(1, 'siteCode là bắt buộc'),
  name: z.string().trim().min(1, 'name là bắt buộc').max(255),
  description: z.string().trim().max(512).optional(),
  endpointUrl: z.string().url('endpointUrl phải là URL hợp lệ').max(2048),
  subscribedEvents: z.array(z.enum([
    'GATE_SESSION_OPENED',
    'GATE_SESSION_PASSED',
    'GATE_SESSION_DENIED',
    'GATE_SESSION_REVIEW',
    'GATE_SESSION_CANCELLED',
    'GATE_SESSION_TIMEOUT',
    'TICKET_CREATED',
    'TICKET_CLOSED',
    'PAYMENT_COMPLETED',
    'SUBSCRIPTION_CREATED',
    'SUBSCRIPTION_EXPIRED',
    'INCIDENT_OPENED',
    'INCIDENT_RESOLVED',
    'SHIFT_CLOSED',
  ])).min(1, 'Ít nhất 1 event phải được subscribe'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional().default('ACTIVE'),
  retryCount: z.coerce.number().int().min(1).max(10).optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(30000).optional(),
  rateLimitRpm: z.coerce.number().int().positive().max(10000).optional(),
});

const PatchWebhookBody = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(512).optional().nullable(),
  endpointUrl: z.string().url().max(2048).optional(),
  subscribedEvents: z.array(z.string()).min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  retryCount: z.coerce.number().int().min(1).max(10).optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(30000).optional(),
  rateLimitRpm: z.coerce.number().int().positive().max(10000).optional().nullable(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Patch body không được rỗng' });

const ListWebhooksQuery = z.object({
  siteCode: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().trim().optional(),
});

const ListDeliveriesQuery = z.object({
  status: z.enum(['SUCCESS', 'FAILED', 'PENDING', 'RETRYING']).optional(),
  eventType: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().trim().optional(),
});

export function registerWebhookRoutes(api: Router) {
  /**
   * POST /api/integrations/webhooks
   * Tạo mới một webhook endpoint
   */
  api.post(
    '/integrations/webhooks',
    requireAuth(ADMIN_OPS_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = validateOrThrow(CreateWebhookBody, req.body ?? {});
        const actor = getRequestActor(req);

        const siteId = await resolveSiteId(parsed.siteCode);

        const webhook = await createWebhook({
          siteId,
          name: parsed.name,
          description: parsed.description,
          endpointUrl: parsed.endpointUrl,
          subscribedEvents: parsed.subscribedEvents as WebhookEventType[],
          status: parsed.status,
          retryCount: parsed.retryCount,
          timeoutMs: parsed.timeoutMs,
          rateLimitRpm: parsed.rateLimitRpm,
          createdByUserId: actor.actorUserId ? BigInt(actor.actorUserId) : undefined,
        });

        await writeAuditLog({
          siteId,
          actor: actor.actorUserId
            ? buildAuditActorSnapshot({ actorUserId: actor.actorUserId })
            : undefined,
          actorUserId: actor.actorUserId ? BigInt(actor.actorUserId) : undefined,
          action: 'WEBHOOK_CREATED',
          entityTable: 'webhooks',
          entityId: webhook.webhookId,
          afterSnapshot: webhook,
        });

        res.status(201).json(ok((req as any).id, webhook));
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/integrations/webhooks
   * List webhooks cho site
   */
  api.get(
    '/integrations/webhooks',
    requireAuth(ADMIN_OPS_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = validateOrThrow(ListWebhooksQuery, req.query ?? {});

        let siteId: bigint | undefined;
        if (parsed.siteCode) {
          siteId = await resolveSiteId(parsed.siteCode);
        }

        const result = await listWebhooks({
          siteId,
          status: parsed.status,
          limit: parsed.limit,
          cursor: parsed.cursor,
        });

        res.json(ok((req as any).id, withCursorPage(result.items, {
          limit: parsed.limit ?? 50,
          nextCursor: result.nextCursor,
          sort: 'webhookId:desc',
        })));
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/integrations/webhooks/:webhookId
   * Chi tiết một webhook
   */
  api.get(
    '/integrations/webhooks/:webhookId',
    requireAuth(ADMIN_OPS_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const webhook = await getWebhookById(String(req.params.webhookId));
        res.json(ok((req as any).id, webhook));
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * PATCH /api/integrations/webhooks/:webhookId
   * Cập nhật webhook
   */
  api.patch(
    '/integrations/webhooks/:webhookId',
    requireAuth(ADMIN_OPS_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = validateOrThrow(PatchWebhookBody, req.body ?? {});
        const actor = getRequestActor(req);

        const before = await getWebhookById(String(req.params.webhookId));
        const updated = await updateWebhook(String(req.params.webhookId), {
          ...parsed,
          subscribedEvents: parsed.subscribedEvents as WebhookEventType[] | undefined,
        });

        await writeAuditLog({
          siteId: BigInt(updated.siteId),
          actor: actor.actorUserId
            ? buildAuditActorSnapshot({ actorUserId: actor.actorUserId })
            : undefined,
          actorUserId: actor.actorUserId ? BigInt(actor.actorUserId) : undefined,
          action: 'WEBHOOK_UPDATED',
          entityTable: 'webhooks',
          entityId: updated.webhookId,
          beforeSnapshot: before,
          afterSnapshot: updated,
        });

        res.json(ok((req as any).id, updated));
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * DELETE /api/integrations/webhooks/:webhookId
   * Xóa webhook
   */
  api.delete(
    '/integrations/webhooks/:webhookId',
    requireAuth(ADMIN_OPS_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const before = await getWebhookById(String(req.params.webhookId));
        const actor = getRequestActor(req);

        await deleteWebhook(String(req.params.webhookId));

        await writeAuditLog({
          siteId: BigInt(before.siteId),
          actor: actor.actorUserId
            ? buildAuditActorSnapshot({ actorUserId: actor.actorUserId })
            : undefined,
          actorUserId: actor.actorUserId ? BigInt(actor.actorUserId) : undefined,
          action: 'WEBHOOK_DELETED',
          entityTable: 'webhooks',
          entityId: before.webhookId,
          beforeSnapshot: before,
        });

        res.json(ok((req as any).id, { deleted: true, webhookId: before.webhookId }));
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/integrations/webhooks/:webhookId/regenerate-secret
   * Tạo lại secret key
   */
  api.post(
    '/integrations/webhooks/:webhookId/regenerate-secret',
    requireAuth(ADMIN_OPS_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const actor = getRequestActor(req);
        const updated = await regenerateWebhookSecret(String(req.params.webhookId));

        await writeAuditLog({
          siteId: BigInt(updated.siteId),
          actor: actor.actorUserId
            ? buildAuditActorSnapshot({ actorUserId: actor.actorUserId })
            : undefined,
          actorUserId: actor.actorUserId ? BigInt(actor.actorUserId) : undefined,
          action: 'WEBHOOK_SECRET_REGENERATED',
          entityTable: 'webhooks',
          entityId: updated.webhookId,
        });

        res.json(ok((req as any).id, updated));
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/integrations/webhooks/:webhookId/deliveries
   * Lịch sử delivery của một webhook
   */
  api.get(
    '/integrations/webhooks/:webhookId/deliveries',
    requireAuth(ADMIN_OPS_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const webhookId = String(req.params.webhookId ?? '').trim();
        if (!webhookId) {
          throw new ApiError({ code: 'BAD_REQUEST', message: 'webhookId là bắt buộc' });
        }

        // Verify webhook exists
        await getWebhookById(webhookId);

        const parsed = validateOrThrow(ListDeliveriesQuery, req.query ?? {});
        const result = await listWebhookDeliveries({
          webhookId,
          status: parsed.status,
          eventType: parsed.eventType,
          limit: parsed.limit,
          cursor: parsed.cursor,
        });

        res.json(ok((req as any).id, withCursorPage(result.items, {
          limit: parsed.limit ?? 50,
          nextCursor: result.nextCursor,
          sort: 'deliveryId:desc',
        })));
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/integrations/webhooks/:webhookId/test
   * Gửi test event tới webhook endpoint
   */
  api.post(
    '/integrations/webhooks/:webhookId/test',
    requireAuth(ADMIN_OPS_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const webhook = await getWebhookById(String(req.params.webhookId));

        const { deliverWebhookEvent } = await import('../../application/webhook.service');
        const result = await deliverWebhookEvent({
          webhookId: webhook.webhookId,
          eventType: 'GATE_SESSION_OPENED',
          eventId: `test_${Date.now()}`,
          payload: {
            test: true,
            webhookId: webhook.webhookId,
            message: 'This is a test webhook delivery from Parkly',
            timestamp: new Date().toISOString(),
          },
          attemptNumber: 1,
        });

        res.json(ok((req as any).id, {
          webhookId: webhook.webhookId,
          delivered: result.delivered,
          statusCode: result.statusCode,
          durationMs: result.durationMs,
          error: result.delivered ? undefined : (result as any).error,
        }));
      } catch (error) {
        next(error);
      }
    },
  );
}
