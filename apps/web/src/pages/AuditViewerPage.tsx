import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRightLeft, Loader2, RefreshCw, SearchCode, ShieldCheck } from 'lucide-react'
import { InlineMessage, PageHeader, SurfaceState } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuditDetailPanel } from '@/features/audit-viewer/components/AuditDetailPanel'
import { AuditFilterBar } from '@/features/audit-viewer/components/AuditFilterBar'
import { AuditTable } from '@/features/audit-viewer/components/AuditTable'
import {
  matchesAuditKeyword,
  matchesAuditQuickFilter,
  type AuditQuickFilter,
} from '@/features/audit-viewer/audit-viewer-model'
import { getAuditRecordDetail, getAuditRecords } from '@/lib/api/audit'
import { getSites } from '@/lib/api/topology'
import type { AuditRecord } from '@/lib/contracts/audit'
import type { SiteRow } from '@/lib/contracts/topology'
import { measureAsync } from '@/lib/query/perf'

const ROOT_CURSOR = '__ROOT__'
const WINDOW_LIMIT = 50

function buildAuditSearchParams(args: {
  siteCode: string
  quickFilter: AuditQuickFilter
  action: string
  keyword: string
  correlationId: string
  requestId: string
  entityTable: string
  entityId: string
  actorUserId: string
  selectedAuditId: string
}) {
  const next = new URLSearchParams()
  if (args.siteCode) next.set('siteCode', args.siteCode)
  if (args.quickFilter !== 'all') next.set('quick', args.quickFilter)
  if (args.action) next.set('action', args.action)
  if (args.keyword) next.set('q', args.keyword)
  if (args.correlationId) next.set('correlationId', args.correlationId)
  if (args.requestId) next.set('requestId', args.requestId)
  if (args.entityTable) next.set('entityTable', args.entityTable)
  if (args.entityId) next.set('entityId', args.entityId)
  if (args.actorUserId) next.set('actorUserId', args.actorUserId)
  if (args.selectedAuditId) next.set('auditId', args.selectedAuditId)
  return next
}

