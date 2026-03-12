import { createHash } from 'node:crypto';

import { type NextFunction, type Request, type Response, type Router } from 'express';
import { z } from 'zod';

import { ReviewClaimBody, SessionManualOverrideBody, SessionOpenBody, SessionResolveBody } from '@parkly/contracts';

import { getRequestActor, requireAuth } from '../../../../server/auth';
import { ApiError, ok } from '../../../../server/http';
import { observeSessionOpen, observeSessionResolve, setReviewQueueSize } from '../../../../server/metrics';
import { assertNoClientCanonicalPlateFields } from '../../../../server/plate-authority';
import {
  claimIdempotency,
  markIdempotencyFailed,
  markIdempotencySucceeded,
} from '../../../../server/services/idempotency.service';
import {
  cancelGateSession,
  confirmGateSessionPass,
  getGateSessionDetail,
  listGateSessions,
  openOrReuseSessionAndResolve,
  resolveGateSession,
} from '../../application/resolve-session';
import { openGateSession } from '../../application/open-session';
import { claimGateReview, listGateReviewQueue } from '../../application/review/claim-review';
import { manualApproveGateSession } from '../../application/review/manual-approve';
import { manualRejectGateSession } from '../../application/review/manual-reject';
import { manualOpenBarrierForSession } from '../../application/review/manual-open-barrier';
import { resolveMediaViewById } from '../../../../server/services/media-presign.service';

const IsoDateTime = z.string().datetime().optional();
const SessionDirection = z.enum(['ENTRY', 'EXIT']);

const SessionMutateBody = z.object({
  requestId: z.string().trim().min(1).max(64),
  idempotencyKey: z.string().trim().min(8).max(64),
  occurredAt: IsoDateTime,
  reasonCode: z.string().trim().max(64).optional(),
  note: z.string().trim().max(500).optional(),
  rawPayload: z.unknown().optional(),
});

const SessionListQuery = z.object({
  siteCode: z.string().trim().min(1).optional(),
  laneCode: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  direction: SessionDirection.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().trim().optional(),
});

const ReviewQueueQuery = z.object({
  siteCode: z.string().trim().min(1).optional(),
  status: z.enum(['OPEN', 'CLAIMED', 'RESOLVED', 'CANCELLED']).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().trim().optional(),
});

function requestHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex');
}

function idempotencyBusy(scope: string, key: string, status: string) {
  throw new ApiError({
    code: 'CONFLICT',
    message: 'Yêu cầu idempotent đang được xử lý hoặc đã thất bại trước đó',
    details: { scope, idempotencyKey: key, status },
  });
}

