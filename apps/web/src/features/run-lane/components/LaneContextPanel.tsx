import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, type SelectOption } from '@/components/ui/select'
import { formatTimeValue } from '@/i18n/format'
import { useRunLaneActions, useRunLaneStore } from '@/features/run-lane/store/runLaneStoreContext'
import { selectRunLaneMeta, selectRunLaneTopology } from '@/features/run-lane/store/runLaneSelectors'
import { cn } from '@/lib/utils'

function statusVariant(status: 'idle' | 'loading' | 'ready' | 'error') {
  if (status === 'ready') return 'entry' as const
  if (status === 'loading') return 'amber' as const
  if (status === 'error') return 'destructive' as const
  return 'outline' as const
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  className,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={cn('rounded-xl border border-border/50 bg-muted/20', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
      >
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open ? <div className="border-t border-border/40 px-3 pb-3 pt-1">{children}</div> : null}
    </div>
  )
}

function MiniMetric({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn('font-mono-data text-xs font-medium', muted ? 'text-muted-foreground' : 'text-foreground')}>
        {value}
      </span>
    </div>
  )
}

export function LaneContextPanel({ onReloadTopology }: { onReloadTopology: () => void }) {
  const { t } = useTranslation()
  const actions = useRunLaneActions()
  const meta = useRunLaneStore(selectRunLaneMeta)
  const topology = useRunLaneStore(selectRunLaneTopology)

  const selectedSite = useMemo(
    () => topology.sites.find((site) => site.siteCode === topology.siteCode) ?? null,
    [topology.sites, topology.siteCode],
  )
  const selectedGate = useMemo(
    () => topology.gates.find((gate) => gate.gateCode === topology.gateCode) ?? null,
    [topology.gates, topology.gateCode],
  )
  const gateLanes = useMemo(
    () => topology.lanes.filter((lane) => lane.gateCode === topology.gateCode),
    [topology.lanes, topology.gateCode],
  )
  const selectedLane = useMemo(
    () => gateLanes.find((lane) => lane.laneCode === topology.laneCode) ?? gateLanes[0] ?? null,
    [gateLanes, topology.laneCode],
  )
  const laneDevices = useMemo(
    () => topology.devices.filter((device) => device.laneCode === selectedLane?.laneCode),
    [topology.devices, selectedLane?.laneCode],
  )
  const primaryCamera = useMemo(
    () =>
      laneDevices.find((device) => device.deviceRole === 'CAMERA') ??
      laneDevices.find((device) => device.deviceType.toUpperCase().includes('CAMERA')) ??
      null,
    [laneDevices],
  )
  const loopSensor = useMemo(
    () =>
      laneDevices.find((device) => device.deviceRole === 'LOOP_SENSOR') ??
      laneDevices.find((device) => device.deviceType.toUpperCase().includes('SENSOR')) ??
      null,
    [laneDevices],
  )

  const siteOptions = useMemo<SelectOption[]>(
    () => topology.sites.map((site) => ({ value: site.siteCode, label: site.siteCode, description: site.name })),
    [topology.sites],
  )
  const gateOptions = useMemo<SelectOption[]>(() => {
    const seen = new Set<string>()
    return topology.gates
      .filter((gate) => {
        if (seen.has(gate.gateCode)) return false
        seen.add(gate.gateCode)
        return true
      })
      .map((gate) => ({ value: gate.gateCode, label: gate.gateCode, description: gate.label }))
  }, [topology.gates])
  const laneOptions = useMemo<SelectOption[]>(
    () => {
      const seen = new Set<string>()
      return gateLanes
        .filter((lane) => {
          if (seen.has(lane.laneCode)) return false
          seen.add(lane.laneCode)
          return true
        })
        .map((lane) => ({
          value: lane.laneCode,
          label: lane.laneCode,
          description: `${lane.label} / ${t(`direction.${lane.direction}` as 'direction.ENTRY' | 'direction.EXIT')}`,
        }))
    },
    [gateLanes, t],
  )

  const loadStatusLabel = (status: typeof topology.loadStatus) => {
    if (status === 'idle') return t('laneContext.statusIdle')
    if (status === 'loading') return t('laneContext.statusLoading')
    if (status === 'ready') return t('laneContext.statusReady')
    return t('laneContext.statusError')
  }

  return (
    <Card className="border-border/60 bg-card/96">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(topology.loadStatus)} className="text-[10px]">
              {loadStatusLabel(topology.loadStatus)}
            </Badge>
            {selectedLane ? (
              <Badge variant={selectedLane.direction === 'ENTRY' ? 'entry' : 'exit'} className="text-[10px]">
                {t(`direction.${selectedLane.direction}` as 'direction.ENTRY' | 'direction.EXIT')}
              </Badge>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onReloadTopology}
            disabled={!topology.siteCode || topology.loadStatus === 'loading'}
            className="h-7 gap-1.5 text-[11px]"
          >
            {topology.loadStatus === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {t('laneContext.reload')}
          </Button>
        </div>

        <CollapsibleSection title={t('laneContext.chooseContext')} defaultOpen={true}>
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">{t('laneContext.site')}</Label>
              <Select
                value={topology.siteCode}
                onChange={actions.setSiteCode}
                options={siteOptions}
                placeholder={
                  topology.loadStatus === 'loading' && siteOptions.length === 0
                    ? t('laneContext.placeholderLoadingSite')
                    : t('laneContext.placeholderSelectSite')
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">{t('laneContext.gate')}</Label>
              <Select
                value={topology.gateCode}
                onChange={actions.setGateCode}
                options={gateOptions}
                placeholder={
                  !topology.siteCode
                    ? t('laneContext.placeholderSelectGateFirst')
                    : gateOptions.length === 0
                      ? t('laneContext.placeholderNoGate')
                      : t('laneContext.placeholderSelectGate')
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">{t('laneContext.lane')}</Label>
              <Select
                value={topology.laneCode}
                onChange={actions.setLaneCode}
                options={laneOptions}
                placeholder={
                  !topology.gateCode
                    ? t('laneContext.placeholderSelectLaneFirst')
                    : laneOptions.length === 0
                      ? t('laneContext.placeholderNoLane')
                      : t('laneContext.placeholderSelectLane')
                }
              />
            </div>
          </div>
        </CollapsibleSection>

        {topology.error ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p className="font-medium">{topology.error}</p>
            </div>
          </div>
        ) : null}

        <CollapsibleSection title={t('laneContext.laneDetails')} defaultOpen={true}>
          <div className="space-y-0.5 rounded-xl border border-border/40 bg-muted/30 p-3">
            <MiniMetric label={t('laneContext.site')} value={selectedSite ? `${selectedSite.siteCode} / ${selectedSite.name}` : t('common.dash')} />
            <MiniMetric label={t('laneContext.gate')} value={selectedGate ? `${selectedGate.gateCode} / ${selectedGate.label}` : t('common.dash')} />
            <MiniMetric label={t('laneContext.lane')} value={selectedLane ? `${selectedLane.laneCode} / ${selectedLane.label}` : t('common.dash')} />
            <MiniMetric label={t('laneContext.direction')} value={selectedLane ? t(`direction.${selectedLane.direction}` as 'direction.ENTRY' | 'direction.EXIT') : t('common.dash')} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title={t('laneContext.devicesTitle')} defaultOpen={false}>
          <div className="space-y-0.5 rounded-xl border border-border/40 bg-muted/30 p-3">
            <MiniMetric label={t('laneContext.primaryCamera')} value={primaryCamera?.deviceCode ?? t('laneContext.unassigned')} muted={!primaryCamera} />
            <MiniMetric label={t('laneContext.loopSensor')} value={loopSensor?.deviceCode ?? t('laneContext.unassigned')} muted={!loopSensor} />
            <MiniMetric label={t('laneContext.devicesCount')} value={t('laneContext.devicesCountValue', { count: laneDevices.length })} muted={laneDevices.length === 0} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title={t('laneContext.scopeTitle')} defaultOpen={false}>
          <div className="space-y-0.5 rounded-xl border border-border/40 bg-muted/30 p-3">
            <MiniMetric label={t('laneContext.scopeId')} value={meta.scopeId} />
            <MiniMetric label={t('laneContext.scopeCreated')} value={formatTimeValue(meta.createdAt)} />
          </div>
        </CollapsibleSection>
      </CardContent>
    </Card>
  )
}
