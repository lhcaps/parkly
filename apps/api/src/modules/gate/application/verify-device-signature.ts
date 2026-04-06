import { createHmac, timingSafeEqual } from 'node:crypto';

import { getRotationAcceptedSecretValues, matchRotationSecret, resolveDeviceCaptureDefaultRotation } from '../../../lib/security/secret-rotation';
import { ApiError } from '../../../server/http';
import { observeSecretReject } from '../../../server/metrics';

export type DeviceCaptureReadType = 'ALPR' | 'RFID' | 'SENSOR' | 'HEARTBEAT';

export type VerifyDeviceSignatureInput = {
  surface: string;
  readType: DeviceCaptureReadType;
  siteCode: string;
  deviceCode: string;
  requestId: string;
  idempotencyKey: string;
  timestamp: string | Date;
  signature?: string | null;
  laneCode?: string | null;
  direction?: 'ENTRY' | 'EXIT' | null;
  eventTime?: string | Date | null;
  reportedAt?: string | Date | null;
  plateRaw?: string | null;
  rfidUid?: string | null;
  sensorState?: 'PRESENT' | 'CLEARED' | 'TRIGGERED' | null;
  heartbeatStatus?: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'MAINTENANCE' | null;
};

export type DeviceCaptureAuthResult = {
  verified: boolean;
  secretSource: 'DEVICE_CAPTURE_SECRETS_JSON' | 'DEVICE_CAPTURE_SECRET_<DEVICE_CODE>' | 'DEVICE_CAPTURE_DEFAULT_SECRET' | 'DEVICE_CAPTURE_SECRET_ACTIVE' | 'DEVICE_CAPTURE_SECRET_NEXT' | 'DISABLED';
  timestampIso: string;
  maxSkewSeconds: number;
};

function normalizeText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? '').trim().toUpperCase();
  if (!raw) return fallback;
  if (['1', 'TRUE', 'ON', 'YES'].includes(raw)) return true;
  if (['0', 'FALSE', 'OFF', 'NO'].includes(raw)) return false;
  return fallback;
}

function getMaxSkewSeconds(): number {
  const raw = Number(process.env.DEVICE_CAPTURE_MAX_SKEW_SECONDS ?? 300);
  if (!Number.isFinite(raw)) return 300;
  return Math.max(5, Math.floor(raw));
}

export function isDeviceCaptureAuthEnabled(): boolean {
  return parseBooleanEnv('DEVICE_CAPTURE_AUTH_MODE', true);
}

export function parseCaptureTimestamp(value: string | Date, surface: string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    observeSecretReject({ channel: 'DEVICE_CAPTURE', reason: 'INVALID_TIMESTAMP' });
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'timestamp của thiết bị không hợp lệ',
      details: { surface, reason: 'INVALID_CAPTURE_TIMESTAMP', timestamp: value },
    });
  }
  return date;
}

export function assertCaptureTimestampWithinSkew(args: { timestamp: string | Date; surface: string; now?: Date }): Date {
  const captureTs = parseCaptureTimestamp(args.timestamp, args.surface);
  const now = args.now ? new Date(args.now.getTime()) : new Date();
  const deltaMs = now.getTime() - captureTs.getTime();
  const skewMs = Math.abs(deltaMs);
  const maxSkewSeconds = getMaxSkewSeconds();

  if (skewMs > maxSkewSeconds * 1000) {
    const isExpired = deltaMs > 0;
    observeSecretReject({ channel: 'DEVICE_CAPTURE', reason: isExpired ? 'TIMESTAMP_EXPIRED' : 'TIMESTAMP_AHEAD' });
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: isExpired
        ? 'timestamp của thiết bị đã quá cũ'
        : 'timestamp của thiết bị vượt quá thời gian hiện tại cho phép',
      details: {
        surface: args.surface,
        reason: isExpired ? 'DEVICE_TIMESTAMP_EXPIRED' : 'DEVICE_TIMESTAMP_AHEAD',
        maxSkewSeconds,
        timestamp: captureTs.toISOString(),
        now: now.toISOString(),
        skewSeconds: Math.floor(skewMs / 1000),
      },
    });
  }

  return captureTs;
}

