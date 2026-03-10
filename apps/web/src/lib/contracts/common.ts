import type { PlateCanonicalDto } from '@parkly/contracts'

export type { PlateCanonicalDto } from '@parkly/contracts'

export type Direction = 'ENTRY' | 'EXIT'
export type GateReadType = 'ALPR' | 'RFID' | 'SENSOR'
export type SensorState = 'PRESENT' | 'CLEARED' | 'TRIGGERED'
export type HealthRes = { ok: boolean; ts: string }
export type MeRes = { role: string }

export type WithPlate = {
  plate?: PlateCanonicalDto | null
} & Partial<PlateCanonicalDto>
