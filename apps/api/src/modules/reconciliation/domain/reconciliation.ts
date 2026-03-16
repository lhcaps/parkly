export type SpotOccupancyStatus =
  | 'EMPTY'
  | 'OCCUPIED_MATCHED'
  | 'OCCUPIED_UNKNOWN'
  | 'OCCUPIED_VIOLATION'
  | 'SENSOR_STALE'

export type ReconciliationSpotRecord = {
  siteId: bigint | string
  zoneId: bigint | string | null
  spotId: bigint | string
  zoneCode: string | null
  spotCode: string
}

export type LatestPresenceEventRecord = {
  presenceEventId: bigint | string
  plateCompact: string | null
  confidence: number | null
  capturedAt: Date | string
  cameraCode: string | null
  traceId: string | null
  snapshotObjectKey: string | null
  modelVersion: string | null
}

export type ActiveGatePresenceRecord = {
  presenceId: bigint | string
  plateCompact: string | null
  ticketId: bigint | string | null
  sessionId: bigint | string | null
  enteredAt: Date | string | null
  lastSeenAt: Date | string | null
}

export type SubscriptionPlateContext = {
  subscriptionId: bigint | string
  subscriptionSpotId: bigint | string | null
  plateCompact: string
  assignedSpotIds: Array<string>
  assignedSpotCodes: Array<string>
  primaryAssignedSpotId: string | null
  primaryAssignedSpotCode: string | null
  primaryPlateCompact: string | null
}

export type SpotReservationContext = {
  subscriptionId: bigint | string
  subscriptionSpotId: bigint | string | null
  spotId: bigint | string
  spotCode: string
  primaryPlateCompact: string | null
  allowedPlateCompacts: Array<string>
}

export type ReconciliationDecisionInput = {
  now: Date
  sensorStaleSeconds: number
  spot: ReconciliationSpotRecord
  latestPresenceEvent: LatestPresenceEventRecord | null
  activeGatePresence: ActiveGatePresenceRecord | null
  observedVehicleSubscription: SubscriptionPlateContext | null
  reservedSpotSubscription: SpotReservationContext | null
}

export type SpotProjectionDecision = {
  occupancyStatus: SpotOccupancyStatus
  reasonCode: string
  reasonDetail: string
  observedPlateCompact: string | null
  expectedPlateCompact: string | null
  matchedSubscriptionId: string | null
  matchedSubscriptionSpotId: string | null
  matchedGatePresenceId: string | null
  sourcePresenceEventId: string | null
  staleAt: string | null
  snapshot: Record<string, unknown>
}

