import { createHash } from 'node:crypto';

import type { Router } from 'express';
import {
  CaptureAlprBody,
  CaptureRfidBody,
  CaptureSensorBody,
  DeviceHeartbeatBody,
} from '@parkly/contracts';

import { ApiError, ok } from '../../../../server/http';
import { assertNoClientCanonicalPlateFields } from '../../../../server/plate-authority';
import {
  claimIdempotency,
  markIdempotencyFailed,
  markIdempotencySucceeded,
} from '../../../../server/services/idempotency.service';
import { stringifyBigint } from '../../../../server/utils';
import { observeSecretReplaySuspicion } from '../../../../server/metrics';
import { ingestAlprRead } from '../../application/ingest-alpr-read';
import { ingestRfidRead } from '../../application/ingest-rfid-read';
import { ingestSensorRead } from '../../application/ingest-sensor-read';
import { recordDeviceHeartbeat } from '../../application/record-device-heartbeat';
import {
  verifyDeviceSignature,
  type DeviceCaptureAuthResult,
  type DeviceCaptureReadType,
} from '../../application/verify-device-signature';

declare global {
  // eslint-disable-next-line no-var
  var __parklyLastEvents: any[] | undefined;
}

type CaptureLogContext = {
  rid: string;
  scope: string;
  siteCode?: string;
  deviceCode?: string;
  deviceRequestId?: string;
  idempotencyKey?: string;
  reason?: string | null;
};

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const nextValue = stableSort((value as Record<string, unknown>)[key]);
        if (nextValue !== undefined) acc[key] = nextValue;
        return acc;
      }, {});
  }
  return value;
}

function hashRequest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableSort(value ?? null))).digest('hex');
}

function normalizeCode(value: string): string {
  return String(value ?? '').trim().toUpperCase();
}

function buildCaptureScope(readType: DeviceCaptureReadType, siteCode: string, deviceCode: string) {
  return `capture:${readType}:${normalizeCode(siteCode)}:${normalizeCode(deviceCode)}`;
}

function buildPersistedIdempotencyKey(
  readType: DeviceCaptureReadType,
  siteCode: string,
  deviceCode: string,
  idempotencyKey: string,
) {
  const raw = `${readType}:${normalizeCode(siteCode)}:${normalizeCode(deviceCode)}:${String(idempotencyKey).trim()}`;
  if (raw.length <= 64) return raw;
  return createHash('sha256').update(raw).digest('hex');
}

function assertIdempotencyHash(existing: string | null, incoming: string) {
  if (existing && existing !== incoming) {
    throw new ApiError({
      code: 'CONFLICT',
      message: 'Idempotency key đã được dùng với payload khác',
      details: {
        reason: 'IDEMPOTENCY_CONFLICT',
      },
    });
  }
}

async function claimOrReplay(args: {
  scope: string;
  idempotencyKey: string;
  requestHash: string;
}) {
  const claimed = await claimIdempotency({
    scope: args.scope,
    key: args.idempotencyKey,
    requestHash: args.requestHash,
  });

  if (claimed.claimed) return { replay: false as const };

  assertIdempotencyHash(claimed.row.request_hash, args.requestHash);

  if (claimed.row.status === 'SUCCEEDED' && claimed.row.response_json != null) {
    return { replay: true as const, responseJson: claimed.row.response_json };
  }

  throw new ApiError({
    code: 'CONFLICT',
    message: 'Idempotency key đang được xử lý hoặc đã fail, không thể claim lại ngay',
    details: {
      reason: 'IDEMPOTENCY_BUSY',
      scope: args.scope,
      status: claimed.row.status,
    },
  });
}

function pushCaptureFeed(item: Record<string, unknown>) {
  globalThis.__parklyLastEvents = globalThis.__parklyLastEvents ?? [];
  globalThis.__parklyLastEvents.push({ ts: Date.now(), ...item });
  globalThis.__parklyLastEvents = globalThis.__parklyLastEvents.slice(-200);
}

function normalizeCaptureRawPayload(
  rawPayload: unknown,
  meta: {
    authority: 'DEVICE_SIGNATURE';
    verified: boolean;
    secretSource: DeviceCaptureAuthResult['secretSource'];
    requestTimestamp: string;
    maxSkewSeconds: number;
    signatureVersion: 'capture-v1';
    serverRequestId: string;
    deviceRequestId: string;
  },
) {
  const base = rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
    ? { ...(rawPayload as Record<string, unknown>) }
    : {};

  return {
    ...base,
    captureAuth: meta,
  };
}

