import {
  insertDeviceHeartbeat,
  resolveDeviceContext,
} from '../infrastructure/device-heartbeats.repo';

export async function recordDeviceHeartbeat(input: {
  requestId: string;
  idempotencyKey: string;
  siteCode: string;
  deviceCode: string;
  reportedAt: Date;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  latencyMs?: number;
  firmwareVersion?: string;
  ipAddress?: string;
  rawPayload?: unknown;
}) {
  const context = await resolveDeviceContext({
    siteCode: input.siteCode,
    deviceCode: input.deviceCode,
  });

  const heartbeat = await insertDeviceHeartbeat({
    siteId: context.siteId,
    deviceId: context.deviceId,
    status: input.status,
    reportedAt: input.reportedAt,
    latencyMs: input.latencyMs ?? null,
    firmwareVersion: input.firmwareVersion ?? null,
    ipAddress: input.ipAddress ?? null,
    payloadJson: {
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      rawPayload: input.rawPayload ?? null,
    },
  });

  return {
    siteCode: context.siteCode,
    deviceCode: context.deviceCode,
    deviceType: context.deviceType,
    direction: context.direction,
    laneCode: context.laneCode,
    heartbeatId: heartbeat.heartbeatId,
    status: input.status,
    reportedAt: heartbeat.reportedAt.toISOString(),
    receivedAt: heartbeat.receivedAt.toISOString(),
    latencyMs: input.latencyMs ?? null,
    firmwareVersion: input.firmwareVersion ?? null,
    ipAddress: input.ipAddress ?? null,
    changed: true,
    alreadyExists: false,
  };
}
