import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { InlineMessage } from '@/components/ops/console'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type {
  SubscriptionVehicleMutationInput,
  SubscriptionVehiclePatchInput,
  SubscriptionVehicleRow,
  SubscriptionVehicleStatus,
} from '../types'
import { SUBSCRIPTION_VEHICLE_STATUS_VALUES } from '../types'
import { SubscriptionEditorDialogShell } from './SubscriptionEditorDialogShell'

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  siteCode: string
  subscriptionId: string
  vehicle: SubscriptionVehicleRow | null
  busy: boolean
  error: string
  onClose: () => void
  onCreate: (input: SubscriptionVehicleMutationInput) => Promise<boolean>
  onUpdate: (subscriptionVehicleId: string, patch: SubscriptionVehiclePatchInput) => Promise<boolean>
}

type FormState = {
  vehicleId: string
  status: SubscriptionVehicleStatus
  isPrimary: boolean
  validFrom: string
  validTo: string
  note: string
}

const EMPTY_FORM: FormState = {
  vehicleId: '',
  status: 'ACTIVE',
  isPrimary: false,
  validFrom: '',
  validTo: '',
  note: '',
}

function createInitialState(vehicle: SubscriptionVehicleRow | null): FormState {
  if (!vehicle) return EMPTY_FORM
  return {
    vehicleId: vehicle.vehicleId,
    status: (vehicle.status === 'REMOVED' || vehicle.status === 'SUSPENDED' ? vehicle.status : 'ACTIVE') as SubscriptionVehicleStatus,
    isPrimary: vehicle.isPrimary,
    validFrom: vehicle.validFrom || '',
    validTo: vehicle.validTo || '',
    note: vehicle.note || '',
  }
}

export function SubscriptionVehicleDialog({
  open,
  mode,
  siteCode,
  subscriptionId,
  vehicle,
  busy,
  error,
  onClose,
  onCreate,
  onUpdate,
}: Props) {
  const [form, setForm] = useState<FormState>(createInitialState(vehicle))
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(createInitialState(vehicle))
    setValidationError('')
  }, [open, vehicle])

  const footer = useMemo(() => {
    if (mode === 'create') return 'Manual vehicleId entry is required because this shell does not yet include a customer or vehicle lookup endpoint.'
    return vehicle?.licensePlate || vehicle?.plateCompact || vehicle?.vehicleId || ''
  }, [mode, vehicle])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError('')

    if (mode === 'create' && !form.vehicleId.trim()) {
      setValidationError('Vehicle ID is required.')
      return
    }

    if (form.validFrom && form.validTo && form.validFrom > form.validTo) {
      setValidationError('Valid from must be on or before valid to.')
      return
    }

    if (mode === 'create') {
      const ok = await onCreate({
        subscriptionId,
        siteCode,
        vehicleId: form.vehicleId.trim(),
        status: form.status,
        isPrimary: form.isPrimary,
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
        note: form.note.trim() || null,
      })
      if (ok) onClose()
      return
    }

    if (!vehicle) return

    const ok = await onUpdate(vehicle.subscriptionVehicleId, {
      status: form.status,
      isPrimary: form.isPrimary,
      validFrom: form.validFrom || null,
      validTo: form.validTo || null,
      note: form.note.trim() || null,
    })
    if (ok) onClose()
  }

  return (
    <SubscriptionEditorDialogShell
      open={open}
      title={mode === 'create' ? 'Add linked vehicle' : 'Edit linked vehicle'}
      description={mode === 'create' ? 'Create a vehicle binding for the current subscription.' : 'Update the selected vehicle binding.'}
      submitLabel={mode === 'create' ? 'Create vehicle link' : 'Save vehicle changes'}
      busy={busy}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={footer}
    >
      <div className="space-y-4">
        {validationError ? <InlineMessage tone="error">{validationError}</InlineMessage> : null}
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="vehicle-id">Vehicle ID</Label>
            <Input
              id="vehicle-id"
              value={form.vehicleId}
              onChange={(event) => setForm((current) => ({ ...current, vehicleId: event.target.value }))}
              placeholder="vehicle_id"
              disabled={busy || mode === 'edit'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle-status">Status</Label>
            <select
              id="vehicle-status"
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SubscriptionVehicleStatus }))}
              className="flex h-10 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={busy}
            >
              {SUBSCRIPTION_VEHICLE_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle-valid-from">Valid from</Label>
            <Input
              id="vehicle-valid-from"
              type="date"
              value={form.validFrom}
              onChange={(event) => setForm((current) => ({ ...current, validFrom: event.target.value }))}
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle-valid-to">Valid to</Label>
            <Input
              id="vehicle-valid-to"
              type="date"
              value={form.validTo}
              onChange={(event) => setForm((current) => ({ ...current, validTo: event.target.value }))}
              disabled={busy}
            />
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/40 px-4 py-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.isPrimary}
            onChange={(event) => setForm((current) => ({ ...current, isPrimary: event.target.checked }))}
            disabled={busy}
            className="h-4 w-4 rounded border-border"
          />
          Mark this vehicle as primary for the subscription.
        </label>

        <div className="space-y-2">
          <Label htmlFor="vehicle-note">Note</Label>
          <textarea
            id="vehicle-note"
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            className="min-h-[96px] w-full rounded-2xl border border-input bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Operator note"
            disabled={busy}
          />
        </div>
      </div>
    </SubscriptionEditorDialogShell>
  )
}
