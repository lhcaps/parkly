import { useEffect, useMemo, useCallback, useState } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from '@xyflow/react'
import dagre from 'dagre'
import '@xyflow/react/dist/style.css'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Activity, AlertTriangle, Edit2, Zap } from 'lucide-react'

import type { TopologyGate, TopologyLane, TopologyDevice } from '@/lib/api/topology-admin-queries'
import { useTopologyAdminStore } from './topology-admin-store'
import { useSyncLaneDevices } from './useTopologyAdmin'

// ─── Dagre Auto-Layout ──────────────────────────────────────────────────────

const NODE_WIDTH = 250
const NODE_HEIGHT_GATE = 78
const NODE_HEIGHT_LANE = 96
const NODE_HEIGHT_DEVICE = 68

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 72, ranksep: 102, marginx: 40, marginy: 40 })

  for (const node of nodes) {
    const h = node.type === 'gate' ? NODE_HEIGHT_GATE : node.type === 'lane' ? NODE_HEIGHT_LANE : NODE_HEIGHT_DEVICE
    g.setNode(node.id, { width: NODE_WIDTH, height: h })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id)
    const h = node.type === 'gate' ? NODE_HEIGHT_GATE : node.type === 'lane' ? NODE_HEIGHT_LANE : NODE_HEIGHT_DEVICE
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - h / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

// ─── Custom Node Components ──────────────────────────────────────────────────

function GateNode({ data }: { data: { label: string; laneCount: number } }) {
  return (
    <div className="relative min-w-[250px] overflow-hidden rounded-[1.3rem] border border-white/8 bg-[#151518]/88 px-5 py-4 text-center shadow-[0_18px_44px_rgba(0,0,0,0.22)] backdrop-blur-md transition-all group hover:border-primary/35">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="mb-2 truncate text-[15px] font-semibold tracking-wide text-foreground">{data.label}</div>
      <Badge variant="secondary" className="bg-muted/70 text-muted-foreground hover:bg-muted/70 font-normal uppercase tracking-wider text-[10px] px-2 py-0.5">
        {data.laneCount} Lanes
      </Badge>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-muted-foreground border-none" />
    </div>
  )
}

function LaneNode({ data }: { data: { lane: TopologyLane; onEdit: (laneId: string) => void } }) {
  const lane = data.lane
  const isUp = lane.status === 'ACTIVE'
  const isDegraded = lane.devices.some((d) => d.isRequired && d.heartbeatStatus !== 'ONLINE') && lane.devices.length > 0

  return (
    <div className="relative min-w-[235px] rounded-[1.25rem] border border-white/8 bg-[#1a1b1e]/94 px-4 py-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-md transition-all group hover:border-primary/35">
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-muted-foreground border-none" />

      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="max-w-[155px] truncate font-medium text-[14px] text-foreground/90">{lane.label}</span>
            <Badge variant="outline" className={`text-[9px] uppercase tracking-wider py-0 px-1.5 border-foreground/20 text-foreground/70 ${lane.direction === 'ENTRY' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
              {lane.direction}
            </Badge>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); data.onEdit(lane.laneCode) }}
          className="rounded-md p-1 text-muted-foreground opacity-0 transition-colors hover:text-foreground group-hover:opacity-100"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${isUp ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
          <Activity className="w-3 h-3" /> {lane.status}
        </span>
        {isDegraded && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-amber-400 bg-amber-400/10">
            <AlertTriangle className="w-3 h-3" /> DEGRADED
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-amber-500 border-none" />
    </div>
  )
}

function DeviceNode({ data }: { data: { device: TopologyDevice; laneId: string } }) {
  const d = data.device
  const openDrawer = useTopologyAdminStore((s) => s.openDrawer)
  const isUp = d.heartbeatStatus === 'ONLINE'
  const isPrimary = d.isPrimary

  return (
    <div
      className={`min-w-[200px] cursor-pointer rounded-[1.1rem] border border-white/8 bg-[#1c1d22]/94 px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.18)] transition-all group hover:border-amber-500/35 ${
        isPrimary ? 'border-amber-500/30 ring-1 ring-amber-500/20' : ''
      }`}
      onClick={() => openDrawer(d.deviceCode, data.laneId)}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-amber-500 border-none" />

      <div className="flex items-center justify-between mb-2">
        <div className="max-w-[132px] truncate font-mono text-[12px] font-bold text-foreground/90" title={d.deviceCode}>
          {d.deviceCode}
        </div>
        <div className="flex items-center justify-center p-1">
          <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_var(--tw-shadow-color)] ${isUp ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-red-500 shadow-red-500/50'}`} title={d.heartbeatStatus ?? 'OFFLINE'} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="max-w-[96px] truncate text-[11px] font-medium capitalize text-muted-foreground" title={d.deviceType}>
          {d.deviceType.replace('_', ' ')}
        </span>
        {isPrimary && (
          <Badge variant="outline" className="text-[9px] uppercase tracking-wider py-0 px-1.5 bg-amber-500/10 text-amber-500 border-amber-500/20 ml-auto">
            Primary
          </Badge>
        )}
      </div>
    </div>
  )
}

const nodeTypes = {
  gate: GateNode,
  lane: LaneNode,
  device: DeviceNode,
}

// ─── Assign Device Dialog ────────────────────────────────────────────────────

