import { Link } from 'react-router-dom'
import { Camera, Smartphone, SplitSquareVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function GateEventsMonitorPage() {
  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">legacy</Badge>
            <Badge variant="outline">deprecated</Badge>
            <Badge variant="outline">split complete</Badge>
          </div>
          <CardTitle>Gate Events Monitor đã được thay thế</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Mixed surface cũ đã được tách thành các route rõ vai trò hơn. Giữ file này để deprecate có kiểm soát thay vì để route/import cũ chết trắng.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/capture-debug">
                <Camera className="h-4 w-4" />
                Open Capture Debug
              </Link>
            </Button>

            <Button asChild variant="outline">
              <Link to="/mobile-camera-pair">
                <Smartphone className="h-4 w-4" />
                Open Mobile Camera Pair
              </Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <SplitSquareVertical className="h-4 w-4 text-primary" />
              <span className="font-medium">Why split</span>
            </div>
            Pair QR là flow onboarding device. Capture debug là flow quan sát ingest/OCR. Ép chúng sống chung chỉ làm UX và QA khó kiểm soát hơn.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
