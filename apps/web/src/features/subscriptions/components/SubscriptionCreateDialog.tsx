import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { InlineMessage } from '@/components/ops/console'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SiteRow } from '@/lib/contracts/topology'
import type { SubscriptionCreateInput, SubscriptionPlanType } from '../types'
import { SUBSCRIPTION_PLAN_VALUES } from '../types'
import { SubscriptionEditorDialogShell } from './SubscriptionEditorDialogShell'

type Props = {
  sites: SiteRow[]
  defaultSiteCode: string
  canMutate: boolean
  busy: boolean
  error: string
  onCreate: (input: SubscriptionCreateInput) => Promise<boolean>
}

type FormState = {
  siteCode: string
  customerId: string
  planType: SubscriptionPlanType
  startDate: string
  endDate: string
}

function createInitialState(defaultSiteCode: string, sites: SiteRow[]): FormState {
  const activeSite = defaultSiteCode || sites.find((site) => site.isActive)?.siteCode || sites[0]?.siteCode || ''
  const today = new Date()
  const start = today.toISOString().slice(0, 10)
  const end = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()).toISOString().slice(0, 10)
  return {
    siteCode: activeSite,
    customerId: '',
    planType: 'MONTHLY',
    startDate: start,
    endDate: end,
  }
}

export function SubscriptionCreateDialog({
  sites,
  defaultSiteCode,
  canMutate,
  busy,
  error,
  onCreate,
}: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(createInitialState(defaultSiteCode, sites))
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(createInitialState(defaultSiteCode, sites))
    setValidationError('')
  }, [defaultSiteCode, open, sites])

  const footer = useMemo(() => {
    return 'Customer selection is manual in this wave because the current frontend shell does not yet expose a customer lookup endpoint.'
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError('')

    if (!form.siteCode.trim()) {
      setValidationError('Site code is required.')
      return
    }
    if (!form.customerId.trim()) {
      setValidationError('Customer ID is required.')
      return
    }
    if (!form.startDate || !form.endDate) {
      setValidationError('Start date and end date are required.')
      return
    }
    if (form.startDate > form.endDate) {
      setValidationError('Start date must be on or before end date.')
      return
    }

    const ok = await onCreate({
      siteCode: form.siteCode.trim(),
      customerId: form.customerId.trim(),
      planType: form.planType,
      startDate: form.startDate,
      endDate: form.endDate,
    })
    if (ok) setOpen(false)
  }

  if (!canMutate) return null

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New subscription
      </Button>

      <SubscriptionEditorDialogShell
        open={open}
        title="Create subscription"
        description="Create a new subscription record for a site, customer, plan, and validity window."
        submitLabel="Create subscription"
        busy={busy}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        footer={footer}
      >
        <div className="space-y-4">
          {validationError ? <InlineMessage tone="error">{validationError}</InlineMessage> : null}
          {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subscription-create-site">Site</Label>
              <select
                id="subscription-create-site"
                value={form.siteCode}
                onChange={(event) => setForm((current) => ({ ...current, siteCode: event.target.value }))}
                className="flex h-10 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={busy}
              >
                <option value="">Select site</option>
                {sites.map((site) => (
                  <option key={site.siteCode} value={site.siteCode}>{site.siteCode} · {site.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subscription-create-customer">Customer ID</Label>
              <Input
                id="subscription-create-customer"
                value={form.customerId}
                onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))}
                placeholder="customer_id"
                disabled={busy}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subscription-create-plan">Plan type</Label>
              <select
                id="subscription-create-plan"
                value={form.planType}
                onChange={(event) => setForm((current) => ({ ...current, planType: event.target.value as SubscriptionPlanType }))}
                className="flex h-10 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={busy}
              >
                {SUBSCRIPTION_PLAN_VALUES.map((planType) => (
                  <option key={planType} value={planType}>{planType}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subscription-create-start">Start date</Label>
              <Input
                id="subscription-create-start"
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                disabled={busy}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="subscription-create-end">End date</Label>
              <Input
                id="subscription-create-end"
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                disabled={busy}
              />
            </div>
          </div>
        </div>
      </SubscriptionEditorDialogShell>
    </>
  )
}
