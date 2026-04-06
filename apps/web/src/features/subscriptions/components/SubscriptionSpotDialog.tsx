import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { InlineMessage } from '@/components/ops/console'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type {
  AssignedMode,
  SubscriptionSpotMutationInput,
  SubscriptionSpotPatchInput,
  SubscriptionSpotRow,
  SubscriptionSpotStatus,
} from '../types'
import { SUBSCRIPTION_ASSIGNED_MODE_VALUES, SUBSCRIPTION_SPOT_STATUS_VALUES } from '../types'
import { SubscriptionEditorDialogShell } from './SubscriptionEditorDialogShell'

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  siteCode: string
  subscriptionId: string
  spot: SubscriptionSpotRow | null
  busy: boolean
  error: string
  onClose: () => void
  onCreate: (input: SubscriptionSpotMutationInput) => Promise<boolean>
  onUpdate: (subscriptionSpotId: string, patch: SubscriptionSpotPatchInput) => Promise<boolean>
}

type FormState = {
  spotId: string
  status: SubscriptionSpotStatus
  assignedMode: AssignedMode
  isPrimary: boolean
  assignedFrom: string
  assignedUntil: string
  note: string
}

const EMPTY_FORM: FormState = {
  spotId: '',
  status: 'ACTIVE',
  assignedMode: 'ASSIGNED',
  isPrimary: false,
  assignedFrom: '',
  assignedUntil: '',
  note: '',
}

function createInitialState(spot: SubscriptionSpotRow | null): FormState {
  if (!spot) return EMPTY_FORM
  return {
    spotId: spot.spotId,
    status: (spot.status === 'SUSPENDED' || spot.status === 'RELEASED' ? spot.status : 'ACTIVE') as SubscriptionSpotStatus,
    assignedMode: (spot.assignedMode === 'PREFERRED' ? 'PREFERRED' : 'ASSIGNED') as AssignedMode,
    isPrimary: spot.isPrimary,
    assignedFrom: spot.assignedFrom || '',
    assignedUntil: spot.assignedUntil || '',
    note: spot.note || '',
  }
}

export function SubscriptionSpotDialog({
  open,
  mode,
  siteCode,
  subscriptionId,
  spot,
  busy,
  error,
  onClose,
  onCreate,
  onUpdate,
}: Props) {
  const [form, setForm] = useState<FormState>(createInitialState(spot))
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(createInitialState(spot))
    setValidationError('')
  }, [open, spot])

  const footer = useMemo(() => {
    if (mode === 'create') return 'Manual spotId entry is required until the shell has a dedicated spot picker.'
    return spot ? `${spot.spotCode} · Zone ${spot.zoneCode}` : ''
  }, [mode, spot])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError('')

    if (mode === 'create' && !form.spotId.trim()) {
      setValidationError('Spot ID is required.')
      return
    }

    if (form.assignedFrom && form.assignedUntil && form.assignedFrom > form.assignedUntil) {
      setValidationError('Assigned from must be on or before assigned until.')
      return
    }

    if (mode === 'create') {
      const ok = await onCreate({
        subscriptionId,
        siteCode,
        spotId: form.spotId.trim(),
        status: form.status,
        assignedMode: form.assignedMode,
        isPrimary: form.isPrimary,
        assignedFrom: form.assignedFrom || null,
        assignedUntil: form.assignedUntil || null,
        note: form.note.trim() || null,
      })
      if (ok) onClose()
      return
    }

    if (!spot) return

    const ok = await onUpdate(spot.subscriptionSpotId, {
      status: form.status,
      assignedMode: form.assignedMode,
      isPrimary: form.isPrimary,
      assignedFrom: form.assignedFrom || null,
      assignedUntil: form.assignedUntil || null,
      note: form.note.trim() || null,
    })
    if (ok) onClose()
  }

  return (
    <SubscriptionEditorDialogShell
      open={open}
      title={mode === 'create' ? 'Assign spot to subscription' : 'Edit spot assignment'}
      description={mode === 'create' ? 'Create a spot assignment for the selected subscription.' : 'Update the selected spot assignment.'}
      submitLabel={mode === 'create' ? 'Create spot assignment' : 'Save spot changes'}
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
            <Label htmlFor="spot-id">Spot ID</Label>
            <Input
              id="spot-id"
              value={form.spotId}
              onChange={(event) => setForm((current) => ({ ...current, spotId: event.target.value }))}
              placeholder="spot_id"
              disabled={busy || mode === 'edit'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="spot-assigned-mode">Assigned mode</Label>
            <select
              id="spot-assigned-mode"
              value={form.assignedMode}
              onChange={(event) => setForm((current) => ({ ...current, assignedMode: event.target.value as AssignedMode }))}
              className="flex h-10 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={busy}
            >
              {SUBSCRIPTION_ASSIGNED_MODE_VALUES.map((assignedMode) => (
                <option key={assignedMode} value={assignedMode}>{assignedMode}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="spot-status">Status</Label>
            <select
              id="spot-status"
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SubscriptionSpotStatus }))}
              className="flex h-10 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={busy}
            >
              {SUBSCRIPTION_SPOT_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="spot-assigned-from">Assigned from</Label>
            <Input
              id="spot-assigned-from"
              type="date"
              value={form.assignedFrom}
              onChange={(event) => setForm((current) => ({ ...current, assignedFrom: event.target.value }))}
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="spot-assigned-until">Assigned until</Label>
            <Input
              id="spot-assigned-until"
              type="date"
              value={form.assignedUntil}
              onChange={(event) => setForm((current) => ({ ...current, assignedUntil: event.target.value }))}
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
          Mark this assignment as the primary subscription spot.
        </label>

        <div className="space-y-2">
          <Label htmlFor="spot-note">Note</Label>
          <textarea
            id="spot-note"
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
