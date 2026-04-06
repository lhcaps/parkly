import { createHash } from 'node:crypto';

import { type NextFunction, type Request, type Response, type Router } from 'express';
import { z } from 'zod';

import { ReviewClaimBody, SessionManualOverrideBody, SessionOpenBody, SessionResolveBody } from '@parkly/contracts';
import { prisma } from '../../../../lib/prisma';
import {
  ADMIN_OPS_GUARD_ROLES,
  ADMIN_OPS_ROLES,
  SESSION_READ_ROLES,
} from '../../../../server/auth-policies'

import { getRequestActor, requireAuth } from '../../../../server/auth'
import { ApiError, ok, buildCursorPageInfo } from '../../../../server/http'
import { observeSessionOpen, observeSessionResolve, setReviewQueueSize } from '../../../../server/metrics'
import { assertNoClientCanonicalPlateFields } from '../../../../server/plate-authority'
import { resolveAuthorizedSiteScope } from '../../../../server/services/read-models/site-scope'
import {
  claimIdempotency,
  markIdempotencyFailed,
  markIdempotencySucceeded,
} from '../../../../server/services/idempotency.service'
import {
  cancelGateSession,
  confirmGateSessionPass,
  getGateSessionDetail,
  listGateSessions,
  openOrReuseSessionAndResolve,
  resolveGateSession,
} from '../../application/resolve-session'
import { openGateSession } from '../../application/open-session'
import { claimGateReview, listGateReviewQueue } from '../../application/review/claim-review'
import { manualApproveGateSession } from '../../application/review/manual-approve'
import { manualRejectGateSession } from '../../application/review/manual-reject'
import { manualOpenBarrierForSession } from '../../application/review/manual-open-barrier'
import { resolveMediaViewById } from '../../../../server/services/media-presign.service'
import { normalizeQueryPrimitive, parseBigIntCursor, validateOrThrow } from '../../../../server/validation'

// Use canonical role groups from auth-policies. SUPER_ADMIN bypasses all role checks.

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
  siteCode: z.preprocess(normalizeQueryPrimitive, z.string().min(1).optional()),
  status: z.preprocess(
    (v) => {
      const s = normalizeQueryPrimitive(v)?.toUpperCase();
      return s ?? undefined;
    },
    z.enum(['OPEN', 'CLAIMED', 'RESOLVED', 'CANCELLED', 'DONE']).optional(),
  ),
  limit: z.preprocess(
    (v) => {
      const raw = Array.isArray(v) ? v[0] : v;
      if (raw === undefined || raw === null || raw === '') return undefined;
      return raw;
    },
    z.coerce.number().int().positive().max(200).optional(),
  ),
  cursor: z.preprocess(normalizeQueryPrimitive, z.string().optional()),
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

function logReviewMutation(req: Request, action: string, payload: Record<string, unknown>) {
  (req as any).log?.info?.({
    requestId: (req as any).id,
    correlationId: (req as any).correlationId,
    action,
    ...payload,
  }, 'gate_review_mutation')
}

function logReviewMutationError(req: Request, action: string, err: unknown, payload: Record<string, unknown>) {
  if (!(err instanceof ApiError)) return

  const level = err.code === 'CONFLICT' ? 'warn' : 'error'
  ;(req as any).log?.[level]?.({
    requestId: (req as any).id,
    correlationId: (req as any).correlationId,
    action,
    errorCode: err.code,
    errorMessage: err.message,
    errorDetails: (err as any).details ?? null,
    ...payload,
  }, 'gate_review_mutation_error')
}

async function resolveSessionSiteCode(sessionId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ siteCode: string }>>(
    `
      SELECT ps.site_code AS siteCode
      FROM gate_passage_sessions gps
      JOIN parking_sites ps
        ON ps.site_id = gps.site_id
      WHERE gps.session_id = ?
      LIMIT 1
    `,
    sessionId,
  )

  const siteCode = rows[0]?.siteCode ? String(rows[0].siteCode) : null
  if (!siteCode) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: `KhÃ´ng tÃ¬m tháº¥y session ${sessionId}`,
    })
  }

  return siteCode
}

async function resolveReviewSiteCode(reviewId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ siteCode: string }>>(
    `
      SELECT ps.site_code AS siteCode
      FROM gate_manual_reviews gmr
      JOIN parking_sites ps
        ON ps.site_id = gmr.site_id
      WHERE gmr.review_id = ?
      LIMIT 1
    `,
    reviewId,
  )

  const siteCode = rows[0]?.siteCode ? String(rows[0].siteCode) : null
  if (!siteCode) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: `KhÃ´ng tÃ¬m tháº¥y review ${reviewId}`,
    })
  }

  return siteCode
}

