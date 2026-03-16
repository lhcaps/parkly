import test from 'node:test'
import assert from 'node:assert/strict'

import { listParkingLiveBoard } from '../../modules/parking-live/application/list-parking-live-board'
import { getParkingLiveSummary } from '../../modules/parking-live/application/get-parking-live-summary'
import { getParkingLiveSpotDetail } from '../../modules/parking-live/application/get-parking-live-spot-detail'
import type { ParkingLiveBaseRow } from '../../modules/parking-live/domain/parking-live-types'
import type { ParkingLiveRepository } from '../../modules/parking-live/infrastructure/parking-live-repository'
import { ApiError } from '../../server/http'

const baseRows: ParkingLiveBaseRow[] = [
  {
    siteId: '1',
    siteCode: 'SITE_HCM_01',
    siteName: 'HCM Main',
    zoneId: '11',
    zoneCode: 'F1',
    zoneName: 'Floor 1',
    zoneVehicleType: 'CAR',
    spotId: '101',
    spotCode: 'F1-A02',
    spotStatus: 'FREE',
    projectionId: '5002',
    occupancyStatus: 'EMPTY',
    observedPlateCompact: null,
    expectedPlateCompact: null,
    matchedSubscriptionId: null,
    matchedSubscriptionSpotId: null,
    matchedGatePresenceId: null,
    sourcePresenceEventId: null,
    reasonCode: 'EMPTY',
    reasonDetail: 'spot empty',
    staleAt: null,
    snapshot: { layout: { order: 2, row: 1, col: 2 } },
    updatedAt: '2026-03-16T18:10:00.000Z',
  },
  {
    siteId: '1',
    siteCode: 'SITE_HCM_01',
    siteName: 'HCM Main',
    zoneId: '11',
    zoneCode: 'F1',
    zoneName: 'Floor 1',
    zoneVehicleType: 'CAR',
    spotId: '100',
    spotCode: 'F1-A01',
    spotStatus: 'FREE',
    projectionId: '5001',
    occupancyStatus: 'OCCUPIED_MATCHED',
    observedPlateCompact: '43A12345',
    expectedPlateCompact: '43A12345',
    matchedSubscriptionId: '9001',
    matchedSubscriptionSpotId: '8001',
    matchedGatePresenceId: '7001',
    sourcePresenceEventId: '6001',
    reasonCode: 'VIP_MATCHED',
    reasonDetail: 'matched subscription',
    staleAt: null,
    snapshot: { layout: { order: 1, row: 1, col: 1 } },
    updatedAt: '2026-03-16T18:12:00.000Z',
  },
  {
    siteId: '1',
    siteCode: 'SITE_HCM_01',
    siteName: 'HCM Main',
    zoneId: '12',
    zoneCode: 'F2',
    zoneName: 'Floor 2',
    zoneVehicleType: 'CAR',
    spotId: '102',
    spotCode: 'F2-A01',
    spotStatus: 'OUT_OF_SERVICE',
    projectionId: null,
    occupancyStatus: null,
    observedPlateCompact: null,
    expectedPlateCompact: null,
    matchedSubscriptionId: null,
    matchedSubscriptionSpotId: null,
    matchedGatePresenceId: null,
    sourcePresenceEventId: null,
    reasonCode: null,
    reasonDetail: null,
    staleAt: null,
    snapshot: { layout: { order: 1, row: 1, col: 1 } },
    updatedAt: null,
  },
]

