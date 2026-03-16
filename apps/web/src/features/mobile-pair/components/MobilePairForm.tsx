import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import type { Direction } from '@/lib/contracts/common'
import type { DeviceRow } from '@/lib/contracts/devices'
import type { LaneRow, SiteRow } from '@/lib/contracts/topology'

export type MobilePairDraft = {
  siteCode: string
  laneCode: string
  direction: Direction
  deviceCode: string
  deviceSecret: string
  token: string
}

function buildSiteOptions(sites: SiteRow[]): SelectOption[] {
  return [
    { value: '', label: 'Select site', description: 'Site to assign to the pairing link' },
    ...sites.map<SelectOption>((site) => ({
      value: site.siteCode,
      label: site.siteCode,
      description: site.name,
      badge: site.isActive ? 'active' : 'off',
      badgeVariant: site.isActive ? 'success' : 'neutral',
    })),
  ]
}

function buildLaneOptions(lanes: LaneRow[]): SelectOption[] {
  return [
    { value: '', label: 'Select lane', description: 'Lane that will receive capture from mobile' },
    ...lanes.map<SelectOption>((lane) => ({
      value: lane.laneCode,
      label: lane.laneCode,
      description: `${lane.gateCode} · ${lane.label}`,
      badge: lane.direction,
      badgeVariant: lane.direction === 'ENTRY' ? 'success' : 'warning',
    })),
  ]
}

function buildDirectionOptions(): SelectOption[] {
  return [
    { value: 'ENTRY', label: 'ENTRY', description: 'Inbound', badge: 'in', badgeVariant: 'success' },
    { value: 'EXIT', label: 'EXIT', description: 'Outbound', badge: 'out', badgeVariant: 'warning' },
  ]
}

function buildDeviceOptions(devices: DeviceRow[]): SelectOption[] {
  return [
    { value: '', label: 'Select device', description: 'Device that will sign requests from the mobile surface' },
    ...devices.map<SelectOption>((device) => ({
      value: device.deviceCode,
      label: device.deviceCode,
      description: [device.deviceRole || device.deviceType, device.laneLabel || device.laneCode || device.gateCode || '']
        .filter(Boolean)
        .join(' · '),
      badge: device.isPrimary ? 'primary' : device.isRequired ? 'required' : undefined,
      badgeVariant: device.isPrimary ? 'success' : device.isRequired ? 'warning' : 'neutral',
    })),
  ]
}

export function MobilePairForm({
  sites,
  lanes,
  devices,
  value,
  loading,
  onChange,
  onGenerateToken,
  onClear,
}: {
  sites: SiteRow[]
  lanes: LaneRow[]
  devices: DeviceRow[]
  value: MobilePairDraft
  loading: boolean
  onChange: (patch: Partial<MobilePairDraft>) => void
  onGenerateToken: () => void
  onClear: () => void
}) {
  const laneOptions = lanes.filter((lane) => !value.siteCode || lane.siteCode === value.siteCode)
  const deviceOptions = devices.filter((device) => !value.laneCode || device.laneCode === value.laneCode)

  return (
    <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <div className="mb-4">
        <p className="text-sm font-medium">Device pairing context</p>
        <p className="mt-1 text-xs text-muted-foreground">Select site, lane, and source device before creating a pair link.ường dẫn hoặc mã QR cho điện thoại.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Select
          value={value.siteCode}
          onChange={(next) => onChange({ siteCode: next, laneCode: '', deviceCode: '' })}
          options={buildSiteOptions(sites)}
          disabled={loading}
        />

        <Select
          value={value.laneCode}
          onChange={(next) => onChange({ laneCode: next, deviceCode: '' })}
          options={buildLaneOptions(laneOptions)}
          disabled={loading}
        />

        <Select
          value={value.direction}
          onChange={(next) => onChange({ direction: next === 'EXIT' ? 'EXIT' : 'ENTRY' })}
          options={buildDirectionOptions()}
          disabled={loading}
        />

        <Select
          value={value.deviceCode}
          onChange={(next) => onChange({ deviceCode: next })}
          options={buildDeviceOptions(deviceOptions)}
          disabled={loading}
        />

        <Input value={value.deviceSecret} onChange={(e) => onChange({ deviceSecret: e.target.value })} placeholder="Device secret" disabled={loading} />

        <div className="flex gap-2">
          <Input value={value.token} onChange={(e) => onChange({ token: e.target.value })} placeholder="Pair token" disabled={loading} />
          <Button type="button" variant="outline" onClick={onGenerateToken} disabled={loading}>
            Generate token
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={onClear} disabled={loading}>
          Clear form
        </Button>
      </div>
    </div>
  )
}
