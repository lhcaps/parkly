import { buildPlateCanonical } from '@parkly/gate-core';

import { ApiError } from '../../../server/http';
import { describeStoredUpload } from '../../../server/services/local-alpr.service';
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

  const storedUpload = describeStoredUpload(input.imageUrl ?? null)

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
      imageUrl: input.imageUrl ?? null,
      rawPayload: input.rawPayload ?? null,
      plateEngine: {
        authority: 'BACKEND',
        ...plateCanonical,
      },
    },
    rawOcrText:
      (input.rawPayload as any)?.rawOcrText ??
      (input.rawPayload as any)?.ocr?.rawText ??
      (input.rawPayload as any)?.alpr?.rawText ??
      null,
    cameraFrameRef:
      (input.rawPayload as any)?.cameraFrameRef ??
      (input.rawPayload as any)?.frameRef ??
      (input.rawPayload as any)?.evidence?.cameraFrameRef ??
      null,
    cropRef:
      (input.rawPayload as any)?.cropRef ??
      (input.rawPayload as any)?.evidence?.cropRef ??
      null,
    sourceDeviceCode: context.deviceCode,
    sourceCaptureTs: input.occurredAt,
    media: storedUpload
      ? {
          storageKind: storedUpload.storageKind,
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
    changed: persisted.changed,
    alreadyExists: !persisted.changed,
    ...plateCanonical,
    plate: plateCanonical,
    imageUrl: input.imageUrl ?? null,
    ocrConfidence: input.ocrConfidence ?? null,
    rfidUid: null,
    sensorState: null,
  };
}
