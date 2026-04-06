import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useUpdateLane, useTopologyData } from './useTopologyAdmin'
import { useTopologyAdminStore } from './topology-admin-store'
import { TopologyLane } from '@/lib/api/topology-admin-queries'

interface EditLaneDialogProps {
  laneId: string | null
  isOpen: boolean
  onClose: () => void
}

export default function EditLaneDialog({ laneId, isOpen, onClose }: EditLaneDialogProps) {
  const { t } = useTranslation()
  const currentSiteCode = useTopologyAdminStore((s) => s.siteCode)
  const { data: topology } = useTopologyData(currentSiteCode ?? '')
  const updateLaneMutation = useUpdateLane()

  const [gateCode, setGateCode] = useState('')
  const [name, setName] = useState('')
  const [direction, setDirection] = useState('ENTRY')
  const [status, setStatus] = useState('ACTIVE')
  const [sortOrder, setSortOrder] = useState('0')

  // Find the target lane data
  useEffect(() => {
    if (isOpen && laneId && topology) {
      let foundLane: TopologyLane | null = null
      let foundGateCode = ''
      
      for (const gate of topology.gates) {
        const lane = gate.lanes.find(l => l.laneCode === laneId)
        if (lane) {
          foundLane = lane
          foundGateCode = gate.gateCode
          break
        }
      }

      if (foundLane) {
        setGateCode(foundGateCode)
        setName(foundLane.label !== foundLane.laneCode ? foundLane.label : '')
        setDirection(foundLane.direction)
        setStatus(foundLane.status)
        setSortOrder(foundLane.sortOrder.toString())
      }
    }
  }, [isOpen, laneId, topology])

  if (!isOpen || !laneId) return null

  const handleSave = async () => {
    try {
      await updateLaneMutation.mutateAsync({
        laneId,
        payload: {
          gateCode: gateCode || undefined,
          name: name || undefined,
          direction,
          status,
          sortOrder: parseInt(sortOrder, 10) || 0,
        }
      })
      onClose()
    } catch (err) {
      console.error('Failed to update lane', err)
      alert(t('topologyDialog.updateLaneFailed'))
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-xl shadow-lg border flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">{t('topologyDialog.editLaneTitle', { laneId })}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('topologyDialog.closeEditLane')}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>{t('topologyDialog.gate')}</Label>
            <select
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={gateCode}
              onChange={(e) => setGateCode(e.target.value)}
            >
              <option value="">{t('topologyDialog.noChange')}</option>
              {topology?.gates.map((g) => (
                <option key={g.gateCode} value={g.gateCode}>
                  {g.label} ({g.gateCode})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>{t('topologyDialog.name')}</Label>
            <Input
              placeholder={t('topologyDialog.laneNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('topologyDialog.direction')}</Label>
            <select
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="ENTRY">{t('direction.ENTRY')}</option>
              <option value="EXIT">{t('direction.EXIT')}</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <Label>{t('topologyDialog.status')}</Label>
            <select
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>{t('topologyDialog.sortOrder')}</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2 bg-muted/20">
          <Button variant="secondary" onClick={onClose}>
            {t('topologyDialog.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={updateLaneMutation.isPending}>
            {updateLaneMutation.isPending ? t('topologyDialog.saving') : t('topologyDialog.saveChanges')}
          </Button>
        </div>
      </div>
    </div>
  )
}
