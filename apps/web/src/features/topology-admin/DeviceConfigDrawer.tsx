import { useTranslation } from 'react-i18next'
import { X, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useTopologyAdminStore } from './topology-admin-store'
import { useTopologyData } from './useTopologyAdmin'

export default function DeviceConfigDrawer() {
  const { t } = useTranslation()
  const currentSiteCode = useTopologyAdminStore((s) => s.siteCode)
  const { data: topology } = useTopologyData(currentSiteCode ?? '')

  const { drawerOpen, drawerDeviceId, drawerLaneId, closeDrawer } = useTopologyAdminStore()

  if (!drawerOpen || !drawerDeviceId) return null

  // Find the device from the topology structure
  let targetedDevice = null
  if (topology) {
    for (const gate of topology.gates) {
      for (const lane of gate.lanes) {
        if (lane.laneCode === drawerLaneId) {
          const matchingDevice = lane.devices.find((d) => d.deviceCode === drawerDeviceId) // TODO: deviceId vs deviceCode mismatch
          if (matchingDevice) targetedDevice = matchingDevice
        }
      }
    }
  }

  // NOTE: In a real app, you'd manage local state for these inputs and submit mutations
  // For the V1 visualizer, we just show a static read-only view or basic form shell.

  return (
    <div className="w-80 border-l bg-card flex flex-col items-stretch shadow-xl z-20 absolute top-0 right-0 bottom-0 transform transition-transform duration-300">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-semibold">{t('topologyDialog.configureDevice')}</h2>
        <Button variant="ghost" size="icon" onClick={closeDrawer} aria-label={t('topologyDialog.closeDeviceDrawer')}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <Label>{t('topologyDialog.deviceCode')}</Label>
          <Input disabled value={targetedDevice?.deviceCode ?? drawerDeviceId} />
          <p className="text-[10px] text-muted-foreground font-mono">ID: {drawerDeviceId}</p>
        </div>

        <div className="space-y-2">
          <Label>{t('topologyDialog.roleInLane')}</Label>
          <select 
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            defaultValue={targetedDevice?.deviceRole ?? 'CAMERA'} 
            disabled
          >
            <option value="PRIMARY">PRIMARY</option>
            <option value="CAMERA">CAMERA</option>
            <option value="RFID">RFID</option>
            <option value="LOOP_SENSOR">LOOP SENSOR</option>
            <option value="BARRIER">BARRIER</option>
          </select>
        </div>

        <div className="flex items-center justify-between border rounded-md p-3">
          <div className="space-y-0.5">
            <Label>{t('topologyDialog.isPrimary')}</Label>
            <p className="text-xs text-muted-foreground">{t('topologyDialog.isPrimaryHint')}</p>
          </div>
          <input type="checkbox" checked={targetedDevice?.isPrimary ?? false} disabled />
        </div>

        <div className="flex items-center justify-between border rounded-md p-3">
          <div className="space-y-0.5">
            <Label>{t('topologyDialog.isRequired')}</Label>
            <p className="text-xs text-muted-foreground">{t('topologyDialog.isRequiredHint')}</p>
          </div>
          <input type="checkbox" checked={targetedDevice?.isRequired ?? true} disabled />
        </div>

        <div className="space-y-2 pt-4 border-t">
          <Label>{t('topologyDialog.locationHint')}</Label>
          <Input placeholder={t('topologyDialog.locationPlaceholder')} defaultValue={targetedDevice?.locationHint ?? ''} disabled />
        </div>

        <div className="space-y-2">
          <Label>{t('topologyDialog.ipAddress')}</Label>
          <Input placeholder="192.168.1.100" defaultValue={targetedDevice?.ipAddress ?? ''} disabled />
        </div>
      </div>

      <div className="p-4 border-t flex flex-col gap-2">
        <Button className="w-full gap-2" disabled>
          <Save className="h-4 w-4" /> {t('topologyDialog.saveChanges')}
        </Button>
        <Button variant="destructive" className="w-full gap-2" disabled>
          <Trash2 className="h-4 w-4" /> {t('topologyDialog.unlinkFromLane')}
        </Button>
      </div>
    </div>
  )
}
