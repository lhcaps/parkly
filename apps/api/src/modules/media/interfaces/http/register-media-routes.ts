import type { NextFunction, Request, Response, Router } from 'express'
import multer from 'multer'
import { z } from 'zod'

import { prisma } from '../../../../lib/prisma'
import { requireAuth, getRequestActor } from '../../../../server/auth'
import { SESSION_READ_ROLES } from '../../../../server/auth-policies'
import { config } from '../../../../server/config'
import { ApiError, ok } from '../../../../server/http'
import { resolveMediaViewById } from '../../../../server/services/media-presign.service'
import { storeUploadedMedia } from '../../../../server/services/media-storage.service'
import { resolveAuthorizedSiteScope } from '../../../../server/services/read-models/site-scope'
import { verifyDeviceSignature } from '../../../gate/application/verify-device-signature'
import {
  claimIdempotency,
  markIdempotencyFailed,
  markIdempotencySucceeded,
} from '../../../../server/services/idempotency.service'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function validateMediaMimeType(mime: string): boolean {
  return ALLOWED_MIME.has(String(mime ?? '').trim().toLowerCase())
}

export function parseMediaId(raw: unknown): bigint {
  const value = String(raw ?? '').trim()
  if (!/^\d+$/.test(value)) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Invalid mediaId: must be a positive integer',
    })
  }
  const parsed = BigInt(value)
  if (parsed <= 0n) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Invalid mediaId: must be greater than zero',
    })
  }
  return parsed
}

export function clampPresignTtl(ttlSec?: number): number {
  if (ttlSec === undefined || Number.isNaN(ttlSec)) {
    return Math.trunc(config.media?.presignTtlSec ?? 300)
  }
  return Math.max(1, Math.min(604800, Math.trunc(ttlSec)))
}

const ViewQuerySchema = z.object({
  ttlSec: z.coerce.number().int().positive().max(604800).optional(),
})

const DeviceMediaUploadHeaderSchema = z.object({
  'x-site-code': z.string().trim().min(1),
  'x-device-code': z.string().trim().min(1),
  'x-request-id': z.string().trim().min(1),
  'x-idempotency-key': z.string().trim().min(1),
  'x-device-timestamp': z.string().trim().min(1),
  'x-device-signature': z.string().trim().min(1).optional(),
  'x-lane-code': z.string().trim().optional(),
})

