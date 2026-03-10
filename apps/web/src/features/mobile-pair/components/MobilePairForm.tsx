import type { DeviceRow } from '@/lib/contracts/devices'
import type { LaneRow, SiteRow } from '@/lib/contracts/topology'
import type { Direction } from '@/lib/contracts/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type MobilePairDraft = {
  siteCode: string
  laneCode: string
  direction: Direction
  deviceCode: string
  deviceSecret: string
  token: string
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
        <p className="text-sm font-medium">Pair context</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Desktop chọn lane / device rồi tạo link pair cho điện thoại. Mobile surface vẫn đứng riêng ở route <span className="font-mono-data">/mobile-capture</span>.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <select
          value={value.siteCode}
          onChange={(e) => onChange({ siteCode: e.target.value, laneCode: '', deviceCode: '' })}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          disabled={loading}
        >
          <option value="">Chọn site</option>
          {sites.map((site) => (
            <option key={site.siteCode} value={site.siteCode}>
              {site.siteCode}
            </option>
          ))}
        </select>

        <select
          value={value.laneCode}
          onChange={(e) => onChange({ laneCode: e.target.value, deviceCode: '' })}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          disabled={loading}
        >
          <option value="">Chọn lane</option>
          {laneOptions.map((lane) => (
            <option key={`${lane.gateCode}:${lane.laneCode}`} value={lane.laneCode}>
              {lane.gateCode} · {lane.laneCode} · {lane.direction}
            </option>
          ))}
        </select>

        <select
          value={value.direction}
          onChange={(e) => onChange({ direction: e.target.value === 'EXIT' ? 'EXIT' : 'ENTRY' })}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          disabled={loading}
        >
          <option value="ENTRY">ENTRY</option>
          <option value="EXIT">EXIT</option>
        </select>

        <select
          value={value.deviceCode}
          onChange={(e) => onChange({ deviceCode: e.target.value })}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          disabled={loading}
        >
          <option value="">Chọn device</option>
          {deviceOptions.map((device) => (
            <option key={device.deviceCode} value={device.deviceCode}>
              {device.deviceCode} · {device.deviceRole || device.deviceType}
            </option>
          ))}
        </select>

        <Input
          value={value.deviceSecret}
          onChange={(e) => onChange({ deviceSecret: e.target.value })}
          placeholder="deviceSecret"
          disabled={loading}
        />

        <div className="flex gap-2">
          <Input
            value={value.token}
            onChange={(e) => onChange({ token: e.target.value })}
            placeholder="pair token"
            disabled={loading}
          />
          <Button type="button" variant="outline" onClick={onGenerateToken} disabled={loading}>
            Token
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
