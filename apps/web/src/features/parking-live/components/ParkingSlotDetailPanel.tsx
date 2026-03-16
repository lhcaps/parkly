import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SurfaceState } from '@/components/ops/console'
import { getSpotOccupancyDetail } from '../api/parking-live'
import type { SlotViewModel, SpotProjectionRow } from '../types'

const STATUS_BADGE: Record<string, 'entry' | 'amber' | 'destructive' | 'muted' | 'outline'> = {
  EMPTY: 'entry',
  OCCUPIED_MATCHED: 'secondary' as any,
  OCCUPIED_UNKNOWN: 'amber',
  OCCUPIED_VIOLATION: 'destructive',
  SENSOR_STALE: 'muted',
}

function fmtTime(v: string | null | undefined) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2.5 last:border-b-0">
      <span className="text-[10px] font-mono-data uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className="max-w-[60%] break-all text-right text-xs font-medium text-foreground">{value}</span>
    </div>
  )
}

type Props = {
  slot: SlotViewModel
  siteCode: string
  onClose: () => void
}

export function ParkingSlotDetailPanel({ slot, siteCode, onClose }: Props) {
  const [detail, setDetail] = useState<SpotProjectionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function loadDetail(reconcile = false) {
    setLoading(true)
    setError('')
    getSpotOccupancyDetail(siteCode, slot.spotCode, reconcile)
      .then((row) => {
        setDetail(row)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
  }

  useEffect(() => {
    loadDetail(false)
  }, [slot.spotId, siteCode])

  const statusBadge = STATUS_BADGE[slot.occupancyStatus] ?? 'outline'

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="font-mono-data text-base">{slot.spotCode}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Zone {slot.zoneCode}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusBadge}>{slot.occupancyStatus.replace(/_/g, ' ')}</Badge>
          {slot.hasSubscription ? <Badge variant="outline">subscription</Badge> : null}
          {slot.isStale ? <Badge variant="muted">stale</Badge> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <SurfaceState title="Loading slot detail…" busy className="min-h-[80px]" />
        ) : error ? (
          <SurfaceState title="Could not load detail" description={error} tone="error" className="min-h-[80px]" />
        ) : detail ? (
          <>
            <div className="rounded-2xl border border-border/60 bg-background/40 px-3">
              <MetaRow label="Spot code" value={detail.spotCode} />
              <MetaRow label="Zone" value={detail.zoneCode ?? '—'} />
              <MetaRow label="Spot ID" value={detail.spotId} />
              <MetaRow label="Status" value={detail.occupancyStatus} />
              <MetaRow label="Updated" value={fmtTime(detail.updatedAt)} />
              {detail.observedPlateCompact ? (
                <MetaRow label="Observed plate" value={detail.observedPlateCompact} />
              ) : null}
              {detail.expectedPlateCompact ? (
                <MetaRow label="Expected plate" value={detail.expectedPlateCompact} />
              ) : null}
              {detail.matchedSubscriptionId ? (
                <MetaRow label="Subscription" value={detail.matchedSubscriptionId} />
              ) : null}
              {detail.reasonCode ? (
                <MetaRow label="Reason code" value={detail.reasonCode} />
              ) : null}
              {detail.reasonDetail ? (
                <MetaRow label="Reason detail" value={detail.reasonDetail} />
              ) : null}
              {detail.staleAt ? (
                <MetaRow label="Stale at" value={fmtTime(detail.staleAt)} />
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadDetail(true)}
                disabled={loading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reconcile slot
              </Button>

              {detail.matchedSubscriptionId ? (
                <Button asChild variant="ghost" size="sm">
                  <Link to={`/subscriptions?id=${detail.matchedSubscriptionId}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    View subscription
                  </Link>
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <SurfaceState
            title="No projection data"
            description="This slot has not been projected yet. Run a reconciliation to generate occupancy state."
            tone="empty"
            className="min-h-[80px]"
            action={{ label: 'Reconcile', onClick: () => loadDetail(true) }}
          />
        )}
      </CardContent>
    </Card>
  )
}
