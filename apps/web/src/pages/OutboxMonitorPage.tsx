import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Play, RefreshCcw, RotateCcw, ShieldAlert } from 'lucide-react'
import { InlineMessage, PageHeader, SurfaceState } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { OutboxMonitorPanel } from '@/features/outbox-monitor/OutboxMonitorPanel'
import {
  drainOutbox,
  getMe,
  getOutboxItems,
  requeueOutboxItems,
  type MeRes,
  type OutboxDrainRes,
  type OutboxListItem,
} from '@/lib/api'

function statusVariant(status: string): 'secondary' | 'outline' | 'destructive' {
  if (status === 'SENT' || status === 'ACKED') return 'secondary'
  if (status === 'FAILED' || status === 'TIMEOUT' || status === 'NACKED') return 'destructive'
  return 'outline'
}

function readPayloadSummary(payload: unknown) {
  const row = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}
  return {
    direction: typeof row.direction === 'string' ? row.direction : '—',
    readType: typeof row.readType === 'string' ? row.readType : '—',
    laneCode: typeof row.laneCode === 'string' ? row.laneCode : '—',
    deviceCode: typeof row.deviceCode === 'string' ? row.deviceCode : '—',
    plate: typeof row.plateDisplay === 'string'
      ? row.plateDisplay
      : typeof row.plateCompact === 'string'
        ? row.plateCompact
        : typeof row.plateRaw === 'string'
          ? row.plateRaw
          : '—',
  }
}

