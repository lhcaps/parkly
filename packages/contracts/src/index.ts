import { z } from 'zod'

export const AuthRoleSchema = z.enum([
  'SUPER_ADMIN',
  'SITE_ADMIN',
  'MANAGER',
  'CASHIER',
  'GUARD',
  'OPERATOR',
  'VIEWER',
])
export const LegacyAuthRoleSchema = z.enum(['ADMIN', 'OPS', 'WORKER'])
export const AcceptedAuthRoleSchema = z.union([AuthRoleSchema, LegacyAuthRoleSchema])
export const SiteScopeInfoSchema = z.object({
  siteId: z.string().trim().min(1),
  siteCode: z.string().trim().min(1),
  scopeLevel: z.string().trim().min(1),
})
export const UserAuthPrincipalSchema = z.object({
  principalType: z.literal('USER'),
  role: AuthRoleSchema,
  actorLabel: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  username: z.string().trim().min(1),
  sessionId: z.string().trim().min(1),
  siteScopes: z.array(SiteScopeInfoSchema),
})
export const ServiceAuthPrincipalSchema = z.object({
  principalType: z.literal('SERVICE'),
  role: z.string().trim().min(1),
  actorLabel: z.string().trim().min(1),
  serviceCode: z.string().trim().min(1),
  siteScopes: z.array(SiteScopeInfoSchema).default([]),
})
export const AuthPrincipalSchema = z.union([UserAuthPrincipalSchema, ServiceAuthPrincipalSchema])
export const AuthTokenBundleSchema = z.object({
  accessToken: z.string().trim().min(1),
  refreshToken: z.string().trim().min(1),
  accessExpiresAt: z.string().datetime(),
  refreshExpiresAt: z.string().datetime(),
  principal: AuthPrincipalSchema,
})

const AUTH_ROLE_VALUES = new Set<string>(AuthRoleSchema.options)

export function asCanonicalAuthRole(value: unknown): AuthRole | null {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return AUTH_ROLE_VALUES.has(normalized) ? (normalized as AuthRole) : null
}

export function normalizeAcceptedAuthRole(value: unknown): AuthRole | null {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (!normalized) return null
  if (normalized === 'ADMIN') return 'SUPER_ADMIN'
  if (normalized === 'OPS' || normalized === 'WORKER') return 'OPERATOR'
  return asCanonicalAuthRole(normalized)
}

export function isGlobalAuthRole(role: AuthRole | string | null | undefined): role is AuthRole {
  return String(role ?? '').trim().toUpperCase() === 'SUPER_ADMIN'
}

export const DirectionSchema = z.enum(['ENTRY', 'EXIT'])
export const SessionDirectionSchema = DirectionSchema
export const PlateFamilySchema = z.enum(['DOMESTIC', 'SPECIAL', 'DIPLOMATIC', 'FOREIGN', 'UNKNOWN'])
export const PlateValiditySchema = z.enum(['STRICT_VALID', 'REVIEW', 'INVALID'])


export const PreviewStatusSchema = PlateValiditySchema
export const ApiBusinessErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'NOT_FOUND',
  'UNSUPPORTED_MEDIA_TYPE',
  'UNPROCESSABLE_ENTITY',
  'SERVICE_UNAVAILABLE',
])
export const ApiBusinessErrorSchema = z.object({
  code: ApiBusinessErrorCodeSchema,
  message: z.string().trim().min(1),
  details: z.unknown().optional(),
})

export const AlprPreviewCandidateSchema = z.object({
  plate: z.string().trim().min(1).max(32),
  score: z.coerce.number().min(0).max(100),
  votes: z.coerce.number().int().nonnegative(),
  cropVariants: z.array(z.string().trim().min(1)).default([]),
  psmModes: z.array(z.coerce.number().int().nonnegative()).default([]),
  suspiciousFlags: z.array(z.string().trim().min(1)).default([]),
})

export const AlprPreviewWinnerSchema = z.object({
  cropVariant: z.string().trim().min(1),
  psm: z.coerce.number().int().nonnegative(),
  rawText: z.string(),
  score: z.coerce.number().min(0).max(100),
})

export const AlprPreviewRawDiagnosticsSchema = z.object({
  mode: z.string().trim().min(1).nullable(),
  imageUrl: z.string().trim().max(1024).nullable(),
  imagePath: z.string().trim().nullable(),
  originalFilename: z.string().trim().nullable(),
  rawText: z.string().nullable(),
  attempts: z.coerce.number().int().nonnegative(),
  failureReason: z.string().trim().nullable(),
  cacheHit: z.boolean().nullable(),
  latencyMs: z.coerce.number().nonnegative().nullable(),
  authoritative: z.string().trim().min(1).nullable(),
}).catchall(z.unknown())

