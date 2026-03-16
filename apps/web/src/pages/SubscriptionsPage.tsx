import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Building2,
  Car,
  ChevronRight,
  Loader2,
  MapPin,
  RefreshCw,
  User,
  X,
} from 'lucide-react'
import { PageHeader, SurfaceState, InlineMessage, FilterCard } from '@/components/ops/console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getSubscriptionDetail, getSubscriptions, patchSubscription } from '@/features/subscriptions/api/subscriptions'
import { getSites } from '@/lib/api/topology'
import { getMe } from '@/lib/api/system'
import { toAppErrorDisplay } from '@/lib/http/errors'
import { readTrimmedSearchParam, setQueryValue } from '@/lib/router/url-state'
import type { SiteRow } from '@/lib/contracts/topology'
import type {
  SubscriptionDetail,
  SubscriptionEffectiveStatus,
  SubscriptionRow,
} from '@/features/subscriptions/types'

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'ACTIVE', badge: 'active', badgeVariant: 'entry' },
  { value: 'EXPIRED', label: 'EXPIRED', badge: 'expired', badgeVariant: 'muted' },
  { value: 'SUSPENDED', label: 'SUSPENDED', badge: 'suspended', badgeVariant: 'amber' },
  { value: 'CANCELLED', label: 'CANCELLED', badge: 'cancelled', badgeVariant: 'destructive' },
]

function statusVariant(s: string): 'entry' | 'amber' | 'destructive' | 'muted' | 'outline' {
  if (s === 'ACTIVE') return 'entry'
  if (s === 'SUSPENDED') return 'amber'
  if (s === 'CANCELLED') return 'destructive'
  if (s === 'EXPIRED') return 'muted'
  return 'outline'
}

function planVariant(p: string): 'secondary' | 'outline' {
  return p === 'VIP' ? 'secondary' : 'outline'
}

function fmtDate(v: string | null | undefined) {
  if (!v) return '—'
  return v.slice(0, 10)
}

function buildSiteOptions(sites: SiteRow[]): SelectOption[] {
  return [
    { value: '', label: 'All sites' },
    ...sites.map((s) => ({
      value: s.siteCode,
      label: s.siteCode,
      description: s.name,
      badge: s.isActive ? 'active' : 'off',
      badgeVariant: s.isActive ? ('success' as const) : ('neutral' as const),
    })),
  ]
}

// ─── Sub-components ────────────────────────────────────────────

function SubscriptionStatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{status}</Badge>
}

