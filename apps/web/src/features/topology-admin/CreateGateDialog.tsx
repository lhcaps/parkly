import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useCreateLane } from './useTopologyAdmin'
import { useTopologyAdminStore } from './topology-admin-store'

interface CreateGateDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function CreateGateDialog({ isOpen, onClose }: CreateGateDialogProps) {
  const { t } = useTranslation()
  const currentSiteCode = useTopologyAdminStore((s) => s.siteCode)
  const createLaneMutation = useCreateLane()

  const [gateCode, setGateCode] = useState('')
  const [laneCode, setLaneCode] = useState('')
  const [name, setName] = useState('')
  const [direction, setDirection] = useState('ENTRY')

  if (!isOpen) return null

  const handleSave = async () => {
    if (!currentSiteCode || !gateCode || !laneCode || !name) return

    try {
      // Creating a gate implicitly creates its first lane
      await createLaneMutation.mutateAsync({
        siteCode: currentSiteCode,
        gateCode,
        laneCode,
        name,
        direction,
        sortOrder: 0,
      })
      onClose()
      setGateCode('')
      setLaneCode('')
      setName('')
    } catch (err) {
      console.error('Failed to create gate', err)
      alert(t('topologyDialog.createGateFailed'))
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-xl shadow-lg border flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">{t('topologyDialog.addGate')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('topologyDialog.closeCreateGate')}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>{t('topologyDialog.newGateCode')}</Label>
            <Input
              placeholder={t('topologyDialog.gateCodePlaceholder')}
              value={gateCode}
              onChange={(e) => setGateCode(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('topologyDialog.gateNeedsLane')}</p>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <h3 className="text-sm font-medium">{t('topologyDialog.firstLaneDetails')}</h3>
          </div>

          <div className="space-y-2">
            <Label>{t('topologyDialog.laneCode')}</Label>
            <Input
              placeholder={t('topologyDialog.laneCodePlaceholder')}
              value={laneCode}
              onChange={(e) => setLaneCode(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('topologyDialog.laneName')}</Label>
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
        </div>

        <div className="p-4 border-t flex justify-end gap-2 bg-muted/20">
          <Button variant="secondary" onClick={onClose}>
            {t('topologyDialog.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={createLaneMutation.isPending || !gateCode || !laneCode || !name}>
            {createLaneMutation.isPending ? t('topologyDialog.saving') : t('topologyDialog.createGate')}
          </Button>
        </div>
      </div>
    </div>
  )
}