export const LaneFlowPreviewSnapshotSchema = z.object({
  recognizedPlate: z.string().trim().max(32).optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
  previewStatus: PreviewStatusSchema.optional(),
  needsConfirm: z.boolean().optional(),
  candidates: z.array(AlprPreviewCandidateSchema).optional(),
  winner: AlprPreviewWinnerSchema.nullable().optional(),
  raw: AlprPreviewRawDiagnosticsSchema.optional(),
})
export const DeviceStatusSchema = z.enum(['ONLINE', 'DEGRADED', 'OFFLINE', 'MAINTENANCE'])
export const CaptureHeartbeatStatusSchema = z.enum(['ONLINE', 'DEGRADED', 'OFFLINE'])
export const LaneStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE'])
export const LaneAggregateHealthSchema = z.enum(['HEALTHY', 'DEGRADED_CAMERA', 'DEGRADED_RFID', 'DEGRADED_SENSOR', 'BARRIER_FAULT', 'OFFLINE'])
export const DeviceRoleSchema = z.enum(['PRIMARY', 'CAMERA', 'RFID', 'LOOP_SENSOR', 'BARRIER'])
export const GateReadTypeSchema = z.enum(['ALPR', 'RFID', 'SENSOR'])
export const SensorStateSchema = z.enum(['PRESENT', 'CLEARED', 'TRIGGERED'])
export const SessionStatusSchema = z.enum(['OPEN', 'WAITING_READ', 'WAITING_DECISION', 'APPROVED', 'WAITING_PAYMENT', 'DENIED', 'PASSED', 'TIMEOUT', 'CANCELLED', 'ERROR'])
export const SessionAllowedActionSchema = z.enum(['APPROVE', 'REQUIRE_PAYMENT', 'DENY', 'CONFIRM_PASS', 'CANCEL'])
export const ReviewQueueActionSchema = z.enum(['CLAIM', 'MANUAL_APPROVE', 'MANUAL_REJECT', 'MANUAL_OPEN_BARRIER'])
export const BarrierCommandStatusSchema = z.enum(['PENDING', 'SENT', 'ACKED', 'NACKED', 'TIMEOUT', 'CANCELLED'])

export const BarrierLifecycleSchema = z.object({
  promotedToSent: z.number().int().nonnegative(),
  timedOut: z.number().int().nonnegative(),
})

const IsoDateTime = z.string().datetime().optional()
const SignedIsoDateTime = z.string().datetime()
const CaptureSignatureSchema = z.string().trim().regex(/^[a-fA-F0-9]{64,256}$/, 'signature không hợp lệ')

const DeviceSignedCaptureBaseSchema = z.object({
  requestId: z.string().trim().min(1).max(64),
  idempotencyKey: z.string().trim().min(8).max(64),
  siteCode: z.string().trim().min(1),
  deviceCode: z.string().trim().min(1),
  timestamp: SignedIsoDateTime,
  signature: CaptureSignatureSchema,
  signatureVersion: z.literal('capture-v1').optional(),
})

export const PlateCanonicalDtoSchema = z.object({
  plateRaw: z.string().trim().max(32).nullable(),
  plateCompact: z.string().trim().max(32).nullable(),
  plateDisplay: z.string().trim().max(32).nullable(),
  plateFamily: PlateFamilySchema,
  plateValidity: PlateValiditySchema,
  ocrSubstitutions: z.array(z.string()),
  suspiciousFlags: z.array(z.string()),
  validationNotes: z.array(z.string()),
  reviewRequired: z.boolean(),
})
export type PlateCanonicalDto = z.infer<typeof PlateCanonicalDtoSchema>

export const PlateCarrierSchema = z.object({
  plate: PlateCanonicalDtoSchema.nullable(),
})
export type PlateCarrier = z.infer<typeof PlateCarrierSchema>

export const SiteRowSchema = z.object({
  siteCode: z.string().trim().min(1),
  name: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
  isActive: z.boolean(),
})

export const GateRowSchema = z.object({
  siteCode: z.string().trim().min(1),
  gateCode: z.string().trim().min(1),
  label: z.string().trim().min(1),
  laneCount: z.number().int().nonnegative(),
  directions: z.array(DirectionSchema),
})

export const LaneRowSchema = z.object({
  siteCode: z.string().trim().min(1),
  gateCode: z.string().trim().min(1),
  laneCode: z.string().trim().min(1),
  label: z.string().trim().min(1),
  direction: DirectionSchema,
  deviceCode: z.string().trim().min(1),
  deviceType: z.string().trim().min(1),
  locationHint: z.string().nullable(),
  status: LaneStatusSchema.optional(),
  sortOrder: z.number().int().optional(),
  primaryDeviceCode: z.string().trim().min(1).nullable().optional(),
  zoneCode: z.string().trim().nullable().optional(),
  zoneName: z.string().trim().nullable().optional(),
  floorKey: z.string().trim().nullable().optional(),
  spotCount: z.number().int().nonnegative().nullable().optional(),
})

