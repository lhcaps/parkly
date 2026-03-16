import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getReviewQueue, type ReviewQueueItem } from '@/lib/api'

function reviewVariant(value: string): 'secondary' | 'outline' | 'destructive' | 'amber' {
  if (value === 'OPEN') return 'amber'
  if (value === 'CLAIMED') return 'outline'
  if (value === 'RESOLVED') return 'secondary'
  return 'destructive'
}

export function ReviewQueueSummaryPanel() {
  const [rows, setRows] = useState<ReviewQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    try {
      setLoading(true)
      setError('')
      const data = await getReviewQueue({ limit: 20 })
      setRows(data.rows)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const counts = useMemo(() => ({
    open: rows.filter((row) => row.status === 'OPEN').length,
    claimed: rows.filter((row) => row.status === 'CLAIMED').length,
    resolved: rows.filter((row) => row.status === 'RESOLVED').length,
  }), [rows])

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Review Queue</CardTitle>
          <CardDescription>
            Low-confidence, mismatch, unpaid, or anomaly cases enter the real queue. Manual overrides go through the audited API.I có audit bắt buộc.
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-[11px] font-mono-data text-muted-foreground">
          <Badge variant="outline">open={counts.open}</Badge>
          <Badge variant="outline">claimed={counts.claimed}</Badge>
          <Badge variant="outline">resolved={counts.resolved}</Badge>
        </div>
        {error && <div className="rounded-lg border border-destructive/25 bg-destructive/8 px-4 py-3 text-xs text-destructive">{error}</div>}
        <ScrollArea className="h-[360px]">
          <div className="space-y-3 pr-3">
            {rows.map((row) => (
              <div key={row.reviewId} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono-data text-sm font-semibold">{row.queueReasonCode}</p>
                    <p className="mt-1 text-xs text-muted-foreground">review={row.reviewId} · session={row.session.sessionId}</p>
                  </div>
                  <Badge variant={reviewVariant(row.status)}>{row.status}</Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{row.session.siteCode} / {row.session.gateCode} / {row.session.laneCode} · {row.session.direction}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.actions.map((action) => <Badge key={action} variant="muted">{action}</Badge>)}
                </div>
              </div>
            ))}
            {!loading && rows.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                <ClipboardCheck className="h-4 w-4" />
                Queue is empty.
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
