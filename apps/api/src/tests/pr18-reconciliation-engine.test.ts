import test from 'node:test'
import assert from 'node:assert/strict'

import { reconcileSpotProjection } from '../modules/reconciliation/domain/reconciliation'
import { runReconciliation } from '../modules/reconciliation/application/run-reconciliation'

test('VIP đúng spot => OCCUPIED_MATCHED', () => {
  const result = reconcileSpotProjection({
    now: new Date('2026-03-12T10:00:00Z'),
    sensorStaleSeconds: 180,
    spot: { siteId: 1n, zoneId: 11n, spotId: 101n, zoneCode: 'VIP_A', spotCode: 'A-01' },
    latestPresenceEvent: {
      presenceEventId: 1001n,
      plateCompact: '51A12345',
      confidence: 0.98,
      capturedAt: '2026-03-12T09:59:30Z',
      cameraCode: 'CAM_A01',
      traceId: 'trace-1',
      snapshotObjectKey: 'snap/1.jpg',
      modelVersion: 'yolo-v1',
    },
    activeGatePresence: {
      presenceId: 9001n,
      plateCompact: '51A12345',
      ticketId: 7001n,
      sessionId: 6001n,
      enteredAt: '2026-03-12T09:30:00Z',
      lastSeenAt: '2026-03-12T09:59:00Z',
    },
    observedVehicleSubscription: {
      subscriptionId: 3001n,
      subscriptionSpotId: 4001n,
      plateCompact: '51A12345',
      assignedSpotIds: ['101'],
      assignedSpotCodes: ['A-01'],
      primaryAssignedSpotId: '101',
      primaryAssignedSpotCode: 'A-01',
      primaryPlateCompact: '51A12345',
    },
    reservedSpotSubscription: {
      subscriptionId: 3001n,
      subscriptionSpotId: 4001n,
      spotId: 101n,
      spotCode: 'A-01',
      primaryPlateCompact: '51A12345',
      allowedPlateCompacts: ['51A12345'],
    },
  })

  assert.equal(result.occupancyStatus, 'OCCUPIED_MATCHED')
  assert.equal(result.reasonCode, 'VIP_MATCHED')
})

test('VIP sai spot => OCCUPIED_VIOLATION', () => {
  const result = reconcileSpotProjection({
    now: new Date('2026-03-12T10:00:00Z'),
    sensorStaleSeconds: 180,
    spot: { siteId: 1n, zoneId: 11n, spotId: 102n, zoneCode: 'VIP_A', spotCode: 'A-02' },
    latestPresenceEvent: {
      presenceEventId: 1002n,
      plateCompact: '51A12345',
      confidence: 0.98,
      capturedAt: '2026-03-12T09:59:30Z',
      cameraCode: 'CAM_A02',
      traceId: 'trace-2',
      snapshotObjectKey: 'snap/2.jpg',
      modelVersion: 'yolo-v1',
    },
    activeGatePresence: {
      presenceId: 9002n,
      plateCompact: '51A12345',
      ticketId: 7002n,
      sessionId: 6002n,
      enteredAt: '2026-03-12T09:30:00Z',
      lastSeenAt: '2026-03-12T09:59:00Z',
    },
    observedVehicleSubscription: {
      subscriptionId: 3001n,
      subscriptionSpotId: 4001n,
      plateCompact: '51A12345',
      assignedSpotIds: ['101'],
      assignedSpotCodes: ['A-01'],
      primaryAssignedSpotId: '101',
      primaryAssignedSpotCode: 'A-01',
      primaryPlateCompact: '51A12345',
    },
    reservedSpotSubscription: null,
  })

  assert.equal(result.occupancyStatus, 'OCCUPIED_VIOLATION')
  assert.equal(result.reasonCode, 'VIP_WRONG_SPOT')
})

test('vãng lai vào spot VIP => OCCUPIED_VIOLATION', () => {
  const result = reconcileSpotProjection({
    now: new Date('2026-03-12T10:00:00Z'),
    sensorStaleSeconds: 180,
    spot: { siteId: 1n, zoneId: 11n, spotId: 101n, zoneCode: 'VIP_A', spotCode: 'A-01' },
    latestPresenceEvent: {
      presenceEventId: 1003n,
      plateCompact: '59B99999',
      confidence: 0.94,
      capturedAt: '2026-03-12T09:59:20Z',
      cameraCode: 'CAM_A01',
      traceId: 'trace-3',
      snapshotObjectKey: 'snap/3.jpg',
      modelVersion: 'yolo-v1',
    },
    activeGatePresence: {
      presenceId: 9003n,
      plateCompact: '59B99999',
      ticketId: 7003n,
      sessionId: 6003n,
      enteredAt: '2026-03-12T09:40:00Z',
      lastSeenAt: '2026-03-12T09:59:00Z',
    },
    observedVehicleSubscription: null,
    reservedSpotSubscription: {
      subscriptionId: 3001n,
      subscriptionSpotId: 4001n,
      spotId: 101n,
      spotCode: 'A-01',
      primaryPlateCompact: '51A12345',
      allowedPlateCompacts: ['51A12345'],
    },
  })

  assert.equal(result.occupancyStatus, 'OCCUPIED_VIOLATION')
  assert.equal(result.reasonCode, 'RESERVED_SPOT_OCCUPIED_BY_OTHER')
})