export const DeviceRowSchema = z.object({
  siteCode: z.string().trim().min(1),
  gateCode: z.string().trim().min(1).nullable(),
  laneCode: z.string().trim().min(1).nullable(),
  laneLabel: z.string().trim().min(1).nullable(),
  laneStatus: LaneStatusSchema.nullable(),
  deviceCode: z.string().trim().min(1),
  deviceType: z.string().trim().min(1),
  direction: DirectionSchema,
  locationHint: z.string().nullable(),
  deviceRole: DeviceRoleSchema.nullable(),
  isPrimary: z.boolean(),
  isRequired: z.boolean(),
  heartbeatStatus: DeviceStatusSchema.nullable(),
  heartbeatReportedAt: z.string().datetime().nullable(),
  heartbeatReceivedAt: z.string().datetime().nullable(),
  heartbeatAgeSeconds: z.number().int().nonnegative().nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
  firmwareVersion: z.string().trim().max(64).nullable(),
  ipAddress: z.string().trim().max(64).nullable(),
})

export const SitesListResponseSchema = z.object({ rows: z.array(SiteRowSchema) })
export const GatesListResponseSchema = z.object({ siteCode: z.string().trim().min(1), rows: z.array(GateRowSchema) })
export const LanesListResponseSchema = z.object({ siteCode: z.string().trim().min(1), rows: z.array(LaneRowSchema) })
export const DevicesListResponseSchema = z.object({
  siteCode: z.string().trim().min(1).nullable(),
  rows: z.array(DeviceRowSchema),
})

export const DeviceHealthStreamItemSchema = z.object({
  siteCode: z.string().trim().min(1),
  gateCode: z.string().trim().min(1).nullable(),
  laneCode: z.string().trim().min(1).nullable(),
  laneLabel: z.string().trim().min(1).nullable(),
  laneDirection: DirectionSchema.nullable(),
  laneOperationalStatus: LaneStatusSchema.nullable(),
  deviceCode: z.string().trim().min(1),
  deviceType: z.string().trim().min(1),
  deviceRole: z.string().trim().min(1).nullable(),
  isPrimary: z.boolean(),
  isRequired: z.boolean(),
  heartbeatStatus: DeviceStatusSchema.nullable(),
  derivedHealth: z.enum(['ONLINE', 'DEGRADED', 'OFFLINE']),
  healthReason: z.string().trim().min(1),
  heartbeatReportedAt: z.string().datetime().nullable(),
  heartbeatReceivedAt: z.string().datetime().nullable(),
  heartbeatAgeSeconds: z.number().int().nonnegative().nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
  firmwareVersion: z.string().trim().max(64).nullable(),
  ipAddress: z.string().trim().max(64).nullable(),
  locationHint: z.string().trim().max(255).nullable(),
})

export const DeviceHealthSnapshotSchema = z.object({
  ts: z.number().int().nonnegative(),
  siteCode: z.string().trim().min(1).nullable(),
  rows: z.array(DeviceHealthStreamItemSchema),
})

export const LaneStatusStreamItemSchema = z.object({
  siteCode: z.string().trim().min(1),
  gateCode: z.string().trim().min(1),
  laneCode: z.string().trim().min(1),
  laneLabel: z.string().trim().min(1),
  direction: DirectionSchema,
  laneOperationalStatus: LaneStatusSchema,
  aggregateHealth: LaneAggregateHealthSchema,
  aggregateReason: z.string().trim().min(1),
  lastBarrierStatus: z.string().trim().min(1).nullable(),
  lastBarrierIssuedAt: z.string().datetime().nullable(),
  lastSessionStatus: SessionStatusSchema.nullable(),
  activePresenceCount: z.number().int().nonnegative(),
  requiredDeviceCount: z.number().int().nonnegative(),
  onlineDeviceCount: z.number().int().nonnegative(),
  degradedDeviceCount: z.number().int().nonnegative(),
  offlineDeviceCount: z.number().int().nonnegative(),
  zoneCode: z.string().trim().nullable().optional(),
  zoneName: z.string().trim().nullable().optional(),
  floorKey: z.string().trim().nullable().optional(),
  spotCount: z.number().int().nonnegative().nullable().optional(),
  devices: z.array(z.object({
    deviceCode: z.string().trim().min(1),
    deviceRole: z.string().trim().min(1).nullable(),
    deviceType: z.string().trim().min(1),
    derivedHealth: z.enum(['ONLINE', 'DEGRADED', 'OFFLINE']),
    heartbeatStatus: DeviceStatusSchema.nullable(),
    heartbeatAgeSeconds: z.number().int().nonnegative().nullable(),
    heartbeatReceivedAt: z.string().datetime().nullable().optional(),
    latencyMs: z.number().int().nonnegative().nullable().optional(),
    firmwareVersion: z.string().trim().max(64).nullable().optional(),
    ipAddress: z.string().trim().max(64).nullable().optional(),
    isRequired: z.boolean(),
  })),
})

