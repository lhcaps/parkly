import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Car, Loader2, MapPin, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConsoleCard, InlineMessage, RetryActionBar } from '@/components/ops/console'
import { PageStateBlock } from '@/components/state/page-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  SubscriptionDetail,
  SubscriptionEffectiveStatus,
  SubscriptionPlanType,
  SubscriptionSpotPatchInput,
  SubscriptionStatus,
  SubscriptionVehiclePatchInput,
} from '../types'
import {
  SUBSCRIPTION_PLAN_VALUES,
  computeRiskFlags,
  riskFlagLabel,
  riskFlagVariant,
} from '../types'
import { SubscriptionSelectionEmptyState } from './SubscriptionSelectionEmptyState'
import { SubscriptionOverviewTab } from './SubscriptionOverviewTab'
import { SubscriptionSpotsTab } from './SubscriptionSpotsTab'
import { SubscriptionStatusActions } from './SubscriptionStatusActions'
import { SubscriptionVehiclesTab } from './SubscriptionVehiclesTab'
import { SubscriptionEditorDialogShell } from './SubscriptionEditorDialogShell'

type TabValue = 'overview' | 'spots' | 'vehicles'

type Props = {
  selectedId: string
  activeTab: TabValue
  detail: SubscriptionDetail | null
  detailLoading: boolean
  detailError: string
  hasRows: boolean
  selectionReason: string
  canMutate: boolean
  mutationBusy: boolean
  mutationError: string
  mutationSuccess: string
  mutationAction: string
  onClose: () => void
  onRetryDetail: () => void
  onResetFilters: () => void
  onTabChange: (value: string) => void
  onPatchStatus: (status: SubscriptionStatus) => Promise<void>
  onUpdateOverview: (subscriptionId: string, patch: { planType?: SubscriptionPlanType; startDate?: string; endDate?: string }) => Promise<boolean>
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
}

function statusVariant(status: string): 'entry' | 'amber' | 'destructive' | 'muted' | 'outline' {
  if (status === 'ACTIVE') return 'entry'
  if (status === 'SUSPENDED') return 'amber'
  if (status === 'CANCELLED') return 'destructive'
  if (status === 'EXPIRED') return 'muted'
  return 'outline'
}

function planVariant(planType: string): 'secondary' | 'outline' {
  return planType === 'VIP' ? 'secondary' : 'outline'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return value.slice(0, 10)
}

function SubscriptionStatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{status}</Badge>
}

type OverviewFormState = {
  planType: SubscriptionPlanType
  startDate: string
  endDate: string
}

function createOverviewForm(detail: SubscriptionDetail | null): OverviewFormState {
  return {
    planType: detail?.planType === 'VIP' ? 'VIP' : 'MONTHLY',
    startDate: detail?.startDate || '',
    endDate: detail?.endDate || '',
  }
}

function matchesAction(action: string, expected: string) {
  return action.toLowerCase().includes(expected)
}

