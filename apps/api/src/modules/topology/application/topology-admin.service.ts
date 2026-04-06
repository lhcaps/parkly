import { resolveSiteIdByCode } from '../../../lib/ids'
import { prisma } from '../../../lib/prisma'
import { ApiError } from '../../../server/http'
import { publishSseEnvelope } from '../../../server/sse-contract'
import { writeAuditLog } from '../../../server/services/audit-service'
import { stringifyBigint } from '../../../server/utils'

export type CreateSiteInput = {
  siteCode: string
  name: string
  timezone?: string
}

export type UpdateSiteInput = {
  name?: string
  timezone?: string
}

export type CreateDeviceInput = {
  siteId?: string
  siteCode?: string
  deviceCode: string
  deviceType: 'RFID_READER' | 'CAMERA_ALPR' | 'BARRIER' | 'LOOP_SENSOR'
  direction: 'ENTRY' | 'EXIT'
  ipAddress?: string | null
  locationHint?: string | null
  firmwareVersion?: string | null
}

export type UpdateDeviceInput = {
  deviceType?: 'RFID_READER' | 'CAMERA_ALPR' | 'BARRIER' | 'LOOP_SENSOR'
  direction?: 'ENTRY' | 'EXIT'
  ipAddress?: string | null
  locationHint?: string | null
  firmwareVersion?: string | null
  isActive?: boolean
}

export type CreateLaneInput = {
  siteId?: string
  siteCode?: string
  gateCode: string
  laneCode: string
  name: string
  direction: 'ENTRY' | 'EXIT'
  sortOrder?: number
}

export type UpdateLaneInput = {
  gateCode?: string
  name?: string
  direction?: 'ENTRY' | 'EXIT'
  status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
  sortOrder?: number
}

export type LaneDeviceSyncItem = {
  deviceId: string
  deviceRole: 'PRIMARY' | 'CAMERA' | 'RFID' | 'LOOP_SENSOR' | 'BARRIER'
  isPrimary: boolean
  isRequired?: boolean
  sortOrder?: number
}

function toBigInt(value: string | number | bigint): bigint {
  return BigInt(value)
}

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  return stringifyBigint(row) as Record<string, unknown>
}

async function resolveSiteIdInput(input: { siteId?: string; siteCode?: string }) {
  if (input.siteId) return toBigInt(input.siteId)

  if (input.siteCode) {
    try {
      return await resolveSiteIdByCode(input.siteCode)
    } catch {
      throw new ApiError({
        code: 'NOT_FOUND',
        message: `Site code '${input.siteCode}' not found`,
        details: { siteCode: input.siteCode },
      })
    }
  }

  throw new ApiError({ code: 'BAD_REQUEST', message: 'Missing siteId or siteCode' })
}

export async function createSite(input: CreateSiteInput, actorUserId?: string | bigint) {
  const existing = await prisma.parking_sites.findUnique({ where: { site_code: input.siteCode } })
  if (existing) {
    throw new ApiError({
      code: 'CONFLICT',
      message: `Site code '${input.siteCode}' already exists`,
      details: { siteCode: input.siteCode },
    })
  }

  const site = await prisma.parking_sites.create({
    data: {
      site_code: input.siteCode,
      name: input.name,
      timezone: input.timezone ?? 'Asia/Ho_Chi_Minh',
      is_active: true,
    },
  })

  await writeAuditLog({
    siteId: site.site_id,
    actorUserId: actorUserId ?? null,
    action: 'TOPOLOGY.SITE_CREATE',
    entityTable: 'parking_sites',
    entityId: site.site_id,
    afterSnapshot: serializeRow(site as unknown as Record<string, unknown>),
  })

  return serializeRow(site as unknown as Record<string, unknown>)
}

export async function updateSite(siteId: string, input: UpdateSiteInput, actorUserId?: string | bigint) {
  const id = toBigInt(siteId)
  const before = await prisma.parking_sites.findUnique({ where: { site_id: id } })
  if (!before) throw new ApiError({ code: 'NOT_FOUND', message: `Site ${siteId} not found` })

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) data.name = input.name
  if (input.timezone !== undefined) data.timezone = input.timezone

  const after = await prisma.parking_sites.update({ where: { site_id: id }, data })

  await writeAuditLog({
    siteId: id,
    actorUserId: actorUserId ?? null,
    action: 'TOPOLOGY.SITE_UPDATE',
    entityTable: 'parking_sites',
    entityId: id,
    beforeSnapshot: serializeRow(before as unknown as Record<string, unknown>),
    afterSnapshot: serializeRow(after as unknown as Record<string, unknown>),
  })

  return serializeRow(after as unknown as Record<string, unknown>)
}