export const LaneStatusSnapshotSchema = z.object({
  ts: z.number().int().nonnegative(),
  siteCode: z.string().trim().min(1).nullable(),
  barrierLifecycle: BarrierLifecycleSchema,
  rows: z.array(LaneStatusStreamItemSchema),
})

export const BarrierLifecycleStreamItemSchema = z.object({
  eventType: z.literal('lane.barrier.lifecycle'),
  siteCode: z.string().trim().nullable(),
  payload: BarrierLifecycleSchema,
})

export const OutboxStreamItemSchema = z.object({
  outboxId: z.string().trim().min(1),
  eventId: z.string().trim().min(1),
  siteCode: z.string().trim().min(1).nullable(),
  laneCode: z.string().trim().min(1).nullable(),
  deviceCode: z.string().trim().min(1).nullable(),
  eventTime: z.string().datetime(),
  status: z.string().trim().min(1),
  attempts: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  nextRetryAt: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
  mongoDocId: z.string().trim().nullable(),
  payloadSummary: z.object({
    direction: DirectionSchema.nullable(),
    readType: z.string().trim().min(1).nullable(),
    plateCompact: z.string().trim().max(32).nullable(),
    plateDisplay: z.string().trim().max(32).nullable(),
    reviewRequired: z.boolean(),
  }),
})

export const OutboxSnapshotSchema = z.object({
  ts: z.number().int().nonnegative(),
  siteCode: z.string().trim().min(1).nullable(),
  barrierLifecycle: z.object({
    promotedToSent: z.number().int().nonnegative(),
    timedOut: z.number().int().nonnegative(),
  }),
  rows: z.array(OutboxStreamItemSchema),
})

export const GateEventWriteBodySchema = z.object({
  siteCode: z.string().trim().min(1).optional(),
  deviceCode: z.string().trim().min(1).optional(),
  laneCode: z.string().trim().min(1).optional(),
  direction: DirectionSchema,
  eventTime: IsoDateTime,
  idempotencyKey: z.string().trim().min(8).max(64),
  ticketId: z.string().trim().optional(),
  licensePlateRaw: z.string().trim().max(32).optional(),
  rfidUid: z.string().trim().max(64).optional(),
  imageUrl: z.string().trim().max(1024).optional(),
  alprResult: z
    .object({
      plate: z.string().trim().max(32).optional(),
      confidence: z.coerce.number().min(0).max(1).optional(),
      raw: z.unknown().optional(),
    })
    .optional(),
  rawPayload: z.unknown().optional(),
  simulatePlate: z.boolean().optional(),
})
export type GateEventWriteBody = z.infer<typeof GateEventWriteBodySchema>

export const CaptureAlprBodySchema = DeviceSignedCaptureBaseSchema.extend({
  laneCode: z.string().trim().min(1).optional(),
  direction: DirectionSchema,
  eventTime: IsoDateTime,
  plateRaw: z.string().trim().max(32).optional(),
  imageUrl: z.string().trim().max(1024).optional(),
  ocrConfidence: z.coerce.number().min(0).max(1).optional(),
  rawPayload: z.unknown().optional(),
})

export const CaptureRfidBodySchema = DeviceSignedCaptureBaseSchema.extend({
  laneCode: z.string().trim().min(1).optional(),
  direction: DirectionSchema,
  eventTime: IsoDateTime,
  rfidUid: z.string().trim().min(1).max(64),
  rawPayload: z.unknown().optional(),
})

export const CaptureSensorBodySchema = DeviceSignedCaptureBaseSchema.extend({
  laneCode: z.string().trim().min(1).optional(),
  direction: DirectionSchema,
  eventTime: IsoDateTime,
  sensorState: SensorStateSchema,
  rawPayload: z.unknown().optional(),
})

export const DeviceHeartbeatBodySchema = DeviceSignedCaptureBaseSchema.extend({
  reportedAt: IsoDateTime,
  status: CaptureHeartbeatStatusSchema,
  latencyMs: z.coerce.number().int().nonnegative().optional(),
  firmwareVersion: z.string().trim().max(64).optional(),
  ipAddress: z.string().trim().max(64).optional(),
  rawPayload: z.unknown().optional(),
})

