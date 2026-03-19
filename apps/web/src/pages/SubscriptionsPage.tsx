import { Loader2, RefreshCw } from 'lucide-react'
import { PageHeader, InlineMessage } from '@/components/ops/console'
import { StateBanner } from '@/components/state/page-state'
import { Button } from '@/components/ui/button'
import { SubscriptionCreateDialog } from '@/features/subscriptions/components/SubscriptionCreateDialog'
import { SubscriptionDetailPane } from '@/features/subscriptions/components/SubscriptionDetailPane'
import { SubscriptionsFilterBar } from '@/features/subscriptions/components/SubscriptionsFilterBar'
import { SubscriptionsListPane } from '@/features/subscriptions/components/SubscriptionsListPane'
import { useSubscriptionMutations } from '@/features/subscriptions/hooks/useSubscriptionMutations'
import { useSubscriptionsWorkspace } from '@/features/subscriptions/hooks/useSubscriptionsWorkspace'

export function SubscriptionsPage() {
  const workspace = useSubscriptionsWorkspace()
  const mutations = useSubscriptionMutations({
    operatorRole: workspace.operatorRole,
    selectedId: workspace.query.selectedId,
    reloadList: workspace.reloadList,
    reloadDetail: workspace.reloadDetail,
    focusSubscription: workspace.focusSubscription,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Subscriptions"
        description="Manage parking subscriptions, linked vehicles, linked spots, and lifecycle state without losing deep-link fidelity or authoritative refresh semantics."
        badges={[
          { label: 'canonical', variant: 'secondary' },
          { label: workspace.operatorRole || '—', variant: 'muted' },
          { label: workspace.canMutate ? 'mutable' : 'read-only', variant: workspace.canMutate ? 'entry' : 'outline' },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <SubscriptionCreateDialog
              sites={workspace.sites}
              defaultSiteCode={workspace.query.siteCode}
              canMutate={mutations.canMutate}
              busy={mutations.state.busy && mutations.state.action.toLowerCase().includes('create subscription')}
              error={mutations.state.action.toLowerCase().includes('create subscription') ? mutations.state.error : ''}
              onCreate={mutations.createSubscription}
            />
            <Button variant="outline" size="lg" onClick={() => void workspace.reloadList()} disabled={workspace.list.loading || mutations.state.busy} className="h-11 px-5 gap-2">
              {workspace.list.loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
              Refresh
            </Button>
          </div>
        }
      />

      {mutations.state.success && mutations.state.action.toLowerCase().includes('create subscription') ? (
        <InlineMessage tone="success">{mutations.state.success}</InlineMessage>
      ) : null}

      {mutations.state.error && mutations.state.action.toLowerCase().includes('create subscription') ? (
        <StateBanner error={mutations.state.error} title="Subscription create failed" />
      ) : null}

      <SubscriptionsFilterBar
        sites={workspace.sites}
        siteCode={workspace.query.siteCode}
        status={workspace.query.status}
        plateInput={workspace.plateInput}
        busy={workspace.list.loading}
        onSiteChange={(value) => workspace.applyFilters({ siteCode: value })}
        onStatusChange={(value) => workspace.applyFilters({ status: value })}
        onPlateInputChange={workspace.setPlateInput}
        onSubmitPlate={() => workspace.applyFilters({ plate: workspace.plateInput })}
        onClearPlate={() => {
          workspace.setPlateInput('')
          workspace.applyFilters({ plate: '' })
        }}
        onReset={workspace.resetFilters}
        onRefresh={() => void workspace.reloadList()}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(400px,0.9fr)_minmax(0,1.1fr)]">
        <SubscriptionsListPane
          rows={workspace.list.rows}
          selectedId={workspace.query.selectedId}
          loading={workspace.list.loading}
          loadingMore={workspace.list.loadingMore}
          error={workspace.list.error}
          nextCursor={workspace.list.nextCursor}
          onSelect={workspace.selectRow}
          onReset={workspace.resetFilters}
          onLoadMore={() => void workspace.loadMore()}
        />

        <div className="xl:sticky xl:top-20 xl:self-start">
          <SubscriptionDetailPane
            selectedId={workspace.query.selectedId}
            activeTab={workspace.query.activeTab}
            detail={workspace.detail.data}
            detailLoading={workspace.detail.loading}
            detailError={workspace.detail.error}
            hasRows={workspace.list.rows.length > 0}
            selectionReason={workspace.selection.reason}
            canMutate={workspace.canMutate}
            mutationBusy={mutations.state.busy}
            mutationError={mutations.state.error}
            mutationSuccess={mutations.state.success}
            mutationAction={mutations.state.action}
            onClose={workspace.closeDetail}
            onRetryDetail={() => void workspace.retryDetail()}
            onResetFilters={workspace.resetFilters}
            onTabChange={workspace.setActiveTab}
            onPatchStatus={(status) => mutations.patchSubscriptionStatus(workspace.query.selectedId, status).then(() => undefined)}
            onUpdateOverview={mutations.updateSubscription}
            onCreateVehicle={mutations.createVehicleLink}
            onUpdateVehicle={mutations.updateVehicleLink}
            onCreateSpot={mutations.createSpotLink}
            onUpdateSpot={mutations.updateSpotLink}
          />
        </div>
      </div>
    </div>
  )
}