export function AuditViewerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sites, setSites] = useState<SiteRow[]>([])
  const [siteCode, setSiteCode] = useState(searchParams.get('siteCode') ?? '')
  const [quickFilter, setQuickFilter] = useState<AuditQuickFilter>((searchParams.get('quick') as AuditQuickFilter) || 'all')
  const [action, setAction] = useState(searchParams.get('action') ?? '')
  const [keyword, setKeyword] = useState(searchParams.get('q') ?? '')
  const [correlationId, setCorrelationId] = useState(searchParams.get('correlationId') ?? '')
  const [requestId, setRequestId] = useState(searchParams.get('requestId') ?? '')
  const [entityTable, setEntityTable] = useState(searchParams.get('entityTable') ?? '')
  const [entityId, setEntityId] = useState(searchParams.get('entityId') ?? '')
  const [actorUserId, setActorUserId] = useState(searchParams.get('actorUserId') ?? '')
  const [rows, setRows] = useState<AuditRecord[]>([])
  const [selectedAuditId, setSelectedAuditId] = useState(searchParams.get('auditId') ?? '')
  const [selectedDetail, setSelectedDetail] = useState<AuditRecord | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [cursorMap, setCursorMap] = useState<Record<string, string | null>>({ [ROOT_CURSOR]: null })
  const [cursorKey, setCursorKey] = useState(ROOT_CURSOR)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const deferredKeyword = useDeferredValue(keyword)

  async function load(overrideCursorKey?: string) {
    const targetCursorKey = overrideCursorKey ?? cursorKey
    const cursor = cursorMap[targetCursorKey] ?? null
    setLoading(true)
    try {
      const [siteRes, auditRes] = await Promise.all([
        getSites(),
        measureAsync('audit-refresh', () => getAuditRecords({
          siteCode: siteCode || undefined,
          actorUserId: actorUserId || undefined,
          action: action || undefined,
          entityTable: entityTable || undefined,
          entityId: entityId || undefined,
          requestId: requestId || undefined,
          correlationId: correlationId || undefined,
          limit: WINDOW_LIMIT,
          cursor: cursor || undefined,
        }), [siteCode || 'all', action || 'all', requestId || 'none', correlationId || 'none', targetCursorKey].join(':')),
      ])

      setSites(siteRes.rows)
      setRows(auditRes.rows)
      setNextCursor(auditRes.nextCursor)
      setCursorMap((prev) => ({ ...prev, [targetCursorKey]: cursor, ...(auditRes.nextCursor ? { [`${targetCursorKey}:next`]: auditRes.nextCursor } : {}) }))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }

  async function openDetail(auditId: string) {
    if (!auditId) {
      setSelectedDetail(null)
      return
    }
    setDetailLoading(true)
    try {
      const detail = await measureAsync('audit-detail-open', () => getAuditRecordDetail(auditId), auditId)
      setSelectedDetail(detail)
      setDetailError('')
    } catch (detailLoadError) {
      setDetailError(detailLoadError instanceof Error ? detailLoadError.message : String(detailLoadError))
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    void load(ROOT_CURSOR)
    setCursorKey(ROOT_CURSOR)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedAuditId) {
      setSelectedDetail(null)
      return
    }
    void openDetail(selectedAuditId)
  }, [selectedAuditId])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => matchesAuditQuickFilter(row, quickFilter) && matchesAuditKeyword(row, deferredKeyword))
  }, [deferredKeyword, quickFilter, rows])

  const requestLinked = filteredRows.filter((row) => row.requestId).length
  const correlationLinked = filteredRows.filter((row) => row.correlationId).length
  const manualLinked = filteredRows.filter((row) => row.action.includes('MANUAL') || row.action.includes('OVERRIDE')).length

  function applyFilters() {
    const next = buildAuditSearchParams({ siteCode, quickFilter, action, keyword, correlationId, requestId, entityTable, entityId, actorUserId, selectedAuditId })
    setSearchParams(next)
    setCursorMap({ [ROOT_CURSOR]: null })
    setCursorKey(ROOT_CURSOR)
    void load(ROOT_CURSOR)
  }

  function resetFilters() {
    setSiteCode('')
    setQuickFilter('all')
    setAction('')
    setKeyword('')
    setCorrelationId('')
    setRequestId('')
    setEntityTable('')
    setEntityId('')
    setActorUserId('')
    setSelectedAuditId('')
    setSelectedDetail(null)
    setSearchParams(new URLSearchParams())
    setCursorMap({ [ROOT_CURSOR]: null })
    setCursorKey(ROOT_CURSOR)
    void load(ROOT_CURSOR)
  }

  function handleSelect(row: AuditRecord) {
    setSelectedAuditId(row.auditId)
    setSearchParams(buildAuditSearchParams({ siteCode, quickFilter, action, keyword, correlationId, requestId, entityTable, entityId, actorUserId, selectedAuditId: row.auditId }))
  }

  async function handlePage(direction: 'next' | 'prev') {
    if (direction === 'next' && nextCursor) {
      const nextKey = `${cursorKey}:next`
      setCursorMap((prev) => ({ ...prev, [nextKey]: nextCursor }))
      setCursorKey(nextKey)
      await load(nextKey)
      return
    }

    if (direction === 'prev') {
      const parts = cursorKey.split(':')
      if (parts.length <= 1) return
      const prevKey = parts.slice(0, -1).join(':') || ROOT_CURSOR
      setCursorKey(prevKey)
      await load(prevKey)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Viewer"
        description="Audit workspace for operators and OPS. Trace request chains, correlations, actors, and entity changes.ff snapshot để biết hệ thống vừa làm gì, ai làm và ảnh hưởng tới entity nào."
        badges={[
          { label: `rows ${filteredRows.length}`, variant: 'muted' },
          { label: `request linked ${requestLinked}`, variant: requestLinked > 0 ? 'secondary' : 'outline' },
          { label: `correlation linked ${correlationLinked}`, variant: correlationLinked > 0 ? 'secondary' : 'outline' },
          { label: `manual ${manualLinked}`, variant: manualLinked > 0 ? 'amber' : 'outline' },
        ]}
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 bg-card/95">
          <CardContent className="pt-5">
            <div className="mb-2 flex items-center gap-2">
              <SearchCode className="h-4 w-4 text-primary" />
              <p className="font-medium">Correlation lookup</p>
            </div>
            <p className="text-sm text-muted-foreground">Filter by correlation ID or request ID to trace chains across lane actions and downstream.i chuỗi giữa lane action, review action và outbox fail.</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardContent className="pt-5">
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="font-medium">Before / after snapshot</p>
            </div>
            <p className="text-sm text-muted-foreground">The detail panel breaks down actor, entity, changed fields, and diff for full operator context.actor, entity, changed keys và snapshot để operator đọc nhanh hơn.</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardContent className="pt-5">
            <div className="mb-2 flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              <p className="font-medium">Cross-surface handoff</p>
            </div>
            <p className="text-sm text-muted-foreground">Jump from an audit record to the outbox or session history via correlation ID.on history theo đúng correlation/request đang điều tra.</p>
          </CardContent>
        </Card>
      </div>

      <AuditFilterBar
        sites={sites}
        siteCode={siteCode}
        quickFilter={quickFilter}
        action={action}
        keyword={keyword}
        correlationId={correlationId}
        requestId={requestId}
        entityTable={entityTable}
        entityId={entityId}
        actorUserId={actorUserId}
        onSiteCodeChange={setSiteCode}
        onQuickFilterChange={setQuickFilter}
        onActionChange={setAction}
        onKeywordChange={setKeyword}
        onCorrelationIdChange={setCorrelationId}
        onRequestIdChange={setRequestId}
        onEntityTableChange={setEntityTable}
        onEntityIdChange={setEntityId}
        onActorUserIdChange={setActorUserId}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={loading}
      />

      {error ? <InlineMessage message={error} tone="error" /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle>Audit list</CardTitle>
            <CardDescription>Scan actions, actors, entities, and correlations. Client-side filter covers the current page only. dùng để quét nhanh trong window hiện tại; filter API giữ vai trò authoritative.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-[11px] font-mono-data text-muted-foreground">
              <Badge variant="outline">window={rows.length}</Badge>
              <Badge variant="outline">visible={filteredRows.length}</Badge>
              <Badge variant={manualLinked > 0 ? 'amber' : 'outline'}>manual={manualLinked}</Badge>
              <Badge variant={correlationLinked > 0 ? 'secondary' : 'outline'}>correlation={correlationLinked}</Badge>
            </div>

            {loading ? (
              <SurfaceState title="Loading audit list" tone="loading" className="min-h-[220px]" />
            ) : filteredRows.length === 0 ? (
              <SurfaceState title="No matching audit records" description="Try widening filters or searching by request ID or correlation ID." className="min-h-[220px]" />
            ) : (
              <AuditTable rows={filteredRows} selectedAuditId={selectedAuditId} onSelect={handleSelect} />
            )}

            <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
              <Button variant="outline" size="sm" onClick={() => void handlePage('prev')} disabled={loading || cursorKey === ROOT_CURSOR}>Previous</Button>
              <p className="text-xs text-muted-foreground">Cursor window: {cursorKey === ROOT_CURSOR ? 'root' : cursorKey}</p>
              <Button variant="outline" size="sm" onClick={() => void handlePage('next')} disabled={loading || !nextCursor}>Next</Button>
            </div>
          </CardContent>
        </Card>

        <AuditDetailPanel selected={selectedDetail} loading={detailLoading} error={detailError} onRefresh={() => void openDetail(selectedAuditId)} />
      </div>
    </div>
  )
}
