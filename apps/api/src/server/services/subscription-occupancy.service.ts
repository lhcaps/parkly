import { prisma } from '../../lib/prisma'

type RawSubscriptionOccupancyRow = {
  subscription_id: bigint | number | string
  subscription_vehicle_id: bigint | number | string
  vehicle_id: bigint | number | string | null
  plate_compact: string | null
  vehicle_is_primary: number | boolean | null
  subscription_spot_id: bigint | number | string | null
  spot_id: bigint | number | string | null
  spot_code: string | null
  spot_is_primary: number | boolean | null
}

export type SubscriptionOccupancyPlateContext = {
  subscriptionId: string
  subscriptionSpotId: string | null
  plateCompact: string
  assignedSpotIds: Array<string>
  assignedSpotCodes: Array<string>
  primaryAssignedSpotId: string | null
  primaryAssignedSpotCode: string | null
  primaryPlateCompact: string | null
}

export type SubscriptionSpotReservationContext = {
  subscriptionId: string
  subscriptionSpotId: string | null
  spotId: string
  spotCode: string
  primaryPlateCompact: string | null
  allowedPlateCompacts: Array<string>
}

export type SubscriptionOccupancyLookup = {
  byPlate: Record<string, SubscriptionOccupancyPlateContext>
  bySpotId: Record<string, SubscriptionSpotReservationContext>
}

function normalizePlate(value: string | null | undefined) {
  const raw = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return raw || null
}

function toId(value: bigint | number | string | null | undefined) {
  if (value == null) return null
  return String(value)
}

function boolish(value: unknown) {
  return value === true || value === 1 || value === '1'
}

export async function listSubscriptionOccupancyLookup(siteCode: string): Promise<SubscriptionOccupancyLookup> {
  const rows = await prisma.$queryRawUnsafe<RawSubscriptionOccupancyRow[]>(
    `
      SELECT
        s.subscription_id,
        sv.subscription_vehicle_id,
        sv.vehicle_id,
        sv.plate_compact,
        sv.is_primary AS vehicle_is_primary,
        ss.subscription_spot_id,
        ss.spot_id,
        sp.code AS spot_code,
        ss.is_primary AS spot_is_primary
      FROM subscriptions s
      JOIN parking_sites ps
        ON ps.site_id = s.site_id
      JOIN subscription_vehicles sv
        ON sv.subscription_id = s.subscription_id
       AND sv.status = 'ACTIVE'
       AND CURDATE() BETWEEN COALESCE(sv.valid_from, s.start_date) AND COALESCE(sv.valid_to, s.end_date)
      LEFT JOIN subscription_spots ss
        ON ss.subscription_id = s.subscription_id
       AND ss.status = 'ACTIVE'
       AND CURDATE() BETWEEN COALESCE(ss.assigned_from, s.start_date) AND COALESCE(ss.assigned_until, s.end_date)
      LEFT JOIN spots sp
        ON sp.spot_id = ss.spot_id
      WHERE ps.site_code = ?
        AND s.status = 'ACTIVE'
        AND CURDATE() BETWEEN s.start_date AND s.end_date
      ORDER BY s.subscription_id ASC, sv.is_primary DESC, ss.is_primary DESC, sv.subscription_vehicle_id ASC, ss.subscription_spot_id ASC
    `,
    siteCode,
  )

  const plateMap = new Map<string, SubscriptionOccupancyPlateContext & { _primaryPlateRank: number; _spotRank: number }>()
  const spotMap = new Map<string, SubscriptionSpotReservationContext & { _primaryRank: number }>()

  for (const row of rows) {
    const plateCompact = normalizePlate(row.plate_compact)
    if (!plateCompact) continue

    const subscriptionId = String(row.subscription_id)
    const subscriptionSpotId = toId(row.subscription_spot_id)
    const spotId = toId(row.spot_id)
    const spotCode = row.spot_code ? String(row.spot_code) : null
    const vehiclePrimaryRank = boolish(row.vehicle_is_primary) ? 2 : 1
    const spotPrimaryRank = boolish(row.spot_is_primary) ? 2 : 1

    const existingPlate = plateMap.get(plateCompact)
    if (!existingPlate) {
      plateMap.set(plateCompact, {
        subscriptionId,
        subscriptionSpotId,
        plateCompact,
        assignedSpotIds: spotId ? [spotId] : [],
        assignedSpotCodes: spotCode ? [spotCode] : [],
        primaryAssignedSpotId: spotId,
        primaryAssignedSpotCode: spotCode,
        primaryPlateCompact: plateCompact,
        _primaryPlateRank: vehiclePrimaryRank,
        _spotRank: spotPrimaryRank,
      })
    } else {
      if (spotId && !existingPlate.assignedSpotIds.includes(spotId)) existingPlate.assignedSpotIds.push(spotId)
      if (spotCode && !existingPlate.assignedSpotCodes.includes(spotCode)) existingPlate.assignedSpotCodes.push(spotCode)
      if (spotPrimaryRank > existingPlate._spotRank && spotId) {
        existingPlate.primaryAssignedSpotId = spotId
        existingPlate.primaryAssignedSpotCode = spotCode
        existingPlate.subscriptionSpotId = subscriptionSpotId
        existingPlate._spotRank = spotPrimaryRank
      }
      if (vehiclePrimaryRank > existingPlate._primaryPlateRank) {
        existingPlate.primaryPlateCompact = plateCompact
        existingPlate._primaryPlateRank = vehiclePrimaryRank
      }
    }

    if (!spotId || !spotCode) continue

    const existingSpot = spotMap.get(spotId)
    if (!existingSpot) {
      spotMap.set(spotId, {
        subscriptionId,
        subscriptionSpotId,
        spotId,
        spotCode,
        primaryPlateCompact: plateCompact,
        allowedPlateCompacts: [plateCompact],
        _primaryRank: vehiclePrimaryRank,
      })
    } else {
      if (!existingSpot.allowedPlateCompacts.includes(plateCompact)) existingSpot.allowedPlateCompacts.push(plateCompact)
      if (vehiclePrimaryRank > existingSpot._primaryRank) {
        existingSpot.primaryPlateCompact = plateCompact
        existingSpot._primaryRank = vehiclePrimaryRank
      }
    }
  }

  const byPlate: Record<string, SubscriptionOccupancyPlateContext> = {}
  for (const [plate, value] of plateMap.entries()) {
    byPlate[plate] = {
      subscriptionId: value.subscriptionId,
      subscriptionSpotId: value.subscriptionSpotId,
      plateCompact: value.plateCompact,
      assignedSpotIds: value.assignedSpotIds,
      assignedSpotCodes: value.assignedSpotCodes,
      primaryAssignedSpotId: value.primaryAssignedSpotId,
      primaryAssignedSpotCode: value.primaryAssignedSpotCode,
      primaryPlateCompact: value.primaryPlateCompact,
    }
  }

  const bySpotId: Record<string, SubscriptionSpotReservationContext> = {}
  for (const [spotId, value] of spotMap.entries()) {
    bySpotId[spotId] = {
      subscriptionId: value.subscriptionId,
      subscriptionSpotId: value.subscriptionSpotId,
      spotId: value.spotId,
      spotCode: value.spotCode,
      primaryPlateCompact: value.primaryPlateCompact,
      allowedPlateCompacts: value.allowedPlateCompacts,
    }
  }

  return { byPlate, bySpotId }
}
