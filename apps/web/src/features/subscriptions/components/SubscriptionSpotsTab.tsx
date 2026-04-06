import { useState } from 'react'
import { MapPin, Pencil, Plus, Star, Undo2, Wrench } from 'lucide-react'
import { InlineMessage, SurfaceState } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type {
  SubscriptionDetail,
  SubscriptionSpotPatchInput,
  SubscriptionSpotRow,
} from '../types'
import { SubscriptionSpotDialog } from './SubscriptionSpotDialog'

function formatDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '—'
}

function statusVariant(status: string): 'entry' | 'amber' | 'muted' | 'destructive' | 'outline' {
  if (status === 'ACTIVE') return 'entry'
  if (status === 'SUSPENDED') return 'amber'
  if (status === 'RELEASED') return 'muted'
  if (status === 'CANCELLED') return 'destructive'
  return 'outline'
}

export function SubscriptionSpotsTab({
  detail,
  canMutate,
  busy,
  error,
  onCreateSpot,
  onUpdateSpot,
}: {
  detail: SubscriptionDetail
  canMutate: boolean
  busy: boolean
  error: string
  onCreateSpot: (input: {
    subscriptionId: string
    siteCode: string
    spotId: string
    assignedMode?: 'ASSIGNED' | 'PREFERRED'
    status?: 'ACTIVE' | 'SUSPENDED' | 'RELEASED'
    isPrimary?: boolean
    assignedFrom?: string | null
    assignedUntil?: string | null
    note?: string | null
  }) => Promise<boolean>
  onUpdateSpot: (subscriptionId: string, subscriptionSpotId: string, patch: SubscriptionSpotPatchInput, successMessage?: string) => Promise<boolean>
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editingSpot, setEditingSpot] = useState<SubscriptionSpotRow | null>(null)

  if (detail.spots.length === 0) {
    return (
      <>
        <SurfaceState
          title="No spots linked"
          description={canMutate ? 'Create the first spot assignment for this subscription.' : 'This subscription has no linked spot assignments in the current authoritative snapshot.'}
          tone="empty"
          action={canMutate ? { label: 'Assign spot', onClick: () => setCreateOpen(true) } : undefined}
          className="min-h-[140px]"
        />
        <SubscriptionSpotDialog
          open={createOpen}
          mode="create"
          siteCode={detail.siteCode}
          subscriptionId={detail.subscriptionId}
          spot={null}
          busy={busy}
          error={error}
          onClose={() => setCreateOpen(false)}
          onCreate={onCreateSpot}
          onUpdate={() => Promise.resolve(false)}
        />
      </>
    )
  }

  return (
    <div className="space-y-3">
      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
        <div>
          <p className="text-[10px] font-mono-data uppercase tracking-[0.16em] text-muted-foreground">Spot assignments</p>
          <p className="mt-1 text-sm text-muted-foreground">Assigned and preferred spots with lifecycle controls and primary designation.</p>
        </div>
        {canMutate ? (
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Assign spot
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        {detail.spots.map((spot) => (
          <section key={spot.subscriptionSpotId} className="rounded-2xl border border-border/70 bg-background/40 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(spot.status)}>{spot.status}</Badge>
                  <Badge variant="outline">{spot.assignedMode}</Badge>
                  {spot.isPrimary ? <Badge variant="secondary">primary</Badge> : null}
                  <span className="font-mono-data text-[11px] text-muted-foreground">{spot.subscriptionSpotId}</span>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">{spot.spotCode}</p>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  spotId {spot.spotId} · Zone {spot.zoneCode}
                  {spot.assignedFrom ? ` · from ${formatDate(spot.assignedFrom)}` : ''}
                  {spot.assignedUntil ? ` to ${formatDate(spot.assignedUntil)}` : ''}
                </p>
                {spot.note ? <p className="mt-2 text-xs text-muted-foreground">{spot.note}</p> : null}
              </div>

              {canMutate ? (
                <div className="flex flex-wrap justify-end gap-2">
                  {!spot.isPrimary && spot.status === 'ACTIVE' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onUpdateSpot(detail.subscriptionId, spot.subscriptionSpotId, { isPrimary: true }, 'Primary spot updated.')}
                    >
                      <Star className="h-3.5 w-3.5" />
                      Set primary
                    </Button>
                  ) : null}

                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setEditingSpot(spot)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>

                  {spot.status === 'ACTIVE' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onUpdateSpot(detail.subscriptionId, spot.subscriptionSpotId, { status: 'SUSPENDED' }, 'Spot assignment suspended.')}
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      Suspend
                    </Button>
                  ) : null}

                  {spot.status === 'SUSPENDED' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onUpdateSpot(detail.subscriptionId, spot.subscriptionSpotId, { status: 'ACTIVE' }, 'Spot assignment reactivated.')}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Reactivate
                    </Button>
                  ) : null}

                  {spot.status !== 'RELEASED' ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onUpdateSpot(detail.subscriptionId, spot.subscriptionSpotId, { status: 'RELEASED' }, 'Spot assignment released.')}
                    >
                      Release
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <SubscriptionSpotDialog
        open={createOpen}
        mode="create"
        siteCode={detail.siteCode}
        subscriptionId={detail.subscriptionId}
        spot={null}
        busy={busy}
        error={error}
        onClose={() => setCreateOpen(false)}
        onCreate={onCreateSpot}
        onUpdate={() => Promise.resolve(false)}
      />

      <SubscriptionSpotDialog
        open={editingSpot !== null}
        mode="edit"
        siteCode={detail.siteCode}
        subscriptionId={detail.subscriptionId}
        spot={editingSpot}
        busy={busy}
        error={error}
        onClose={() => setEditingSpot(null)}
        onCreate={onCreateSpot}
        onUpdate={(subscriptionSpotId, patch) => onUpdateSpot(detail.subscriptionId, subscriptionSpotId, patch)}
      />
    </div>
  )
}