function AssignDeviceDialog({
  open,
  onOpenChange,
  deviceCode,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceCode: string
  onConfirm: (laneCode: string) => void
}) {
  const [laneCode, setLaneCode] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Assign Device to Lane
          </DialogTitle>
          <DialogDescription>
            Assign <span className="font-mono font-semibold text-foreground">{deviceCode}</span> to a lane by entering the lane code below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="assign-lane-code" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Lane Code
          </label>
          <Input
            id="assign-lane-code"
            placeholder="e.g. LANE-A1"
            value={laneCode}
            onChange={(e) => setLaneCode(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && laneCode.trim()) {
                onConfirm(laneCode.trim())
                setLaneCode('')
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!laneCode.trim()}
            onClick={() => {
              onConfirm(laneCode.trim())
              setLaneCode('')
            }}
          >
            Assign Device
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Build Graph from Gates Data ────────────────────────────────────────────

function buildGraph(gates: TopologyGate[], onEditLane: (laneId: string) => void) {
  const nodes: Node[] = []
  const edges: Edge[] = []

  for (const gate of gates) {
    const gateNodeId = `gate-${gate.gateCode}`
    nodes.push({
      id: gateNodeId,
      type: 'gate',
      position: { x: 0, y: 0 }, // dagre will set position
      data: { label: gate.label, laneCount: gate.laneCount },
    })

    for (const lane of gate.lanes) {
      const laneNodeId = `lane-${lane.laneCode}`
      nodes.push({
        id: laneNodeId,
        type: 'lane',
        position: { x: 0, y: 0 },
        data: { lane, onEdit: onEditLane },
      })
      edges.push({
        id: `e-${gateNodeId}-${laneNodeId}`,
        source: gateNodeId,
        target: laneNodeId,
        type: 'smoothstep',
        animated: lane.status === 'ACTIVE',
        style: { stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '6 4' },
      })

      for (const device of lane.devices) {
        const deviceNodeId = `dev-${device.deviceCode}`
        nodes.push({
          id: deviceNodeId,
          type: 'device',
          position: { x: 0, y: 0 },
          data: { device, laneId: lane.laneCode },
        })
        edges.push({
          id: `e-${laneNodeId}-${deviceNodeId}`,
          source: laneNodeId,
          target: deviceNodeId,
          type: 'smoothstep',
          style: { stroke: '#f59e0b', strokeWidth: 2 },
          animated: false,
        })
      }
    }
  }

  return getLayoutedElements(nodes, edges)
}

// ─── Main Visualizer ────────────────────────────────────────────────────────

export default function TopologyVisualizer({
  gates,
  onEditLane,
}: {
  gates: TopologyGate[]
  onEditLane: (laneId: string) => void
}) {
  const syncMutation = useSyncLaneDevices()
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])

  // Dialog state for device assignment (replaces prompt())
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; deviceCode: string }>({
    open: false,
    deviceCode: '',
  })

  // Reactive: rebuild graph whenever gates data changes
  useEffect(() => {
    if (!gates || gates.length === 0) {
      setNodes([] as Node[])
      setEdges([] as Edge[])
      return
    }
    const { nodes: layoutedNodes, edges: layoutedEdges } = buildGraph(gates, onEditLane)
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
  }, [gates, onEditLane, setNodes, setEdges])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const deviceDataStr = event.dataTransfer.getData('application/json')
      if (!deviceDataStr) return

      try {
        const device = JSON.parse(deviceDataStr)
        if (device?.deviceCode) {
          setAssignDialog({ open: true, deviceCode: device.deviceCode })
        }
      } catch {
        toast.error('Invalid device data dropped')
      }
    },
    [],
  )

  const handleAssignDevice = useCallback(
    (targetLaneCode: string) => {
      setAssignDialog({ open: false, deviceCode: '' })
      toast.success(`Assigning ${assignDialog.deviceCode} → ${targetLaneCode}`, {
        description: 'Calling sync API...',
      })

      // In production: find existing devices on that lane, append new one, call mutation
      // For now, we show the intent via toast
      syncMutation.mutate(
        {
          laneId: targetLaneCode,
          payload: {
            devices: [
              {
                deviceId: assignDialog.deviceCode,
                deviceRole: 'CAMERA',
                isPrimary: false,
                isRequired: false,
                sortOrder: 99,
              },
            ],
          },
        },
        {
          onSuccess: () => toast.success(`Device ${assignDialog.deviceCode} assigned to ${targetLaneCode}`),
          onError: (err) => toast.error('Failed to assign device', { description: String(err) }),
        },
      )
    },
    [assignDialog.deviceCode, syncMutation],
  )

  return (
    <>
      <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          className="bg-[#0b0c0f]"
          colorMode="dark"
          minZoom={0.3}
          maxZoom={1.8}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} color="hsl(var(--muted-foreground))" style={{ opacity: 0.15 }} />
          <Controls position="top-right" className="!bg-[#151518] !border-border/40 !fill-muted-foreground [&>button]:!border-border/40 hover:[&>button]:!bg-muted" />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'gate') return '#6b7280'
              if (node.type === 'lane') return '#f59e0b'
              return '#22c55e'
            }}
            maskColor="rgba(0,0,0,0.7)"
            className="!bg-[#151518] !border-border/40"
            pannable
            zoomable
          />
        </ReactFlow>
      </div>

      <AssignDeviceDialog
        open={assignDialog.open}
        onOpenChange={(open) => setAssignDialog((prev) => ({ ...prev, open }))}
        deviceCode={assignDialog.deviceCode}
        onConfirm={handleAssignDevice}
      />
    </>
  )
}