async function authorizeSessionSite(req: Request, sessionId: string, resourceLabel = 'gate session') {
  const siteCode = await resolveSessionSiteCode(sessionId)
  await resolveAuthorizedSiteScope({
    principal: req.auth!,
    requestedSiteCode: siteCode,
    resourceLabel,
  })
  return siteCode
}

async function authorizeReviewSite(req: Request, reviewId: string) {
  const siteCode = await resolveReviewSiteCode(reviewId)
  await resolveAuthorizedSiteScope({
    principal: req.auth!,
    requestedSiteCode: siteCode,
    resourceLabel: 'review queue',
  })
  return siteCode
}

export function registerGateSessionRoutes(api: Router) {
  api.post('/gate-sessions/open', requireAuth(ADMIN_OPS_GUARD_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    const startedAt = Date.now();
    try {
      const body = validateOrThrow(SessionOpenBody, req.body);
      await resolveAuthorizedSiteScope({
        principal: req.auth!,
        requestedSiteCode: body.siteCode,
        resourceLabel: 'gate session',
      });
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

  api.post('/gate-sessions/resolve', requireAuth(ADMIN_OPS_GUARD_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    const startedAt = Date.now();
    try {
      const body = validateOrThrow(SessionResolveBody, req.body);
      if (body.sessionId != null) {
        await authorizeSessionSite(req, String(body.sessionId));
      } else {
        await resolveAuthorizedSiteScope({
          principal: req.auth!,
          requestedSiteCode: body.siteCode ?? null,
          resourceLabel: 'gate session',
        });
      }
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

  api.get('/gate-sessions/:sessionId', requireAuth(SESSION_READ_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getGateSessionDetail(String(req.params.sessionId));
      await resolveAuthorizedSiteScope({
        principal: req.auth!,
        requestedSiteCode: data.session.siteCode,
        resourceLabel: 'gate session',
      });

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

  api.get('/gate-sessions', requireAuth(SESSION_READ_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(SessionListQuery, req.query ?? {});
      const scope = await resolveAuthorizedSiteScope({
        principal: req.auth!,
        requestedSiteCode: parsed.siteCode ?? null,
        resourceLabel: 'gate sessions',
      });

      const data = await listGateSessions({
        siteCode: scope.requestedSiteCode ?? undefined,
        siteCodes: scope.requestedSiteCode ? undefined : scope.siteCodes,
        laneCode: parsed.laneCode,
        status: parsed.status,
        direction: parsed.direction,
        from: parsed.from ? new Date(parsed.from) : undefined,
        to: parsed.to ? new Date(parsed.to) : undefined,
        limit: parsed.limit,
        cursor: parseBigIntCursor(parsed.cursor),
      });

      const pageInfo = buildCursorPageInfo({
        limit: parsed.limit ?? 50,
        nextCursor: data.nextCursor,
        sort: 'sessionId:desc',
      });

      res.json(ok((req as any).id, {
        rows: data.items,
        nextCursor: pageInfo.nextCursor,
        pageInfo,
      }));
    } catch (e) {
      next(e);
    }
  });


  api.get('/gate-review-queue', requireAuth(ADMIN_OPS_GUARD_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateOrThrow(ReviewQueueQuery, req.query ?? {});
      const scope = await resolveAuthorizedSiteScope({
        principal: req.auth!,
        requestedSiteCode: parsed.siteCode ?? null,
        resourceLabel: 'review queue',
      });

      const data = await listGateReviewQueue({
        siteCode: scope.requestedSiteCode ?? undefined,
        siteCodes: scope.requestedSiteCode ? undefined : scope.siteCodes,
        status: parsed.status,
        limit: parsed.limit,
        cursor: parseBigIntCursor(parsed.cursor),
      });

      if (parsed.siteCode) {
        setReviewQueueSize({ siteCode: parsed.siteCode, count: data.items.length });
      } else {
        const counts = new Map<string, number>();
        for (const row of data.items) counts.set(row.session.siteCode, (counts.get(row.session.siteCode) ?? 0) + 1);
        for (const [siteCode, count] of counts.entries()) setReviewQueueSize({ siteCode, count });
      }

      (req as any).log?.info?.({
        requestId: (req as any).id,
        correlationId: (req as any).correlationId,
        siteCode: parsed.siteCode ?? null,
        status: parsed.status ?? null,
        cursor: parsed.cursor ?? null,
        returned: data.items.length,
      }, 'gate_review_queue_list');

      const pageInfo = buildCursorPageInfo({
        limit: parsed.limit ?? 50,
        nextCursor: data.nextCursor,
        sort: 'reviewId:desc',
      });

      res.json(ok((req as any).id, {
        rows: data.items,
        nextCursor: pageInfo.nextCursor,
        pageInfo,
      }));
    } catch (e) {
      next(e);
    }
  });

  api.post('/gate-review-queue/:reviewId/claim', requireAuth(ADMIN_OPS_GUARD_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    try {
      await authorizeReviewSite(req, String(req.params.reviewId));
      const body = validateOrThrow(ReviewClaimBody, req.body);
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
        logReviewMutation(req, 'CLAIM_REVIEW', {
          reviewId: req.params.reviewId,
          sessionId: data.session.sessionId,
          sessionStatus: data.session.status,
        });
        await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
        res.json(ok(rid, data));
      } catch (err) {
        logReviewMutationError(req, 'CLAIM_REVIEW', err, { reviewId: req.params.reviewId });
        await markIdempotencyFailed({ scope, key: body.idempotencyKey }).catch(() => void 0);
        throw err;
      }
    } catch (e) {
      next(e);
    }
  });

  api.post('/gate-sessions/:sessionId/manual-approve', requireAuth(ADMIN_OPS_GUARD_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    try {
      await authorizeSessionSite(req, String(req.params.sessionId));
      const body = validateOrThrow(SessionManualOverrideBody, req.body);
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
        logReviewMutation(req, 'MANUAL_APPROVE', {
          sessionId: req.params.sessionId,
          reviewId: data.reviewId,
          sessionStatus: data.session.status,
        });
        await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
        res.json(ok(rid, data));
      } catch (err) {
        logReviewMutationError(req, 'MANUAL_APPROVE', err, { sessionId: req.params.sessionId });
        await markIdempotencyFailed({ scope, key: body.idempotencyKey }).catch(() => void 0);
        throw err;
      }
    } catch (e) {
      next(e);
    }
  });

  api.post('/gate-sessions/:sessionId/manual-reject', requireAuth(ADMIN_OPS_GUARD_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    try {
      await authorizeSessionSite(req, String(req.params.sessionId));
      const body = validateOrThrow(SessionManualOverrideBody, req.body);
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
        logReviewMutation(req, 'MANUAL_REJECT', {
          sessionId: req.params.sessionId,
          reviewId: data.reviewId,
          sessionStatus: data.session.status,
        });
        await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
        res.json(ok(rid, data));
      } catch (err) {
        logReviewMutationError(req, 'MANUAL_REJECT', err, { sessionId: req.params.sessionId });
        await markIdempotencyFailed({ scope, key: body.idempotencyKey }).catch(() => void 0);
        throw err;
      }
    } catch (e) {
      next(e);
    }
  });

  api.post('/gate-sessions/:sessionId/manual-open-barrier', requireAuth(ADMIN_OPS_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    try {
      await authorizeSessionSite(req, String(req.params.sessionId));
      const body = validateOrThrow(SessionManualOverrideBody, req.body);
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
        logReviewMutation(req, 'MANUAL_OPEN_BARRIER', {
          sessionId: req.params.sessionId,
          reviewId: data.reviewId,
          sessionStatus: data.session.status,
        });
        await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
        res.json(ok(rid, data));
      } catch (err) {
        logReviewMutationError(req, 'MANUAL_OPEN_BARRIER', err, { sessionId: req.params.sessionId });
        await markIdempotencyFailed({ scope, key: body.idempotencyKey }).catch(() => void 0);
        throw err;
      }
    } catch (e) {
      next(e);
    }
  });

  api.post('/gate-sessions/:sessionId/confirm-pass', requireAuth(ADMIN_OPS_GUARD_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    try {
      await authorizeSessionSite(req, String(req.params.sessionId));
      const body = validateOrThrow(SessionMutateBody, req.body);
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

  api.post('/gate-sessions/:sessionId/cancel', requireAuth(ADMIN_OPS_GUARD_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    const rid = (req as any).id;
    try {
      await authorizeSessionSite(req, String(req.params.sessionId));
      const body = validateOrThrow(SessionMutateBody, req.body);
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
