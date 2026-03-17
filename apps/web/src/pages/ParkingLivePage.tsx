import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw, Search, Wifi, WifiOff, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader, SurfaceState } from '@/components/ops/console'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { getSites } from '@/lib/api/topology'
import type { SiteRow } from '@parkly/contracts'
import { useParkingLiveData } from '@/features/parking-live/hooks/useParkingLiveData'
import { FloorTabs } from '@/features/parking-live/components/FloorTabs'
import { ParkingFloorBoard } from '@/features/parking-live/components/ParkingFloorBoard'
import { ParkingSlotDetailPanel } from '@/features/parking-live/components/ParkingSlotDetailPanel'
import { ParkingLiveSummaryBar } from '@/features/parking-live/components/ParkingLiveSummaryBar'
import { ParkingLegend } from '@/features/parking-live/components/ParkingLegend'
import { readTrimmedSearchParam, setQueryValue } from '@/lib/router/url-state'
import type { OccupancySummary, SlotViewModel } from '@/features/parking-live/types'

const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'All statuses', badge: 'all', badgeVariant: 'neutral' },
  { value: 'EMPTY', label: 'Empty', badge: 'free', badgeVariant: 'success' },
  { value: 'OCCUPIED_MATCHED', label: 'Matched', badge: 'used', badgeVariant: 'neutral' },
  { value: 'OCCUPIED_UNKNOWN', label: 'Unknown', badge: 'review', badgeVariant: 'warning' },
  { value: 'OCCUPIED_VIOLATION', label: 'Violation', badge: 'alert', badgeVariant: 'error' },
  { value: 'SENSOR_STALE', label: 'Stale', badge: 'stale', badgeVariant: 'neutral' },
  { value: 'RESERVED', label: 'Reserved', badge: 'hold', badgeVariant: 'neutral' },
  { value: 'BLOCKED', label: 'Blocked', badge: 'blocked', badgeVariant: 'neutral' },
]

function buildSiteOptions(sites: SiteRow[]): SelectOption[] {
  return [
    { value: '', label: 'Select site…' },
    ...sites.map((s) => ({
      value: s.siteCode,
      label: s.siteCode,
      description: s.name,
    })),
  ]
}

function ConnectionBanner({
  status,
  error,
  lastFetchedAt,
  onRefresh,
  refreshing,
}: {
  status: string
  error: string
  lastFetchedAt: string | null
  onRefresh: () => void
  refreshing: boolean
}) {
  if (status === 'ok' || status === 'loading' || status === 'idle') return null

  if (status === 'stale') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/8 px-4 py-3 text-sm text-primary">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          Parking live data is stale — realtime fell back to snapshot refresh. Last update: {lastFetchedAt ? new Date(lastFetchedAt).toLocaleTimeString('en-GB') : '—'}.
        </span>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Retry
        </Button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1">
          <p className="font-medium">Failed to load parking live data</p>
          {error ? <p className="mt-1 text-destructive/80">{error}</p> : null}
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>Retry</Button>
      </div>
    )
  }

  return null
}

function aggregateFromFloors(slots: SlotViewModel[]): OccupancySummary {
  return {
    total: slots.length,
    empty: slots.filter((slot) => slot.occupancyStatus === 'EMPTY').length,
    occupiedMatched: slots.filter((slot) => slot.occupancyStatus === 'OCCUPIED_MATCHED').length,
    occupiedUnknown: slots.filter((slot) => slot.occupancyStatus === 'OCCUPIED_UNKNOWN').length,
    occupiedViolation: slots.filter((slot) => slot.occupancyStatus === 'OCCUPIED_VIOLATION').length,
    sensorStale: slots.filter((slot) => slot.occupancyStatus === 'SENSOR_STALE').length,
    blocked: slots.filter((slot) => slot.occupancyStatus === 'BLOCKED').length,
    reserved: slots.filter((slot) => slot.occupancyStatus === 'RESERVED').length,
    occupiedTotal: slots.filter((slot) => slot.occupancyStatus === 'OCCUPIED_MATCHED' || slot.occupancyStatus === 'OCCUPIED_UNKNOWN' || slot.occupancyStatus === 'OCCUPIED_VIOLATION').length,
  }
}

