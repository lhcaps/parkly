import {
  persistGateReadEvent,
  resolveLaneContext,
  resolveOrCreateSession,
} from '../infrastructure/gate-read-events.repo';
import type { LaneLockHandle } from '../../../lib/lane-lock';

export async function ingestSensorRead(input: {
  requestId: string;
  idempotencyKey: string;
  siteCode: string;
  laneCode?: string;
  deviceCode?: string;
  direction: 'ENTRY' | 'EXIT';
  occurredAt: Date;
  sensorState: 'PRESENT' | 'CLEARED' | 'TRIGGERED';
  rawPayload?: unknown;
}) {
  const context = await resolveLaneContext({
    siteCode: input.siteCode,
    laneCode: input.laneCode,
    deviceCode: input.deviceCode,
    expectedDirection: input.direction,
  });

  const presenceActive = input.sensorState === 'PRESENT' || input.sensorState === 'TRIGGERED';

  const session = await resolveOrCreateSession({
    siteId: context.siteId,
    laneId: context.laneId,
    direction: context.direction,
    occurredAt: input.occurredAt,
    requestId: input.requestId,
    readType: 'SENSOR',
    sensorState: input.sensorState,
    presenceActive,
  });

  const persisted = await persistGateReadEvent({
    sessionId: session.sessionId,
    siteId: context.siteId,
    laneId: context.laneId,
    deviceId: context.deviceId,
    readType: 'SENSOR',
    direction: context.direction,
    occurredAt: input.occurredAt,
    sensorState: input.sensorState,
    payloadJson: {
      source: 'CAPTURE_API',
      rawPayload: input.rawPayload ?? null,
      derivedPresenceActive: presenceActive,
    },
    sourceDeviceCode: context.deviceCode,
    sourceCaptureTs: input.occurredAt,
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
  });

  return {
    siteCode: context.siteCode,
    laneCode: context.laneCode,
    deviceCode: context.deviceCode,
    direction: context.direction,
    readType: 'SENSOR' as const,
    occurredAt: input.occurredAt.toISOString(),
    sessionId: session.sessionId,
    sessionStatus: session.sessionStatus,
    readEventId: persisted.readEventId,
    changed: persisted.changed,
    alreadyExists: !persisted.changed,
    rfidUid: null,
    sensorState: input.sensorState,
    plateRaw: null,
    plateCompact: null,
    plateDisplay: null,
    plateFamily: 'UNKNOWN' as const,
    plateValidity: 'REVIEW' as const,
    ocrSubstitutions: [],
    suspiciousFlags: [],
    validationNotes: [],
    reviewRequired: false,
    plate: null,
  };
}
