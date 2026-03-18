import { useState } from 'react'
import { Car, Pencil, Plus, Star, Undo2, Wrench } from 'lucide-react'
import { InlineMessage, SurfaceState } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type {
  SubscriptionDetail,
  SubscriptionVehiclePatchInput,
  SubscriptionVehicleRow,
} from '../types'
import { SubscriptionVehicleDialog } from './SubscriptionVehicleDialog'

function formatDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '—'
}

function statusVariant(status: string): 'entry' | 'amber' | 'muted' | 'destructive' | 'outline' {
  if (status === 'ACTIVE') return 'entry'
  if (status === 'SUSPENDED') return 'amber'
  if (status === 'REMOVED') return 'muted'
  if (status === 'CANCELLED') return 'destructive'
  return 'outline'
}

export function SubscriptionVehiclesTab({
  detail,
  canMutate,
  busy,
  error,
  onCreateVehicle,
  onUpdateVehicle,
}: {
  detail: SubscriptionDetail
  canMutate: boolean
  busy: boolean
  error: string
  onCreateVehicle: (input: {
    subscriptionId: string
    siteCode: string
    vehicleId: string
    status?: 'ACTIVE' | 'SUSPENDED' | 'REMOVED'
    isPrimary?: boolean
    validFrom?: string | null
    validTo?: string | null
    note?: string | null
  }) => Promise<boolean>
  onUpdateVehicle: (subscriptionId: string, subscriptionVehicleId: string, patch: SubscriptionVehiclePatchInput, successMessage?: string) => Promise<boolean>
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<SubscriptionVehicleRow | null>(null)

  if (detail.vehicles.length === 0) {
    return (
      <>
        <SurfaceState
          title="No vehicles linked"
          description={canMutate ? 'Create the first vehicle binding for this subscription.' : 'This subscription has no linked vehicles in the current authoritative snapshot.'}
          tone="empty"
          action={canMutate ? { label: 'Add vehicle', onClick: () => setCreateOpen(true) } : undefined}
          className="min-h-[140px]"
        />
        <SubscriptionVehicleDialog
          open={createOpen}
          mode="create"
          siteCode={detail.siteCode}
          subscriptionId={detail.subscriptionId}
          vehicle={null}
          busy={busy}
          error={error}
          onClose={() => setCreateOpen(false)}
          onCreate={onCreateVehicle}
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
          <p className="text-[10px] font-mono-data uppercase tracking-[0.16em] text-muted-foreground">Vehicle links</p>
          <p className="mt-1 text-sm text-muted-foreground">Primary, active, suspended, and removed vehicle bindings for this subscription.</p>
        </div>
        {canMutate ? (
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add vehicle
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        {detail.vehicles.map((vehicle) => (
          <section key={vehicle.subscriptionVehicleId} className="rounded-2xl border border-border/70 bg-background/40 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(vehicle.status)}>{vehicle.status}</Badge>
                  {vehicle.isPrimary ? <Badge variant="secondary">primary</Badge> : null}
                  <span className="font-mono-data text-[11px] text-muted-foreground">{vehicle.subscriptionVehicleId}</span>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <p className="font-mono-data text-sm font-semibold text-foreground">{vehicle.plateCompact || vehicle.licensePlate || '—'}</p>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  vehicleId {vehicle.vehicleId}
                  {vehicle.vehicleType ? ` · ${vehicle.vehicleType}` : ''}
                  {vehicle.validFrom ? ` · from ${formatDate(vehicle.validFrom)}` : ''}
                  {vehicle.validTo ? ` to ${formatDate(vehicle.validTo)}` : ''}
                </p>
                {vehicle.note ? <p className="mt-2 text-xs text-muted-foreground">{vehicle.note}</p> : null}
              </div>

              {canMutate ? (
                <div className="flex flex-wrap justify-end gap-2">
                  {!vehicle.isPrimary && vehicle.status === 'ACTIVE' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onUpdateVehicle(detail.subscriptionId, vehicle.subscriptionVehicleId, { isPrimary: true }, 'Primary vehicle updated.')}
                    >
                      <Star className="h-3.5 w-3.5" />
                      Set primary
                    </Button>
                  ) : null}

                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setEditingVehicle(vehicle)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>

                  {vehicle.status === 'ACTIVE' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onUpdateVehicle(detail.subscriptionId, vehicle.subscriptionVehicleId, { status: 'SUSPENDED' }, 'Vehicle link suspended.')}
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      Suspend
                    </Button>
                  ) : null}

                  {vehicle.status === 'SUSPENDED' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onUpdateVehicle(detail.subscriptionId, vehicle.subscriptionVehicleId, { status: 'ACTIVE' }, 'Vehicle link reactivated.')}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Reactivate
                    </Button>
                  ) : null}

                  {vehicle.status !== 'REMOVED' ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onUpdateVehicle(detail.subscriptionId, vehicle.subscriptionVehicleId, { status: 'REMOVED' }, 'Vehicle link removed.')}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <SubscriptionVehicleDialog
        open={createOpen}
        mode="create"
        siteCode={detail.siteCode}
        subscriptionId={detail.subscriptionId}
        vehicle={null}
        busy={busy}
        error={error}
        onClose={() => setCreateOpen(false)}
        onCreate={onCreateVehicle}
        onUpdate={() => Promise.resolve(false)}
      />

      <SubscriptionVehicleDialog
        open={editingVehicle !== null}
        mode="edit"
        siteCode={detail.siteCode}
        subscriptionId={detail.subscriptionId}
        vehicle={editingVehicle}
        busy={busy}
        error={error}
        onClose={() => setEditingVehicle(null)}
        onCreate={onCreateVehicle}
        onUpdate={(subscriptionVehicleId, patch) => onUpdateVehicle(detail.subscriptionId, subscriptionVehicleId, patch)}
      />
    </div>
  )
}