export function registerGateSessionRoutes(api: Router) {
  api.post('/gate-sessions/open', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    const startedAt = Date.now();
    try {
      const parsed = SessionOpenBody.safeParse(req.body);
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });

      const body = parsed.data;
      assertNoClientCanonicalPlateFields(req.body, 'POST /api/gate-sessions/open');
      const scope = `gate-session-open:${body.siteCode}:${body.laneCode}`;
      const claim = await claimIdempotency({ scope, key: body.idempotencyKey, requestHash: requestHash(body) });
      if (!claim.claimed) {
        if (claim.row.status === 'SUCCEEDED') return res.json(ok(rid, claim.row.response_json as any));
        return idempotencyBusy(scope, body.idempotencyKey, claim.row.status);
      }

      try {
        const data = await openGateSession({
          siteCode: body.siteCode,
          laneCode: body.laneCode,
          direction: body.direction,
          occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
          presenceActive: body.presenceActive,
          correlationId: body.correlationId,
          plateRaw: body.plateRaw,
          rfidUid: body.rfidUid,
          deviceCode: body.deviceCode,
          readType: body.readType,
          sensorState: body.sensorState,
          ocrConfidence: body.ocrConfidence,
          requestId: body.requestId,
          idempotencyKey: body.idempotencyKey,
          payload: body.rawPayload,
        });

        const correlationId = data.session.correlationId ?? body.correlationId ?? (req as any).correlationId ?? rid;
        (req as any).correlationId = correlationId;
        res.setHeader('x-correlation-id', correlationId);
        observeSessionOpen({
          siteCode: data.session.siteCode,
          laneCode: data.session.laneCode,
          direction: data.session.direction,
          result: data.reused ? 'REUSED' : data.session.status,
          durationMs: Date.now() - startedAt,
        });
        (req as any).log?.info?.({
          requestId: rid,
          correlationId,
          siteCode: data.session.siteCode,
          laneCode: data.session.laneCode,
          deviceCode: body.deviceCode ?? null,
          sessionId: data.session.sessionId,
          sessionStatus: data.session.status,
          reused: data.reused,
        }, 'gate_session_open');

        await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
        res.json(ok(rid, data));
      } catch (err) {
        observeSessionOpen({
          siteCode: body.siteCode,
          laneCode: body.laneCode,
          direction: body.direction,
          result: 'ERROR',
          durationMs: Date.now() - startedAt,
        });
        await markIdempotencyFailed({ scope, key: body.idempotencyKey }).catch(() => void 0);
        throw err;
      }
    } catch (e) {
      next(e);
    }
  });

  api.post('/gate-sessions/resolve', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    const startedAt = Date.now();
    try {
      const parsed = SessionResolveBody.safeParse(req.body);
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });

      const body = parsed.data;
      assertNoClientCanonicalPlateFields(req.body, 'POST /api/gate-sessions/resolve');
      const scope = body.sessionId != null
        ? `gate-session-resolve:${body.sessionId}`
        : `gate-session-resolve:${body.siteCode ?? 'UNKNOWN'}:${body.laneCode ?? 'UNKNOWN'}`;
      const claim = await claimIdempotency({ scope, key: body.idempotencyKey, requestHash: requestHash(body) });
      if (!claim.claimed) {
        if (claim.row.status === 'SUCCEEDED') return res.json(ok(rid, claim.row.response_json as any));
        return idempotencyBusy(scope, body.idempotencyKey, claim.row.status);
      }

      try {
        const fn = body.autoOpenIfMissing ? openOrReuseSessionAndResolve : resolveGateSession;
        const data = await fn({
          sessionId: body.sessionId,
          siteCode: body.siteCode,
          laneCode: body.laneCode,
          direction: body.direction,
          occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
          requestId: body.requestId,
          idempotencyKey: body.idempotencyKey,
          deviceCode: body.deviceCode,
          readType: body.readType,
          sensorState: body.sensorState,
          plateRaw: body.plateRaw,
          ocrConfidence: body.ocrConfidence,
          rfidUid: body.rfidUid,
          presenceActive: body.presenceActive,
          approved: body.approved,
          denied: body.denied,
          paymentRequired: body.paymentRequired,
          reasonCode: body.reasonCode,
          reasonDetail: body.reasonDetail,
          payload: body.rawPayload,
        });

        const correlationId = data.session.correlationId ?? (req as any).correlationId ?? rid;
        (req as any).correlationId = correlationId;
        res.setHeader('x-correlation-id', correlationId);
        observeSessionResolve({
          siteCode: data.session.siteCode,
          laneCode: data.session.laneCode,
          direction: data.session.direction,
          result: data.decision?.decisionCode ?? data.session.status,
          durationMs: Date.now() - startedAt,
        });
        (req as any).log?.info?.({
          requestId: rid,
          correlationId,
          siteCode: data.session.siteCode,
          laneCode: data.session.laneCode,
          deviceCode: body.deviceCode ?? null,
          sessionId: data.session.sessionId,
          sessionStatus: data.session.status,
          decisionCode: data.decision?.decisionCode ?? null,
          reasonCode: data.decision?.reasonCode ?? body.reasonCode ?? null,
          readType: body.readType ?? null,
        }, 'gate_session_resolve');

        await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
        res.json(ok(rid, data));
      } catch (err) {
        observeSessionResolve({
          siteCode: body.siteCode,
          laneCode: body.laneCode,
          direction: body.direction,
          result: 'ERROR',
          durationMs: Date.now() - startedAt,
        });
        await markIdempotencyFailed({ scope, key: body.idempotencyKey }).catch(() => void 0);
        throw err;
      }
    } catch (e) {
      next(e);
    }
  });

  api.get('/gate-sessions/:sessionId', requireAuth(['ADMIN', 'OPS', 'GUARD', 'WORKER']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getGateSessionDetail(String(req.params.sessionId));

      const reads = await Promise.all((data.reads ?? []).map(async (read: any) => {
        const mediaId = read?.evidence?.media?.mediaId ?? read?.evidence?.sourceMediaId ?? null;
        if (!mediaId) return read;
        const resolved = await resolveMediaViewById(String(mediaId)).catch(() => null);
        if (!resolved?.viewUrl) return read;
        return {
          ...read,
          evidence: {
            ...read.evidence,
            media: {
              ...(read.evidence?.media ?? {}),
              mediaId: String(mediaId),
              mediaUrl: resolved.viewUrl,
              viewUrl: resolved.viewUrl,
              expiresAt: resolved.expiresAt,
              storageProvider: resolved.storageProvider,
              bucketName: resolved.bucketName,
              objectKey: resolved.objectKey,
              objectEtag: resolved.objectEtag,
            },
          },
        };
      }));

      const mediaUrlById = new Map(
        reads
          .map((read: any) => {
            const media = read?.evidence?.media ?? null;
            return media?.mediaId && media?.mediaUrl ? [String(media.mediaId), String(media.mediaUrl)] : null;
          })
          .filter(Boolean) as Array<[string, string]>
      );

      const timeline = Array.isArray(data.timeline)
        ? data.timeline.map((item: any) => {
            if (item?.kind !== 'READ') return item;
            const mediaId = item?.payload?.sourceMediaId ? String(item.payload.sourceMediaId) : null;
            const mediaUrl = mediaId ? (mediaUrlById.get(mediaId) ?? item?.payload?.mediaUrl ?? null) : item?.payload?.mediaUrl ?? null;
            return {
              ...item,
              payload: {
                ...item.payload,
                mediaUrl,
              },
            };
          })
        : data.timeline;

      res.json(ok((req as any).id, { ...data, reads, timeline }));
    } catch (e) {
      next(e);
    }
  });

  api.get('/gate-sessions', requireAuth(['ADMIN', 'OPS', 'GUARD', 'WORKER']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = SessionListQuery.safeParse(req.query ?? {});
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });

      const data = await listGateSessions({
        siteCode: parsed.data.siteCode,
        laneCode: parsed.data.laneCode,
        status: parsed.data.status,
        direction: parsed.data.direction,
        from: parsed.data.from ? new Date(parsed.data.from) : undefined,
        to: parsed.data.to ? new Date(parsed.data.to) : undefined,
        limit: parsed.data.limit,
        cursor: parsed.data.cursor ? BigInt(parsed.data.cursor) : undefined,
      });

      res.json(ok((req as any).id, {
        rows: data.items,
        nextCursor: data.nextCursor,
        pageInfo: {
          limit: parsed.data.limit ?? 50,
          nextCursor: data.nextCursor,
          sort: 'sessionId:desc',
        },
      }));
    } catch (e) {
      next(e);
    }
  });


  api.get('/gate-review-queue', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = ReviewQueueQuery.safeParse(req.query ?? {});
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });

      const data = await listGateReviewQueue({
        siteCode: parsed.data.siteCode,
        status: parsed.data.status,
        limit: parsed.data.limit,
        cursor: parsed.data.cursor ? BigInt(parsed.data.cursor) : undefined,
      });

      if (parsed.data.siteCode) {
        setReviewQueueSize({ siteCode: parsed.data.siteCode, count: data.items.length });
      } else {
        const counts = new Map<string, number>();
        for (const row of data.items) counts.set(row.session.siteCode, (counts.get(row.session.siteCode) ?? 0) + 1);
        for (const [siteCode, count] of counts.entries()) setReviewQueueSize({ siteCode, count });
      }

      (req as any).log?.info?.({
        requestId: (req as any).id,
        correlationId: (req as any).correlationId,
        siteCode: parsed.data.siteCode ?? null,
        status: parsed.data.status ?? null,
        cursor: parsed.data.cursor ?? null,
        returned: data.items.length,
      }, 'gate_review_queue_list');

      res.json(ok((req as any).id, {
        rows: data.items,
        nextCursor: data.nextCursor,
        pageInfo: {
          limit: parsed.data.limit ?? 50,
          nextCursor: data.nextCursor,
          sort: 'reviewId:desc',
        },
      }));
    } catch (e) {
      next(e);
    }
  });

  api.post('/gate-review-queue/:reviewId/claim', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    try {
      const parsed = ReviewClaimBody.safeParse(req.body);
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });

      const body = parsed.data;
      const scope = `gate-review-claim:${req.params.reviewId}`;
      const claim = await claimIdempotency({ scope, key: body.idempotencyKey, requestHash: requestHash(body) });
      if (!claim.claimed) {
        if (claim.row.status === 'SUCCEEDED') return res.json(ok(rid, claim.row.response_json as any));
        return idempotencyBusy(scope, body.idempotencyKey, claim.row.status);
      }

      try {
        const data = await claimGateReview({
          reviewId: req.params.reviewId,
          occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
          reasonCode: body.reasonCode,
          note: body.note,
          actor: getRequestActor(req),
        });
        await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
        res.json(ok(rid, data));
      } catch (err) {
        await markIdempotencyFailed({ scope, key: body.idempotencyKey }).catch(() => void 0);
        throw err;
      }
    } catch (e) {
      next(e);
    }
  });

  api.post('/gate-sessions/:sessionId/manual-approve', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    try {
      const parsed = SessionManualOverrideBody.safeParse(req.body);
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });

      const body = parsed.data;
      const scope = `gate-session-manual-approve:${req.params.sessionId}`;
      const claim = await claimIdempotency({ scope, key: body.idempotencyKey, requestHash: requestHash(body) });
      if (!claim.claimed) {
        if (claim.row.status === 'SUCCEEDED') return res.json(ok(rid, claim.row.response_json as any));
        return idempotencyBusy(scope, body.idempotencyKey, claim.row.status);
      }

      try {
        const data = await manualApproveGateSession({
          sessionId: req.params.sessionId,
          occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
          reasonCode: body.reasonCode,
          note: body.note,
          actor: getRequestActor(req),
        });
        await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
        res.json(ok(rid, data));
      } catch (err) {
        await markIdempotencyFailed({ scope, key: body.idempotencyKey }).catch(() => void 0);
        throw err;
      }
    } catch (e) {
      next(e);
    }
  });

  api.post('/gate-sessions/:sessionId/manual-reject', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    try {
      const parsed = SessionManualOverrideBody.safeParse(req.body);
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });

      const body = parsed.data;
      const scope = `gate-session-manual-reject:${req.params.sessionId}`;
      const claim = await claimIdempotency({ scope, key: body.idempotencyKey, requestHash: requestHash(body) });
      if (!claim.claimed) {
        if (claim.row.status === 'SUCCEEDED') return res.json(ok(rid, claim.row.response_json as any));
        return idempotencyBusy(scope, body.idempotencyKey, claim.row.status);
      }

      try {
        const data = await manualRejectGateSession({
          sessionId: req.params.sessionId,
          occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
          reasonCode: body.reasonCode,
          note: body.note,
          actor: getRequestActor(req),
        });
        await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
        res.json(ok(rid, data));
      } catch (err) {
        await markIdempotencyFailed({ scope, key: body.idempotencyKey }).catch(() => void 0);
        throw err;
      }
    } catch (e) {
      next(e);
    }
  });

  api.post('/gate-sessions/:sessionId/manual-open-barrier', requireAuth(['ADMIN', 'OPS']), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    try {
      const parsed = SessionManualOverrideBody.safeParse(req.body);
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });

      const body = parsed.data;
      const scope = `gate-session-manual-open-barrier:${req.params.sessionId}`;
      const claim = await claimIdempotency({ scope, key: body.idempotencyKey, requestHash: requestHash(body) });
      if (!claim.claimed) {
        if (claim.row.status === 'SUCCEEDED') return res.json(ok(rid, claim.row.response_json as any));
        return idempotencyBusy(scope, body.idempotencyKey, claim.row.status);
      }

      try {
        const data = await manualOpenBarrierForSession({
          sessionId: req.params.sessionId,
          occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
          reasonCode: body.reasonCode,
          note: body.note,
          actor: getRequestActor(req),
        });
        await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
        res.json(ok(rid, data));
      } catch (err) {
        await markIdempotencyFailed({ scope, key: body.idempotencyKey }).catch(() => void 0);
        throw err;
      }
    } catch (e) {
      next(e);
    }
  });

  api.post('/gate-sessions/:sessionId/confirm-pass', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    try {
      const parsed = SessionMutateBody.safeParse(req.body);
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });

      const body = parsed.data;
      const scope = `gate-session-confirm-pass:${req.params.sessionId}`;
      const claim = await claimIdempotency({ scope, key: body.idempotencyKey, requestHash: requestHash(body) });
      if (!claim.claimed) {
        if (claim.row.status === 'SUCCEEDED') return res.json(ok(rid, claim.row.response_json as any));
        return idempotencyBusy(scope, body.idempotencyKey, claim.row.status);
      }

      try {
        const data = await confirmGateSessionPass({
          sessionId: req.params.sessionId,
          occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
          requestId: body.requestId,
          reasonCode: body.reasonCode,
          payload: body.rawPayload,
        });
        await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
        res.json(ok(rid, data));
      } catch (err) {
        await markIdempotencyFailed({ scope, key: body.idempotencyKey }).catch(() => void 0);
        throw err;
      }
    } catch (e) {
      next(e);
    }
  });

  api.post('/gate-sessions/:sessionId/cancel', requireAuth(['ADMIN', 'OPS', 'GUARD']), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    try {
      const parsed = SessionMutateBody.safeParse(req.body);
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });

      const body = parsed.data;
      const scope = `gate-session-cancel:${req.params.sessionId}`;
      const claim = await claimIdempotency({ scope, key: body.idempotencyKey, requestHash: requestHash(body) });
      if (!claim.claimed) {
        if (claim.row.status === 'SUCCEEDED') return res.json(ok(rid, claim.row.response_json as any));
        return idempotencyBusy(scope, body.idempotencyKey, claim.row.status);
      }

      try {
        const data = await cancelGateSession({
          sessionId: req.params.sessionId,
          occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
          requestId: body.requestId,
          reasonCode: body.reasonCode,
          note: body.note,
          payload: body.rawPayload,
        });
        await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
        res.json(ok(rid, data));
      } catch (err) {
        await markIdempotencyFailed({ scope, key: body.idempotencyKey }).catch(() => void 0);
        throw err;
      }
    } catch (e) {
      next(e);
    }
  });
}
