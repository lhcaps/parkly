import type { DeviceHealthSnapshot, DeviceHealthStreamItem, DeviceRow } from '@parkly/contracts'

export type { DeviceHealthSnapshot, DeviceHealthStreamItem, DeviceRow } from '@parkly/contracts'

export type DeviceListRes = {
  siteCode: string | null
  rows: DeviceRow[]
}
