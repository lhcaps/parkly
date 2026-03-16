import { DegradedBanner } from '@/components/state/degraded-banner'
import { LiveStateBadge } from '@/components/ui/live-state-badge'
import type { StreamFeedState } from '@/features/_shared/use-sse-feed'
import type { StreamState } from '@/features/_shared/use-sse-snapshot'

type RealtimeStateLike = Pick<StreamState, 'status' | 'stale' | 'unauthorized' | 'error' | 'reconnectCount' | 'receivedAt' | 'lastSnapshotAt' | 'staleSince'>
  | Pick<StreamFeedState, 'status' | 'stale' | 'unauthorized' | 'error' | 'reconnectCount' | 'receivedAt' | 'staleSince'>

function formatTime(value?: string | null) {
  if (!value) return '—'
  const ts = new Date(value)
  if (!Number.isFinite(ts.getTime())) return '—'
  return ts.toLocaleTimeString('en-GB')
}

export function RealtimeStatusBanner({
  title,
  state,
  onResync,
  disabled = false,
}: {
  title: string
  state: RealtimeStateLike
  onResync: () => void
  disabled?: boolean
}) {
  const lastSeen = 'lastSnapshotAt' in state ? state.lastSnapshotAt : state.receivedAt
  const status = state.unauthorized ? 'unauthorized' : state.status

  if (status === 'unauthorized') {
    return (
      <DegradedBanner
        title={`${title} — session expired`}
        description="The realtime stream was rejected because the current user session is no longer valid. Sign in again to restore live updates."
        tone="error"
        meta={`last seen ${formatTime(lastSeen)} · reconnects ${state.reconnectCount}`}
        actionLabel={disabled ? undefined : 'Resync'}
        onAction={disabled ? undefined : onResync}
      >
        <LiveStateBadge state="unauthorized" prefix={title} />
      </DegradedBanner>
    )
  }

  if (state.stale || status === 'stale') {
    return (
      <DegradedBanner
        title={`${title} — stale data`}
        description="Displaying the last known snapshot. The web session is still intact, but you should resync before acting on current state."
        tone="warning"
        meta={`last seen ${formatTime(lastSeen)} · stale since ${formatTime(state.staleSince)} · reconnects ${state.reconnectCount}`}
        actionLabel={disabled ? undefined : 'Resync now'}
        onAction={disabled ? undefined : onResync}
      >
        <LiveStateBadge state="stale" prefix={title} />
      </DegradedBanner>
    )
  }

  if (status === 'reconnecting' || status === 'connecting') {
    return (
      <DegradedBanner
        title={`${title} — reconnecting`}
        description="Holding the last known snapshot while the stream reconnects. This does not sign the operator out."
        tone="warning"
        meta={`last seen ${formatTime(lastSeen)} · reconnects ${state.reconnectCount}`}
        actionLabel={disabled ? undefined : 'Manual resync'}
        onAction={disabled ? undefined : onResync}
      >
        <LiveStateBadge state={status} prefix={title} />
      </DegradedBanner>
    )
  }

  if (status === 'failed' || state.error) {
    return (
      <DegradedBanner
        title={`${title} — retry required`}
        description={state.error || 'The live channel is unstable. Existing data is preserved and the user shell remains signed in, but current state may be stale until resync succeeds.'}
        tone="warning"
        meta={`last seen ${formatTime(lastSeen)} · reconnects ${state.reconnectCount}`}
        actionLabel={disabled ? undefined : 'Try resync'}
        onAction={disabled ? undefined : onResync}
      >
        <LiveStateBadge state="failed" prefix={title} />
      </DegradedBanner>
    )
  }

  if (status === 'idle') {
    return (
      <DegradedBanner
        title={`${title} — not started`}
        description="Select the correct context or use resync to open the stream. This screen will not assume live data until the stream is ready."
        tone="info"
        meta={`last seen ${formatTime(lastSeen)} · reconnects ${state.reconnectCount}`}
        actionLabel={disabled ? undefined : 'Open stream'}
        onAction={disabled ? undefined : onResync}
      >
        <LiveStateBadge state="idle" prefix={title} />
      </DegradedBanner>
    )
  }

  return (
    <DegradedBanner
      title={`${title} — live`}
      description="Data is current. Refresh the snapshot manually after any significant mutate operation."
      tone="success"
      meta={`last seen ${formatTime(lastSeen)} · reconnects ${state.reconnectCount}`}
      actionLabel={disabled ? undefined : 'Refresh snapshot'}
      onAction={disabled ? undefined : onResync}
    >
      <LiveStateBadge state="connected" prefix={title} />
    </DegradedBanner>
  )
}
