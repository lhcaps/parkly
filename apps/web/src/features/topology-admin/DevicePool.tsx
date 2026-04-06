import { useTranslation } from 'react-i18next'
import { Server, Camera, ShieldAlert, Cpu } from 'lucide-react'
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

export default function DevicePool({ siteCode }: { siteCode: string | null }) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useUnassignedDevices(siteCode)
  const setDraggedDevice = useTopologyAdminStore((s) => s.setDraggedDevice)

  if (!siteCode) return null

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 w-full rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="text-sm text-destructive">{t('common.error')}</div>
    )
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, device: UnassignedDevice) => {
    e.dataTransfer.setData('application/json', JSON.stringify(device))
    setDraggedDevice(device.deviceId)
  }

  const handleDragEnd = () => {
    setDraggedDevice(null)
  }

  if (data.rows.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground border border-dashed rounded-md">
        No unassigned devices
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.rows.map((device) => (
        <div
          key={device.deviceId}
          draggable
          onDragStart={(e) => handleDragStart(e, device)}
          onDragEnd={handleDragEnd}
          className="group flex cursor-grab flex-col gap-1.5 rounded-md border bg-card p-3 shadow-sm transition-all hover:border-primary hover:shadow-md active:cursor-grabbing"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-muted-foreground">
                {DEVICE_ICONS[device.deviceType] ?? <Server className="h-4 w-4" />}
              </div>
              <span className="font-medium text-sm">{device.deviceCode}</span>
            </div>
            <Badge variant="outline" className="text-[10px] h-5 capitalize">
              {device.deviceType.replace('_', ' ').toLowerCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={device.direction === 'ENTRY' ? 'default' : 'secondary'} className="text-[10px] h-4">
              {device.direction}
            </Badge>
            {device.locationHint && (
              <span className="truncate" title={device.locationHint}>
                📍 {device.locationHint}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
