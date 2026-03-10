import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Play, RadioTower, RefreshCcw, RotateCcw, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  drainOutbox,
  getMe,
  getOutboxItems,
  requeueOutboxItems,
  type MeRes,
  type OutboxDrainRes,
  type OutboxListItem,
} from '@/lib/api'
import { OutboxMonitorPanel } from '@/features/outbox-monitor/OutboxMonitorPanel'

function statusVariant(status: string): 'secondary' | 'outline' | 'destructive' {
  if (status === 'SENT' || status === 'ACKED') return 'secondary'
  if (status === 'FAILED' || status === 'TIMEOUT' || status === 'NACKED') return 'destructive'
  return 'outline'
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
      setMessage(`Requeue xong: changed=${result.changed}`)
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
      setMessage(dryRun ? 'Đã preview batch outbox.' : 'Đã chạy drain outbox.')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">monitoring</Badge>
              <Badge variant="outline">outbox control</Badge>
              <Badge variant="outline">worker-facing</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Outbox Monitor</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Đây là trang dành cho backlog đồng bộ, retry, drain và requeue. Nó tách riêng khỏi overview để worker/operator xử lý outbox mà không lẫn với lane operations.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">role={role}</Badge>
            <Badge variant="outline">rows={rows.length}</Badge>
            <Badge variant={failedRows.length > 0 ? 'destructive' : 'secondary'}>failed={failedRows.length}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/review-queue">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="pt-5">
              <p className="font-medium">Review Queue</p>
              <p className="mt-1 text-sm text-muted-foreground">Nếu outbox backlog tới từ review workflow, nhảy sang queue để xử lý nguyên nhân đầu vào.</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/lane-monitor">
          <Card className="h-full border-border/80 bg-card/95 transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="pt-5">
              <p className="font-medium">Lane Monitor</p>
              <p className="mt-1 text-sm text-muted-foreground">Đối chiếu lane nào vừa ghi event nhiều nhưng outbox chưa thông.</p>
            </CardContent>
          </Card>
        </Link>

        <Card className="h-full border-border/80 bg-card/95">
          <CardContent className="pt-5">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <p className="font-medium">Tách vai trò</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Overview chỉ nhắc bạn có backlog. Outbox Monitor mới là nơi chạy requeue/drain thật.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <OutboxMonitorPanel />

        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle>Manual control</CardTitle>
            <CardDescription>
              Requeue dành cho OPS/ADMIN. Drain dành cho ADMIN/WORKER. Tất cả thao tác này đi qua API thật.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || busy != null}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Refresh list
              </Button>

              <Button variant="outline" size="sm" onClick={() => void handleDrain(true)} disabled={!canDrain || busy != null}>
                <Play className="h-4 w-4" />
                Dry-run drain
              </Button>

              <Button variant="secondary" size="sm" onClick={() => void handleDrain(false)} disabled={!canDrain || busy != null}>
                <Play className="h-4 w-4" />
                Drain now
              </Button>

              <Button variant="secondary" size="sm" onClick={() => void handleRequeue()} disabled={!canRequeue || failedRows.length === 0 || busy != null}>
                <RotateCcw className="h-4 w-4" />
                Requeue failed rows
              </Button>

              <Button variant="outline" size="sm" onClick={() => void handleRequeue(50)} disabled={!canRequeue || busy != null}>
                <RotateCcw className="h-4 w-4" />
                Requeue 50 FAILED gần nhất
              </Button>
            </div>

            {message ? (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                {message}
              </div>
            ) : null}

            {drainResult ? (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs font-mono-data text-muted-foreground">
                {drainResult.dryRun
                  ? `dryRun candidates=${drainResult.candidates.join(', ') || 'none'}`
                  : `claimed=${drainResult.claimed} ok=${drainResult.ok} fail=${drainResult.fail}`}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle>Outbox backlog list</CardTitle>
          <CardDescription>
            REST list này dùng để đối chiếu với SSE feed. Operator nhìn chính xác attempts, lastError, retry và payload snapshot tại đây.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải outbox list...
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Chưa có row outbox nào.</div>
          ) : (
            <ScrollArea className="h-[460px]">
              <div className="space-y-3 pr-3">
                {rows.map((row) => (
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
                      <Badge variant="outline">mongo={row.mongoDocId || '—'}</Badge>
                      <Badge variant="outline">sentAt={row.sentAt ? new Date(row.sentAt).toLocaleTimeString('vi-VN') : '—'}</Badge>
                      <Badge variant="outline">nextRetry={row.nextRetryAt ? new Date(row.nextRetryAt).toLocaleTimeString('vi-VN') : '—'}</Badge>
                    </div>

                    <p className="mt-3 break-all text-xs text-muted-foreground">lastError={row.lastError || '—'}</p>
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-background/80 p-3 text-[11px] text-muted-foreground">
                      {JSON.stringify(row.payload, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
