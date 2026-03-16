import {
  persistGateReadEvent,
  resolveLaneContext,
  resolveOrCreateSession,
} from '../infrastructure/gate-read-events.repo';

export async function ingestRfidRead(input: {
  requestId: string;
  idempotencyKey: string;
  siteCode: string;
  laneCode?: string;
  deviceCode?: string;
  direction: 'ENTRY' | 'EXIT';
  occurredAt: Date;
  rfidUid: string;
  rawPayload?: unknown;
}) {
  const context = await resolveLaneContext({
    siteCode: input.siteCode,
    laneCode: input.laneCode,
    deviceCode: input.deviceCode,
    expectedDirection: input.direction,
  });

  const session = await resolveOrCreateSession({
    siteId: context.siteId,
    laneId: context.laneId,
    direction: context.direction,
    occurredAt: input.occurredAt,
    requestId: input.requestId,
    readType: 'RFID',
    rfidUid: input.rfidUid,
    presenceActive: true,
  });

  const persisted = await persistGateReadEvent({
    sessionId: session.sessionId,
    siteId: context.siteId,
    laneId: context.laneId,
    deviceId: context.deviceId,
    readType: 'RFID',
    direction: context.direction,
    occurredAt: input.occurredAt,
    rfidUid: input.rfidUid,
    payloadJson: {
      source: 'CAPTURE_API',
      rawPayload: input.rawPayload ?? null,
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
    readType: 'RFID' as const,
    occurredAt: input.occurredAt.toISOString(),
    sessionId: session.sessionId,
    sessionStatus: session.sessionStatus,
    readEventId: persisted.readEventId,
    changed: persisted.changed,
    alreadyExists: !persisted.changed,
    rfidUid: input.rfidUid,
    sensorState: null,
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
