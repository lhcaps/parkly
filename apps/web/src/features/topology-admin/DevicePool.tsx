import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Cpu, MoveRight, Server, ShieldAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import { useUnassignedDevices } from './useTopologyAdmin'
import { useTopologyAdminStore } from './topology-admin-store'
import type { UnassignedDevice } from '@/lib/api/topology-admin'

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  RFID_READER: <Server className="h-4 w-4" />,
  CAMERA_ALPR: <Camera className="h-4 w-4" />,
  BARRIER: <ShieldAlert className="h-4 w-4" />,
  LOOP_SENSOR: <Cpu className="h-4 w-4" />,
}

function PoolStat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-[1rem] border border-border/60 bg-background/40 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold tracking-tight">{value}</p>
    </div>
  )
}

export default function DevicePool({ siteCode }: { siteCode: string | null }) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useUnassignedDevices(siteCode)
  const setDraggedDevice = useTopologyAdminStore((state) => state.setDraggedDevice)

  const summary = useMemo(() => {
    const rows = data?.rows ?? []
    return {
      total: rows.length,
      entry: rows.filter((row) => row.direction === 'ENTRY').length,
      exit: rows.filter((row) => row.direction === 'EXIT').length,
      cameras: rows.filter((row) => row.deviceType === 'CAMERA_ALPR').length,
    }
  }, [data?.rows])

  if (!siteCode) return null

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-20 w-full animate-pulse rounded-[1.1rem] bg-muted/60" />
        ))}
      </div>
    )
  }

  if (isError || !data) {
    return <div className="text-sm text-destructive">{t('common.error')}</div>
  }

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, device: UnassignedDevice) => {
    event.dataTransfer.setData('application/json', JSON.stringify(device))
    setDraggedDevice(device.deviceId)
  }

  const handleDragEnd = () => {
    setDraggedDevice(null)
  }

  if (data.rows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <PoolStat label={t('topologyPage.unassignedDevices')} value={0} />
          <PoolStat label={t('topologyPage.devices')} value={0} />
        </div>
        <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/35 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">{t('topologyPage.noUnassignedDevices')}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t('topologyPage.noUnassignedDevicesDesc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <PoolStat label={t('topologyPage.unassignedDevices')} value={summary.total} />
        <PoolStat label={t('topologyPage.entryDevices')} value={summary.entry} />
        <PoolStat label={t('topologyPage.exitDevices')} value={summary.exit} />
        <PoolStat label={t('topologyPage.devices')} value={summary.cameras} />
      </div>

      <div className="rounded-[1.15rem] border border-primary/20 bg-primary/8 px-3.5 py-3 text-xs text-muted-foreground">
        {t('topologyPage.dragDevicesHint')}
      </div>

      <div className="space-y-3">
        {data.rows.map((device) => (
          <div
            key={device.deviceId}
            draggable
            onDragStart={(event) => handleDragStart(event, device)}
            onDragEnd={handleDragEnd}
            className="group cursor-grab rounded-[1.2rem] border border-border/70 bg-background/45 p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.10)] transition-colors duration-150 hover:border-primary/35 hover:bg-background/65 active:cursor-grabbing"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  {DEVICE_ICONS[device.deviceType] ?? <Server className="h-4 w-4" />}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{device.deviceCode}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{device.siteCode}</p>
                </div>
              </div>

              <Badge variant={device.direction === 'ENTRY' ? 'secondary' : 'outline'} className="text-[10px]">
                {device.direction}
              </Badge>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[10px]">
                {device.deviceType.replace('_', ' ').toLowerCase()}
              </Badge>
              {device.locationHint ? (
                <Badge variant="outline" className="max-w-full text-[10px]">
                  <span className="truncate" title={device.locationHint}>
                    {device.locationHint}
                  </span>
                </Badge>
              ) : null}
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MoveRight className="h-3.5 w-3.5" />
                {t('topologyPage.dragDevicesHint')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