export async function createDevice(input: CreateDeviceInput, actorUserId?: string | bigint) {
  const siteId = await resolveSiteIdInput(input)
  const site = await prisma.parking_sites.findUnique({ where: { site_id: siteId } })
  if (!site) throw new ApiError({ code: 'NOT_FOUND', message: `Site ${input.siteId ?? input.siteCode} not found` })

  const existing = await prisma.gate_devices.findFirst({
    where: { site_id: siteId, device_code: input.deviceCode },
  })
  if (existing) {
    throw new ApiError({
      code: 'CONFLICT',
      message: `Device code '${input.deviceCode}' already exists in the site`,
      details: { deviceCode: input.deviceCode },
    })
  }

  const device = await prisma.gate_devices.create({
    data: {
      site_id: siteId,
      device_code: input.deviceCode,
      device_type: input.deviceType as never,
      direction: input.direction as never,
      location_hint: input.locationHint ?? null,
    },
  })

  await writeAuditLog({
    siteId,
    actorUserId: actorUserId ?? null,
    action: 'TOPOLOGY.DEVICE_CREATE',
    entityTable: 'gate_devices',
    entityId: device.device_id,
    afterSnapshot: serializeRow(device as unknown as Record<string, unknown>),
  })

  return serializeRow(device as unknown as Record<string, unknown>)
}

export async function updateDevice(deviceId: string, input: UpdateDeviceInput, actorUserId?: string | bigint) {
  const id = toBigInt(deviceId)
  const before = await prisma.gate_devices.findUnique({ where: { device_id: id } })
  if (!before) throw new ApiError({ code: 'NOT_FOUND', message: `Device ${deviceId} not found` })

  const data: Record<string, unknown> = {}
  if (input.deviceType !== undefined) data.device_type = input.deviceType
  if (input.direction !== undefined) data.direction = input.direction
  if (input.locationHint !== undefined) data.location_hint = input.locationHint

  const after = await prisma.gate_devices.update({ where: { device_id: id }, data })

  await writeAuditLog({
    siteId: before.site_id,
    actorUserId: actorUserId ?? null,
    action: 'TOPOLOGY.DEVICE_UPDATE',
    entityTable: 'gate_devices',
    entityId: id,
    beforeSnapshot: serializeRow(before as unknown as Record<string, unknown>),
    afterSnapshot: serializeRow(after as unknown as Record<string, unknown>),
  })

  return serializeRow(after as unknown as Record<string, unknown>)
}

export async function createLane(input: CreateLaneInput, actorUserId?: string | bigint) {
  const siteId = await resolveSiteIdInput(input)
  const site = await prisma.parking_sites.findUnique({ where: { site_id: siteId } })
  if (!site) throw new ApiError({ code: 'NOT_FOUND', message: `Site ${input.siteId ?? input.siteCode} not found` })

  const existing = await prisma.gate_lanes.findFirst({
    where: { site_id: siteId, lane_code: input.laneCode },
  })
  if (existing) {
    throw new ApiError({
      code: 'CONFLICT',
      message: `Lane code '${input.laneCode}' already exists in the site`,
      details: { laneCode: input.laneCode },
    })
  }

  const lane = await prisma.gate_lanes.create({
    data: {
      site_id: siteId,
      gate_code: input.gateCode,
      lane_code: input.laneCode,
      name: input.name,
      direction: input.direction as never,
      status: 'ACTIVE' as never,
      sort_order: input.sortOrder ?? 0,
    },
  })

  await writeAuditLog({
    siteId,
    actorUserId: actorUserId ?? null,
    action: 'TOPOLOGY.LANE_CREATE',
    entityTable: 'gate_lanes',
    entityId: lane.lane_id,
    afterSnapshot: serializeRow(lane as unknown as Record<string, unknown>),
  })

  return serializeRow(lane as unknown as Record<string, unknown>)
}

