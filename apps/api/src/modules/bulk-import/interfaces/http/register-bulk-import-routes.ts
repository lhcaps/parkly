import type { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

import { ADMIN_OPS_ROLES } from '../../../../server/auth-policies';
import { requireAuth } from '../../../../server/auth';
import { ApiError, ok } from '../../../../server/http';
import { getRequestActor } from '../../../../server/auth';
import { validateOrThrow } from '../../../../server/validation';
import {
  createBulkImportJob,
  getBulkImportJobStatus,
  CreateBulkImportJobBody,
} from '../../application/bulk-import.service';
import { z } from 'zod';

// Use canonical role groups from auth-policies. SUPER_ADMIN bypasses all role checks.

export function registerBulkImportRoutes(api: Router) {
  /**
   * POST /api/admin/subscriptions/bulk-import
   * Nhận payload trực tiếp (JSON array), enqueue BullMQ job.
   * Trả về HTTP 202 Accepted với jobId để frontend polling.
   */
  api.post(
    '/admin/subscriptions/bulk-import',
    requireAuth(ADMIN_OPS_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = validateOrThrow(CreateBulkImportJobBody, req.body ?? {});

        const actor = getRequestActor(req);
        const result = await createBulkImportJob(parsed, {
          actorUserId: actor.actorUserId ? BigInt(actor.actorUserId) : undefined,
        });

        res.status(202).json(ok((req as any).id, result));
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/admin/jobs/:jobId
   * Frontend polling trạng thái job (progress % từ BullMQ / DB).
   */
  api.get(
    '/admin/jobs/:jobId',
    requireAuth(ADMIN_OPS_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const jobId = String(req.params.jobId ?? '').trim();
        if (!jobId) {
          throw new ApiError({ code: 'BAD_REQUEST', message: 'jobId là bắt buộc' });
        }

        const job = await getBulkImportJobStatus(jobId);
        if (!job) {
          throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy job', details: { jobId } });
        }

        res.json(ok((req as any).id, job));
      } catch (error) {
        next(error);
      }
    },
  );
}