test('ghost camera presence => OCCUPIED_UNKNOWN', () => {
  const result = reconcileSpotProjection({
    now: new Date('2026-03-12T10:00:00Z'),
    sensorStaleSeconds: 180,
    spot: { siteId: 1n, zoneId: 12n, spotId: 201n, zoneCode: 'PUBLIC', spotCode: 'P-01' },
    latestPresenceEvent: {
      presenceEventId: 1004n,
      plateCompact: '30F12345',
      confidence: 0.89,
      capturedAt: '2026-03-12T09:59:40Z',
      cameraCode: 'CAM_P01',
      traceId: 'trace-4',
      snapshotObjectKey: 'snap/4.jpg',
      modelVersion: 'yolo-v1',
    },
    activeGatePresence: null,
    observedVehicleSubscription: null,
    reservedSpotSubscription: null,
  })

  assert.equal(result.occupancyStatus, 'OCCUPIED_UNKNOWN')
  assert.equal(result.reasonCode, 'MISSING_GATE_PRESENCE')
})

test('sensor stale => SENSOR_STALE', () => {
  const result = reconcileSpotProjection({
    now: new Date('2026-03-12T10:00:00Z'),
    sensorStaleSeconds: 60,
    spot: { siteId: 1n, zoneId: 12n, spotId: 202n, zoneCode: 'PUBLIC', spotCode: 'P-02' },
    latestPresenceEvent: {
      presenceEventId: 1005n,
      plateCompact: '30F12345',
      confidence: 0.89,
      capturedAt: '2026-03-12T09:50:00Z',
      cameraCode: 'CAM_P02',
      traceId: 'trace-5',
      snapshotObjectKey: 'snap/5.jpg',
      modelVersion: 'yolo-v1',
    },
    activeGatePresence: null,
    observedVehicleSubscription: null,
    reservedSpotSubscription: null,
  })

  assert.equal(result.occupancyStatus, 'SENSOR_STALE')
})

test('runReconciliation upsert idempotent theo spot', async () => {
  const store = new Map<string, any>()
  const deps: Parameters<typeof runReconciliation>[1] = {
    listSpots: async () => [
      { siteId: 1n, zoneId: 11n, spotId: 101n, zoneCode: 'VIP_A', spotCode: 'A-01' },
    ],
    listLatestPresenceEvents: async () => ({
      '101': {
        presenceEventId: 1001n,
        plateCompact: '51A12345',
        confidence: 0.98,
        capturedAt: '2026-03-12T09:59:30Z',
        cameraCode: 'CAM_A01',
        traceId: 'trace-1',
        snapshotObjectKey: 'snap/1.jpg',
        modelVersion: 'yolo-v1',
      },
    }),
    listActiveGatePresence: async () => ({
      '51A12345': {
        presenceId: 9001n,
        plateCompact: '51A12345',
        ticketId: 7001n,
        sessionId: 6001n,
        enteredAt: '2026-03-12T09:30:00Z',
        lastSeenAt: '2026-03-12T09:59:00Z',
      },
    }),
    listSubscriptionLookup: async () => ({
      byPlate: {
        '51A12345': {
          subscriptionId: '3001',
          subscriptionSpotId: '4001',
          plateCompact: '51A12345',
          assignedSpotIds: ['101'],
          assignedSpotCodes: ['A-01'],
          primaryAssignedSpotId: '101',
          primaryAssignedSpotCode: 'A-01',
          primaryPlateCompact: '51A12345',
        },
      },
      bySpotId: {
        '101': {
          subscriptionId: '3001',
          subscriptionSpotId: '4001',
          spotId: '101',
          spotCode: 'A-01',
          primaryPlateCompact: '51A12345',
          allowedPlateCompacts: ['51A12345'],
        },
      },
    }),
    persistProjection: async ({ spot, decision }) => {
      const key = `${spot.siteId}:${spot.spotId}`
      const row = {
        projectionId: key,
        siteId: String(spot.siteId),
        zoneId: String(spot.zoneId),
        spotId: String(spot.spotId),
        zoneCode: spot.zoneCode,
        spotCode: spot.spotCode,
        occupancyStatus: decision.occupancyStatus,
        observedPlateCompact: decision.observedPlateCompact,
        expectedPlateCompact: decision.expectedPlateCompact,
        matchedSubscriptionId: decision.matchedSubscriptionId,
        matchedSubscriptionSpotId: decision.matchedSubscriptionSpotId,
        matchedGatePresenceId: decision.matchedGatePresenceId,
        sourcePresenceEventId: decision.sourcePresenceEventId,
        reasonCode: decision.reasonCode,
        reasonDetail: decision.reasonDetail,
        staleAt: decision.staleAt,
        snapshot: decision.snapshot,
        updatedAt: new Date('2026-03-12T10:00:00Z').toISOString(),
      }
      store.set(key, row)
      return row
    },
    listProjectionRows: async () => Array.from(store.values()),
    getProjectionRow: async ({ spotCode }) => Array.from(store.values()).find((row) => row.spotCode === spotCode) ?? null,
  }

  const first = await runReconciliation({ siteCode: 'SITE_HCM_01', now: new Date('2026-03-12T10:00:00Z') }, deps)
  const second = await runReconciliation({ siteCode: 'SITE_HCM_01', now: new Date('2026-03-12T10:00:00Z') }, deps)

  assert.equal(first.processedCount, 1)
  assert.equal(second.processedCount, 1)
  assert.equal(store.size, 1)
  assert.equal(first.rows[0].occupancyStatus, 'OCCUPIED_MATCHED')
})
