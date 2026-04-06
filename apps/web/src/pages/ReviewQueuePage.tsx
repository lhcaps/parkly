import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReviewActionPanel } from '@/features/review-queue/components/ReviewActionPanel'
import { ReviewFilterBar, type ReviewStatus } from '@/features/review-queue/components/ReviewFilterBar'
import { ReviewTable } from '@/features/review-queue/components/ReviewTable'
import { useReviewQueue } from '@/features/review-queue/hooks/useReviewQueue'

export function ReviewQueuePage() {
  const { t } = useTranslation()
  const queue = useReviewQueue()

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        eyebrow={t('navGroup.Operations')}
        title={t('route.reviewQueue.label')}
        description={t('route.reviewQueue.description')}
        badges={[
          { label: t('reviewQueuePage.badges.manualReview'), variant: 'secondary' },
          { label: queue.operatorRole || t('common.dash'), variant: 'muted' },
          {
            label: queue.filters.listScope === 'active' ? t('reviewQueuePage.badges.pending') : t('reviewQueuePage.badges.done'),
            variant: queue.filters.listScope === 'active' ? 'outline' : 'secondary',
          },
          { label: t('reviewQueuePage.badges.caseCount', { count: queue.filteredRows.length }), variant: 'outline' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 flex rounded-lg border border-border/80 bg-muted/30 p-0.5">
              <Button
                type="button"
                variant={queue.filters.listScope === 'active' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3"
                onClick={() => queue.setFilters.switchListScope('active')}
              >
                {t('reviewQueuePage.needsAction')}
              </Button>
              <Button
                type="button"
                variant={queue.filters.listScope === 'done' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3"
                onClick={() => queue.setFilters.switchListScope('done')}
              >
                {t('reviewQueuePage.done')}
              </Button>
            </div>
            <Button
              variant={queue.autoRefreshEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => queue.setAutoRefreshEnabled(!queue.autoRefreshEnabled)}
              title={
                queue.autoRefreshEnabled
                  ? t('reviewQueuePage.autoRefreshTitle', { seconds: queue.AUTO_REFRESH_MS / 1000 })
                  : t('reviewQueuePage.manualRefreshTitle')
              }
            >
              {queue.autoRefreshEnabled ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('reviewQueuePage.auto')}
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t('reviewQueuePage.manual')}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void queue.refresh(queue.selectedId || undefined, { force: true })}
              disabled={queue.loading}
            >
              {queue.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t('common.refresh')}
            </Button>
            {queue.lastRefreshAt ? (
              <span className="text-xs text-muted-foreground">
                {t('reviewQueuePage.lastRefreshAgo', {
                  seconds: Math.round((Date.now() - queue.lastRefreshAt.getTime()) / 1000),
                })}
              </span>
            ) : null}
          </div>
        }
      />

      <ReviewFilterBar
        sites={queue.filters.sites}
        siteCode={queue.filters.siteCode}
        status={queue.filters.status as ReviewStatus}
        search={queue.filters.search}
        from={queue.filters.from}
        to={queue.filters.to}
        loading={queue.loading}
        onSiteCodeChange={queue.setFilters.setSiteCode}
        onStatusChange={queue.setFilters.setStatus as (value: ReviewStatus) => void}
        onSearchChange={queue.setFilters.setSearch}
        onFromChange={queue.setFilters.setFrom}
        onToChange={queue.setFilters.setTo}
        onRefresh={() => void queue.refresh(queue.selectedId || undefined, { force: true })}
        onReset={queue.setFilters.resetFilters}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.05fr)]">
        <ReviewTable
          title={queue.filters.listScope === 'active' ? t('reviewQueuePage.needsAction') : t('reviewQueuePage.done')}
          emptyHint={
            queue.filters.listScope === 'done'
              ? t('reviewQueuePage.doneEmptyHint')
              : t('reviewQueuePage.activeEmptyHint')
          }
          variant={queue.filters.listScope === 'done' ? 'done' : 'active'}
          rows={queue.filteredRows}
          selectedId={queue.selected?.reviewId || ''}
          loading={queue.loading}
          error={queue.error}
          onSelect={(reviewId) => {
            queue.setSelectedId(reviewId)
            queue.setActionError(null)
            queue.setStaleWarning('')
          }}
        />

        <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <ReviewActionPanel
            selected={queue.selected}
            listScope={queue.filters.listScope}
            liveStatus={queue.liveStatus}
            liveSessionAllowedActions={queue.liveSessionAllowedActions}
            isTerminal={queue.isTerminal}
            liveContextReady={queue.liveContextReady}
            detailLoading={queue.detailLoading}
            detailError={queue.detailError}
            staleWarning={queue.staleWarning}
            actionBusy={queue.actionBusy}
            actionError={queue.actionError}
            reasonCode={queue.reasonCode}
            note={queue.note}
            onReasonCodeChange={queue.setReasonCode}
            onNoteChange={queue.setNote}
            run={queue.run}
            getActionLockReason={queue.getActionLockReason}
            isActionDisabled={queue.isActionDisabled}
          />
        </div>
      </div>
    </div>
  )
}
