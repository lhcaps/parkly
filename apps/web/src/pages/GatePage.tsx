import { Link, Navigate } from 'react-router-dom'
import { ArrowRightLeft, ArchiveX, Camera } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function GatePage() {
  if (typeof window !== 'undefined' && window.location.pathname === '/gate') {
    return <Navigate to="/run-lane" replace />
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">legacy</Badge>
            <Badge variant="outline">deprecated</Badge>
          </div>
          <CardTitle>GatePage đã bị deprecate</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            GatePage monolith cũ không còn là entry surface chính. Flow mới đã được tách ra thành Run Lane, Capture Debug và Mobile Camera Pair.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/run-lane">
                <ArrowRightLeft className="h-4 w-4" />
                Open Run Lane
              </Link>
            </Button>

            <Button asChild variant="outline">
              <Link to="/capture-debug">
                <Camera className="h-4 w-4" />
                Open Capture Debug
              </Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <ArchiveX className="h-4 w-4 text-amber-500" />
              <span className="font-medium">Legacy cleanup</span>
            </div>
            Route cũ đã được redirect có kiểm soát. File này được giữ lại chỉ để tránh import lỗi ngầm trong giai đoạn cuối chu kỳ.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
