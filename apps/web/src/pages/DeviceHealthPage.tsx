import { Link } from 'react-router-dom'
import { Camera, Cpu, RadioTower, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DeviceHealthPanel } from '@/features/device-health/DeviceHealthPanel'

export function DeviceHealthPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">monitoring</Badge>
              <Badge variant="outline">device health</Badge>
              <Badge variant="outline">heartbeat aging</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Device Health</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Trang này chuyên cho camera, RFID, sensor và barrier health. Overview chỉ nhắc bạn có alert; còn quyết định lane nào, device nào đang degraded/offline thì xem ở đây.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/40 p-4 text-sm text-muted-foreground">
            SSE ở đây nên được giữ riêng, không mount tràn lan ở mọi page.
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/capture-debug">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="flex h-full items-start gap-3 pt-5">
              <Camera className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Capture Debug</p>
                <p className="mt-1 text-sm text-muted-foreground">Nếu camera health xấu, nhảy sang debug capture ngay.</p>
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
                <p className="mt-1 text-sm text-muted-foreground">Xem health device đang tác động lane nào ở góc nhìn aggregate.</p>
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
                <p className="mt-1 text-sm text-muted-foreground">Đối chiếu lỗi device với backlog đồng bộ nếu cần.</p>
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
                <p className="text-sm font-medium">Cách dùng page này</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Bắt đầu từ OFFLINE/DEGRADED count, nhìn heartbeat age và latency, rồi mới quyết định xem cần debug device, lane hay capture pipeline.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