export async function updateLane(laneId: string, input: UpdateLaneInput, actorUserId?: string | bigint) {
  const id = toBigInt(laneId)
  const before = await prisma.gate_lanes.findUnique({ where: { lane_id: id } })
  if (!before) throw new ApiError({ code: 'NOT_FOUND', message: `Lane ${laneId} not found` })

  const data: Record<string, unknown> = {}
  if (input.gateCode !== undefined) data.gate_code = input.gateCode
  if (input.name !== undefined) data.name = input.name
  if (input.direction !== undefined) data.direction = input.direction
  if (input.status !== undefined) data.status = input.status
  if (input.sortOrder !== undefined) data.sort_order = input.sortOrder

  const after = await prisma.gate_lanes.update({ where: { lane_id: id }, data })

  await writeAuditLog({
    siteId: before.site_id,
    actorUserId: actorUserId ?? null,
    action: 'TOPOLOGY.LANE_UPDATE',
    entityTable: 'gate_lanes',
    entityId: id,
    beforeSnapshot: serializeRow(before as unknown as Record<string, unknown>),
    afterSnapshot: serializeRow(after as unknown as Record<string, unknown>),
  })

  return serializeRow(after as unknown as Record<string, unknown>)
}

export async function syncLaneDevices(laneId: string, devices: LaneDeviceSyncItem[], actorUserId?: string | bigint) {
  const id = toBigInt(laneId)

  const result = await prisma.$transaction(async (tx) => {
    const laneRows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      'SELECT * FROM gate_lanes WHERE lane_id = ? FOR UPDATE',
      id,
    )
    if (laneRows.length === 0) {
      throw new ApiError({ code: 'NOT_FOUND', message: `Lane ${laneId} not found` })
    }
    const lane = laneRows[0]

    const beforeDevices = await tx.gate_lane_devices.findMany({
      where: { lane_id: id },
      orderBy: { sort_order: 'asc' },
    })
    const beforeSnapshot = beforeDevices.map((device) => serializeRow(device as unknown as Record<string, unknown>))

    await tx.gate_lane_devices.deleteMany({ where: { lane_id: id } })

    if (devices.length > 0) {
      await tx.gate_lane_devices.createMany({
        data: devices.map((device, index) => ({
          lane_id: id,
          device_id: toBigInt(device.deviceId),
          device_role: device.deviceRole as never,
          is_primary: device.isPrimary,
          is_required: device.isRequired ?? true,
          sort_order: device.sortOrder ?? index,
        })),
      })
    }

    const primaryDevice = devices.find((device) => device.isPrimary)
    const primaryDeviceId = primaryDevice ? toBigInt(primaryDevice.deviceId) : null

    await tx.gate_lanes.update({
      where: { lane_id: id },
      data: { primary_device_id: primaryDeviceId },
    })

    const afterDevices = await tx.gate_lane_devices.findMany({
      where: { lane_id: id },
      orderBy: { sort_order: 'asc' },
    })
    const afterSnapshot = afterDevices.map((device) => serializeRow(device as unknown as Record<string, unknown>))

    await writeAuditLog({
      siteId: lane.site_id as bigint,
      actorUserId: actorUserId ?? null,
      action: 'TOPOLOGY.LANE_DEVICE_SYNC',
      entityTable: 'gate_lane_devices',
      entityId: id,
      beforeSnapshot,
      afterSnapshot,
    })

    return {
      laneId: String(id),
      siteId: String(lane.site_id),
      deviceCount: afterDevices.length,
      primaryDeviceId: primaryDeviceId ? String(primaryDeviceId) : null,
      devices: afterSnapshot,
    }
  })

  const siteRow = await prisma.parking_sites.findUnique({ where: { site_id: toBigInt(result.siteId) } })

  await publishSseEnvelope('lane-status', {
    eventType: 'lane.status.upsert',
    payload: {
      laneId: result.laneId,
      deviceCount: result.deviceCount,
      primaryDeviceId: result.primaryDeviceId,
      action: 'DEVICE_SYNC',
    },
    siteCode: siteRow?.site_code ?? null,
  })

  return result
}

export async function getUnassignedDevices(siteCode: string) {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        gd.device_id AS deviceId,
        gd.device_code AS deviceCode,
        gd.device_type AS deviceType,
        gd.direction AS direction,
        gd.location_hint AS locationHint,
        ps.site_code AS siteCode
      FROM gate_devices gd
      JOIN parking_sites ps ON ps.site_id = gd.site_id
      LEFT JOIN gate_lane_devices gld ON gld.device_id = gd.device_id
      WHERE ps.site_code = ?
        AND gld.lane_device_id IS NULL
      ORDER BY gd.device_code ASC
    `,
    siteCode,
  )

  return rows.map((row) => ({
    deviceId: String(row.deviceId ?? ''),
    deviceCode: String(row.deviceCode ?? ''),
    deviceType: String(row.deviceType ?? ''),
    direction: String(row.direction ?? '').toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY',
    locationHint: row.locationHint == null ? null : String(row.locationHint),
    siteCode: String(row.siteCode ?? ''),
  }))
}
