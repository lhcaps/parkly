/**
 * PR PL-03/04: Delta publisher for Parking Live stream.
 *
 * Called after each spot projection is persisted (run-reconciliation.ts).
 * Uses a lightweight in-process event emitter — no guaranteed delivery,
 * no persistence. Stream subscribers receive the delta; polling is the
 * fallback if the subscriber is not connected.
 */

import { EventEmitter } from 'node:events'
import type { ParkingLiveDerivedStatus } from '../domain/parking-live-types'
import type { SpotProjectionRow } from '../../reconciliation/application/run-reconciliation'

export type ParkingLiveDeltaEvent = {
  siteCode: string
  floorKey: string | null
  spotCode: string
  spotId: string
  occupancyStatus: ParkingLiveDerivedStatus
  observedPlateCompact: string | null
  stale: boolean
  updatedAt: string
}

const emitter = new EventEmitter()
emitter.setMaxListeners(200) // support many concurrent SSE subscribers

const DELTA_EVENT = 'parking-live:delta'

export function onParkingLiveDelta(
  handler: (event: ParkingLiveDeltaEvent) => void,
): () => void {
  emitter.on(DELTA_EVENT, handler)
  return () => emitter.off(DELTA_EVENT, handler)
}

/**
 * Derive the derived parking-live status from a raw projection row.
 * Mirrors resolveDerivedStatus logic but without DB subscription lookup
 * (this is called hot-path; subscription lookup is too expensive per-event).
 * The SSE subscriber is responsible for re-fetching detail if needed.
 */
function deriveDeltaStatus(
  occupancyStatus: string | null,
  spotStatus: string | null,
): ParkingLiveDerivedStatus {
  if (String(spotStatus ?? '').toUpperCase() === 'OUT_OF_SERVICE') return 'BLOCKED'
  if (!occupancyStatus) return 'SENSOR_STALE'
  const known: ParkingLiveDerivedStatus[] = [
    'EMPTY',
    'OCCUPIED_MATCHED',
    'OCCUPIED_UNKNOWN',
    'OCCUPIED_VIOLATION',
    'SENSOR_STALE',
    'BLOCKED',
    'RESERVED',
  ]
  return known.includes(occupancyStatus as ParkingLiveDerivedStatus)
    ? (occupancyStatus as ParkingLiveDerivedStatus)
    : 'SENSOR_STALE'
}

/**
 * Publish a parking-live delta event after a projection row is written.
 * Safe to call from reconciliation hot-path: emits synchronously, no I/O.
 */
export function publishParkingLiveDelta(
  row: SpotProjectionRow,
  siteCode: string,
  floorKey: string | null,
): void {
  const event: ParkingLiveDeltaEvent = {
    siteCode,
    floorKey,
    spotCode: row.spotCode,
    spotId: row.spotId,
    occupancyStatus: deriveDeltaStatus(row.occupancyStatus, null),
    observedPlateCompact: row.observedPlateCompact,
    stale: row.occupancyStatus === 'SENSOR_STALE' || row.staleAt != null,
    updatedAt: row.updatedAt,
  }
  emitter.emit(DELTA_EVENT, event)
}
