import { useMemo } from 'react'
import { Activity, Camera, CircleDot, Loader2, MapPinned, Radar, RefreshCw, ScanLine, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

function ContextMetric({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: typeof Activity
  label: string
  value: string
  tone?: 'default' | 'muted'
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-mono-data uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className={cn('text-sm font-medium text-foreground break-all', tone === 'muted' && 'text-muted-foreground')}>
        {value}
      </p>
    </div>
  )
}

export function LaneContextPanel({ onReloadTopology }: { onReloadTopology: () => void }) {
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
    () => laneDevices.find((device) => device.deviceRole === 'CAMERA') ?? laneDevices.find((device) => device.deviceType.toUpperCase().includes('CAMERA')) ?? null,
    [laneDevices],
  )
  const loopSensor = useMemo(
    () => laneDevices.find((device) => device.deviceRole === 'LOOP_SENSOR') ?? laneDevices.find((device) => device.deviceType.toUpperCase().includes('SENSOR')) ?? null,
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
    () => gateLanes.map((lane) => ({ value: lane.laneCode, label: lane.laneCode, description: `${lane.label} · ${lane.direction}` })),
    [gateLanes],
  )

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">scoped store</Badge>
            <Badge variant={statusVariant(topology.loadStatus)}>{topology.loadStatus}</Badge>
            {selectedLane && <Badge variant={selectedLane.direction === 'ENTRY' ? 'entry' : 'exit'}>{selectedLane.direction}</Badge>}
          </div>
          <Button variant="outline" size="sm" onClick={onReloadTopology} disabled={!topology.siteCode || topology.loadStatus === 'loading'}>
            {topology.loadStatus === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Reload
          </Button>
        </div>
        <div>
          <CardTitle className="text-base sm:text-lg">Lane Context Panel</CardTitle>
          <CardDescription>
            Context subscribes to the topology slice only. The provider supplies a scoped store instance with no mutable state injection.table state qua React Context.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="run-lane-site">Site</Label>
            <Select
              value={topology.siteCode}
              onChange={actions.setSiteCode}
              options={siteOptions}
              placeholder={topology.loadStatus === 'loading' && siteOptions.length === 0 ? 'Loading site...' : 'Select site'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="run-lane-gate">Gate</Label>
            <Select
              value={topology.gateCode}
              onChange={actions.setGateCode}
              options={gateOptions}
              placeholder={!topology.siteCode ? 'Select site first' : gateOptions.length === 0 ? 'No gate' : 'Select gate'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="run-lane-lane">Lane</Label>
            <Select
              value={topology.laneCode}
              onChange={actions.setLaneCode}
              options={laneOptions}
              placeholder={!topology.gateCode ? 'Select gate first' : laneOptions.length === 0 ? 'No lane' : 'Select lane'}
            />
          </div>
        </div>

        {topology.error && (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Topology load error</p>
                <p className="mt-1 text-destructive/90">{topology.error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <ContextMetric icon={MapPinned} label="Site" value={selectedSite ? `${selectedSite.siteCode} · ${selectedSite.name}` : '—'} />
          <ContextMetric icon={Radar} label="Gate" value={selectedGate ? `${selectedGate.gateCode} · ${selectedGate.label}` : '—'} />
          <ContextMetric icon={CircleDot} label="Lane" value={selectedLane ? `${selectedLane.laneCode} · ${selectedLane.label}` : '—'} />
          <ContextMetric icon={Activity} label="Direction" value={selectedLane?.direction ?? '—'} />
          <ContextMetric icon={Camera} label="Primary camera" value={primaryCamera?.deviceCode ?? 'Unresolved'} tone={primaryCamera ? 'default' : 'muted'} />
          <ContextMetric icon={ScanLine} label="Loop sensor" value={loopSensor?.deviceCode ?? 'Unresolved'} tone={loopSensor ? 'default' : 'muted'} />
        </div>

        <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">scope {meta.scopeId}</Badge>
            <Badge variant="muted">created {new Date(meta.createdAt).toLocaleTimeString('vi-VN')}</Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            This scope is released when leaving /run-lane — state here is not shared with other screens.te lane context/capture placeholder không leak sang route khác.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