export function ParkingLivePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sites, setSites] = useState<SiteRow[]>([])

  const siteCode = readTrimmedSearchParam(searchParams, 'siteCode')
  const floorKey = readTrimmedSearchParam(searchParams, 'floor')
  const statusFilter = readTrimmedSearchParam(searchParams, 'status')
  const spotId = readTrimmedSearchParam(searchParams, 'spot')
  const queryParam = readTrimmedSearchParam(searchParams, 'q')
  const [searchQuery, setSearchQuery] = useState(queryParam)
  const [refreshing, setRefreshing] = useState(false)

  const { floors, raw, summary, state, refresh, connectionStatus } = useParkingLiveData(siteCode)

  useEffect(() => {
    getSites()
      .then((res) => setSites(res.rows))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    setSearchQuery(queryParam)
  }, [queryParam])

  useEffect(() => {
    if (siteCode || sites.length === 0) return
    const fallbackSite = sites[0]?.siteCode
    if (!fallbackSite) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      setQueryValue(next, 'siteCode', fallbackSite)
      return next
    }, { replace: true })
  }, [siteCode, sites, setSearchParams])

  function setParam(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      setQueryValue(next, key, value || null)
      return next
    }, { replace: true })
  }

  async function handleRefresh(forceReconcile = false) {
    setRefreshing(true)
    await refresh(forceReconcile)
    setRefreshing(false)
  }

  const activeFloor = useMemo(() => {
    if (floors.length === 0) return null
    return floors.find((floor) => floor.floorKey === floorKey) ?? floors[0]
  }, [floors, floorKey])

  const selectedSlot = useMemo((): SlotViewModel | null => {
    if (!spotId || !activeFloor) return null
    return activeFloor.slots.find((slot) => slot.spotId === spotId) ?? null
  }, [spotId, activeFloor])

  const activeSummary = useMemo(() => {
    if (floorKey && activeFloor) return activeFloor.summary
    if (summary) return summary.summary
    return raw.length ? aggregateFromFloors(raw) : null
  }, [activeFloor, floorKey, raw, summary])

  const siteOptions = useMemo(() => buildSiteOptions(sites), [sites])

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Monitoring"
        title="Parking Live"
        description="Realtime slot occupancy by floor — sourced from Parking Live read-model routes and SSE invalidation."
        badges={[
          { label: 'sse + fallback poll', variant: 'outline' },
          { label: siteCode || 'no site', variant: 'secondary' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/70 px-3 py-1.5">
              {connectionStatus === 'ok' ? (
                <><Wifi className="h-3.5 w-3.5 text-success" /><span className="text-[11px] text-success">Realtime</span></>
              ) : connectionStatus === 'loading' ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /><span className="text-[11px] text-muted-foreground">Loading…</span></>
              ) : connectionStatus === 'stale' ? (
                <><WifiOff className="h-3.5 w-3.5 text-amber-400" /><span className="text-[11px] text-amber-400">Fallback</span></>
              ) : (
                <><WifiOff className="h-3.5 w-3.5 text-destructive" /><span className="text-[11px] text-destructive">Error</span></>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => void handleRefresh(true)} disabled={refreshing || !siteCode} title="Force backend refresh">
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        }
      />

      <ConnectionBanner
        status={connectionStatus}
        error={state.error}
        lastFetchedAt={state.lastFetchedAt}
        onRefresh={() => void handleRefresh(false)}
        refreshing={refreshing}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3">
        <div className="w-[180px]">
          <Select
            value={siteCode}
            onChange={(v) => {
              setParam('siteCode', v)
              setParam('floor', '')
              setParam('spot', '')
            }}
            options={siteOptions}
            placeholder="Select site…"
          />
        </div>

        <div className="w-[200px]">
          <Select
            value={statusFilter}
            onChange={(v) => setParam('status', v)}
            options={STATUS_FILTER_OPTIONS}
            placeholder="All statuses"
          />
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setParam('q', e.target.value)
            }}
            placeholder="Search slot code, zone, plate, subscription…"
            className="pl-8 font-mono-data text-sm"
          />
          {searchQuery ? (
            <button type="button" onClick={() => { setSearchQuery(''); setParam('q', '') }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {!siteCode ? (
        <SurfaceState title="Select a site" description="Choose a site from the toolbar to view parking occupancy." tone="empty" />
      ) : state.loading && floors.length === 0 ? (
        <SurfaceState title="Loading parking live data…" busy />
      ) : floors.length === 0 ? (
        <SurfaceState
          title="No parking live data"
          description="No parking-live slots were returned for this site. Refresh the board to rebuild the snapshot."
          tone="empty"
          action={{ label: 'Refresh now', onClick: () => void handleRefresh(true) }}
        />
      ) : (
        <>
          {activeSummary ? <ParkingLiveSummaryBar summary={activeSummary} /> : null}

          {floors.length > 1 ? (
            <FloorTabs floors={floors} activeFloorKey={activeFloor?.floorKey ?? ''} onChange={(key) => { setParam('floor', key); setParam('spot', '') }} />
          ) : null}

          <div className={`grid gap-5 ${selectedSlot ? 'xl:grid-cols-[1fr_320px]' : ''}`}>
            <div className="min-w-0">
              {activeFloor ? (
                <ParkingFloorBoard
                  floor={activeFloor}
                  selectedSpotId={spotId}
                  searchQuery={searchQuery}
                  statusFilter={statusFilter}
                  onSlotClick={(slot) => setParam('spot', slot.spotId === spotId ? '' : slot.spotId)}
                />
              ) : null}
            </div>

            {selectedSlot ? (
              <div className="xl:sticky xl:top-20 xl:self-start">
                <ParkingSlotDetailPanel slot={selectedSlot} siteCode={siteCode} onClose={() => setParam('spot', '')} />
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/50 px-4 py-3">
            <ParkingLegend />
          </div>
        </>
      )}
    </div>
  )
}
