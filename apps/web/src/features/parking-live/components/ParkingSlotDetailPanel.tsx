import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SurfaceState } from '@/components/ops/console'
import { getParkingLiveSpotDetail } from '../api/parking-live'
import type { ParkingLiveSpotDetail, SlotViewModel } from '../types'

const STATUS_BADGE: Record<string, 'entry' | 'secondary' | 'amber' | 'destructive' | 'muted' | 'outline'> = {
  EMPTY: 'entry',
  OCCUPIED_MATCHED: 'secondary',
  OCCUPIED_UNKNOWN: 'amber',
  OCCUPIED_VIOLATION: 'destructive',
  SENSOR_STALE: 'muted',
  BLOCKED: 'outline',
  RESERVED: 'outline',
}

function fmtDateTime(v: string | null | undefined) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
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
  const [detail, setDetail] = useState<ParkingLiveSpotDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function loadDetail(reconcile = false) {
    setLoading(true)
    setError('')
    getParkingLiveSpotDetail(siteCode, slot.spotCode, reconcile)
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
    void loadDetail(false)
  }, [slot.spotId, siteCode])

  const statusBadge = STATUS_BADGE[slot.occupancyStatus] ?? 'outline'

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="font-mono-data text-base">{slot.spotCode}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{slot.zoneCode ? `Zone ${slot.zoneCode}` : `Floor ${slot.floorKey}`}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusBadge}>{slot.occupancyStatus.replace(/_/g, ' ')}</Badge>
          {slot.hasSubscription ? <Badge variant="outline">subscription</Badge> : null}
          {slot.isStale ? <Badge variant="muted">stale</Badge> : null}
          {slot.slotKind ? <Badge variant="outline">{slot.slotKind}</Badge> : null}
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
              <MetaRow label="Spot code" value={detail.spot.spotCode} />
              <MetaRow label="Zone" value={detail.spot.zoneCode ?? '—'} />
              <MetaRow label="Floor" value={detail.spot.floorKey} />
              <MetaRow label="Spot ID" value={detail.spot.spotId} />
              <MetaRow label="State" value={detail.occupancy.occupancyStatus} />
              <MetaRow label="Updated" value={fmtDateTime(detail.occupancy.updatedAt)} />
              {detail.occupancy.plateNumber ? <MetaRow label="Plate" value={detail.occupancy.plateNumber} /> : null}
              {detail.subscription?.subscriptionCode ? <MetaRow label="Subscription" value={detail.subscription.subscriptionCode} /> : null}
              {detail.occupancy.reasonCode ? <MetaRow label="Reason code" value={detail.occupancy.reasonCode} /> : null}
              {detail.occupancy.reasonDetail ? <MetaRow label="Reason detail" value={detail.occupancy.reasonDetail} /> : null}
              {detail.history.lastTransitionCode ? <MetaRow label="Last transition" value={detail.history.lastTransitionCode} /> : null}
              {detail.history.lastTransitionAt ? <MetaRow label="Transition at" value={fmtDateTime(detail.history.lastTransitionAt)} /> : null}
              {detail.session?.sessionId ? <MetaRow label="Session" value={detail.session.sessionId} /> : null}
              {detail.incident?.incidentId ? <MetaRow label="Incident" value={detail.incident.title || detail.incident.incidentId} /> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadDetail(true)}
                disabled={loading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh slot
              </Button>

              {detail.subscription?.subscriptionId ? (
                <Button asChild variant="ghost" size="sm">
                  <Link to={`/subscriptions?id=${detail.subscription.subscriptionId}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    View subscription
                  </Link>
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <SurfaceState
            title="No parking live detail"
            description="This slot has not been projected yet. Refresh the site to rebuild the board snapshot."
            tone="empty"
            className="min-h-[80px]"
            action={{ label: 'Refresh slot', onClick: () => loadDetail(true) }}
          />
        )}
      </CardContent>
    </Card>
  )
}
