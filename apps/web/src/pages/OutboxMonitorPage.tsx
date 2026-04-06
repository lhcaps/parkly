import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, Play, RefreshCcw, RotateCcw, ShieldAlert } from 'lucide-react'
import { InlineMessage, PageHeader } from '@/components/ops/console'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ValidationSummary } from '@/components/forms/validation-summary'
import { DangerConfirmDialog } from '@/components/state/danger-confirm-dialog'
import { PageStateRenderer, StateBanner } from '@/components/state/page-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { OutboxDetailPanel } from '@/features/outbox-monitor/OutboxDetailPanel'
import { OutboxFilterBar } from '@/features/outbox-monitor/OutboxFilterBar'
import { OutboxMonitorPanel } from '@/features/outbox-monitor/OutboxMonitorPanel'
import {
  matchesOutboxKeyword,
  matchesOutboxQuickFilter,
  normalizeRestOutboxRecord,
  type OutboxQuickFilter,
  type OutboxTriageRecord,
} from '@/features/outbox-monitor/outbox-triage-model'
import {
  drainOutbox,
  getMe,
  getOutboxItems,
  requeueOutboxItems,
  type MeRes,
  type OutboxDrainRes,
} from '@/lib/api'
import { getSites } from '@/lib/api/topology'
import { extractValidationFieldErrors } from '@/lib/http/errors'
import { buildSearchParams, readEnumSearchParam, readTrimmedSearchParam, syncSearchParams } from '@/lib/router/url-state'
import type { SiteRow } from '@/lib/contracts/topology'

const OUTBOX_STATUS_VALUES = ['', 'PENDING', 'SENT', 'FAILED'] as const
const OUTBOX_QUICK_FILTER_VALUES: OutboxQuickFilter[] = ['all', 'failed', 'pending', 'retrying', 'sent', 'barrier', 'review']

function parseOutboxSearchParams(searchParams: URLSearchParams) {
  return {
    siteCode: readTrimmedSearchParam(searchParams, 'siteCode'),
    status: readEnumSearchParam(searchParams, 'status', OUTBOX_STATUS_VALUES, ''),
    quickFilter: readEnumSearchParam(searchParams, 'quick', OUTBOX_QUICK_FILTER_VALUES, 'all'),
    keyword: readTrimmedSearchParam(searchParams, 'q'),
    correlationId: readTrimmedSearchParam(searchParams, 'correlationId'),
    requestId: readTrimmedSearchParam(searchParams, 'requestId'),
    entity: readTrimmedSearchParam(searchParams, 'entity'),
    outboxId: readTrimmedSearchParam(searchParams, 'outboxId'),
  }
}

function buildOutboxSearchParams(args: {
  siteCode: string
  status: string
  quickFilter: OutboxQuickFilter
  keyword: string
  correlationId: string
  requestId: string
  entity: string
  outboxId: string
}) {
  return buildSearchParams({
    siteCode: args.siteCode,
    status: args.status,
    quick: args.quickFilter !== 'all' ? args.quickFilter : '',
    q: args.keyword,
    correlationId: args.correlationId,
    requestId: args.requestId,
    entity: args.entity,
    outboxId: args.outboxId,
  })
}