function parseDeviceSecretsJson(): Record<string, string> {
  const raw = String(process.env.DEVICE_CAPTURE_SECRETS_JSON ?? '').trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed ?? {})) {
      const normalizedKey = normalizeText(key)?.toUpperCase();
      const normalizedSecret = normalizeText(value);
      if (!normalizedKey || !normalizedSecret) continue;
      out[normalizedKey] = normalizedSecret;
    }
    return out;
  } catch {
    throw new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'DEVICE_CAPTURE_SECRETS_JSON không parse được',
      details: { reason: 'DEVICE_SECRET_CONFIG_INVALID_JSON' },
    });
  }
}

export function resolveDeviceSecret(deviceCode: string): {
  secret: string;
  source: DeviceCaptureAuthResult['secretSource'];
  acceptedSecrets?: Array<{ secret: string; source: DeviceCaptureAuthResult['secretSource'] }>;
} {
  const normalizedDeviceCode = normalizeText(deviceCode)?.toUpperCase();
  if (!normalizedDeviceCode) {
    throw new ApiError({ code: 'BAD_REQUEST', message: 'deviceCode là bắt buộc để verify chữ ký thiết bị' });
  }

  const fromJson = parseDeviceSecretsJson()[normalizedDeviceCode];
  if (fromJson) {
    return { secret: fromJson, source: 'DEVICE_CAPTURE_SECRETS_JSON' };
  }

  const exactEnvKey = `DEVICE_CAPTURE_SECRET_${normalizedDeviceCode.replace(/[^A-Z0-9]/g, '_')}`;
  const exactSecret = normalizeText(process.env[exactEnvKey]);
  if (exactSecret) {
    return { secret: exactSecret, source: 'DEVICE_CAPTURE_SECRET_<DEVICE_CODE>' };
  }

  const defaultRotation = resolveDeviceCaptureDefaultRotation(process.env)
  const defaultSecrets = getRotationAcceptedSecretValues(defaultRotation)
  if (defaultSecrets.length > 0) {
    const primary = matchRotationSecret(defaultRotation, defaultSecrets[0])
    const acceptedSecrets = defaultSecrets.map((secret) => {
      const matched = matchRotationSecret(defaultRotation, secret)
      return {
        secret,
        source: (matched?.sourceEnv === 'DEVICE_CAPTURE_SECRET_ACTIVE'
          ? 'DEVICE_CAPTURE_SECRET_ACTIVE'
          : matched?.sourceEnv === 'DEVICE_CAPTURE_SECRET_NEXT'
            ? 'DEVICE_CAPTURE_SECRET_NEXT'
            : 'DEVICE_CAPTURE_DEFAULT_SECRET') as DeviceCaptureAuthResult['secretSource'],
      }
    })

    return {
      secret: defaultSecrets[0],
      source: (primary?.sourceEnv === 'DEVICE_CAPTURE_SECRET_ACTIVE'
        ? 'DEVICE_CAPTURE_SECRET_ACTIVE'
        : primary?.sourceEnv === 'DEVICE_CAPTURE_SECRET_NEXT'
          ? 'DEVICE_CAPTURE_SECRET_NEXT'
          : 'DEVICE_CAPTURE_DEFAULT_SECRET') as DeviceCaptureAuthResult['secretSource'],
      acceptedSecrets,
    };
  }

  observeSecretReject({ channel: 'DEVICE_CAPTURE', reason: 'SECRET_NOT_CONFIGURED' });
  throw new ApiError({
    code: 'UNAUTHENTICATED',
    message: 'Thiết bị chưa được cấu hình secret để ký capture request',
    details: {
      reason: 'DEVICE_SECRET_NOT_CONFIGURED',
      deviceCode: normalizedDeviceCode,
    },
  });
}

