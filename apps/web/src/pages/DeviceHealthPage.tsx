import { Link } from 'react-router-dom'
import { Camera, Cpu, RadioTower, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/ops/console'
import { Card, CardContent } from '@/components/ui/card'
import { DeviceHealthPanel } from '@/features/device-health/DeviceHealthPanel'

export function DeviceHealthPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Device Health"
        description="Monitor device heartbeat, latency, and degradation by site and lane. Use this screen to quickly identify cameras, RFID readers, sensors, or barriers with issues."
        badges={[
          { label: 'devices', variant: 'secondary' },
          { label: 'heartbeat', variant: 'outline' },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/capture-debug">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <Camera className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Capture Debug</p>
                <p className="mt-1 text-sm text-muted-foreground">Investigate image source and ALPR results when capture or preview is abnormal.</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/lane-monitor">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <Cpu className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Lane Monitor</p>
                <p className="mt-1 text-sm text-muted-foreground">Cross-reference faulty devices against affected lanes.</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/sync-outbox">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <RadioTower className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Sync Outbox</p>
                <p className="mt-1 text-sm text-muted-foreground">Cross-reference device faults with the sync backlog.</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <DeviceHealthPanel />

        <Card className="border-border/80 bg-card/95">
          <CardContent className="space-y-4 pt-5">
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">How to read this screen</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Start with the count of OFFLINE or DEGRADED devices, then check heartbeat age and latency to prioritise.cần xử lý trước.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