export function OutboxMonitorPage() {
  const [role, setRole] = useState<MeRes['role']>('GUARD')
  const [rows, setRows] = useState<OutboxListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [drainResult, setDrainResult] = useState<OutboxDrainRes | null>(null)

  const canRequeue = role === 'ADMIN' || role === 'OPS'
  const canDrain = role === 'ADMIN' || role === 'WORKER'
  const failedRows = useMemo(() => rows.filter((row) => row.status === 'FAILED' || row.status === 'TIMEOUT' || row.status === 'NACKED'), [rows])

  async function load() {
    setLoading(true)
    try {
      const [me, outbox] = await Promise.all([getMe(), getOutboxItems({ limit: 50 })])
      setRole(me.role)
      setRows(outbox.rows)
      setMessage(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleRequeue(limit?: number) {
    setBusy('requeue')
    try {
      const result = await requeueOutboxItems(limit ? { limit } : { outboxIds: failedRows.map((row) => row.outboxId) })
      setMessage(`Đã đưa ${result.changed} bản ghi trở lại hàng đợi.`)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  async function handleDrain(dryRun = false) {
    setBusy(dryRun ? 'dryRun' : 'drain')
    try {
      const result = await drainOutbox({ limit: 20, dryRun })
      setDrainResult(result)
      setMessage(dryRun ? 'Đã xem trước batch drain.' : 'Đã chạy drain outbox.')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sync Outbox"
        description="Theo dõi backlog đồng bộ, retry và thao tác requeue hoặc drain theo quyền hiện tại. Màn hình này tách riêng khỏi luồng lane để giảm nhiễu khi xử lý sự cố đồng bộ."
        badges={[
          { label: `role ${role}`, variant: 'muted' },
          { label: `failed ${failedRows.length}`, variant: failedRows.length > 0 ? 'destructive' : 'secondary' },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/review-queue">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="pt-5">
              <p className="font-medium">Review Queue</p>
              <p className="mt-1 text-sm text-muted-foreground">Kiểm tra đầu vào khi backlog xuất phát từ các trường hợp cần xác nhận thủ công.</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/lane-monitor">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="pt-5">
              <p className="font-medium">Lane Monitor</p>
              <p className="mt-1 text-sm text-muted-foreground">Đối chiếu lane nào vừa ghi nhiều sự kiện nhưng chưa đồng bộ ra ngoài.</p>
            </CardContent>
          </Card>
        </Link>

        <Card className="h-full border-border/80 bg-card/95">
          <CardContent className="pt-5">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <p className="font-medium">Phân vai thao tác</p>
            </div>
            <p className="text-sm text-muted-foreground">Màn hình này dành cho thao tác hàng đợi đồng bộ. Xử lý lane vẫn nên thực hiện ở các màn vận hành tương ứng.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <OutboxMonitorPanel />

        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle>Điều khiển hàng đợi</CardTitle>
            <CardDescription>Requeue dành cho OPS hoặc ADMIN. Drain dành cho ADMIN hoặc WORKER.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || busy != null}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Làm mới danh sách
              </Button>

              <Button variant="outline" size="sm" onClick={() => void handleDrain(true)} disabled={!canDrain || busy != null}>
                <Play className="h-4 w-4" />
                Xem trước drain
              </Button>

              <Button variant="secondary" size="sm" onClick={() => void handleDrain(false)} disabled={!canDrain || busy != null}>
                <Play className="h-4 w-4" />
                Chạy drain
              </Button>

              <Button variant="secondary" size="sm" onClick={() => void handleRequeue()} disabled={!canRequeue || failedRows.length === 0 || busy != null}>
                <RotateCcw className="h-4 w-4" />
                Requeue bản ghi lỗi
              </Button>

              <Button variant="outline" size="sm" onClick={() => void handleRequeue(50)} disabled={!canRequeue || busy != null}>
                <RotateCcw className="h-4 w-4" />
                Requeue 50 bản ghi gần nhất
              </Button>
            </div>

            {message ? <InlineMessage message={message} /> : null}

            {drainResult ? (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs font-mono-data text-muted-foreground">
                {drainResult.dryRun
                  ? `candidates=${drainResult.candidates.join(', ') || 'none'}`
                  : `claimed=${drainResult.claimed} ok=${drainResult.ok} fail=${drainResult.fail}`}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle>Danh sách backlog</CardTitle>
          <CardDescription>Đối chiếu bản ghi REST với feed SSE để xem chính xác trạng thái, lỗi gần nhất và thời điểm retry.</CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <SurfaceState title="Đang tải outbox list" tone="loading" className="min-h-[180px]" />
          ) : rows.length === 0 ? (
            <SurfaceState title="Chưa có bản ghi outbox" description="Khi hệ thống phát sinh sự kiện cần đồng bộ, danh sách này sẽ xuất hiện." className="min-h-[180px]" />
          ) : (
            <ScrollArea className="h-[460px]">
              <div className="space-y-3 pr-3">
                {rows.map((row) => {
                  const payload = readPayloadSummary(row.payload)
                  return (
                    <div key={row.outboxId} className="rounded-xl border border-border bg-muted/15 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono-data text-sm font-semibold">outbox={row.outboxId} · event={row.eventId}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            created {new Date(row.createdAt).toLocaleString('vi-VN')} · updated {new Date(row.updatedAt).toLocaleString('vi-VN')}
                          </p>
                        </div>
                        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono-data text-muted-foreground">
                        <Badge variant="outline">attempts={row.attempts}</Badge>
                        <Badge variant="outline">lane={payload.laneCode}</Badge>
                        <Badge variant="outline">device={payload.deviceCode}</Badge>
                        <Badge variant="outline">direction={payload.direction}</Badge>
                        <Badge variant="outline">readType={payload.readType}</Badge>
                        <Badge variant="outline">plate={payload.plate}</Badge>
                      </div>

                      <p className="mt-3 break-all text-xs text-muted-foreground">lastError={row.lastError || '—'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        sentAt={row.sentAt ? new Date(row.sentAt).toLocaleTimeString('vi-VN') : '—'} · nextRetry={row.nextRetryAt ? new Date(row.nextRetryAt).toLocaleTimeString('vi-VN') : '—'} · mongo={row.mongoDocId || '—'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