function stablePayload(args: VerifyDeviceSignatureInput): string {
  const payload = {
    v: 'capture-v1',
    surface: normalizeText(args.surface),
    readType: normalizeText(args.readType),
    siteCode: normalizeText(args.siteCode)?.toUpperCase(),
    deviceCode: normalizeText(args.deviceCode)?.toUpperCase(),
    laneCode: normalizeText(args.laneCode)?.toUpperCase(),
    direction: normalizeText(args.direction)?.toUpperCase(),
    requestId: normalizeText(args.requestId),
    idempotencyKey: normalizeText(args.idempotencyKey),
    timestamp: parseCaptureTimestamp(args.timestamp, args.surface).toISOString(),
    eventTime: args.eventTime ? parseCaptureTimestamp(args.eventTime, args.surface).toISOString() : null,
    reportedAt: args.reportedAt ? parseCaptureTimestamp(args.reportedAt, args.surface).toISOString() : null,
    plateRaw: normalizeText(args.plateRaw)?.toUpperCase(),
    rfidUid: normalizeText(args.rfidUid)?.toUpperCase(),
    sensorState: normalizeText(args.sensorState)?.toUpperCase(),
    heartbeatStatus: normalizeText(args.heartbeatStatus)?.toUpperCase(),
  };

  return JSON.stringify(payload);
}

export function buildDeviceSignature(args: VerifyDeviceSignatureInput & { secret: string }): string {
  return createHmac('sha256', args.secret).update(stablePayload(args)).digest('hex');
}

function timingSafeHexCompare(expectedHex: string, providedHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex');
  const provided = Buffer.from(providedHex, 'hex');
  if (expected.length === 0 || provided.length === 0) return false;
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export function verifyDeviceSignature(args: VerifyDeviceSignatureInput): DeviceCaptureAuthResult {
  const timestampIso = assertCaptureTimestampWithinSkew({ timestamp: args.timestamp, surface: args.surface }).toISOString();
  const maxSkewSeconds = getMaxSkewSeconds();

  if (!isDeviceCaptureAuthEnabled()) {
    return {
      verified: false,
      secretSource: 'DISABLED',
      timestampIso,
      maxSkewSeconds,
    };
  }

  const signature = normalizeText(args.signature)?.toLowerCase();
  if (!signature) {
    observeSecretReject({ channel: 'DEVICE_CAPTURE', reason: 'MISSING_SIGNATURE' });
    throw new ApiError({
      code: 'UNAUTHENTICATED',
      message: 'Thiếu chữ ký thiết bị cho capture request',
      details: {
        reason: 'DEVICE_SIGNATURE_MISSING',
        deviceCode: normalizeText(args.deviceCode)?.toUpperCase() ?? null,
        surface: args.surface,
      },
    });
  }

  if (!/^[a-f0-9]{64,256}$/i.test(signature)) {
    observeSecretReject({ channel: 'DEVICE_CAPTURE', reason: 'INVALID_SIGNATURE_FORMAT' });
    throw new ApiError({
      code: 'UNAUTHENTICATED',
      message: 'Định dạng chữ ký thiết bị không hợp lệ',
      details: {
        reason: 'DEVICE_SIGNATURE_FORMAT_INVALID',
        deviceCode: normalizeText(args.deviceCode)?.toUpperCase() ?? null,
        surface: args.surface,
      },
    });
  }

  const { secret, source, acceptedSecrets } = resolveDeviceSecret(args.deviceCode);
  const accepted = acceptedSecrets && acceptedSecrets.length > 0
    ? acceptedSecrets
    : [{ secret, source }]

  const matched = accepted.find((candidate) => {
    const expected = buildDeviceSignature({ ...args, secret: candidate.secret }).toLowerCase()
    return timingSafeHexCompare(expected, signature)
  })

  if (!matched) {
    observeSecretReject({ channel: 'DEVICE_CAPTURE', reason: 'INVALID_SIGNATURE' });
    throw new ApiError({
      code: 'UNAUTHENTICATED',
      message: 'Chữ ký thiết bị không hợp lệ',
      details: {
        reason: 'DEVICE_SIGNATURE_INVALID',
        deviceCode: normalizeText(args.deviceCode)?.toUpperCase() ?? null,
        surface: args.surface,
        secretSource: source,
      },
    });
  }

  return {
    verified: true,
    secretSource: matched.source,
    timestampIso,
    maxSkewSeconds,
  };
}