function SpotsTab({ spots }: { spots: SubscriptionDetail['spots'] }) {
  if (spots.length === 0) {
    return (
      <SurfaceState
        title="No spots linked"
        description="This subscription has no active spot assignments."
        tone="empty"
        className="min-h-[120px]"
      />
    )
  }
  return (
    <div className="space-y-2">
      {spots.map((spot) => (
        <div
          key={spot.subscriptionSpotId}
          className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/40 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">{spot.spotCode}</p>
              <p className="text-xs text-muted-foreground">Zone {spot.zoneCode} · {spot.assignedMode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {spot.isPrimary ? <Badge variant="secondary">primary</Badge> : null}
            <Badge variant={spot.status === 'ACTIVE' ? 'entry' : spot.status === 'SUSPENDED' ? 'amber' : 'muted'}>
              {spot.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  )
}

function VehiclesTab({ vehicles }: { vehicles: SubscriptionDetail['vehicles'] }) {
  if (vehicles.length === 0) {
    return (
      <SurfaceState
        title="No vehicles linked"
        description="This subscription has no active vehicle registrations."
        tone="empty"
        className="min-h-[120px]"
      />
    )
  }
  return (
    <div className="space-y-2">
      {vehicles.map((v) => (
        <div
          key={v.subscriptionVehicleId}
          className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/40 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <Car className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-mono-data text-sm font-medium text-foreground">
                {v.plateCompact || '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                vehicleId {v.vehicleId}
                {v.validFrom ? ` · from ${fmtDate(v.validFrom)}` : ''}
                {v.validTo ? ` to ${fmtDate(v.validTo)}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {v.isPrimary ? <Badge variant="secondary">primary</Badge> : null}
            <Badge variant={v.status === 'ACTIVE' ? 'entry' : v.status === 'SUSPENDED' ? 'amber' : 'muted'}>
              {v.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  )
}

function OverviewTab({ detail }: { detail: SubscriptionDetail }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {[
          { label: 'Subscription ID', value: detail.subscriptionId },
          { label: 'Site', value: `${detail.siteCode} · ${detail.siteName}` },
          { label: 'Customer', value: detail.customerName },
          { label: 'Customer ID', value: detail.customerId },
          { label: 'Phone', value: detail.customerPhone || '—' },
          { label: 'Plan type', value: detail.planType },
          { label: 'Start date', value: fmtDate(detail.startDate) },
          { label: 'End date', value: fmtDate(detail.endDate) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-border/60 bg-background/40 p-3">
            <p className="text-[10px] font-mono-data uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
            <p className="mt-1 break-all text-sm text-foreground">{value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <span>{detail.spots.length} spot{detail.spots.length !== 1 ? 's' : ''}</span>
        <span className="text-border">·</span>
        <span>{detail.vehicles.length} vehicle{detail.vehicles.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────

export function SubscriptionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const siteCode = readTrimmedSearchParam(searchParams, 'siteCode')
  const statusParam = readTrimmedSearchParam(searchParams, 'status') as SubscriptionEffectiveStatus | ''
  const plate = readTrimmedSearchParam(searchParams, 'plate')
  const selectedId = readTrimmedSearchParam(searchParams, 'id')
  const activeTab = readTrimmedSearchParam(searchParams, 'tab') || 'overview'

  const [plateInput, setPlateInput] = useState(plate)
  const deferredPlate = useDeferredValue(plate)

  const [sites, setSites] = useState<SiteRow[]>([])
  const [rows, setRows] = useState<SubscriptionRow[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [operatorRole, setOperatorRole] = useState('')

  const [detail, setDetail] = useState<SubscriptionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const [patchBusy, setPatchBusy] = useState(false)
  const [patchError, setPatchError] = useState('')
  const [patchSuccess, setPatchSuccess] = useState('')

  const detailAbort = useRef<AbortController | null>(null)

  // Bootstrap sites + role
  useEffect(() => {
    Promise.all([getSites(), getMe()])
      .then(([siteRes, me]) => {
        setSites(siteRes.rows)
        setOperatorRole(me.role)
      })
      .catch(() => undefined)
  }, [])

  // Load subscription list
  const loadList = useCallback(async () => {
    setLoading(true)
    setListError('')
    try {
      const res = await getSubscriptions({
        siteCode: siteCode || undefined,
        status: statusParam || undefined,
        plate: deferredPlate || undefined,
        limit: 100,
      })
      setRows(res.rows)
      setNextCursor(res.nextCursor)
    } catch (err) {
      const d = toAppErrorDisplay(err, 'Failed to load subscriptions')
      setListError(d.message + (d.requestId ? ` (requestId: ${d.requestId})` : ''))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [siteCode, statusParam, deferredPlate])

  useEffect(() => { void loadList() }, [loadList])

  // Load detail when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setDetailError('')
      return
    }
    if (detailAbort.current) detailAbort.current.abort()
    detailAbort.current = new AbortController()
    setDetailLoading(true)
    setDetailError('')
    setDetail(null)
    getSubscriptionDetail(selectedId)
      .then((d) => {
        setDetail(d)
        setDetailLoading(false)
      })
      .catch((err) => {
        const d = toAppErrorDisplay(err, 'Failed to load detail')
        setDetailError(d.message + (d.requestId ? ` (requestId: ${d.requestId})` : ''))
        setDetailLoading(false)
      })
  }, [selectedId])

  function setParam(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      setQueryValue(next, key, value || null)
      return next
    }, { replace: true })
  }

  function selectRow(id: string) {
    setParam('id', id)
    setParam('tab', 'overview')
    setPatchError('')
    setPatchSuccess('')
  }

  function resetFilters() {
    setSearchParams({}, { replace: true })
    setPlateInput('')
  }

  async function handlePatchStatus(newStatus: string) {
    if (!selectedId || !detail) return
    setPatchBusy(true)
    setPatchError('')
    setPatchSuccess('')
    try {
      const updated = await patchSubscription(selectedId, { status: newStatus as any })
      setDetail(updated)
      setRows((prev) => prev.map((r) => r.subscriptionId === selectedId ? { ...r, status: updated.status, effectiveStatus: updated.effectiveStatus } : r))
      setPatchSuccess(`Status updated to ${newStatus}.`)
    } catch (err) {
      const d = toAppErrorDisplay(err, 'Update failed')
      setPatchError(d.message + (d.requestId ? ` (requestId: ${d.requestId})` : ''))
    } finally {
      setPatchBusy(false)
    }
  }

  const siteOptions = useMemo(() => buildSiteOptions(sites), [sites])

  const canMutate = operatorRole === 'ADMIN' || operatorRole === 'OPS'

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Subscriptions"
        description="Manage parking subscriptions — vehicles, spot assignments, and status."
        badges={[
          { label: 'admin', variant: 'secondary' },
          { label: operatorRole || '—', variant: 'muted' },
        ]}
        actions={
          <Button variant="outline" onClick={() => void loadList()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      {/* Filter bar */}
      <FilterCard
        className="ops-sticky-bar"
        contentClassName="pt-0"
        title="Filters"
        description="Filter by site, status, and plate."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadList()} disabled={loading}>Refresh</Button>
            <Button variant="ghost" size="sm" onClick={resetFilters}>Reset</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={siteCode} onChange={(v) => setParam('siteCode', v)} options={siteOptions} placeholder="All sites" disabled={loading} />
            <Select value={statusParam} onChange={(v) => setParam('status', v)} options={STATUS_OPTIONS} placeholder="All statuses" disabled={loading} />
            <form
              onSubmit={(e) => { e.preventDefault(); setParam('plate', plateInput.trim().toUpperCase()) }}
              className="flex gap-2"
            >
              <Input
                value={plateInput}
                onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
                placeholder="Filter by plate"
                className="flex-1 font-mono-data"
              />
              {plateInput ? (
                <Button type="button" variant="ghost" size="icon" onClick={() => { setPlateInput(''); setParam('plate', '') }}>
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </form>
          </div>
        </div>
      </FilterCard>

      {/* List + detail split */}
      <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">

        {/* LEFT: list */}
        <div className="space-y-3">
          {listError ? (
            <InlineMessage tone="error">{listError}</InlineMessage>
          ) : null}

          {loading ? (
            <SurfaceState title="Loading subscriptions…" busy />
          ) : rows.length === 0 ? (
            <SurfaceState
              title="No subscriptions found"
              description="Adjust the filters or select a different site."
              tone="empty"
              action={{ label: 'Reset filters', onClick: resetFilters }}
            />
          ) : (
            <div className="space-y-1.5">
              {rows.map((row) => {
                const isSelected = row.subscriptionId === selectedId
                return (
                  <button
                    key={row.subscriptionId}
                    type="button"
                    onClick={() => selectRow(row.subscriptionId)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-all hover:border-primary/30 hover:bg-primary/5 ${
                      isSelected
                        ? 'border-primary/40 bg-primary/8 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]'
                        : 'border-border/70 bg-card/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <SubscriptionStatusBadge status={row.effectiveStatus} />
                          <Badge variant={planVariant(row.planType)}>{row.planType}</Badge>
                          <span className="font-mono-data text-[11px] text-muted-foreground">{row.subscriptionId}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <p className="truncate text-sm font-medium text-foreground">{row.customerName}</p>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">{row.siteCode}</p>
                          <span className="text-muted-foreground/40">·</span>
                          <p className="text-xs text-muted-foreground">{fmtDate(row.startDate)} — {fmtDate(row.endDate)}</p>
                        </div>
                      </div>
                      <ChevronRight className={`mt-1 h-4 w-4 shrink-0 transition-colors ${isSelected ? 'text-primary' : 'text-muted-foreground/40'}`} />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT: detail */}
        <div className="xl:sticky xl:top-20 xl:self-start">
          {!selectedId ? (
            <Card className="border-border/80 bg-card/95">
              <CardContent className="pt-6">
                <SurfaceState
                  title="Select a subscription"
                  description="Click a row on the left to view details, spots, and vehicles."
                  tone="empty"
                />
              </CardContent>
            </Card>
          ) : detailLoading ? (
            <Card className="border-border/80 bg-card/95">
              <CardContent className="pt-6">
                <SurfaceState title="Loading detail…" busy />
              </CardContent>
            </Card>
          ) : detailError ? (
            <Card className="border-border/80 bg-card/95">
              <CardContent className="pt-6">
                <InlineMessage tone="error">{detailError}</InlineMessage>
              </CardContent>
            </Card>
          ) : detail ? (
            <Card className="border-border/80 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold">{detail.customerName}</CardTitle>
                    <CardDescription>{detail.siteCode} · {detail.siteName}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setParam('id', '')} title="Close detail">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SubscriptionStatusBadge status={detail.effectiveStatus} />
                  <Badge variant={planVariant(detail.planType)}>{detail.planType}</Badge>
                  <Badge variant="outline">{fmtDate(detail.startDate)} — {fmtDate(detail.endDate)}</Badge>
                </div>

                {/* Status action bar — only for ADMIN/OPS and non-terminal mutations */}
                {canMutate && detail.effectiveStatus !== 'CANCELLED' ? (
                  <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-3 space-y-2">
                    <p className="text-[10px] font-mono-data uppercase tracking-[0.16em] text-muted-foreground">Change status</p>
                    <div className="flex flex-wrap gap-2">
                      {(['ACTIVE', 'SUSPENDED', 'CANCELLED'] as const)
                        .filter((s) => s !== detail.effectiveStatus)
                        .map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={s === 'CANCELLED' ? 'destructive' : s === 'SUSPENDED' ? 'outline' : 'secondary'}
                            disabled={patchBusy}
                            onClick={() => void handlePatchStatus(s)}
                          >
                            {patchBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            → {s}
                          </Button>
                        ))}
                    </div>
                    {patchError ? <InlineMessage tone="error">{patchError}</InlineMessage> : null}
                    {patchSuccess ? <InlineMessage tone="success">{patchSuccess}</InlineMessage> : null}
                  </div>
                ) : null}
              </CardHeader>

              <CardContent>
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setParam('tab', v)}
                >
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="spots">Spots ({detail.spots.length})</TabsTrigger>
                    <TabsTrigger value="vehicles">Vehicles ({detail.vehicles.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-4">
                    <OverviewTab detail={detail} />
                  </TabsContent>
                  <TabsContent value="spots" className="mt-4">
                    <SpotsTab spots={detail.spots} />
                  </TabsContent>
                  <TabsContent value="vehicles" className="mt-4">
                    <VehiclesTab vehicles={detail.vehicles} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