export function registerMediaRoutes(api: Router): void {
  const storage = multer.memoryStorage()
  const upload = multer({
    storage,
    limits: {
      fileSize: config.upload.maxBytes,
      files: 1,
    },
  })

  /**
   * GET /api/media/:mediaId/view
   * Resolves a presigned download view URL or local static URL for a media item.
   * Enforces role authorization and tenant site scoping.
   */
  api.get(
    '/media/:mediaId/view',
    requireAuth(SESSION_READ_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const mediaId = parseMediaId(req.params.mediaId)
        const query = ViewQuerySchema.parse(req.query ?? {})
        const actor = getRequestActor(req)

        const record = await prisma.gate_read_media.findUnique({
          where: { media_id: mediaId },
        })

        if (!record) {
          throw new ApiError({
            code: 'NOT_FOUND',
            message: `Media record not found for id ${mediaId}`,
          })
        }

        // Tenant / Site scope validation
        if (record.site_id) {
          const site = await prisma.parking_sites.findUnique({
            where: { site_id: record.site_id },
            select: { site_code: true },
          })
          if (site?.site_code) {
            await resolveAuthorizedSiteScope({
              principal: req.auth!,
              requestedSiteCode: site.site_code,
            })
          }
        }

        const effectiveTtl = clampPresignTtl(query.ttlSec)
        const view = await resolveMediaViewById(mediaId, { ttlSec: effectiveTtl })

        if (!view) {
          throw new ApiError({
            code: 'NOT_FOUND',
            message: `Media view resolution failed for id ${mediaId}`,
          })
        }

        const rid = (req as Request & { id?: string }).id ?? ''
        res.json(ok(rid, view))
      } catch (err) {
        next(err)
      }
    },
  )

  /**
   * GET /api/media/:mediaId
   * Retrieves metadata descriptor for a stored media item with site scoping.
   */
  api.get(
    '/media/:mediaId',
    requireAuth(SESSION_READ_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const mediaId = parseMediaId(req.params.mediaId)
        const actor = getRequestActor(req)

        const record = await prisma.gate_read_media.findUnique({
          where: { media_id: mediaId },
        })

        if (!record) {
          throw new ApiError({
            code: 'NOT_FOUND',
            message: `Media record not found for id ${mediaId}`,
          })
        }

        if (record.site_id) {
          const site = await prisma.parking_sites.findUnique({
            where: { site_id: record.site_id },
            select: { site_code: true },
          })
          if (site?.site_code) {
            await resolveAuthorizedSiteScope({
              principal: req.auth!,
              requestedSiteCode: site.site_code,
            })
          }
        }

        const rid = (req as Request & { id?: string }).id ?? ''
        res.json(
          ok(rid, {
            mediaId: String(record.media_id),
            storageProvider: record.storage_provider,
            storageKind: record.storage_kind,
            mimeType: record.mime_type,
            sizeBytes: record.size_bytes ? Number(record.size_bytes) : null,
            sha256: record.sha256,
            widthPx: record.width_px,
            heightPx: record.height_px,
            bucketName: record.bucket_name,
            objectKey: record.object_key,
            capturedAt: record.captured_at?.toISOString() ?? null,
            createdAt: record.created_at.toISOString(),
          }),
        )
      } catch (err) {
        next(err)
      }
    },
  )

  /**
   * POST /api/media/device-upload
   * Edge-device authenticated media upload with HMAC verification, idempotency,
   * request size limits and content-type enforcement.
   */
  api.post(
    '/media/device-upload',
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      const headers = DeviceMediaUploadHeaderSchema.parse({
        'x-site-code': req.header('x-site-code'),
        'x-device-code': req.header('x-device-code'),
        'x-request-id': req.header('x-request-id'),
        'x-idempotency-key': req.header('x-idempotency-key'),
        'x-device-timestamp': req.header('x-device-timestamp'),
        'x-device-signature': req.header('x-device-signature'),
        'x-lane-code': req.header('x-lane-code'),
      })

      const idempotencyKey = headers['x-idempotency-key']
      const idempotencyScope = `device-media:${headers['x-site-code']}:${headers['x-device-code']}`

      const claim = await claimIdempotency({
        scope: idempotencyScope,
        key: idempotencyKey,
        requestHash: `${headers['x-request-id']}:${headers['x-device-timestamp']}`,
      })

      if (!claim.claimed) {
        if (claim.row.status === 'SUCCEEDED' && claim.row.response_json) {
          const rid = (req as Request & { id?: string }).id ?? ''
          res.json(ok(rid, claim.row.response_json))
          return
        }
        throw new ApiError({
          code: 'BAD_REQUEST',
          message: 'Idempotency conflict: request already in flight or failed',
        })
      }

      try {
        const auth = verifyDeviceSignature({
          surface: 'POST /api/media/device-upload',
          readType: 'HEARTBEAT',
          siteCode: headers['x-site-code'],
          deviceCode: headers['x-device-code'],
          requestId: headers['x-request-id'],
          idempotencyKey,
          timestamp: headers['x-device-timestamp'],
          signature: headers['x-device-signature'] ?? null,
          laneCode: headers['x-lane-code'] ?? null,
        })

        if (!auth.verified) {
          throw new ApiError({
            code: 'FORBIDDEN',
            message: 'Device HMAC signature verification failed',
          })
        }

        const file = (req as Request & { file?: Express.Multer.File }).file
        if (!file) {
          throw new ApiError({
            code: 'BAD_REQUEST',
            message: 'Missing multipart file (field name: file)',
          })
        }

        const mime = String(file.mimetype ?? '').trim().toLowerCase()
        if (!validateMediaMimeType(mime)) {
          throw new ApiError({
            code: 'BAD_REQUEST',
            message: 'Unsupported MIME type for media upload',
            details: { allowed: Array.from(ALLOWED_MIME), got: mime },
          })
        }

        const stored = await storeUploadedMedia({
          buffer: file.buffer,
          mimeType: mime,
          originalName: file.originalname ?? null,
          siteCode: headers['x-site-code'],
          laneCode: headers['x-lane-code'] ?? null,
          deviceCode: headers['x-device-code'],
          metadata: {
            surface: 'POST /api/media/device-upload',
            requestId: headers['x-request-id'],
            secretSource: auth.secretSource,
          },
        })

        const responsePayload = {
          imageUrl: stored.viewUrl ?? stored.mediaUrl,
          viewUrl: stored.viewUrl ?? stored.mediaUrl,
          filePath: stored.filePath,
          filename: stored.filename,
          originalName: stored.originalName,
          size: stored.sizeBytes,
          mime: stored.mimeType,
          sha256: stored.sha256,
          storageKind: stored.storageKind,
          storageProvider: stored.storageProvider,
          bucketName: stored.bucketName,
          objectKey: stored.objectKey,
          objectEtag: stored.objectEtag,
          widthPx: stored.widthPx,
          heightPx: stored.heightPx,
        }

        await markIdempotencySucceeded({
          scope: idempotencyScope,
          key: idempotencyKey,
          responseJson: responsePayload,
        })

        const rid = (req as Request & { id?: string }).id ?? ''
        res.json(ok(rid, responsePayload))
      } catch (err) {
        await markIdempotencyFailed({
          scope: idempotencyScope,
          key: idempotencyKey,
        })
        next(err)
      }
    },
  )
}
