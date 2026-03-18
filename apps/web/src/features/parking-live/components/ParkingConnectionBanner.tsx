import { AlertTriangle, Clock3, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ParkingLiveFreshnessView } from '../types'

function fmt(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

type Props = {
  freshness: ParkingLiveFreshnessView
  refreshing: boolean
  onRefresh: (forceReconcile?: boolean) => void
}

export function ParkingConnectionBanner({ freshness, refreshing, onRefresh }: Props) {
  if (freshness.status === 'connected' || freshness.status === 'idle') return null

  const secondaryLine = [
    `snapshot ${fmt(freshness.lastFetchedAt)}`,
    freshness.lastReconciledAt ? `reconciled ${fmt(freshness.lastReconciledAt)}` : null,
    freshness.lastDeltaAt ? `last delta ${fmt(freshness.lastDeltaAt)}` : null,
    freshness.nextRetryAt ? `next retry ${fmt(freshness.nextRetryAt)}` : null,
  ].filter(Boolean).join(' · ')

  if (freshness.status === 'loading' || freshness.status === 'retrying') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-primary">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Realtime is reconnecting. Snapshot stays on screen while the stream recovers.</p>
          <p className="mt-0.5 text-xs text-primary/80">{secondaryLine || 'Waiting for the next server-sent event.'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onRefresh(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Force refresh
        </Button>
      </div>
    )
  }

  if (freshness.status === 'stale') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-amber-100">Realtime is stale. The board is showing the last good snapshot and periodic fallback refresh.</p>
          <p className="mt-0.5 text-xs text-amber-100/80">{secondaryLine || 'The latest snapshot is still preserved.'}</p>
          {freshness.staleSince ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-200/80">
              <Clock3 className="h-3.5 w-3.5" />
              Stale since {fmt(freshness.staleSince)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="outline" size="sm" onClick={() => onRefresh(false)} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
            Retry stream
          </Button>
          <Button variant="outline" size="sm" onClick={() => onRefresh(true)} disabled={refreshing}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reconcile
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Parking Live could not refresh and there is no authoritative snapshot to render.</p>
        <p className="mt-0.5 text-xs text-destructive/80">{freshness.error || secondaryLine || 'Check API health, SSE auth, and downstream parking projection state.'}</p>
        {freshness.requestIdHint ? <p className="mt-1 text-xs text-destructive/80">requestId: {freshness.requestIdHint}</p> : null}
      </div>
      <Button variant="outline" size="sm" onClick={() => onRefresh(true)} disabled={refreshing}>
        {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Retry
      </Button>
    </div>
  )
}