export const SessionOpenBodySchema = z.object({
  requestId: z.string().trim().min(1).max(64),
  idempotencyKey: z.string().trim().min(8).max(64),
  siteCode: z.string().trim().min(1),
  laneCode: z.string().trim().min(1),
  direction: SessionDirectionSchema,
  occurredAt: IsoDateTime,
  presenceActive: z.boolean().optional(),
  correlationId: z.string().trim().max(64).optional(),
  plateRaw: z.string().trim().max(32).optional(),
  rfidUid: z.string().trim().max(64).optional(),
  deviceCode: z.string().trim().min(1).optional(),
  readType: GateReadTypeSchema.optional(),
  sensorState: SensorStateSchema.optional(),
  ocrConfidence: z.coerce.number().min(0).max(1).optional(),
  rawPayload: z.unknown().optional(),
})

export const SessionResolveBodySchema = z.object({
  requestId: z.string().trim().min(1).max(64),
  idempotencyKey: z.string().trim().min(8).max(64),
  sessionId: z.union([z.string(), z.number().int()]).optional(),
  siteCode: z.string().trim().min(1).optional(),
  laneCode: z.string().trim().min(1).optional(),
  direction: SessionDirectionSchema.optional(),
  occurredAt: IsoDateTime,
  deviceCode: z.string().trim().min(1).optional(),
  readType: GateReadTypeSchema.optional(),
  sensorState: SensorStateSchema.optional(),
  plateRaw: z.string().trim().max(32).optional(),
  ocrConfidence: z.coerce.number().min(0).max(1).optional(),
  rfidUid: z.string().trim().max(64).optional(),
  presenceActive: z.boolean().optional(),
  approved: z.boolean().optional(),
  denied: z.boolean().optional(),
  paymentRequired: z.boolean().optional(),
  reasonCode: z.string().trim().max(64).optional(),
  reasonDetail: z.string().trim().max(255).optional(),
  autoOpenIfMissing: z.boolean().optional(),
  rawPayload: z.unknown().optional(),
})

const ManualAuditBodyBaseSchema = z.object({
  requestId: z.string().trim().min(1).max(64),
  idempotencyKey: z.string().trim().min(8).max(64),
  occurredAt: IsoDateTime,
  reasonCode: z.string().trim().min(1).max(64),
  note: z.string().trim().min(1).max(1000),
  rawPayload: z.unknown().optional(),
})

export const ReviewClaimBodySchema = ManualAuditBodyBaseSchema
export const SessionManualOverrideBodySchema = ManualAuditBodyBaseSchema


export const AlprPreviewRequestSchema = z.object({
  imageUrl: z.string().trim().min(1).max(1024).optional(),
  plateHint: z.string().trim().max(32).optional(),
  mode: z.enum(['MOCK', 'TESSERACT', 'DISABLED']).optional(),
})

export const AlprRecognizeBodySchema = AlprPreviewRequestSchema

export const LaneFlowSubmitBodySchema = z.object({
  requestId: z.string().trim().min(1).max(64),
  idempotencyKey: z.string().trim().min(8).max(128),
  siteCode: z.string().trim().min(1),
  laneCode: z.string().trim().min(1),
  direction: DirectionSchema,
  deviceCode: z.string().trim().min(1),
  sensorDeviceCode: z.string().trim().min(1).optional(),
  imageUrl: z.string().trim().max(1024).optional(),
  plateConfirmed: z.string().trim().max(32).optional(),
  previewSnapshot: LaneFlowPreviewSnapshotSchema.optional(),
  rawPayload: z.unknown().optional(),
})

const GateEventWriteMetaSchema = z.object({
  siteCode: z.string().trim().min(1),
  deviceCode: z.string().trim().min(1),
  laneCode: z.string().trim().min(1),
  eventId: z.union([z.string(), z.number()]),
  outboxId: z.union([z.string(), z.number()]),
  changed: z.boolean(),
  alreadyExists: z.boolean(),
})

export const GateEventWriteResponseSchema = GateEventWriteMetaSchema.merge(PlateCanonicalDtoSchema).extend({
  plate: PlateCanonicalDtoSchema.nullable(),
  mappedSessionId: z.string().trim().nullable().optional(),
  mappedSessionStatus: z.string().trim().nullable().optional(),
  mappedDecisionCode: z.string().trim().nullable().optional(),
})