function normalizePlate(value: string | null | undefined) {
  const raw = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return raw || null
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toId(value: bigint | string | number | null | undefined) {
  if (value == null) return null
  return String(value)
}


export type ReconciliationIncidentSignalClass = 'STALE_SENSOR' | 'GHOST_PRESENCE' | 'REPEATED_MISMATCH' | 'VIOLATION' | 'NONE'

export function classifyReconciliationIncidentSignal(input: { occupancyStatus: SpotOccupancyStatus; reasonCode?: string | null }): ReconciliationIncidentSignalClass {
  const reasonCode = String(input.reasonCode ?? '').trim().toUpperCase()
  if (input.occupancyStatus === 'SENSOR_STALE' || reasonCode === 'SENSOR_STALE') return 'STALE_SENSOR'
  if (reasonCode === 'MISSING_GATE_PRESENCE' || reasonCode === 'PLATE_UNAVAILABLE') return 'GHOST_PRESENCE'
  if (reasonCode === 'VIP_WRONG_SPOT' || reasonCode === 'RESERVED_SPOT_OCCUPIED_BY_OTHER') return 'REPEATED_MISMATCH'
  if (input.occupancyStatus === 'OCCUPIED_VIOLATION') return 'VIOLATION'
  return 'NONE'
}

export function reconcileSpotProjection(input: ReconciliationDecisionInput): SpotProjectionDecision {
  const event = input.latestPresenceEvent
  const gatePresence = input.activeGatePresence
  const vehicleSubscription = input.observedVehicleSubscription
  const reservedSpot = input.reservedSpotSubscription
  const observedPlateCompact = normalizePlate(event?.plateCompact)

  const snapshot = {
    now: input.now.toISOString(),
    sensorStaleSeconds: input.sensorStaleSeconds,
    spot: {
      siteId: toId(input.spot.siteId),
      zoneId: toId(input.spot.zoneId),
      spotId: toId(input.spot.spotId),
      zoneCode: input.spot.zoneCode,
      spotCode: input.spot.spotCode,
    },
    latestPresenceEvent: event
      ? {
          presenceEventId: toId(event.presenceEventId),
          plateCompact: observedPlateCompact,
          confidence: event.confidence,
          capturedAt: toDate(event.capturedAt)?.toISOString() ?? null,
          cameraCode: event.cameraCode,
          traceId: event.traceId,
          snapshotObjectKey: event.snapshotObjectKey,
          modelVersion: event.modelVersion,
        }
      : null,
    activeGatePresence: gatePresence
      ? {
          presenceId: toId(gatePresence.presenceId),
          plateCompact: normalizePlate(gatePresence.plateCompact),
          ticketId: toId(gatePresence.ticketId),
          sessionId: toId(gatePresence.sessionId),
          enteredAt: toDate(gatePresence.enteredAt)?.toISOString() ?? null,
          lastSeenAt: toDate(gatePresence.lastSeenAt)?.toISOString() ?? null,
        }
      : null,
    observedVehicleSubscription: vehicleSubscription
      ? {
          subscriptionId: toId(vehicleSubscription.subscriptionId),
          subscriptionSpotId: toId(vehicleSubscription.subscriptionSpotId),
          plateCompact: vehicleSubscription.plateCompact,
          assignedSpotIds: vehicleSubscription.assignedSpotIds,
          assignedSpotCodes: vehicleSubscription.assignedSpotCodes,
          primaryAssignedSpotId: vehicleSubscription.primaryAssignedSpotId,
          primaryAssignedSpotCode: vehicleSubscription.primaryAssignedSpotCode,
          primaryPlateCompact: vehicleSubscription.primaryPlateCompact,
        }
      : null,
    reservedSpotSubscription: reservedSpot
      ? {
          subscriptionId: toId(reservedSpot.subscriptionId),
          subscriptionSpotId: toId(reservedSpot.subscriptionSpotId),
          spotId: toId(reservedSpot.spotId),
          spotCode: reservedSpot.spotCode,
          primaryPlateCompact: reservedSpot.primaryPlateCompact,
          allowedPlateCompacts: reservedSpot.allowedPlateCompacts,
        }
      : null,
  }

  if (!event) {
    return {
      occupancyStatus: 'EMPTY',
      reasonCode: 'NO_SENSOR_EVENT',
      reasonDetail: 'Chưa có internal presence event mới cho spot này.',
      observedPlateCompact: null,
      expectedPlateCompact: reservedSpot?.primaryPlateCompact ?? null,
      matchedSubscriptionId: toId(reservedSpot?.subscriptionId),
      matchedSubscriptionSpotId: toId(reservedSpot?.subscriptionSpotId),
      matchedGatePresenceId: null,
      sourcePresenceEventId: null,
      staleAt: null,
      snapshot,
    }
  }

  const capturedAt = toDate(event.capturedAt)
  const ageSeconds = capturedAt ? Math.max(0, Math.floor((input.now.getTime() - capturedAt.getTime()) / 1000)) : null
  if (ageSeconds == null || ageSeconds > input.sensorStaleSeconds) {
    return {
      occupancyStatus: 'SENSOR_STALE',
      reasonCode: 'SENSOR_STALE',
      reasonDetail: 'Feed camera cho spot này đã stale so với threshold hiện tại.',
      observedPlateCompact,
      expectedPlateCompact: reservedSpot?.primaryPlateCompact ?? vehicleSubscription?.primaryPlateCompact ?? null,
      matchedSubscriptionId: toId(vehicleSubscription?.subscriptionId ?? reservedSpot?.subscriptionId),
      matchedSubscriptionSpotId: toId(vehicleSubscription?.subscriptionSpotId ?? reservedSpot?.subscriptionSpotId),
      matchedGatePresenceId: toId(gatePresence?.presenceId),
      sourcePresenceEventId: toId(event.presenceEventId),
      staleAt: capturedAt?.toISOString() ?? null,
      snapshot: {
        ...snapshot,
        ageSeconds,
      },
    }
  }

  if (!observedPlateCompact) {
    return {
      occupancyStatus: 'OCCUPIED_UNKNOWN',
      reasonCode: 'PLATE_UNAVAILABLE',
      reasonDetail: 'Camera thấy occupied nhưng không suy ra được plate compact tin cậy.',
      observedPlateCompact: null,
      expectedPlateCompact: reservedSpot?.primaryPlateCompact ?? null,
      matchedSubscriptionId: toId(reservedSpot?.subscriptionId),
      matchedSubscriptionSpotId: toId(reservedSpot?.subscriptionSpotId),
      matchedGatePresenceId: null,
      sourcePresenceEventId: toId(event.presenceEventId),
      staleAt: null,
      snapshot: {
        ...snapshot,
        ageSeconds,
      },
    }
  }

  const spotId = toId(input.spot.spotId)
  const assignedSpotIds = new Set(vehicleSubscription?.assignedSpotIds ?? [])
  const allowedPlateCompacts = new Set((reservedSpot?.allowedPlateCompacts ?? []).map((item) => normalizePlate(item)).filter(Boolean) as string[])

  if (vehicleSubscription && assignedSpotIds.size > 0 && !assignedSpotIds.has(spotId ?? '')) {
    return {
      occupancyStatus: 'OCCUPIED_VIOLATION',
      reasonCode: 'VIP_WRONG_SPOT',
      reasonDetail: 'Xe subscription/VIP đang xuất hiện ở spot không được assign.',
      observedPlateCompact,
      expectedPlateCompact: vehicleSubscription.primaryPlateCompact ?? reservedSpot?.primaryPlateCompact ?? null,
      matchedSubscriptionId: toId(vehicleSubscription.subscriptionId),
      matchedSubscriptionSpotId: toId(vehicleSubscription.subscriptionSpotId),
      matchedGatePresenceId: toId(gatePresence?.presenceId),
      sourcePresenceEventId: toId(event.presenceEventId),
      staleAt: null,
      snapshot: {
        ...snapshot,
        ageSeconds,
      },
    }
  }

  if (reservedSpot && !allowedPlateCompacts.has(observedPlateCompact)) {
    return {
      occupancyStatus: 'OCCUPIED_VIOLATION',
      reasonCode: 'RESERVED_SPOT_OCCUPIED_BY_OTHER',
      reasonDetail: 'Spot đang được reserve/assign cho subscription khác nhưng camera thấy plate không thuộc danh sách cho phép.',
      observedPlateCompact,
      expectedPlateCompact: reservedSpot.primaryPlateCompact,
      matchedSubscriptionId: toId(reservedSpot.subscriptionId),
      matchedSubscriptionSpotId: toId(reservedSpot.subscriptionSpotId),
      matchedGatePresenceId: toId(gatePresence?.presenceId),
      sourcePresenceEventId: toId(event.presenceEventId),
      staleAt: null,
      snapshot: {
        ...snapshot,
        ageSeconds,
      },
    }
  }

  if (gatePresence) {
    return {
      occupancyStatus: 'OCCUPIED_MATCHED',
      reasonCode: vehicleSubscription ? 'VIP_MATCHED' : 'GATE_PRESENCE_MATCHED',
      reasonDetail: vehicleSubscription
        ? 'Plate camera khớp active presence và đúng assigned rules của subscription.'
        : 'Plate camera khớp active gate presence hiện tại.',
      observedPlateCompact,
      expectedPlateCompact: vehicleSubscription?.primaryPlateCompact ?? reservedSpot?.primaryPlateCompact ?? observedPlateCompact,
      matchedSubscriptionId: toId(vehicleSubscription?.subscriptionId ?? reservedSpot?.subscriptionId),
      matchedSubscriptionSpotId: toId(vehicleSubscription?.subscriptionSpotId ?? reservedSpot?.subscriptionSpotId),
      matchedGatePresenceId: toId(gatePresence.presenceId),
      sourcePresenceEventId: toId(event.presenceEventId),
      staleAt: null,
      snapshot: {
        ...snapshot,
        ageSeconds,
      },
    }
  }

  return {
    occupancyStatus: 'OCCUPIED_UNKNOWN',
    reasonCode: 'MISSING_GATE_PRESENCE',
    reasonDetail: 'Camera thấy xe nhưng chưa tìm thấy active gate presence tương ứng để xác thực.',
    observedPlateCompact,
    expectedPlateCompact: vehicleSubscription?.primaryPlateCompact ?? reservedSpot?.primaryPlateCompact ?? null,
    matchedSubscriptionId: toId(vehicleSubscription?.subscriptionId ?? reservedSpot?.subscriptionId),
    matchedSubscriptionSpotId: toId(vehicleSubscription?.subscriptionSpotId ?? reservedSpot?.subscriptionSpotId),
    matchedGatePresenceId: null,
    sourcePresenceEventId: toId(event.presenceEventId),
    staleAt: null,
    snapshot: {
      ...snapshot,
      ageSeconds,
    },
  }
}
