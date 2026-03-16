import { listSubscriptionOccupancyLookup } from '../../../server/services/subscription-occupancy.service'
import { ApiError } from '../../../server/http'
import { runReconciliation } from '../../reconciliation/application/run-reconciliation'
import type { ParkingLiveBoard, ParkingLiveBoardQuery, ParkingLiveDerivedStatus } from '../domain/parking-live-types'
import { createParkingLiveRepository, type ParkingLiveRepository } from '../infrastructure/parking-live-repository'
import { groupSlotsByFloor, matchesSearch, summarizeSlots } from '../mappers/parking-live-mappers'

export type ParkingLiveServiceDeps = {
  repo: ParkingLiveRepository
  refresh: typeof runReconciliation
  listSubscriptionLookup: typeof listSubscriptionOccupancyLookup
}

export function getDefaultParkingLiveServiceDeps(): ParkingLiveServiceDeps {
  return {
    repo: createParkingLiveRepository(),
    refresh: runReconciliation,
    listSubscriptionLookup: listSubscriptionOccupancyLookup,
  }
}

function normalizeSearch(value: string | null | undefined) {
  const text = String(value ?? '').trim()
  return text || null
}

export async function listParkingLiveBoard(
  input: ParkingLiveBoardQuery,
  deps: ParkingLiveServiceDeps = getDefaultParkingLiveServiceDeps(),
): Promise<ParkingLiveBoard> {
  let site
  try {
    site = await deps.repo.requireSite(input.siteCode)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('SITE_NOT_FOUND:')) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy site', details: { siteCode: input.siteCode } })
    }
    throw error
  }

  if (input.refresh) {
    await deps.refresh({ siteCode: input.siteCode, spotCode: null })
  }

  const [rows, subscriptionLookup] = await Promise.all([
    deps.repo.listBaseRows({ siteCode: input.siteCode, zoneCode: input.zoneCode ?? null }),
    deps.listSubscriptionLookup(input.siteCode),
  ])

  const floors = groupSlotsByFloor({ rows, subscriptionLookup })
    .map((floor) => ({
      ...floor,
      slots: floor.slots.filter((slot) => {
        if (input.floorKey && slot.floorKey !== input.floorKey) return false
        if (input.status && slot.occupancyStatus !== input.status) return false
        if (!matchesSearch(slot, normalizeSearch(input.q))) return false
        return true
      }),
    }))
    .filter((floor) => floor.slots.length > 0)
    .map((floor) => ({
      ...floor,
      summary: summarizeSlots(floor.slots),
    }))

  const reconciledAt = floors
    .flatMap((floor) => floor.slots.map((slot) => slot.updatedAt))
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b))
    .at(-1) ?? null

  return {
    site: { siteCode: site.siteCode, name: site.name },
    filters: {
      floorKey: input.floorKey ?? null,
      zoneCode: input.zoneCode ?? null,
      status: (input.status ?? null) as ParkingLiveDerivedStatus | null,
      q: normalizeSearch(input.q),
      refresh: Boolean(input.refresh),
    },
    floors,
    connection: {
      source: 'projection',
      reconciledAt,
      streamSupported: false,
    },
  }
}