export function SubscriptionDetailPane({
  selectedId,
  activeTab,
  detail,
  detailLoading,
  detailError,
  hasRows,
  selectionReason,
  canMutate,
  mutationBusy,
  mutationError,
  mutationSuccess,
  mutationAction,
  onClose,
  onRetryDetail,
  onResetFilters,
  onTabChange,
  onPatchStatus,
  onUpdateOverview,
  onCreateVehicle,
  onUpdateVehicle,
  onCreateSpot,
  onUpdateSpot,
}: Props) {
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [overviewForm, setOverviewForm] = useState<OverviewFormState>(createOverviewForm(detail))
  const [overviewValidationError, setOverviewValidationError] = useState('')

  useEffect(() => {
    if (!overviewOpen) return
    setOverviewForm(createOverviewForm(detail))
    setOverviewValidationError('')
  }, [detail, overviewOpen])

  const overviewError = matchesAction(mutationAction, 'overview') || matchesAction(mutationAction, 'subscription overview') ? mutationError : ''
  const overviewSuccess = matchesAction(mutationAction, 'overview') ? mutationSuccess : ''
  const statusError = matchesAction(mutationAction, 'status') ? mutationError : ''
  const statusSuccess = matchesAction(mutationAction, 'status') ? mutationSuccess : ''
  const vehicleError = matchesAction(mutationAction, 'vehicle') ? mutationError : ''
  const spotError = matchesAction(mutationAction, 'spot') ? mutationError : ''

  const headerMeta = useMemo(() => {
    if (!detail) return []
    return [
      `${detail.spots.length} spot${detail.spots.length === 1 ? '' : 's'}`,
      `${detail.vehicles.length} vehicle${detail.vehicles.length === 1 ? '' : 's'}`,
    ]
  }, [detail])

  async function handleOverviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOverviewValidationError('')
    if (!detail) return

    if (!overviewForm.startDate || !overviewForm.endDate) {
      setOverviewValidationError('Start date and end date are required.')
      return
    }
    if (overviewForm.startDate > overviewForm.endDate) {
      setOverviewValidationError('Start date must be on or before end date.')
      return
    }

    const ok = await onUpdateOverview(detail.subscriptionId, {
      planType: overviewForm.planType,
      startDate: overviewForm.startDate,
      endDate: overviewForm.endDate,
    })
    if (ok) setOverviewOpen(false)
  }

  if (!selectedId) {
    return (
      <SubscriptionSelectionEmptyState hasRows={hasRows} reason={selectionReason} onResetFilters={onResetFilters} />
    )
  }

  if (detailLoading) {
    return (
      <ConsoleCard>
        <PageStateBlock
          variant="loading"
          title="Loading subscription detail"
          description="Resolving the authoritative subscription snapshot for the selected record."
        />
      </ConsoleCard>
    )
  }

  if (detailError) {
    return (
      <ConsoleCard contentClassName="space-y-4 pt-6">
        <PageStateBlock
          variant="error"
          title="Subscription detail unavailable"
          description={detailError}
        />
        <RetryActionBar onRetry={onRetryDetail} retryLabel="Retry detail" />
      </ConsoleCard>
    )
  }

  if (!detail) {
    return (
      <SubscriptionSelectionEmptyState hasRows={hasRows} reason={selectionReason} onResetFilters={onResetFilters} />
    )
  }

  return (
    <>
      <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">{detail.customerName}</CardTitle>
              <CardDescription>{detail.siteCode} · {detail.siteName}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} title="Close detail">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <SubscriptionStatusBadge status={detail.effectiveStatus} />
            <Badge variant={planVariant(detail.planType)}>{detail.planType}</Badge>
            <Badge variant="outline">{formatDate(detail.startDate)} — {formatDate(detail.endDate)}</Badge>
            {headerMeta.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
          </div>

          {(() => {
            const riskFlags = computeRiskFlags(detail)
            if (riskFlags.length === 0) return null
            return (
              <div className="flex flex-wrap gap-1.5">
                {riskFlags.map((flag) => (
                  <Badge key={flag} variant={riskFlagVariant(flag)} className="text-xs">
                    {riskFlagLabel(flag)}
                  </Badge>
                ))}
              </div>
            )
          })()}

          <SubscriptionStatusActions
            detail={detail}
            canMutate={canMutate}
            busy={mutationBusy}
            error={statusError}
            success={statusSuccess}
            onPatchStatus={onPatchStatus}
          />
        </CardHeader>

        <CardContent className="space-y-4">
          {overviewSuccess ? <InlineMessage tone="success">{overviewSuccess}</InlineMessage> : null}

          <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="spots" className="gap-2">
                <MapPin className="h-3.5 w-3.5" /> Spots
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="gap-2">
                <Car className="h-3.5 w-3.5" /> Vehicles
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {overviewError ? <InlineMessage tone="error">{overviewError}</InlineMessage> : null}
              <SubscriptionOverviewTab detail={detail} readOnly={!canMutate} onEditOverview={() => setOverviewOpen(true)} />
            </TabsContent>

            <TabsContent value="spots" className="space-y-4">
              <SubscriptionSpotsTab
                detail={detail}
                canMutate={canMutate}
                busy={mutationBusy}
                error={spotError}
                onCreateSpot={onCreateSpot}
                onUpdateSpot={onUpdateSpot}
              />
            </TabsContent>

            <TabsContent value="vehicles" className="space-y-4">
              <SubscriptionVehiclesTab
                detail={detail}
                canMutate={canMutate}
                busy={mutationBusy}
                error={vehicleError}
                onCreateVehicle={onCreateVehicle}
                onUpdateVehicle={onUpdateVehicle}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <SubscriptionEditorDialogShell
        open={overviewOpen}
        title="Edit subscription overview"
        description="Update the plan type or validity window for the selected subscription."
        submitLabel="Save overview changes"
        busy={mutationBusy}
        onClose={() => setOverviewOpen(false)}
        onSubmit={handleOverviewSubmit}
        footer={`subscriptionId ${detail.subscriptionId}`}
      >
        <div className="space-y-4">
          {overviewValidationError ? <InlineMessage tone="error">{overviewValidationError}</InlineMessage> : null}
          {overviewError ? <InlineMessage tone="error">{overviewError}</InlineMessage> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subscription-overview-plan">Plan type</Label>
              <select
                id="subscription-overview-plan"
                value={overviewForm.planType}
                onChange={(event) => setOverviewForm((current) => ({ ...current, planType: event.target.value as SubscriptionPlanType }))}
                className="flex h-10 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={mutationBusy}
              >
                {SUBSCRIPTION_PLAN_VALUES.map((planType) => (
                  <option key={planType} value={planType}>{planType}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subscription-overview-start">Start date</Label>
              <Input
                id="subscription-overview-start"
                type="date"
                value={overviewForm.startDate}
                onChange={(event) => setOverviewForm((current) => ({ ...current, startDate: event.target.value }))}
                disabled={mutationBusy}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="subscription-overview-end">End date</Label>
              <Input
                id="subscription-overview-end"
                type="date"
                value={overviewForm.endDate}
                onChange={(event) => setOverviewForm((current) => ({ ...current, endDate: event.target.value }))}
                disabled={mutationBusy}
              />
            </div>
          </div>
        </div>
      </SubscriptionEditorDialogShell>
    </>
  )
}
