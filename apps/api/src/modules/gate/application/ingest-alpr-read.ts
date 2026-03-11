import { buildPlateCanonical } from '@parkly/gate-core';

import { ApiError } from '../../../server/http';
import { describeStoredUpload } from '../../../server/services/local-alpr.service';
import { resolveMediaViewById } from '../../../server/services/media-presign.service';
import {
  persistGateReadEvent,
  resolveLaneContext,
  resolveOrCreateSession,
} from '../infrastructure/gate-read-events.repo';

export async function ingestAlprRead(input: {
  requestId: string;
  idempotencyKey: string;
  siteCode: string;
  laneCode?: string;
  deviceCode?: string;
  direction: 'ENTRY' | 'EXIT';
  occurredAt: Date;
  plateRaw?: string;
  imageUrl?: string;
  sourceMediaId?: string | number | bigint | null;
  ocrConfidence?: number;
  rawPayload?: unknown;
}) {
  const context = await resolveLaneContext({
    siteCode: input.siteCode,
    laneCode: input.laneCode,
    deviceCode: input.deviceCode,
    expectedDirection: input.direction,
  });

  const plateCanonical = buildPlateCanonical(input.plateRaw);
  if (input.plateRaw && plateCanonical.plateValidity === 'INVALID') {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Plate không vượt qua strict validation ở backend',
      details: plateCanonical,
    });
  }

  const rawPayloadRecord =
    input.rawPayload && typeof input.rawPayload === 'object' && !Array.isArray(input.rawPayload)
      ? (input.rawPayload as Record<string, any>)
      : null;

  const sourceMediaId = input.sourceMediaId == null ? null : String(input.sourceMediaId);
  const mediaView = sourceMediaId
    ? await resolveMediaViewById(sourceMediaId).catch(() => null)
    : null;

  const effectiveImageUrl = input.imageUrl ?? mediaView?.viewUrl ?? null;
  const storedUpload = sourceMediaId ? null : describeStoredUpload(effectiveImageUrl);

  const session = await resolveOrCreateSession({
    siteId: context.siteId,
    laneId: context.laneId,
    direction: context.direction,
    occurredAt: input.occurredAt,
    requestId: input.requestId,
    readType: 'ALPR',
    plateCompact: plateCanonical.plateCompact,
    reviewRequired: plateCanonical.reviewRequired,
    presenceActive: true,
  });

  const persisted = await persistGateReadEvent({
    sessionId: session.sessionId,
    siteId: context.siteId,
    laneId: context.laneId,
    deviceId: context.deviceId,
    readType: 'ALPR',
    direction: context.direction,
    occurredAt: input.occurredAt,
    plateRaw: plateCanonical.plateRaw,
    plateCompact: plateCanonical.plateCompact,
    ocrConfidence: input.ocrConfidence ?? null,
    payloadJson: {
      source: 'CAPTURE_API',
      imageUrl: effectiveImageUrl,
      sourceMediaId,
      rawPayload: input.rawPayload ?? null,
      plateEngine: {
        authority: 'BACKEND',
        ...plateCanonical,
      },
    },
    rawOcrText:
      rawPayloadRecord?.rawOcrText ??
      rawPayloadRecord?.ocr?.rawText ??
      rawPayloadRecord?.alpr?.rawText ??
      null,
    cameraFrameRef:
      rawPayloadRecord?.cameraFrameRef ??
      rawPayloadRecord?.frameRef ??
      rawPayloadRecord?.evidence?.cameraFrameRef ??
      null,
    cropRef:
      rawPayloadRecord?.cropRef ??
      rawPayloadRecord?.evidence?.cropRef ??
      null,
    sourceDeviceCode: context.deviceCode,
    sourceCaptureTs: input.occurredAt,
    sourceMediaId,
    media: storedUpload
      ? {
          storageKind: storedUpload.storageKind,
          storageProvider: storedUpload.storageKind === 'UPLOAD' ? 'LOCAL' : 'URL',
          mediaUrl: storedUpload.mediaUrl,
          filePath: storedUpload.filePath,
          mimeType: storedUpload.mimeType,
          metadataJson: {
            ...storedUpload.metadataJson,
            source: 'CAPTURE_API',
            laneCode: context.laneCode,
            deviceCode: context.deviceCode,
          },
          capturedAt: input.occurredAt,
        }
      : null,
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
  });

  return {
    siteCode: context.siteCode,
    laneCode: context.laneCode,
    deviceCode: context.deviceCode,
    direction: context.direction,
    readType: 'ALPR' as const,
    occurredAt: input.occurredAt.toISOString(),
    sessionId: session.sessionId,
    sessionStatus: session.sessionStatus,
    readEventId: persisted.readEventId,
    mediaId: persisted.sourceMediaId ? String(persisted.sourceMediaId) : sourceMediaId,
    viewUrl: mediaView?.viewUrl ?? effectiveImageUrl,
    changed: persisted.changed,
    alreadyExists: !persisted.changed,
    ...plateCanonical,
    plate: plateCanonical,
    imageUrl: effectiveImageUrl,
    ocrConfidence: input.ocrConfidence ?? null,
    rfidUid: null,
    sensorState: null,
  };
}