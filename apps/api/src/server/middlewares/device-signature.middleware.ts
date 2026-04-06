/**
 * Device HMAC Signature Middleware
 *
 * Verifies HMAC-SHA256 signature for device capture requests.
 * Used by /media/device-upload and other device endpoints.
 *
 * Headers:
 *   X-Device-Signature: <hmac_hex>
 *   X-Device-Timestamp:  <unix_ms>
 *   X-Device-Code:       <device_code>
 *
 * The signature is computed over: timestamp + method + path + body
 */

import type { Request, Response, NextFunction } from 'express';
import { createHmac } from 'node:crypto';

import { resolveDeviceSecret } from '../../modules/gate/application/verify-device-signature';
import { ApiError, fail } from '../http';

export type DeviceInfo = {
  deviceId: string | null;
  deviceCode: string;
  verified: boolean;
  secretSource: string;
  timestampIso: string;
  maxSkewSeconds: number;
};

declare global {
  namespace Express {
    interface Request {
      deviceInfo?: DeviceInfo;
    }
  }
}

function getMaxSkewSeconds(): number {
  const raw = Number(process.env.DEVICE_CAPTURE_MAX_SKEW_SECONDS ?? 300);
  if (!Number.isFinite(raw)) return 300;
  return Math.max(5, Math.floor(raw));
}

function parseCaptureTimestamp(value: string | undefined): Date | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return new Date(n);
}

function buildDevicePayload(args: {
  timestampMs: string;
  method: string;
  path: string;
  bodyHash: string;
}): string {
  return `${args.timestampMs}|${args.method.toUpperCase()}|${args.path}|${args.bodyHash}`;
}

function computeDeviceSignature(args: {
  secret: string;
  payload: string;
}): string {
  return createHmac('sha256', args.secret).update(args.payload).digest('hex');
}

function timingSafeHexCompare(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

export function verifyDeviceSignatureMiddleware(
  opts?: {
    surface?: string;
    requiredReadType?: 'ALPR' | 'RFID' | 'SENSOR';
  },
) {
  return async function deviceSignatureMiddleware(req: Request, res: Response, next: NextFunction) {
    const rid = (req as any).id ?? 'unknown';
    const surface = opts?.surface ?? req.path;

    const signature = req.header('x-device-signature');
    const timestampRaw = req.header('x-device-timestamp');
    const deviceCode = req.header('x-device-code');

    if (!signature || !timestampRaw || !deviceCode) {
      return res.status(401).json(
        fail(rid, {
          code: 'UNAUTHENTICATED',
          message: 'Thiếu device authentication headers (x-device-signature, x-device-timestamp, x-device-code)',
          details: { required: ['x-device-signature', 'x-device-timestamp', 'x-device-code'] },
        }),
      );
    }

    // Validate timestamp skew
    const captureTs = parseCaptureTimestamp(timestampRaw);
    if (!captureTs) {
      return res.status(400).json(
        fail(rid, {
          code: 'BAD_REQUEST',
          message: 'x-device-timestamp không hợp lệ (cần unix ms)',
          details: { header: 'x-device-timestamp', value: timestampRaw },
        }),
      );
    }

    const now = new Date();
    const skewMs = Math.abs(now.getTime() - captureTs.getTime());
    const maxSkewSeconds = getMaxSkewSeconds();
    if (skewMs > maxSkewSeconds * 1000) {
      const isExpired = captureTs.getTime() < now.getTime();
      return res.status(400).json(
        fail(rid, {
          code: 'BAD_REQUEST',
          message: isExpired
            ? 'x-device-timestamp đã quá cũ'
            : 'x-device-timestamp vượt quá thời gian hiện tại',
          details: {
            reason: isExpired ? 'DEVICE_TIMESTAMP_EXPIRED' : 'DEVICE_TIMESTAMP_AHEAD',
            maxSkewSeconds,
            skewSeconds: Math.floor(skewMs / 1000),
          },
        }),
      );
    }

    // Validate signature format
    if (!/^[a-f0-9]{64,256}$/i.test(signature)) {
      return res.status(401).json(
        fail(rid, {
          code: 'UNAUTHENTICATED',
          message: 'Định dạng chữ ký thiết bị không hợp lệ',
          details: { reason: 'INVALID_SIGNATURE_FORMAT' },
        }),
      );
    }

    // Resolve secret
    let secret: string;
    let secretSource: string;
    try {
      const result = resolveDeviceSecret(deviceCode);
      secret = result.secret;
      secretSource = result.source;
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError({
        code: 'UNAUTHENTICATED',
        message: 'Thiết bị chưa được cấu hình secret',
      });
      return res.status(apiErr.statusCode).json(fail(rid, { code: apiErr.code, message: apiErr.message, details: apiErr.details }));
    }

    // Compute expected signature
    const bodyHash = createHmac('sha256', secret).update(JSON.stringify(req.body ?? {})).digest('hex');
    const payload = buildDevicePayload({
      timestampMs: timestampRaw,
      method: req.method,
      path: req.path ?? '',
      bodyHash,
    });
    const expectedSignature = computeDeviceSignature({ secret, payload });

    if (!timingSafeHexCompare(expectedSignature.toLowerCase(), signature.toLowerCase())) {
      return res.status(401).json(
        fail(rid, {
          code: 'UNAUTHENTICATED',
          message: 'Chữ ký thiết bị không hợp lệ',
          details: { deviceCode, reason: 'INVALID_SIGNATURE', surface },
        }),
      );
    }

    // Attach device info to request
    req.deviceInfo = {
      deviceId: null, // Set by resolveLaneContext if needed
      deviceCode,
      verified: true,
      secretSource,
      timestampIso: captureTs.toISOString(),
      maxSkewSeconds,
    };

    next();
  };
}
