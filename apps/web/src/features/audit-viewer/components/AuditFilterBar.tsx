import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterCard } from '@/components/ops/console'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import type { AuditQuickFilter } from '@/features/audit-viewer/audit-viewer-model'
import type { SiteRow } from '@/lib/contracts/topology'

export function AuditFilterBar({
  sites,
  siteCode,
  quickFilter,
  action,
  keyword,
  correlationId,
  requestId,
  entityTable,
  entityId,
  actorUserId,
  onSiteCodeChange,
  onQuickFilterChange,
  onActionChange,
  onKeywordChange,
  onCorrelationIdChange,
  onRequestIdChange,
  onEntityTableChange,
  onEntityIdChange,
  onActorUserIdChange,
  onApply,
  onReset,
  loading,
}: {
  sites: SiteRow[]
  siteCode: string
  quickFilter: AuditQuickFilter
  action: string
  keyword: string
  correlationId: string
  requestId: string
  entityTable: string
  entityId: string
  actorUserId: string
  onSiteCodeChange: (value: string) => void
  onQuickFilterChange: (value: AuditQuickFilter) => void
  onActionChange: (value: string) => void
  onKeywordChange: (value: string) => void
  onCorrelationIdChange: (value: string) => void
  onRequestIdChange: (value: string) => void
  onEntityTableChange: (value: string) => void
  onEntityIdChange: (value: string) => void
  onActorUserIdChange: (value: string) => void
  onApply: () => void
  onReset: () => void
  loading: boolean
}) {
  const { t } = useTranslation()

  const quickFilterOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: 'all',
        label: t('auditViewer.filters.quick.all.label'),
        description: t('auditViewer.filters.quick.all.description'),
        badge: t('auditViewer.filters.badges.all'),
        badgeVariant: 'neutral',
      },
      {
        value: 'request',
        label: t('auditViewer.filters.quick.request.label'),
        description: t('auditViewer.filters.quick.request.description'),
        badge: 'rid',
        badgeVariant: 'neutral',
      },
      {
        value: 'correlation',
        label: t('auditViewer.filters.quick.correlation.label'),
        description: t('auditViewer.filters.quick.correlation.description'),
        badge: 'cid',
        badgeVariant: 'neutral',
      },
      {
        value: 'manual',
        label: t('auditViewer.filters.quick.manual.label'),
        description: t('auditViewer.filters.quick.manual.description'),
        badge: t('auditViewer.filters.badges.manual'),
        badgeVariant: 'warning',
      },
      {
        value: 'gate-session',
        label: t('auditViewer.filters.quick.gateSession.label'),
        description: t('auditViewer.filters.quick.gateSession.description'),
        badge: t('auditViewer.filters.badges.session'),
        badgeVariant: 'neutral',
      },
      {
        value: 'barrier',
        label: t('auditViewer.filters.quick.barrier.label'),
        description: t('auditViewer.filters.quick.barrier.description'),
        badge: t('auditViewer.filters.badges.barrier'),
        badgeVariant: 'warning',
      },
    ],
    [t],
  )

  const actionOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: '',
        label: t('auditViewer.filters.actions.all.label'),
        description: t('auditViewer.filters.actions.all.description'),
        badge: t('auditViewer.filters.badges.any'),
        badgeVariant: 'neutral',
      },
      {
        value: 'SESSION_OPEN',
        label: 'SESSION_OPEN',
        description: t('auditViewer.filters.actions.sessionOpen'),
        badge: t('auditViewer.filters.badges.open'),
        badgeVariant: 'neutral',
      },
      {
        value: 'SESSION_RESOLVE',
        label: 'SESSION_RESOLVE',
        description: t('auditViewer.filters.actions.sessionResolve'),
        badge: t('auditViewer.filters.badges.resolve'),
        badgeVariant: 'neutral',
      },
      {
        value: 'MANUAL_APPROVE',
        label: 'MANUAL_APPROVE',
        description: t('auditViewer.filters.actions.manualApprove'),
        badge: t('auditViewer.filters.badges.manual'),
        badgeVariant: 'warning',
      },
      {
        value: 'MANUAL_REJECT',
        label: 'MANUAL_REJECT',
        description: t('auditViewer.filters.actions.manualReject'),
        badge: t('auditViewer.filters.badges.manual'),
        badgeVariant: 'warning',
      },
      {
        value: 'MANUAL_OPEN_BARRIER',
        label: 'MANUAL_OPEN_BARRIER',
        description: t('auditViewer.filters.actions.manualOpenBarrier'),
        badge: t('auditViewer.filters.badges.barrier'),
        badgeVariant: 'warning',
      },
      {
        value: 'BARRIER_OPEN',
        label: 'BARRIER_OPEN',
        description: t('auditViewer.filters.actions.barrierOpen'),
        badge: t('auditViewer.filters.badges.barrier'),
        badgeVariant: 'neutral',
      },
    ],
    [t],
  )

  const siteOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: '',
        label: t('auditViewer.filters.site.all.label'),
        description: t('auditViewer.filters.site.all.description'),
        badge: t('auditViewer.filters.badges.all'),
        badgeVariant: 'neutral',
      },
      ...sites.map<SelectOption>((site) => ({
        value: site.siteCode,
        label: site.siteCode,
        description: site.name,
        badge: site.isActive ? t('auditViewer.filters.badges.active') : t('auditViewer.filters.badges.off'),
        badgeVariant: site.isActive ? 'success' : 'neutral',
      })),
    ],
    [sites, t],
  )

  return (
    <FilterCard
      className="ops-sticky-bar"
      contentClassName="pt-0"
      title={t('auditViewer.filters.title')}
      description={t('auditViewer.filters.description')}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onReset} disabled={loading}>
            {t('auditViewer.filters.reset')}
          </Button>
          <Button variant="secondary" size="sm" onClick={onApply} disabled={loading}>
            {t('auditViewer.filters.apply')}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Select value={siteCode} onChange={onSiteCodeChange} options={siteOptions} disabled={loading} />
        <Select value={quickFilter} onChange={(value) => onQuickFilterChange(value as AuditQuickFilter)} options={quickFilterOptions} disabled={loading} />
        <Select value={action} onChange={onActionChange} options={actionOptions} disabled={loading} />
        <Input
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder={t('auditViewer.filters.placeholders.keyword')}
          aria-label={t('auditViewer.filters.aria.keyword')}
          disabled={loading}
        />
        <Input value={correlationId} onChange={(event) => onCorrelationIdChange(event.target.value)} placeholder={t('auditViewer.filters.placeholders.correlationId')} disabled={loading} />
        <Input value={requestId} onChange={(event) => onRequestIdChange(event.target.value)} placeholder={t('auditViewer.filters.placeholders.requestId')} disabled={loading} />
        <Input value={entityTable} onChange={(event) => onEntityTableChange(event.target.value)} placeholder={t('auditViewer.filters.placeholders.entityTable')} disabled={loading} />
        <Input value={entityId} onChange={(event) => onEntityIdChange(event.target.value)} placeholder={t('auditViewer.filters.placeholders.entityId')} disabled={loading} />
        <Input
          value={actorUserId}
          onChange={(event) => onActorUserIdChange(event.target.value)}
          placeholder={t('auditViewer.filters.placeholders.actorUserId')}
          disabled={loading}
          className="md:col-span-2 xl:col-span-1"
        />
      </div>
    </FilterCard>
  )
}