function getApiReason(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== 'object') return null;
  const reason = (error.details as Record<string, unknown>).reason;
  return typeof reason === 'string' ? reason : null;
}

function logCapture(req: any, level: 'info' | 'warn' | 'error', event: string, ctx: CaptureLogContext, err?: unknown) {
  const payload = {
    rid: ctx.rid,
    scope: ctx.scope || undefined,
    siteCode: ctx.siteCode ?? null,
    deviceCode: ctx.deviceCode ?? null,
    deviceRequestId: ctx.deviceRequestId ?? null,
    idempotencyKey: ctx.idempotencyKey ?? null,
    reason: ctx.reason ?? null,
    ...(err ? { err } : {}),
  };

  req?.log?.[level]?.(payload, event);
}

export function registerGateCaptureRoutes(api: Router) {
  api.post('/gate-reads/alpr', async (req, res, next) => {
    const rid = (req as any).id;
    let scope = '';
    let claimedByThisRequest = false;
    let captureCtx: CaptureLogContext = { rid, scope: '' };

    try {
      const parsed = CaptureAlprBody.safeParse(req.body);
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });
      const body = parsed.data;
      captureCtx = {
        rid,
        scope: '',
        siteCode: body.siteCode,
        deviceCode: body.deviceCode,
        deviceRequestId: body.requestId,
        idempotencyKey: body.idempotencyKey,
      };

      assertNoClientCanonicalPlateFields(req.body, 'POST /api/gate-reads/alpr');

      const rawPayloadRecord = body.rawPayload && typeof body.rawPayload === 'object' && !Array.isArray(body.rawPayload)
        ? body.rawPayload as Record<string, unknown>
        : {}

      const sourceMediaId = rawPayloadRecord.sourceMediaId ?? rawPayloadRecord.mediaId ?? null

      const auth = verifyDeviceSignature({
        surface: 'POST /api/gate-reads/alpr',
        readType: 'ALPR',
        siteCode: body.siteCode,
        deviceCode: body.deviceCode,
        laneCode: body.laneCode,
        direction: body.direction,
        requestId: body.requestId,
        idempotencyKey: body.idempotencyKey,
        timestamp: body.timestamp,
        eventTime: body.eventTime,
        plateRaw: body.plateRaw,
        signature: body.signature,
      });

      const occurredAt = body.eventTime ? new Date(body.eventTime) : new Date(auth.timestampIso);
      const requestHash = hashRequest({ ...body, signature: undefined });
      scope = buildCaptureScope('ALPR', body.siteCode, body.deviceCode);
      captureCtx.scope = scope;

      const claim = await claimOrReplay({ scope, idempotencyKey: body.idempotencyKey, requestHash });
      if (claim.replay) {
        observeSecretReplaySuspicion({ channel: 'DEVICE_CAPTURE', reason: 'IDEMPOTENCY_REPLAY' });
        logCapture(req, 'info', 'capture_replay', captureCtx);
        res.json(ok(rid, claim.responseJson));
        return;
      }
      claimedByThisRequest = true;

      const data = stringifyBigint(
        await ingestAlprRead({
          requestId: body.requestId,
          idempotencyKey: buildPersistedIdempotencyKey('ALPR', body.siteCode, body.deviceCode, body.idempotencyKey),
          siteCode: body.siteCode,
          laneCode: body.laneCode,
          deviceCode: body.deviceCode,
          direction: body.direction,
          occurredAt,
          plateRaw: body.plateRaw,
          imageUrl: body.imageUrl,
          sourceMediaId: sourceMediaId == null ? undefined : String(sourceMediaId),
          ocrConfidence: body.ocrConfidence,
          rawPayload: normalizeCaptureRawPayload(body.rawPayload, {
            authority: 'DEVICE_SIGNATURE',
            verified: auth.verified,
            secretSource: auth.secretSource,
            requestTimestamp: auth.timestampIso,
            maxSkewSeconds: auth.maxSkewSeconds,
            signatureVersion: 'capture-v1',
            serverRequestId: rid,
            deviceRequestId: body.requestId,
          }),
        }),
      );

      pushCaptureFeed({
        source: 'CAPTURE_API',
        readType: 'ALPR',
        requestId: body.requestId,
        ...(data as Record<string, unknown>),
      });

      await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
      res.json(ok(rid, data));
    } catch (error) {
      const reason = getApiReason(error);
      captureCtx.reason = reason;

      if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') {
        logCapture(req, 'warn', 'capture_auth_failed', captureCtx);
      } else if (error instanceof ApiError && error.code === 'CONFLICT' && reason === 'IDEMPOTENCY_CONFLICT') {
        logCapture(req, 'warn', 'capture_idempotency_conflict', captureCtx);
      } else if (error instanceof ApiError && error.code === 'CONFLICT') {
        logCapture(req, 'warn', 'capture_idempotency_rejected', captureCtx);
      } else if (
        error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        ['INVALID_CAPTURE_TIMESTAMP', 'DEVICE_TIMESTAMP_EXPIRED', 'DEVICE_TIMESTAMP_AHEAD'].includes(reason ?? '')
      ) {
        logCapture(req, 'warn', 'capture_timestamp_rejected', captureCtx);
      } else {
        logCapture(req, 'error', 'capture_ingest_failed', captureCtx, error);
      }

      if (claimedByThisRequest && scope) {
        await markIdempotencyFailed({ scope, key: String((req.body as any)?.idempotencyKey ?? '') }).catch(() => void 0);
      }
      next(error);
    }
  });

  api.post('/gate-reads/rfid', async (req, res, next) => {
    const rid = (req as any).id;
    let scope = '';
    let claimedByThisRequest = false;
    let captureCtx: CaptureLogContext = { rid, scope: '' };

    try {
      const parsed = CaptureRfidBody.safeParse(req.body);
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });
      const body = parsed.data;
      captureCtx = {
        rid,
        scope: '',
        siteCode: body.siteCode,
        deviceCode: body.deviceCode,
        deviceRequestId: body.requestId,
        idempotencyKey: body.idempotencyKey,
      };

      assertNoClientCanonicalPlateFields(req.body, 'POST /api/gate-reads/rfid');

      const auth = verifyDeviceSignature({
        surface: 'POST /api/gate-reads/rfid',
        readType: 'RFID',
        siteCode: body.siteCode,
        deviceCode: body.deviceCode,
        laneCode: body.laneCode,
        direction: body.direction,
        requestId: body.requestId,
        idempotencyKey: body.idempotencyKey,
        timestamp: body.timestamp,
        eventTime: body.eventTime,
        rfidUid: body.rfidUid,
        signature: body.signature,
      });

      const occurredAt = body.eventTime ? new Date(body.eventTime) : new Date(auth.timestampIso);
      const requestHash = hashRequest({ ...body, signature: undefined });
      scope = buildCaptureScope('RFID', body.siteCode, body.deviceCode);
      captureCtx.scope = scope;

      const claim = await claimOrReplay({ scope, idempotencyKey: body.idempotencyKey, requestHash });
      if (claim.replay) {
        observeSecretReplaySuspicion({ channel: 'DEVICE_CAPTURE', reason: 'IDEMPOTENCY_REPLAY' });
        logCapture(req, 'info', 'capture_replay', captureCtx);
        res.json(ok(rid, claim.responseJson));
        return;
      }
      claimedByThisRequest = true;

      const data = stringifyBigint(
        await ingestRfidRead({
          requestId: body.requestId,
          idempotencyKey: buildPersistedIdempotencyKey('RFID', body.siteCode, body.deviceCode, body.idempotencyKey),
          siteCode: body.siteCode,
          laneCode: body.laneCode,
          deviceCode: body.deviceCode,
          direction: body.direction,
          occurredAt,
          rfidUid: body.rfidUid,
          rawPayload: normalizeCaptureRawPayload(body.rawPayload, {
            authority: 'DEVICE_SIGNATURE',
            verified: auth.verified,
            secretSource: auth.secretSource,
            requestTimestamp: auth.timestampIso,
            maxSkewSeconds: auth.maxSkewSeconds,
            signatureVersion: 'capture-v1',
            serverRequestId: rid,
            deviceRequestId: body.requestId,
          }),
        }),
      );

      pushCaptureFeed({
        source: 'CAPTURE_API',
        readType: 'RFID',
        requestId: body.requestId,
        ...(data as Record<string, unknown>),
      });

      await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
      res.json(ok(rid, data));
    } catch (error) {
      const reason = getApiReason(error);
      captureCtx.reason = reason;

      if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') {
        logCapture(req, 'warn', 'capture_auth_failed', captureCtx);
      } else if (error instanceof ApiError && error.code === 'CONFLICT' && reason === 'IDEMPOTENCY_CONFLICT') {
        logCapture(req, 'warn', 'capture_idempotency_conflict', captureCtx);
      } else if (error instanceof ApiError && error.code === 'CONFLICT') {
        logCapture(req, 'warn', 'capture_idempotency_rejected', captureCtx);
      } else if (
        error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        ['INVALID_CAPTURE_TIMESTAMP', 'DEVICE_TIMESTAMP_EXPIRED', 'DEVICE_TIMESTAMP_AHEAD'].includes(reason ?? '')
      ) {
        logCapture(req, 'warn', 'capture_timestamp_rejected', captureCtx);
      } else {
        logCapture(req, 'error', 'capture_ingest_failed', captureCtx, error);
      }

      if (claimedByThisRequest && scope) {
        await markIdempotencyFailed({ scope, key: String((req.body as any)?.idempotencyKey ?? '') }).catch(() => void 0);
      }
      next(error);
    }
  });

  api.post('/gate-reads/sensor', async (req, res, next) => {
    const rid = (req as any).id;
    let scope = '';
    let claimedByThisRequest = false;
    let captureCtx: CaptureLogContext = { rid, scope: '' };

    try {
      const parsed = CaptureSensorBody.safeParse(req.body);
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });
      const body = parsed.data;
      captureCtx = {
        rid,
        scope: '',
        siteCode: body.siteCode,
        deviceCode: body.deviceCode,
        deviceRequestId: body.requestId,
        idempotencyKey: body.idempotencyKey,
      };

      assertNoClientCanonicalPlateFields(req.body, 'POST /api/gate-reads/sensor');

      const auth = verifyDeviceSignature({
        surface: 'POST /api/gate-reads/sensor',
        readType: 'SENSOR',
        siteCode: body.siteCode,
        deviceCode: body.deviceCode,
        laneCode: body.laneCode,
        direction: body.direction,
        requestId: body.requestId,
        idempotencyKey: body.idempotencyKey,
        timestamp: body.timestamp,
        eventTime: body.eventTime,
        sensorState: body.sensorState,
        signature: body.signature,
      });

      const occurredAt = body.eventTime ? new Date(body.eventTime) : new Date(auth.timestampIso);
      const requestHash = hashRequest({ ...body, signature: undefined });
      scope = buildCaptureScope('SENSOR', body.siteCode, body.deviceCode);
      captureCtx.scope = scope;

      const claim = await claimOrReplay({ scope, idempotencyKey: body.idempotencyKey, requestHash });
      if (claim.replay) {
        observeSecretReplaySuspicion({ channel: 'DEVICE_CAPTURE', reason: 'IDEMPOTENCY_REPLAY' });
        logCapture(req, 'info', 'capture_replay', captureCtx);
        res.json(ok(rid, claim.responseJson));
        return;
      }
      claimedByThisRequest = true;

      const data = stringifyBigint(
        await ingestSensorRead({
          requestId: body.requestId,
          idempotencyKey: buildPersistedIdempotencyKey('SENSOR', body.siteCode, body.deviceCode, body.idempotencyKey),
          siteCode: body.siteCode,
          laneCode: body.laneCode,
          deviceCode: body.deviceCode,
          direction: body.direction,
          occurredAt,
          sensorState: body.sensorState,
          rawPayload: normalizeCaptureRawPayload(body.rawPayload, {
            authority: 'DEVICE_SIGNATURE',
            verified: auth.verified,
            secretSource: auth.secretSource,
            requestTimestamp: auth.timestampIso,
            maxSkewSeconds: auth.maxSkewSeconds,
            signatureVersion: 'capture-v1',
            serverRequestId: rid,
            deviceRequestId: body.requestId,
          }),
        }),
      );

      pushCaptureFeed({
        source: 'CAPTURE_API',
        readType: 'SENSOR',
        requestId: body.requestId,
        ...(data as Record<string, unknown>),
      });

      await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
      res.json(ok(rid, data));
    } catch (error) {
      const reason = getApiReason(error);
      captureCtx.reason = reason;

      if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') {
        logCapture(req, 'warn', 'capture_auth_failed', captureCtx);
      } else if (error instanceof ApiError && error.code === 'CONFLICT' && reason === 'IDEMPOTENCY_CONFLICT') {
        logCapture(req, 'warn', 'capture_idempotency_conflict', captureCtx);
      } else if (error instanceof ApiError && error.code === 'CONFLICT') {
        logCapture(req, 'warn', 'capture_idempotency_rejected', captureCtx);
      } else if (
        error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        ['INVALID_CAPTURE_TIMESTAMP', 'DEVICE_TIMESTAMP_EXPIRED', 'DEVICE_TIMESTAMP_AHEAD'].includes(reason ?? '')
      ) {
        logCapture(req, 'warn', 'capture_timestamp_rejected', captureCtx);
      } else {
        logCapture(req, 'error', 'capture_ingest_failed', captureCtx, error);
      }

      if (claimedByThisRequest && scope) {
        await markIdempotencyFailed({ scope, key: String((req.body as any)?.idempotencyKey ?? '') }).catch(() => void 0);
      }
      next(error);
    }
  });

  api.post('/devices/heartbeat', async (req, res, next) => {
    const rid = (req as any).id;
    let scope = '';
    let claimedByThisRequest = false;
    let captureCtx: CaptureLogContext = { rid, scope: '' };

    try {
      const parsed = DeviceHeartbeatBody.safeParse(req.body);
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() });
      const body = parsed.data;
      captureCtx = {
        rid,
        scope: '',
        siteCode: body.siteCode,
        deviceCode: body.deviceCode,
        deviceRequestId: body.requestId,
        idempotencyKey: body.idempotencyKey,
      };

      const auth = verifyDeviceSignature({
        surface: 'POST /api/devices/heartbeat',
        readType: 'HEARTBEAT',
        siteCode: body.siteCode,
        deviceCode: body.deviceCode,
        requestId: body.requestId,
        idempotencyKey: body.idempotencyKey,
        timestamp: body.timestamp,
        reportedAt: body.reportedAt,
        heartbeatStatus: body.status,
        signature: body.signature,
      });

      const requestHash = hashRequest({ ...body, signature: undefined });
      scope = buildCaptureScope('HEARTBEAT', body.siteCode, body.deviceCode);
      captureCtx.scope = scope;

      const claim = await claimOrReplay({ scope, idempotencyKey: body.idempotencyKey, requestHash });
      if (claim.replay) {
        observeSecretReplaySuspicion({ channel: 'DEVICE_CAPTURE', reason: 'IDEMPOTENCY_REPLAY' });
        logCapture(req, 'info', 'capture_replay', captureCtx);
        res.json(ok(rid, claim.responseJson));
        return;
      }
      claimedByThisRequest = true;

      const data = stringifyBigint(
        await recordDeviceHeartbeat({
          requestId: body.requestId,
          idempotencyKey: buildPersistedIdempotencyKey('HEARTBEAT', body.siteCode, body.deviceCode, body.idempotencyKey),
          siteCode: body.siteCode,
          deviceCode: body.deviceCode,
          reportedAt: body.reportedAt ? new Date(body.reportedAt) : new Date(auth.timestampIso),
          status: body.status,
          latencyMs: body.latencyMs,
          firmwareVersion: body.firmwareVersion,
          ipAddress: body.ipAddress,
          rawPayload: normalizeCaptureRawPayload(body.rawPayload, {
            authority: 'DEVICE_SIGNATURE',
            verified: auth.verified,
            secretSource: auth.secretSource,
            requestTimestamp: auth.timestampIso,
            maxSkewSeconds: auth.maxSkewSeconds,
            signatureVersion: 'capture-v1',
            serverRequestId: rid,
            deviceRequestId: body.requestId,
          }),
        }),
      );

      await markIdempotencySucceeded({ scope, key: body.idempotencyKey, responseJson: data });
      res.json(ok(rid, data));
    } catch (error) {
      const reason = getApiReason(error);
      captureCtx.reason = reason;

      if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') {
        logCapture(req, 'warn', 'capture_auth_failed', captureCtx);
      } else if (error instanceof ApiError && error.code === 'CONFLICT' && reason === 'IDEMPOTENCY_CONFLICT') {
        logCapture(req, 'warn', 'capture_idempotency_conflict', captureCtx);
      } else if (error instanceof ApiError && error.code === 'CONFLICT') {
        logCapture(req, 'warn', 'capture_idempotency_rejected', captureCtx);
      } else if (
        error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        ['INVALID_CAPTURE_TIMESTAMP', 'DEVICE_TIMESTAMP_EXPIRED', 'DEVICE_TIMESTAMP_AHEAD'].includes(reason ?? '')
      ) {
        logCapture(req, 'warn', 'capture_timestamp_rejected', captureCtx);
      } else {
        logCapture(req, 'error', 'capture_ingest_failed', captureCtx, error);
      }

      if (claimedByThisRequest && scope) {
        await markIdempotencyFailed({ scope, key: String((req.body as any)?.idempotencyKey ?? '') }).catch(() => void 0);
      }
      next(error);
    }
  });
}