export function OutboxMonitorPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const routeState = useMemo(() => parseOutboxSearchParams(searchParams), [searchParams])

  const [role, setRole] = useState<MeRes['role']>('GUARD')
  const [sites, setSites] = useState<SiteRow[]>([])
  const [siteCode, setSiteCode] = useState(routeState.siteCode)
  const [status, setStatus] = useState(routeState.status)
  const [quickFilter, setQuickFilter] = useState<OutboxQuickFilter>(routeState.quickFilter)
  const [keyword, setKeyword] = useState(routeState.keyword)
  const [correlationId, setCorrelationId] = useState(routeState.correlationId)
  const [requestId, setRequestId] = useState(routeState.requestId)
  const [entity, setEntity] = useState(routeState.entity)
  const [selectedId, setSelectedId] = useState(routeState.outboxId)

  const [rows, setRows] = useState<OutboxTriageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [drainResult, setDrainResult] = useState<OutboxDrainRes | null>(null)

  useEffect(() => {
    setSiteCode(routeState.siteCode)
    setStatus(routeState.status)
    setQuickFilter(routeState.quickFilter)
    setKeyword(routeState.keyword)
    setCorrelationId(routeState.correlationId)
    setRequestId(routeState.requestId)
    setEntity(routeState.entity)
    setSelectedId(routeState.outboxId)
  }, [routeState])

  useEffect(() => {
    const next = buildOutboxSearchParams({ siteCode, status, quickFilter, keyword, correlationId, requestId, entity, outboxId: selectedId })
    syncSearchParams(searchParams, next, setSearchParams)
  }, [siteCode, status, quickFilter, keyword, correlationId, requestId, entity, selectedId, searchParams, setSearchParams])

  const canRequeue = role === 'SUPER_ADMIN' || role === 'SITE_ADMIN' || role === 'MANAGER' || role === 'OPERATOR'
  const canDrain = role === 'SUPER_ADMIN' || role === 'SITE_ADMIN' || role === 'MANAGER' || role === 'OPERATOR'

  async function load(preferredId?: string) {
    setLoading(true)
    try {
      setError(null)
      const [me, siteRes, outbox] = await Promise.all([
        getMe(),
        getSites(),
        getOutboxItems({ siteCode: siteCode || undefined, status: status as 'PENDING' | 'SENT' | 'FAILED' | undefined, limit: 100 }),
      ])
      const normalized = outbox.rows.map(normalizeRestOutboxRecord)
      setRole(me.role)
      setSites(siteRes.rows)
      setRows(normalized)
      const nextSelectedId =
        preferredId && normalized.some((row) => row.outboxId === preferredId)
          ? preferredId
          : selectedId && normalized.some((row) => row.outboxId === selectedId)
            ? selectedId
            : normalized[0]?.outboxId || ''
      setSelectedId(nextSelectedId)
      setMessage(null)
    } catch (loadError) {
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(routeState.outboxId || selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode, status])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (!matchesOutboxQuickFilter(row, quickFilter)) return false
      if (!matchesOutboxKeyword(row, keyword)) return false
      if (correlationId && (row.correlationId || '').toLowerCase() !== correlationId.trim().toLowerCase()) return false
      if (requestId && (row.requestId || '').toLowerCase() !== requestId.trim().toLowerCase()) return false
      if (entity) {
        const term = entity.trim().toLowerCase()
        const entityHaystack = `${row.entityTable || ''} ${row.entityId || ''}`.toLowerCase()
        if (!entityHaystack.includes(term)) return false
      }
      return true
    })
  }, [rows, quickFilter, keyword, correlationId, requestId, entity])

  const selected = useMemo(
    () => filteredRows.find((row) => row.outboxId === selectedId) || filteredRows[0] || null,
    [filteredRows, selectedId],
  )

  const failedRows = useMemo(() => filteredRows.filter((row) => row.status === 'FAILED' || row.status === 'TIMEOUT' || row.status === 'NACKED'), [filteredRows])
  const validationItems = useMemo(() => extractValidationFieldErrors(error instanceof Error ? (error as any).details : undefined), [error])

  async function handleRequeue(limit?: number) {
    setBusy('requeue')
    try {
      setError(null)
      const result = await requeueOutboxItems(limit ? { limit } : { outboxIds: failedRows.map((row) => row.outboxId) })
      setMessage(`${result.changed} record(s) returned to the queue.`)
      await load(selected?.outboxId)
    } catch (requeueError) {
      setError(requeueError)
    } finally {
      setBusy(null)
    }
  }

  async function handleDrain(dryRun = false) {
    setBusy(dryRun ? 'dryRun' : 'drain')
    try {
      setError(null)
      const result = await drainOutbox({ limit: 20, dryRun })
      setDrainResult(result)
      setMessage(dryRun ? 'Drain preview complete.' : 'Outbox drain complete.')
      await load(selected?.outboxId)
    } catch (drainError) {
      setError(drainError)
    } finally {
      setBusy(null)
    }
  }

  function resetFilters() {
    setSiteCode('')
    setStatus('')
    setQuickFilter('all')
    setKeyword('')
    setCorrelationId('')
    setRequestId('')
    setEntity('')
    setSelectedId('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('navGroup.Operations')}
        title={t('route.syncOutbox.label')}
        description={t('route.syncOutbox.description')}
        badges={[
          { label: t('outboxPage.badges.role', { role }), variant: 'muted' },
          { label: t('outboxPage.badges.failed', { count: failedRows.length }), variant: failedRows.length > 0 ? 'destructive' : 'secondary' },
        ]}
      />

      <ValidationSummary items={validationItems} />
      {message ? <StateBanner className="border-success/25 bg-success/10 text-success">{message}</StateBanner> : null}
      {error ? <StateBanner error={error} onRetry={() => void load(selectedId)} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/review-queue">
          <Card className="ops-detail-card h-full transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="pt-5">
              <p className="font-medium">Review Queue</p>
              <p className="mt-1 text-sm text-muted-foreground">Check the related inputs when the backlog originates from cases needing manual confirmation.</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/lane-monitor">
          <Card className="ops-detail-card h-full transition hover:border-primary/30 hover:bg-primary/5">
            <CardContent className="pt-5">
              <p className="font-medium">Lane Monitor</p>
              <p className="mt-1 text-sm text-muted-foreground">Cross-reference which lanes generated events that have not synced downstream yet.</p>
            </CardContent>
          </Card>
        </Link>

        <Card className="ops-detail-card h-full">
          <CardContent className="pt-5">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <p className="font-medium">Action scope</p>
            </div>
            <p className="text-sm text-muted-foreground">This screen is for sync queue operations. Lane processing still belongs in Run Lane.</p>
          </CardContent>
        </Card>
      </div>

      <OutboxFilterBar
        sites={sites}
        siteCode={siteCode}
        status={status}
        quickFilter={quickFilter}
        keyword={keyword}
        correlationId={correlationId}
        requestId={requestId}
        entity={entity}
        onSiteCodeChange={setSiteCode}
        onStatusChange={(value) => setStatus((value || '') as "" | "PENDING" | "SENT" | "FAILED")}
        onQuickFilterChange={setQuickFilter}
        onKeywordChange={setKeyword}
        onCorrelationIdChange={setCorrelationId}
        onRequestIdChange={setRequestId}
        onEntityChange={setEntity}
        onApply={() => void load(selectedId)}
        onReset={resetFilters}
        loading={loading}
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <OutboxMonitorPanel />

        <Card className="ops-detail-card">
          <CardHeader>
            <CardTitle>Queue controls</CardTitle>
            <CardDescription>Requeue and drain are available to SUPER_ADMIN, SITE_ADMIN, MANAGER, and OPERATOR.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void load(selectedId)} disabled={loading || busy != null}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Refresh
              </Button>

              <DangerConfirmDialog
                title="Preview batch drain?"
                description="Dry-run lists current candidates only. The queue will not be modified."
                confirmLabel="Run dry-run"
                onConfirm={() => handleDrain(true)}
                disabled={!canDrain || busy != null}
                tone="warning"
                trigger={(triggerProps) => (
                  <Button variant="outline" size="sm" {...triggerProps}>
                    <Play className="h-4 w-4" />
                    Preview drain
                  </Button>
                )}
              />

              <DangerConfirmDialog
                title="Run outbox drain now?"
                description="This claims the current batch and forces reprocessing immediately. Only run when downstream is ready."
                confirmLabel="Run drain"
                onConfirm={() => handleDrain(false)}
                disabled={!canDrain || busy != null}
                tone="danger"
                trigger={(triggerProps) => (
                  <Button variant="secondary" size="sm" {...triggerProps}>
                    <Play className="h-4 w-4" />
                    Run drain
                  </Button>
                )}
              />

              <DangerConfirmDialog
                title={`Requeue ${failedRows.length} failed record(s)?`}
                description="Only run after confirming downstream has recovered. Failed records will be returned to the processing queue."
                confirmLabel="Requeue failures"
                onConfirm={() => handleRequeue()}
                disabled={!canRequeue || failedRows.length === 0 || busy != null}
                tone="warning"
                trigger={(triggerProps) => (
                  <Button variant="secondary" size="sm" {...triggerProps}>
                    <RotateCcw className="h-4 w-4" />
                    Requeue failed
                  </Button>
                )}
              />

              <DangerConfirmDialog
                title="Requeue 50 most recent records?"
                description="Returns up to 50 recent records to pending for re-inspection so you can verify the downstream sync path."
                confirmLabel="Requeue latest 50"
                onConfirm={() => handleRequeue(50)}
                disabled={!canRequeue || busy != null}
                tone="warning"
                trigger={(triggerProps) => (
                  <Button variant="outline" size="sm" {...triggerProps}>
                    <RotateCcw className="h-4 w-4" />
                    Requeue 50 recent
                  </Button>
                )}
              />
            </div>

            {drainResult ? (
              <InlineMessage>
                {drainResult.dryRun
                  ? `candidates=${drainResult.candidates.join(', ') || 'none'}`
                  : `claimed=${drainResult.claimed} ok=${drainResult.ok} fail=${drainResult.fail}`}
              </InlineMessage>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.56fr)_minmax(360px,0.44fr)]">
        <Card className="ops-detail-card">
          <CardHeader>
            <CardTitle>REST triage list</CardTitle>
            <CardDescription>Authoritative REST list. Share the URL, select records to investigate, and reconcile with the stream snapshot in the adjacent panel.</CardDescription>
          </CardHeader>

          <CardContent>
            <PageStateRenderer
              loading={loading && filteredRows.length === 0}
              error={error && filteredRows.length === 0 ? error : null}
              empty={!loading && !error && filteredRows.length === 0}
              emptyTitle="No outbox records"
              emptyDescription="When the system generates events that need to sync, they will appear here.ncy-down."
              onRetry={() => void load(selectedId)}
              minHeightClassName="min-h-[180px]"
            >
              <div className="space-y-3 pr-1">
                {filteredRows.map((row) => (
                  <button
                    key={row.outboxId}
                    type="button"
                    onClick={() => setSelectedId(row.outboxId)}
                    className={`w-full rounded-xl border px-4 py-3 text-left ${row.outboxId === selected?.outboxId ? 'border-primary/35 bg-primary/8' : 'border-border bg-muted/15 hover:bg-muted/25'}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono-data text-sm font-semibold">outbox={row.outboxId} | event={row.eventId}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.siteCode || '-'} / {row.laneCode || '-'} / {row.deviceCode || '-'} | {new Date(row.updatedAt).toLocaleString('en-GB')}
                        </p>
                      </div>
                      <StatusBadge tone={row.status === 'FAILED' ? 'error' : row.status === 'SENT' ? 'success' : 'warning'} label={row.status} icon={false} />
                    </div>
                    {row.lastError ? <p className="mt-2 text-sm text-destructive">{row.lastError}</p> : null}
                  </button>
                ))}
              </div>
            </PageStateRenderer>
          </CardContent>
        </Card>

        <OutboxDetailPanel selected={selected} />
      </div>
    </div>
  )
}
