import { StatusBadge } from '@/components/ui/status-badge'

export type LiveStateValue = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'stale' | 'unauthorized' | 'failed'

const LIVE_STATE_META: Record<LiveStateValue, { tone: 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'live' | 'stale'; label: string }> = {
  idle: { tone: 'neutral', label: 'Idle' },
  connecting: { tone: 'info', label: 'Connecting' },
  connected: { tone: 'live', label: 'Live' },
  reconnecting: { tone: 'warning', label: 'Reconnecting' },
  stale: { tone: 'stale', label: 'Stale' },
  unauthorized: { tone: 'error', label: 'Unauthorized' },
  failed: { tone: 'error', label: 'Disconnected' },
}

export function LiveStateBadge({
  state,
  prefix,
  className,
}: {
  state: LiveStateValue
  prefix?: string
  className?: string
}) {
  const meta = LIVE_STATE_META[state]
  return <StatusBadge tone={meta.tone} label={prefix ? `${prefix} ${meta.label}` : meta.label} className={className} />
}
