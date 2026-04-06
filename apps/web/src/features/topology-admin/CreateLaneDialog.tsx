import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useCreateLane, useTopologyData } from './useTopologyAdmin'
import { useTopologyAdminStore } from './topology-admin-store'

interface CreateLaneDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function CreateLaneDialog({ isOpen, onClose }: CreateLaneDialogProps) {
  const { t } = useTranslation()
  const currentSiteCode = useTopologyAdminStore((s) => s.siteCode)
  const { data: topology } = useTopologyData(currentSiteCode ?? '')
  const createLaneMutation = useCreateLane()

  const [gateCode, setGateCode] = useState('')
  const [laneCode, setLaneCode] = useState('')
  const [name, setName] = useState('')
  const [direction, setDirection] = useState('ENTRY')
  const [sortOrder, setSortOrder] = useState('0')

  useEffect(() => {
    if (isOpen && topology?.gates.length) {
      setGateCode(topology.gates[0].gateCode)
    }
  }, [isOpen, topology])

  if (!isOpen) return null

  const handleSave = async () => {
    if (!currentSiteCode || !gateCode || !laneCode || !name) return

    try {
      await createLaneMutation.mutateAsync({
        siteCode: currentSiteCode,
        gateCode,
        laneCode,
        name,
        direction,
        sortOrder: parseInt(sortOrder, 10) || 0,
      })
      onClose()
      setLaneCode('')
      setName('')
      setSortOrder('0')
    } catch (err) {
      console.error('Failed to create lane', err)
      alert(t('topologyDialog.createLaneFailed'))
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-xl shadow-lg border flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">{t('topologyDialog.addLane')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('topologyDialog.closeCreateLane')}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>{t('topologyDialog.selectGate')}</Label>
            <select
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={gateCode}
              onChange={(e) => setGateCode(e.target.value)}
            >
              {topology?.gates.map((g) => (
                <option key={g.gateCode} value={g.gateCode}>
                  {g.label} ({g.gateCode})
                </option>
              ))}
            </select>
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
          <Button onClick={handleSave} disabled={createLaneMutation.isPending || !gateCode || !laneCode || !name}>
            {createLaneMutation.isPending ? t('topologyDialog.saving') : t('topologyDialog.createLane')}
          </Button>
        </div>
      </div>
    </div>
  )
}
