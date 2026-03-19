import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Calendar, Plus } from 'lucide-react'
import { InlineMessage } from '@/components/ops/console'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, type SelectOption } from '@/components/ui/select'
import { cn } from '@/lib/utils'
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

const PLAN_TYPE_LABELS: Record<SubscriptionPlanType, string> = {
  MONTHLY: 'Hàng tháng',
  VIP: 'VIP',
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

  const siteOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: '', label: 'Chọn bãi', description: 'Tất cả các bãi' },
      ...sites.map<SelectOption>((site) => ({
        value: site.siteCode,
        label: site.siteCode,
        description: site.name,
        badge: site.isActive ? 'active' : 'off',
        badgeVariant: site.isActive ? 'success' : 'neutral',
      })),
    ]
  }, [sites])

  const planOptions = useMemo<SelectOption[]>(() => {
    return SUBSCRIPTION_PLAN_VALUES.map<SelectOption>((planType) => ({
      value: planType,
      label: PLAN_TYPE_LABELS[planType] || planType,
      description: planType,
    }))
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError('')

    if (!form.siteCode.trim()) {
      setValidationError('Vui lòng chọn bãi.')
      return
    }
    if (!form.customerId.trim()) {
      setValidationError('Vui lòng nhập mã khách hàng.')
      return
    }
    if (!form.startDate || !form.endDate) {
      setValidationError('Vui lòng chọn ngày bắt đầu và ngày kết thúc.')
      return
    }
    if (form.startDate > form.endDate) {
      setValidationError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.')
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
      <Button onClick={() => setOpen(true)} size="lg" className="h-11 px-5 gap-2">
        <Plus className="h-5 w-5" />
        Tạo gói mới
      </Button>

      <SubscriptionEditorDialogShell
        open={open}
        title="Tạo gói đỗ xe"
        description="Tạo gói đỗ xe mới cho bãi, khách hàng, loại gói và thời hạn hiệu lực."
        submitLabel="Tạo gói"
        busy={busy}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        footer="Lựa chọn khách hàng hiện tại phải nhập thủ công vì frontend shell chưa có endpoint tra cứu khách hàng."
      >
        <div className="space-y-6">
          {validationError ? <InlineMessage tone="error">{validationError}</InlineMessage> : null}
          {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2.5">
              <Label htmlFor="subscription-create-site" className="text-sm font-semibold">
                Bãi
              </Label>
              <Select
                value={form.siteCode}
                onChange={(value) => setForm((current) => ({ ...current, siteCode: value }))}
                options={siteOptions}
                placeholder="Chọn bãi"
                disabled={busy}
                size="md"
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="subscription-create-customer" className="text-sm font-semibold">
                Mã khách hàng
              </Label>
              <Input
                id="subscription-create-customer"
                value={form.customerId}
                onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))}
                placeholder="Nhập mã khách hàng"
                disabled={busy}
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="subscription-create-plan" className="text-sm font-semibold">
                Loại gói
              </Label>
              <Select
                value={form.planType}
                onChange={(value) => setForm((current) => ({ ...current, planType: value as SubscriptionPlanType }))}
                options={planOptions}
                placeholder="Chọn loại gói"
                disabled={busy}
                size="md"
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="subscription-create-start" className="flex items-center gap-2 text-sm font-semibold">
                <Calendar className="h-4 w-4 text-primary" />
                Ngày bắt đầu
              </Label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="subscription-create-start"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                  disabled={busy}
                  className={cn(
                    'h-14 pl-12 pr-4 text-base font-medium',
                    'border-2 border-border/80 bg-card/80',
                    'hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20',
                    'transition-all duration-200'
                  )}
                />
              </div>
            </div>

            <div className="space-y-2.5 md:col-span-2">
              <Label htmlFor="subscription-create-end" className="flex items-center gap-2 text-sm font-semibold">
                <Calendar className="h-4 w-4 text-primary" />
                Ngày kết thúc
              </Label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="subscription-create-end"
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                  disabled={busy}
                  className={cn(
                    'h-14 pl-12 pr-4 text-base font-medium',
                    'border-2 border-border/80 bg-card/80',
                    'hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20',
                    'transition-all duration-200'
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </SubscriptionEditorDialogShell>
    </>
  )
}
