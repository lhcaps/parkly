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
        description="Theo dõi heartbeat, độ trễ và suy giảm thiết bị theo site và lane. Dùng màn hình này để xác định nhanh camera, RFID, sensor hoặc barrier đang gặp vấn đề."
        badges={[
          { label: 'thiết bị', variant: 'secondary' },
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
                <p className="mt-1 text-sm text-muted-foreground">Đi tiếp sang nguồn ảnh và ALPR khi camera hoặc preview có dấu hiệu bất thường.</p>
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
                <p className="mt-1 text-sm text-muted-foreground">Đối chiếu thiết bị hỏng đang tác động lane nào ở góc nhìn tổng hợp.</p>
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
                <p className="mt-1 text-sm text-muted-foreground">Đối chiếu lỗi thiết bị với backlog đồng bộ khi cần.</p>
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
                <p className="text-sm font-medium">Cách đọc màn hình</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Bắt đầu từ số lượng OFFLINE hoặc DEGRADED, sau đó nhìn tuổi heartbeat và độ trễ để xác định thiết bị cần xử lý trước.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
