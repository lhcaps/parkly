import { z } from 'zod'

export const CreateSiteBodySchema = z.object({
  siteCode: z.string().trim().min(1).max(32).regex(/^[A-Z0-9_]+$/, 'siteCode must be UPPERCASE_SNAKE_CASE'),
  name: z.string().trim().min(1).max(255),
  timezone: z.string().trim().min(1).max(64).optional(),
})

export const UpdateSiteBodySchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
}).refine((data) => data.name !== undefined || data.timezone !== undefined, {
  message: 'Provide at least one field to update',
})

export const SiteIdParamSchema = z.object({
  siteId: z.string().regex(/^\d+$/, 'siteId must be numeric'),
})

const DeviceTypeEnum = z.enum(['RFID_READER', 'CAMERA_ALPR', 'BARRIER', 'LOOP_SENSOR'])
const DirectionEnum = z.enum(['ENTRY', 'EXIT'])

export const CreateDeviceBodySchema = z.object({
  siteId: z.string().regex(/^\d+$/, 'siteId must be numeric').optional(),
  siteCode: z.string().trim().min(1).max(32).regex(/^[A-Z0-9_]+$/, 'siteCode must be UPPERCASE_SNAKE_CASE').optional(),
  deviceCode: z.string().trim().min(1).max(32),
  deviceType: DeviceTypeEnum,
  direction: DirectionEnum,
  ipAddress: z.string().trim().max(45).nullable().optional(),
  locationHint: z.string().trim().max(255).nullable().optional(),
  firmwareVersion: z.string().trim().max(64).nullable().optional(),
}).refine((data) => data.siteId !== undefined || data.siteCode !== undefined, {
  message: 'Provide siteId or siteCode',
})

export const UpdateDeviceBodySchema = z.object({
  deviceType: DeviceTypeEnum.optional(),
  direction: DirectionEnum.optional(),
  ipAddress: z.string().trim().max(45).nullable().optional(),
  locationHint: z.string().trim().max(255).nullable().optional(),
  firmwareVersion: z.string().trim().max(64).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const DeviceIdParamSchema = z.object({
  deviceId: z.string().regex(/^\d+$/, 'deviceId must be numeric'),
})

const LaneStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE'])

export const CreateLaneBodySchema = z.object({
  siteId: z.string().regex(/^\d+$/, 'siteId must be numeric').optional(),
  siteCode: z.string().trim().min(1).max(32).regex(/^[A-Z0-9_]+$/, 'siteCode must be UPPERCASE_SNAKE_CASE').optional(),
  gateCode: z.string().trim().min(1).max(32),
  laneCode: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(255),
  direction: DirectionEnum,
  sortOrder: z.number().int().min(0).optional(),
}).refine((data) => data.siteId !== undefined || data.siteCode !== undefined, {
  message: 'Provide siteId or siteCode',
})

export const UpdateLaneBodySchema = z.object({
  gateCode: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(255).optional(),
  direction: DirectionEnum.optional(),
  status: LaneStatusEnum.optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export const LaneIdParamSchema = z.object({
  laneId: z.string().regex(/^\d+$/, 'laneId must be numeric'),
})

const DeviceRoleEnum = z.enum(['PRIMARY', 'CAMERA', 'RFID', 'LOOP_SENSOR', 'BARRIER'])

const LaneDeviceSyncItemSchema = z.object({
  deviceId: z.string().regex(/^\d+$/, 'deviceId must be numeric'),
  deviceRole: DeviceRoleEnum,
  isPrimary: z.boolean(),
  isRequired: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional(),
})

export const SyncLaneDevicesBodySchema = z.object({
  devices: z.array(LaneDeviceSyncItemSchema).max(20, 'Maximum 20 devices per lane'),
}).refine((data) => data.devices.filter((device) => device.isPrimary).length <= 1, {
  message: 'Only one primary device is allowed per lane',
})

export const UnassignedDevicesQuerySchema = z.object({
  siteCode: z.string().trim().min(1).max(32),
})
