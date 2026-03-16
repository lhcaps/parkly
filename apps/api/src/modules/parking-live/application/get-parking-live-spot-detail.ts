import { listSubscriptionOccupancyLookup } from '../../../server/services/subscription-occupancy.service'
import { ApiError } from '../../../server/http'
import { runReconciliation } from '../../reconciliation/application/run-reconciliation'
import type { ParkingLiveSpotDetail } from '../domain/parking-live-types'
import { createParkingLiveRepository, type ParkingLiveRepository } from '../infrastructure/parking-live-repository'
import { mapBaseRowToSpotDetail } from '../mappers/parking-live-mappers'

export type ParkingLiveSpotDetailDeps = {
  repo: ParkingLiveRepository
  refresh: typeof runReconciliation
  listSubscriptionLookup: typeof listSubscriptionOccupancyLookup
}

export function getDefaultParkingLiveSpotDetailDeps(): ParkingLiveSpotDetailDeps {
  return {
    repo: createParkingLiveRepository(),
    refresh: runReconciliation,
    listSubscriptionLookup: listSubscriptionOccupancyLookup,
  }
}

export async function getParkingLiveSpotDetail(
  input: { siteCode: string; spotCode: string; refresh?: boolean },
  deps: ParkingLiveSpotDetailDeps = getDefaultParkingLiveSpotDetailDeps(),
): Promise<ParkingLiveSpotDetail> {
  try {
    await deps.repo.requireSite(input.siteCode)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('SITE_NOT_FOUND:')) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy site', details: { siteCode: input.siteCode } })
    }
    throw error
  }

  if (input.refresh) {
    await deps.refresh({ siteCode: input.siteCode, spotCode: input.spotCode })
  }

  const row = await deps.repo.getBaseRow({ siteCode: input.siteCode, spotCode: input.spotCode })
  if (!row) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy spot trong site này', details: { siteCode: input.siteCode, spotCode: input.spotCode } })
  }

  const subscriptionLookup = await deps.listSubscriptionLookup(input.siteCode)
  const effectiveSubscriptionId = row.matchedSubscriptionId ?? subscriptionLookup.bySpotId[row.spotId]?.subscriptionId ?? null

  const [presence, session, incident, subscription] = await Promise.all([
    deps.repo.getLatestPresence({ siteId: row.siteId, spotId: row.spotId }),
    deps.repo.getMatchedGatePresence(row.matchedGatePresenceId),
    deps.repo.getLatestIncident({ siteId: row.siteId, spotId: row.spotId }),
    deps.repo.getSubscriptionById(effectiveSubscriptionId),
  ])

  return mapBaseRowToSpotDetail({
    row,
    subscriptionLookup,
    subscriptionStatus: subscription?.status ?? null,
    presence,
    session,
    incident,
  })
}
