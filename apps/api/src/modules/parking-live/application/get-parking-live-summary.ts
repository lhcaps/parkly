import type { ParkingLiveBoardQuery, ParkingLiveSummary } from '../domain/parking-live-types'
import { buildOverallSummary } from '../mappers/parking-live-mappers'
import { listParkingLiveBoard, getDefaultParkingLiveServiceDeps, type ParkingLiveServiceDeps } from './list-parking-live-board'

export async function getParkingLiveSummary(
  input: Pick<ParkingLiveBoardQuery, 'siteCode' | 'refresh'>,
  deps: ParkingLiveServiceDeps = getDefaultParkingLiveServiceDeps(),
): Promise<ParkingLiveSummary> {
  const board = await listParkingLiveBoard({ siteCode: input.siteCode, refresh: input.refresh ?? false }, deps)
  return {
    site: board.site,
    summary: buildOverallSummary(board.floors),
    floors: board.floors.map((floor) => ({
      floorKey: floor.floorKey,
      label: floor.label,
      total: floor.summary.total,
      empty: floor.summary.empty,
      occupiedTotal: floor.summary.occupiedTotal,
      sensorStale: floor.summary.sensorStale,
      blocked: floor.summary.blocked,
      reserved: floor.summary.reserved,
    })),
    updatedAt: board.connection.reconciledAt,
  }
}