export const SessionSummaryDtoSchema = z.object({
  sessionId: z.string().trim().min(1),
  siteCode: z.string().trim().min(1),
  gateCode: z.string().trim().min(1),
  laneCode: z.string().trim().min(1),
  direction: SessionDirectionSchema,
  status: SessionStatusSchema,
  allowedActions: z.array(SessionAllowedActionSchema),
  ticketId: z.string().trim().nullable(),
  correlationId: z.string().trim().nullable(),
  openedAt: z.string().datetime(),
  lastReadAt: z.string().datetime().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  closedAt: z.string().datetime().nullable(),
  plateCompact: z.string().trim().max(32).nullable(),
  rfidUid: z.string().trim().max(64).nullable(),
  presenceActive: z.boolean(),
  reviewRequired: z.boolean(),
  readCount: z.number().int().nonnegative(),
  decisionCount: z.number().int().nonnegative(),
  barrierCommandCount: z.number().int().nonnegative(),
})

export const SessionReadSchema = z.object({
  readEventId: z.string().trim().min(1),
  readType: z.string().trim().min(1),
  direction: z.string().trim().min(1),
  occurredAt: z.string().datetime(),
  plateRaw: z.string().trim().max(32).nullable(),
  plateCompact: z.string().trim().max(32).nullable(),
  ocrConfidence: z.number().nullable(),
  rfidUid: z.string().trim().max(64).nullable(),
  sensorState: z.string().trim().nullable(),
  requestId: z.string().trim().nullable(),
  idempotencyKey: z.string().trim().nullable(),
  deviceId: z.string().trim().nullable(),
  evidence: z.object({
    sourceMediaId: z.string().trim().nullable(),
    rawOcrText: z.string().trim().nullable(),
    cameraFrameRef: z.string().trim().nullable(),
    cropRef: z.string().trim().nullable(),
    sourceDeviceCode: z.string().trim().nullable(),
    sourceCaptureTs: z.string().datetime().nullable(),
    media: z.object({
      mediaId: z.string().trim().min(1),
      storageKind: z.string().trim().nullable(),
      mediaUrl: z.string().trim().nullable(),
      filePath: z.string().trim().nullable(),
      mimeType: z.string().trim().nullable(),
      sha256: z.string().trim().nullable(),
      widthPx: z.number().nullable(),
      heightPx: z.number().nullable(),
      capturedAt: z.string().datetime().nullable(),
      metadata: z.unknown(),
    }).nullable(),
  }),
})

export const SessionDecisionSchema = z.object({
  decisionId: z.string().trim().min(1),
  decisionCode: z.string().trim().min(1),
  recommendedAction: z.string().trim().min(1),
  finalAction: z.string().trim().min(1),
  reasonCode: z.string().trim().min(1),
  reasonDetail: z.string().trim().nullable(),
  reviewRequired: z.boolean(),
  explanation: z.string().trim().min(1),
  inputSnapshot: z.unknown().nullable(),
  thresholdSnapshot: z.unknown().nullable(),
  createdAt: z.string().datetime(),
})

export const SessionBarrierCommandSchema = z.object({
  commandId: z.string().trim().min(1),
  commandType: z.string().trim().min(1),
  status: z.string().trim().min(1),
  reasonCode: z.string().trim().nullable(),
  requestId: z.string().trim().nullable(),
  issuedAt: z.string().datetime(),
  ackAt: z.string().datetime().nullable(),
})

export const SessionManualReviewSchema = z.object({
  reviewId: z.string().trim().min(1),
  status: z.string().trim().min(1),
  queueReasonCode: z.string().trim().min(1),
  claimedByUserId: z.string().trim().nullable(),
  claimedAt: z.string().datetime().nullable(),
  resolvedByUserId: z.string().trim().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  note: z.string().trim().nullable(),
  snapshot: z.unknown().nullable(),
  createdAt: z.string().datetime(),
})