function createRepo(): ParkingLiveRepository {
  return {
    async requireSite(siteCode) {
      if (siteCode !== 'SITE_HCM_01') throw new Error(`SITE_NOT_FOUND:${siteCode}`)
      return { siteId: '1', siteCode: 'SITE_HCM_01', name: 'HCM Main' }
    },
    async listBaseRows({ siteCode, zoneCode }) {
      assert.equal(siteCode, 'SITE_HCM_01')
      return baseRows.filter((row) => !zoneCode || row.zoneCode === zoneCode)
    },
    async getBaseRow({ siteCode, spotCode }) {
      assert.equal(siteCode, 'SITE_HCM_01')
      return baseRows.find((row) => row.spotCode === spotCode) ?? null
    },
    async getLatestPresence() {
      return {
        presenceId: '6001',
        capturedAt: '2026-03-16T18:11:00.000Z',
        cameraCode: 'CAM_F1_A01',
        traceId: 'trace-1',
      }
    },
    async getMatchedGatePresence(gatePresenceId) {
      if (!gatePresenceId) return null
      return {
        gatePresenceId,
        sessionId: '5001',
        ticketId: '4001',
        status: 'ACTIVE',
        enteredAt: '2026-03-16T17:55:00.000Z',
        lastSeenAt: '2026-03-16T18:11:00.000Z',
      }
    },
    async getLatestIncident({ spotId }) {
      if (spotId !== '100') return null
      return {
        incidentId: '3001',
        incidentType: 'RECONCILIATION',
        status: 'OPEN',
        severity: 'WARN',
        title: 'Mismatch',
        updatedAt: '2026-03-16T18:13:00.000Z',
      }
    },
    async getSubscriptionById(subscriptionId) {
      if (!subscriptionId) return null
      return { subscriptionId, status: 'ACTIVE' }
    },
  }
}


const noopRefresh = (async () => ({
  siteCode: 'SITE_HCM_01',
  spotCode: null,
  sensorStaleSeconds: 180,
  processedCount: 0,
  summary: {
    EMPTY: 0,
    OCCUPIED_MATCHED: 0,
    OCCUPIED_UNKNOWN: 0,
    OCCUPIED_VIOLATION: 0,
    SENSOR_STALE: 0,
  },
  rows: [],
})) as any

const lookup = {
  byPlate: {},
  bySpotId: {
    '102': {
      subscriptionId: '9100',
      subscriptionSpotId: '8100',
      spotId: '102',
      spotCode: 'F2-A01',
      primaryPlateCompact: '51A99999',
      allowedPlateCompacts: ['51A99999'],
    },
  },
}

test('parking live board groups by floor and sorts slots deterministically', async () => {
  const result = await listParkingLiveBoard(
    { siteCode: 'SITE_HCM_01' },
    {
      repo: createRepo(),
      refresh: noopRefresh,
      listSubscriptionLookup: async () => lookup as any,
    },
  )

  assert.equal(result.floors.length, 2)
  assert.deepEqual(result.floors[0].slots.map((slot) => slot.spotCode), ['F1-A01', 'F1-A02'])
  assert.equal(result.floors[0].summary.occupiedMatched, 1)
  assert.equal(result.floors[1].slots[0].occupancyStatus, 'BLOCKED')
})

test('parking live summary stays consistent with board aggregate', async () => {
  const result = await getParkingLiveSummary(
    { siteCode: 'SITE_HCM_01' },
    {
      repo: createRepo(),
      refresh: noopRefresh,
      listSubscriptionLookup: async () => lookup as any,
    },
  )

  assert.equal(result.summary.total, 3)
  assert.equal(result.summary.occupiedMatched, 1)
  assert.equal(result.summary.blocked, 1)
  assert.equal(result.floors[0].total, 2)
})

test('parking live spot detail is null-safe and carries linked snapshots', async () => {
  const detail = await getParkingLiveSpotDetail(
    { siteCode: 'SITE_HCM_01', spotCode: 'F1-A01' },
    {
      repo: createRepo(),
      refresh: noopRefresh,
      listSubscriptionLookup: async () => lookup as any,
    },
  )

  assert.equal(detail.spot.spotCode, 'F1-A01')
  assert.equal(detail.occupancy.occupancyStatus, 'OCCUPIED_MATCHED')
  assert.equal(detail.subscription?.subscriptionCode, 'SUB-9001')
  assert.equal(detail.session?.sessionId, '5001')
  assert.equal(detail.incident?.incidentId, '3001')
})

test('parking live service returns NOT_FOUND for missing site', async () => {
  await assert.rejects(
    () => listParkingLiveBoard(
      { siteCode: 'UNKNOWN_SITE' },
      {
        repo: createRepo(),
        refresh: noopRefresh,
        listSubscriptionLookup: async () => lookup as any,
      },
    ),
    (error: unknown) => error instanceof ApiError && error.code === 'NOT_FOUND',
  )
})
