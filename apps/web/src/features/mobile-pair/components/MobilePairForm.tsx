import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
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

function buildSiteOptions(sites: SiteRow[], t: (key: string, options?: Record<string, unknown>) => string): SelectOption[] {
  return [
    { value: '', label: t('mobilePairPage.form.selectSite'), description: t('mobilePairPage.form.selectSiteDescription') },
    ...sites.map<SelectOption>((site) => ({
      value: site.siteCode,
      label: site.siteCode,
      description: site.name,
      badge: site.isActive ? t('mobilePairPage.form.activeBadge') : t('mobilePairPage.form.offBadge'),
      badgeVariant: site.isActive ? 'success' : 'neutral',
    })),
  ]
}

function buildLaneOptions(lanes: LaneRow[], t: (key: string, options?: Record<string, unknown>) => string): SelectOption[] {
  return [
    { value: '', label: t('mobilePairPage.form.selectLane'), description: t('mobilePairPage.form.selectLaneDescription') },
    ...lanes.map<SelectOption>((lane) => ({
      value: lane.laneCode,
      label: lane.laneCode,
      description: `${lane.gateCode} / ${lane.label}`,
      badge: lane.direction,
      badgeVariant: lane.direction === 'ENTRY' ? 'success' : 'warning',
    })),
  ]
}

function buildDirectionOptions(t: (key: string, options?: Record<string, unknown>) => string): SelectOption[] {
  return [
    { value: 'ENTRY', label: 'ENTRY', description: t('mobilePairPage.form.inbound'), badge: t('mobilePairPage.form.inBadge'), badgeVariant: 'success' },
    { value: 'EXIT', label: 'EXIT', description: t('mobilePairPage.form.outbound'), badge: t('mobilePairPage.form.outBadge'), badgeVariant: 'warning' },
  ]
}

function buildDeviceOptions(devices: DeviceRow[], t: (key: string, options?: Record<string, unknown>) => string): SelectOption[] {
  return [
    { value: '', label: t('mobilePairPage.form.selectDevice'), description: t('mobilePairPage.form.selectDeviceDescription') },
    ...devices.map<SelectOption>((device) => ({
      value: device.deviceCode,
      label: device.deviceCode,
      description: [device.deviceRole || device.deviceType, device.laneLabel || device.laneCode || device.gateCode || '']
        .filter(Boolean)
        .join(' / '),
      badge: device.isPrimary ? t('mobilePairPage.form.primaryBadge') : device.isRequired ? t('mobilePairPage.form.requiredBadge') : undefined,
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
  const { t } = useTranslation()
  const laneOptions = lanes.filter((lane) => !value.siteCode || lane.siteCode === value.siteCode)
  const deviceOptions = devices.filter((device) => !value.laneCode || device.laneCode === value.laneCode)

  return (
    <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <div className="mb-4">
        <p className="text-sm font-medium">{t('mobilePairPage.form.title')}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('mobilePairPage.form.description')}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Select
          value={value.siteCode}
          onChange={(next) => onChange({ siteCode: next, laneCode: '', deviceCode: '' })}
          options={buildSiteOptions(sites, t)}
          disabled={loading}
        />

        <Select
          value={value.laneCode}
          onChange={(next) => onChange({ laneCode: next, deviceCode: '' })}
          options={buildLaneOptions(laneOptions, t)}
          disabled={loading}
        />

        <Select
          value={value.direction}
          onChange={(next) => onChange({ direction: next === 'EXIT' ? 'EXIT' : 'ENTRY' })}
          options={buildDirectionOptions(t)}
          disabled={loading}
        />

        <Select
          value={value.deviceCode}
          onChange={(next) => onChange({ deviceCode: next })}
          options={buildDeviceOptions(deviceOptions, t)}
          disabled={loading}
        />

        <div>
          <Input
            value={value.deviceSecret}
            onChange={(e) => onChange({ deviceSecret: e.target.value })}
            placeholder={t('mobilePairPage.form.deviceSecretPlaceholder')}
            disabled={loading}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t('mobilePairPage.form.deviceSecretHint')}
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            value={value.token}
            onChange={(e) => onChange({ token: e.target.value })}
            placeholder={t('mobilePairPage.form.pairTokenPlaceholder')}
            disabled={loading}
          />
          <Button type="button" variant="outline" onClick={onGenerateToken} disabled={loading}>
            {t('mobilePairPage.form.generateToken')}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={onClear} disabled={loading}>
          {t('mobilePairPage.form.clear')}
        </Button>
      </div>
    </div>
  )
}