export const SessionIncidentSchema = z.object({
  incidentId: z.string().trim().min(1),
  severity: z.string().trim().min(1),
  status: z.string().trim().min(1),
  incidentType: z.string().trim().min(1),
  title: z.string().trim().min(1),
  detail: z.string().trim().nullable(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  deviceId: z.string().trim().nullable(),
  laneId: z.string().trim().nullable(),
})

export const SessionTimelineItemSchema = z.object({
  kind: z.enum(['READ', 'DECISION', 'BARRIER_COMMAND', 'REVIEW', 'INCIDENT']),
  at: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
})


export const ReviewQueueItemSchema = z.object({
  reviewId: z.string().trim().min(1),
  status: z.string().trim().min(1),
  queueReasonCode: z.string().trim().min(1),
  claimedByUserId: z.string().trim().nullable(),
  claimedAt: z.string().datetime().nullable(),
  resolvedByUserId: z.string().trim().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  note: z.string().trim().nullable(),
  snapshot: z.unknown().nullable(),
  createdAt: z.string().datetime(),
  session: SessionSummaryDtoSchema,
  latestDecision: SessionDecisionSchema.nullable(),
  actions: z.array(ReviewQueueActionSchema),
})

export const ReviewQueueResponseSchema = z.object({
  rows: z.array(ReviewQueueItemSchema),
})

export const ManualReviewActionResponseSchema = z.object({
  session: SessionSummaryDtoSchema,
  reviewId: z.string().trim().nullable(),
  changed: z.boolean(),
})

export const SessionDetailSchema = z.object({
  session: SessionSummaryDtoSchema,
  reads: z.array(SessionReadSchema),
  decisions: z.array(SessionDecisionSchema),
  barrierCommands: z.array(SessionBarrierCommandSchema),
  manualReviews: z.array(SessionManualReviewSchema),
  incidents: z.array(SessionIncidentSchema),
  timeline: z.array(SessionTimelineItemSchema),
})

export const SessionOpenResponseSchema = z.object({
  reused: z.boolean(),
  reuseWindowMs: z.number().int().positive(),
  session: SessionSummaryDtoSchema,
  plate: PlateCanonicalDtoSchema.nullable(),
})

export const SessionResolveResponseSchema = z.object({
  session: SessionSummaryDtoSchema,
  plate: PlateCanonicalDtoSchema.nullable(),
  decision: z.object({
    decisionCode: z.string().trim().min(1),
    recommendedAction: z.string().trim().min(1),
    finalAction: z.string().trim().min(1),
    reasonCode: z.string().trim().min(1),
    reasonDetail: z.string().trim().nullable(),
    reviewRequired: z.boolean(),
    explanation: z.string().trim().min(1),
    inputSnapshot: z.unknown(),
    thresholdSnapshot: z.unknown(),
  }).nullable(),
})

export const SessionMutateResponseSchema = z.object({
  session: SessionSummaryDtoSchema,
  changed: z.boolean(),
})

export const SessionsListResponseSchema = z.object({
  rows: z.array(SessionSummaryDtoSchema),
})

export const CaptureAlprBody = CaptureAlprBodySchema
export const CaptureRfidBody = CaptureRfidBodySchema
export const CaptureSensorBody = CaptureSensorBodySchema
export const DeviceHeartbeatBody = DeviceHeartbeatBodySchema
export const SessionOpenBody = SessionOpenBodySchema
export const SessionResolveBody = SessionResolveBodySchema
export const ReviewClaimBody = ReviewClaimBodySchema
export const SessionManualOverrideBody = SessionManualOverrideBodySchema
export const SessionSummaryDto = SessionSummaryDtoSchema
export const SessionDetailDto = SessionDetailSchema
export const SessionOpenResponse = SessionOpenResponseSchema
export const SessionResolveResponse = SessionResolveResponseSchema
export const SessionMutateResponse = SessionMutateResponseSchema
export const ReviewQueueResponse = ReviewQueueResponseSchema
export const ManualReviewActionResponse = ManualReviewActionResponseSchema
export const SessionsListResponse = SessionsListResponseSchema

export const AlprPreviewResponseSchema = PlateCanonicalDtoSchema.extend({
  plate: PlateCanonicalDtoSchema,
  recognizedPlate: z.string().trim().max(32),
  confidence: z.coerce.number().min(0).max(1),
  previewStatus: PreviewStatusSchema,
  needsConfirm: z.boolean(),
  candidates: z.array(AlprPreviewCandidateSchema),
  winner: AlprPreviewWinnerSchema.nullable(),
  raw: AlprPreviewRawDiagnosticsSchema,
})

export const AlprRecognizeBody = AlprRecognizeBodySchema
export const AlprRecognizeResponseSchema = AlprPreviewResponseSchema
export const AlprPreviewBodySchema = AlprPreviewRequestSchema
export const AlprPreviewBody = AlprPreviewRequestSchema
export const AlprPreviewResponse = AlprPreviewResponseSchema

export type SiteRow = z.infer<typeof SiteRowSchema>
export type GateRow = z.infer<typeof GateRowSchema>
export type LaneRow = z.infer<typeof LaneRowSchema>
export type DeviceRow = z.infer<typeof DeviceRowSchema>
export type DeviceHealthStreamItem = z.infer<typeof DeviceHealthStreamItemSchema>
export type DeviceHealthSnapshot = z.infer<typeof DeviceHealthSnapshotSchema>
export type LaneStatusStreamItem = z.infer<typeof LaneStatusStreamItemSchema>
export type LaneStatusSnapshot = z.infer<typeof LaneStatusSnapshotSchema>
export type OutboxStreamItem = z.infer<typeof OutboxStreamItemSchema>
export type OutboxSnapshot = z.infer<typeof OutboxSnapshotSchema>
export type CaptureAlprBody = z.infer<typeof CaptureAlprBodySchema>
export type CaptureRfidBody = z.infer<typeof CaptureRfidBodySchema>
export type CaptureSensorBody = z.infer<typeof CaptureSensorBodySchema>
export type DeviceHeartbeatBody = z.infer<typeof DeviceHeartbeatBodySchema>
export type SessionStatus = z.infer<typeof SessionStatusSchema>
export type SessionAllowedAction = z.infer<typeof SessionAllowedActionSchema>
export type SessionOpenBody = z.infer<typeof SessionOpenBodySchema>
export type SessionResolveBody = z.infer<typeof SessionResolveBodySchema>
export type ReviewClaimBody = z.infer<typeof ReviewClaimBodySchema>
export type SessionManualOverrideBody = z.infer<typeof SessionManualOverrideBodySchema>
export type SessionSummaryDto = z.infer<typeof SessionSummaryDtoSchema>
export type SessionRead = z.infer<typeof SessionReadSchema>
export type SessionDecision = z.infer<typeof SessionDecisionSchema>
export type SessionBarrierCommand = z.infer<typeof SessionBarrierCommandSchema>
export type SessionManualReview = z.infer<typeof SessionManualReviewSchema>
export type ReviewQueueAction = z.infer<typeof ReviewQueueActionSchema>
export type ReviewQueueItem = z.infer<typeof ReviewQueueItemSchema>
export type ReviewQueueResponse = z.infer<typeof ReviewQueueResponseSchema>
export type ManualReviewActionResponse = z.infer<typeof ManualReviewActionResponseSchema>
export type SessionIncident = z.infer<typeof SessionIncidentSchema>
export type SessionTimelineItem = z.infer<typeof SessionTimelineItemSchema>
export type SessionDetail = z.infer<typeof SessionDetailSchema>
export type SessionOpenResponse = z.infer<typeof SessionOpenResponseSchema>
export type SessionResolveResponse = z.infer<typeof SessionResolveResponseSchema>
export type SessionMutateResponse = z.infer<typeof SessionMutateResponseSchema>
export type SessionsListResponse = z.infer<typeof SessionsListResponseSchema>
export type ApiBusinessErrorCode = z.infer<typeof ApiBusinessErrorCodeSchema>
export type ApiBusinessError = z.infer<typeof ApiBusinessErrorSchema>
export type AlprPreviewCandidate = z.infer<typeof AlprPreviewCandidateSchema>
export type AlprPreviewWinner = z.infer<typeof AlprPreviewWinnerSchema>
export type AlprPreviewRawDiagnostics = z.infer<typeof AlprPreviewRawDiagnosticsSchema>
export type LaneFlowPreviewSnapshot = z.infer<typeof LaneFlowPreviewSnapshotSchema>
export type LaneFlowSubmitBody = z.infer<typeof LaneFlowSubmitBodySchema>
export type AlprPreviewRequest = z.infer<typeof AlprPreviewRequestSchema>
export type AlprPreviewResponse = z.infer<typeof AlprPreviewResponseSchema>
export type AlprRecognizeBody = z.infer<typeof AlprRecognizeBodySchema>
export type GateEventWriteResponse = z.infer<typeof GateEventWriteResponseSchema>
export type AlprRecognizeResponse = z.infer<typeof AlprRecognizeResponseSchema>
export type BarrierLifecycle = z.infer<typeof BarrierLifecycleSchema>
export type BarrierCommandStatus = z.infer<typeof BarrierCommandStatusSchema>
export type BarrierLifecycleStreamItem = z.infer<typeof BarrierLifecycleStreamItemSchema>
export type AuthRole = z.infer<typeof AuthRoleSchema>
export type LegacyAuthRole = z.infer<typeof LegacyAuthRoleSchema>
export type AcceptedAuthRole = z.infer<typeof AcceptedAuthRoleSchema>
export type SiteScopeInfo = z.infer<typeof SiteScopeInfoSchema>
export type UserAuthPrincipal = z.infer<typeof UserAuthPrincipalSchema>
export type ServiceAuthPrincipal = z.infer<typeof ServiceAuthPrincipalSchema>
export type AuthPrincipal = z.infer<typeof AuthPrincipalSchema>
export type AuthTokenBundle = z.infer<typeof AuthTokenBundleSchema>

// ─── User Management (shared API ↔ web) ───────────────────────────────────────
export * from './user-management'

// ─── Customer Management (shared API ↔ web) ────────────────────────────────────
export * from './customer-management'
