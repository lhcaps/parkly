import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Loader2, MapPinned, RefreshCw, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, type SelectOption } from '@/components/ui/select'
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
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && <div className="border-t border-border/40 px-3 pb-3 pt-1">{children}</div>}
    </div>
  )
}

function MiniMetric({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-medium font-mono-data', muted ? 'text-muted-foreground' : 'text-foreground')}>
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
  const gateOptions = useMemo<SelectOption[]>(
    () => topology.gates.map((gate) => ({ value: gate.gateCode, label: gate.gateCode, description: gate.label })),
    [topology.gates],
  )
  const laneOptions = useMemo<SelectOption[]>(
    () =>
      gateLanes.map((lane) => ({
        value: lane.laneCode,
        label: lane.laneCode,
        description: `${lane.label} · ${t(`direction.${lane.direction}` as 'direction.ENTRY' | 'direction.EXIT')}`,
      })),
    [gateLanes, t],
  )

  const loadStatusLabel = (s: typeof topology.loadStatus) => {
    if (s === 'idle') return 'idle'
    if (s === 'loading') return 'loading...'
    if (s === 'ready') return 'ready'
    return 'error'
  }

  return (
    <Card className="border-border/60 bg-card/95">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(topology.loadStatus)} className="text-[10px]">
              {loadStatusLabel(topology.loadStatus)}
            </Badge>
            {selectedLane ? (
              <Badge
                variant={selectedLane.direction === 'ENTRY' ? 'entry' : 'exit'}
                className="text-[10px]"
              >
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
            {topology.loadStatus === 'loading' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Reload
          </Button>
        </div>

        <CollapsibleSection title="Chọn Context" defaultOpen={true}>
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Site</Label>
              <Select
                value={topology.siteCode}
                onChange={actions.setSiteCode}
                options={siteOptions}
                placeholder={
                  topology.loadStatus === 'loading' && siteOptions.length === 0
                    ? 'Loading...'
                    : 'Chọn site'
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Gate</Label>
              <Select
                value={topology.gateCode}
                onChange={actions.setGateCode}
                options={gateOptions}
                placeholder={
                  !topology.siteCode ? 'Chọn site trước' : gateOptions.length === 0 ? 'Không có gate' : 'Chọn gate'
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Lane</Label>
              <Select
                value={topology.laneCode}
                onChange={actions.setLaneCode}
                options={laneOptions}
                placeholder={
                  !topology.gateCode ? 'Chọn gate trước' : laneOptions.length === 0 ? 'Không có lane' : 'Chọn lane'
                }
              />
            </div>
          </div>
        </CollapsibleSection>

        {topology.error && (
          <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p className="font-medium">{topology.error}</p>
            </div>
          </div>
        )}

        <CollapsibleSection title="Thông tin Lane" defaultOpen={true}>
          <div className="rounded-xl border border-border/40 bg-muted/30 p-3 space-y-0.5">
            <MiniMetric
              label="Site"
              value={selectedSite ? `${selectedSite.siteCode} — ${selectedSite.name}` : '—'}
            />
            <MiniMetric
              label="Gate"
              value={selectedGate ? `${selectedGate.gateCode} — ${selectedGate.label}` : '—'}
            />
            <MiniMetric
              label="Lane"
              value={selectedLane ? `${selectedLane.laneCode} — ${selectedLane.label}` : '—'}
            />
            <MiniMetric
              label="Hướng"
              value={selectedLane ? t(`direction.${selectedLane.direction}` as 'direction.ENTRY' | 'direction.EXIT') : '—'}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Thiết bị" defaultOpen={false}>
          <div className="rounded-xl border border-border/40 bg-muted/30 p-3 space-y-0.5">
            <MiniMetric
              label="Camera"
              value={primaryCamera?.deviceCode ?? 'Chưa gắn'}
              muted={!primaryCamera}
            />
            <MiniMetric
              label="Cảm biến"
              value={loopSensor?.deviceCode ?? 'Chưa gắn'}
              muted={!loopSensor}
            />
            <MiniMetric
              label="Thiết bị"
              value={`${laneDevices.length} thiết bị`}
              muted={laneDevices.length === 0}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Scope" defaultOpen={false}>
          <div className="rounded-xl border border-border/40 bg-muted/30 p-3 space-y-0.5">
            <MiniMetric label="Scope ID" value={meta.scopeId} />
            <MiniMetric
              label="Tạo lúc"
              value={new Date(meta.createdAt).toLocaleTimeString('vi-VN')}
            />
          </div>
        </CollapsibleSection>
      </CardContent>
    </Card>
  )
}
