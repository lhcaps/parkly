import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ops/console'
import { PageStateBlock } from '@/components/state/page-state'
import { Button } from '@/components/ui/button'
import { type SelectOption } from '@/components/ui/select'
import { getSites } from '@/lib/api/topology'
import type { SiteRow } from '@parkly/contracts'
import { useParkingLiveData } from '@/features/parking-live/hooks/useParkingLiveData'
import { FloorTabs } from '@/features/parking-live/components/FloorTabs'
import { ParkingFloorBoard } from '@/features/parking-live/components/ParkingFloorBoard'
import { ParkingSlotDetailPanel } from '@/features/parking-live/components/ParkingSlotDetailPanel'
import { ParkingConnectionBanner } from '@/features/parking-live/components/ParkingConnectionBanner'
import { ParkingLiveSummaryBar } from '@/features/parking-live/components/ParkingLiveSummaryBar'
import { ParkingLegend } from '@/features/parking-live/components/ParkingLegend'
import { ParkingLiveToolbar, type ParkingLiveAttentionItem } from '@/features/parking-live/components/ParkingLiveToolbar'
import { ParkingZoneSummaryStrip, type ParkingZoneSummaryItem } from '@/features/parking-live/components/ParkingZoneSummaryStrip'
import { ParkingLiveAttentionBar } from '@/features/parking-live/components/ParkingLiveAttentionBar'
import { normalizeEnumValue, readTrimmedSearchParam, setQueryValue } from '@/lib/router/url-state'
import type { OccupancySummary, SlotViewModel } from '@/features/parking-live/types'

const PARKING_STATUS_VALUES = [
  'EMPTY',
  'OCCUPIED_MATCHED',
  'OCCUPIED_UNKNOWN',
  'OCCUPIED_VIOLATION',
  'SENSOR_STALE',
  'RESERVED',
  'BLOCKED',
] as const

const DENSITY_VALUES = ['comfortable', 'compact'] as const

type DensityMode = (typeof DENSITY_VALUES)[number]

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

const DENSITY_OPTIONS: SelectOption[] = [
  { value: 'comfortable', label: 'Comfortable density', description: 'More context per tile', badge: 'default', badgeVariant: 'neutral' },
  { value: 'compact', label: 'Compact density', description: 'Fit more slots on screen', badge: 'dense', badgeVariant: 'neutral' },
]

function buildSiteOptions(sites: SiteRow[]): SelectOption[] {
  return [
    { value: '', label: 'Select site…' },
    ...sites.map<SelectOption>((site) => ({
      value: site.siteCode,
      label: site.siteCode,
      description: site.name,
      badge: site.isActive ? 'active' : 'off',
      badgeVariant: site.isActive ? 'success' : 'neutral',
    })),
  ]
}

function buildZoneOptions(zones: string[]): SelectOption[] {
  return [
    { value: '', label: 'All zones', badge: 'all', badgeVariant: 'neutral' },
    ...zones.map<SelectOption>((zone) => ({
      value: zone,
      label: `Zone ${zone}`,
    })),
  ]
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

function matchesStatus(slot: SlotViewModel, statusFilter: string) {
  return !statusFilter || slot.occupancyStatus === statusFilter
}

function matchesZone(slot: SlotViewModel, zoneFilter: string) {
  return !zoneFilter || slot.zoneCode === zoneFilter
}

export function ParkingLivePage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sites, setSites] = useState<SiteRow[]>([])

  const siteCode = readTrimmedSearchParam(searchParams, 'siteCode')
  const floorKey = readTrimmedSearchParam(searchParams, 'floor')
  const zoneFilter = readTrimmedSearchParam(searchParams, 'zone')
  const statusFilter = normalizeEnumValue(readTrimmedSearchParam(searchParams, 'status'), PARKING_STATUS_VALUES, '')
  const spotId = readTrimmedSearchParam(searchParams, 'spot')
  const queryParam = readTrimmedSearchParam(searchParams, 'q')
  const densityMode = normalizeEnumValue(readTrimmedSearchParam(searchParams, 'density'), DENSITY_VALUES, 'comfortable') as DensityMode
  const [searchQuery, setSearchQuery] = useState(queryParam)
  const [refreshing, setRefreshing] = useState(false)

  const { floors, raw, summary, state, refresh, connectionStatus, freshness } = useParkingLiveData(siteCode)

  useEffect(() => {
    getSites()
      .then((res) => setSites(res.rows))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    setSearchQuery(queryParam)
  }, [queryParam])

  const updateParams = (values: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(values).forEach(([key, value]) => setQueryValue(next, key, value))
      return next
    }, { replace: true })
  }

  useEffect(() => {
    if (siteCode || sites.length === 0) return
    const fallbackSite = sites[0]?.siteCode
    if (!fallbackSite) return
    updateParams({ siteCode: fallbackSite })
  }, [siteCode, sites])

  async function handleRefresh(forceReconcile = false) {
    setRefreshing(true)
    await refresh(forceReconcile)
    setRefreshing(false)
  }

  const floorForSpot = useMemo(() => {
    if (!spotId) return null
    return floors.find((floor) => floor.slots.some((slot) => slot.spotId === spotId)) ?? null
  }, [floors, spotId])

  const activeFloor = useMemo(() => {
    if (floors.length === 0) return null
    return floors.find((floor) => floor.floorKey === floorKey) ?? floorForSpot ?? floors[0]
  }, [floorForSpot, floorKey, floors])

  useEffect(() => {
    if (!spotId || !floorForSpot || floorKey) return
    updateParams({ floor: floorForSpot.floorKey })
  }, [spotId, floorForSpot, floorKey])

  useEffect(() => {
    if (!activeFloor || !zoneFilter) return
    if (!activeFloor.zones.includes(zoneFilter)) {
      updateParams({ zone: null, spot: null })
    }
  }, [activeFloor, zoneFilter])

  const activeZones = useMemo(() => {
    if (!activeFloor) return []
    return [...activeFloor.zones].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [activeFloor])

  const zoneOptions = useMemo(() => buildZoneOptions(activeZones), [activeZones])
  const siteOptions = useMemo(() => buildSiteOptions(sites), [sites])

  const selectedSlot = useMemo((): SlotViewModel | null => {
    if (!spotId || !activeFloor) return null
    const slot = activeFloor.slots.find((candidate) => candidate.spotId === spotId) ?? null
    if (!slot) return null
    if (!matchesStatus(slot, statusFilter) || !matchesZone(slot, zoneFilter)) return null
    return slot
  }, [spotId, activeFloor, statusFilter, zoneFilter])

  useEffect(() => {
    if (!spotId) return
    if (!selectedSlot) {
      updateParams({ spot: null })
    }
  }, [spotId, selectedSlot])

  const activeSummary = useMemo(() => {
    if (floorKey && activeFloor) return activeFloor.summary
    if (summary) return summary.summary
    return raw.length ? aggregateFromFloors(raw) : null
  }, [activeFloor, floorKey, raw, summary])

  const summaryLabel = floorKey && activeFloor
    ? `${activeFloor.label} snapshot`
    : `${summary?.site.name || siteCode || 'Parking live'} snapshot`

  const scopeSlots = useMemo(() => activeFloor?.slots ?? raw, [activeFloor, raw])

  const attentionItems = useMemo<ParkingLiveAttentionItem[]>(() => {
    const items: ParkingLiveAttentionItem[] = [
      {
        key: 'violation',
        label: 'Violation',
        count: scopeSlots.filter((slot) => slot.occupancyStatus === 'OCCUPIED_VIOLATION').length,
        statusValue: 'OCCUPIED_VIOLATION',
      },
      {
        key: 'stale',
        label: 'Stale',
        count: scopeSlots.filter((slot) => slot.occupancyStatus === 'SENSOR_STALE').length,
        statusValue: 'SENSOR_STALE',
      },
      {
        key: 'blocked',
        label: 'Blocked',
        count: scopeSlots.filter((slot) => slot.occupancyStatus === 'BLOCKED').length,
        statusValue: 'BLOCKED',
      },
      {
        key: 'reserved',
        label: 'Reserved',
        count: scopeSlots.filter((slot) => slot.occupancyStatus === 'RESERVED').length,
        statusValue: 'RESERVED',
      },
    ]

    return items.filter((item) => item.count > 0)
  }, [scopeSlots])

  const zoneSummaryItems = useMemo<ParkingZoneSummaryItem[]>(() => {
    if (!activeFloor) return []
    return activeZones.map((zoneCode) => {
      const zoneSlots = activeFloor.slots.filter((slot) => slot.zoneCode === zoneCode)
      return {
        zoneCode,
        total: zoneSlots.length,
        occupied: zoneSlots.filter((slot) => slot.occupancyStatus === 'OCCUPIED_MATCHED' || slot.occupancyStatus === 'OCCUPIED_UNKNOWN' || slot.occupancyStatus === 'OCCUPIED_VIOLATION').length,
        stale: zoneSlots.filter((slot) => slot.occupancyStatus === 'SENSOR_STALE').length,
        blocked: zoneSlots.filter((slot) => slot.occupancyStatus === 'BLOCKED').length,
        reserved: zoneSlots.filter((slot) => slot.occupancyStatus === 'RESERVED').length,
        violation: zoneSlots.filter((slot) => slot.occupancyStatus === 'OCCUPIED_VIOLATION').length,
      }
    })
  }, [activeFloor, activeZones])

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('navGroup.Monitoring')}
        title={t('route.parkingLive.label')}
        description={t('route.parkingLive.description')}
        badges={[
          {
            label:
              freshness.status === 'connected'
                ? t('parkingLivePage.badges.realtime')
                : freshness.status === 'stale'
                  ? t('parkingLivePage.badges.snapshotFallback')
                  : t('parkingLivePage.badges.resilience'),
            variant: 'outline',
          },
          { label: siteCode || t('parkingLivePage.badges.noSite'), variant: 'secondary' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                {connectionStatus === 'connected' ? (
                  <><Wifi className="h-3.5 w-3.5 text-success" /><span className="text-[11px] text-success">Realtime</span></>
                ) : connectionStatus === 'loading' || connectionStatus === 'retrying' ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /><span className="text-[11px] text-muted-foreground">Recovering…</span></>
                ) : connectionStatus === 'stale' ? (
                  <><WifiOff className="h-3.5 w-3.5 text-amber-400" /><span className="text-[11px] text-amber-400">Stale snapshot</span></>
                ) : (
                  <><WifiOff className="h-3.5 w-3.5 text-destructive" /><span className="text-[11px] text-destructive">No live data</span></>
                )}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                snapshot {freshness.lastFetchedAt ? new Date(freshness.lastFetchedAt).toLocaleTimeString('en-GB') : '—'}
                {freshness.lastReconciledAt ? ` · reconciled ${new Date(freshness.lastReconciledAt).toLocaleTimeString('en-GB')}` : ''}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void handleRefresh(true)} disabled={refreshing || !siteCode} title="Force backend refresh">
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        }
      />

      <ParkingConnectionBanner
        freshness={freshness}
        onRefresh={(force) => void handleRefresh(Boolean(force))}
        refreshing={refreshing}
      />

      <ParkingLiveToolbar
        siteCode={siteCode}
        siteOptions={siteOptions}
        statusFilter={statusFilter}
        statusOptions={STATUS_FILTER_OPTIONS}
        zoneFilter={zoneFilter}
        zoneOptions={zoneOptions}
        densityMode={densityMode}
        densityOptions={DENSITY_OPTIONS}
        searchQuery={searchQuery}
        attentionItems={attentionItems}
        onSiteChange={(value) => updateParams({ siteCode: value, floor: null, zone: null, spot: null, status: null, q: null })}
        onStatusChange={(value) => updateParams({ status: value || null, spot: null })}
        onZoneChange={(value) => updateParams({ zone: value || null, spot: null })}
        onDensityChange={(value) => updateParams({ density: value })}
        onSearchChange={(value) => {
          setSearchQuery(value)
          updateParams({ q: value || null })
        }}
        onClearSearch={() => {
          setSearchQuery('')
          updateParams({ q: null })
        }}
        onClearFilters={() => {
          setSearchQuery('')
          updateParams({ status: null, zone: null, q: null, density: 'comfortable', spot: null })
        }}
      />

      {!siteCode ? (
        <PageStateBlock
          variant="empty"
          title="Select a site"
          description="Choose a site from the toolbar to view parking occupancy."
        />
      ) : state.loading && floors.length === 0 ? (
        <PageStateBlock
          variant="loading"
          title="Loading parking live data"
          description="Fetching the authoritative parking snapshot for the selected site."
        />
      ) : state.error && floors.length === 0 ? (
        <PageStateBlock
          variant="error"
          title="Parking Live snapshot unavailable"
          description={state.error}
          requestId={freshness.requestIdHint ?? undefined}
          hint="The board could not load its authoritative snapshot. Retry the request or inspect the API path for this site."
          onRetry={() => void handleRefresh(true)}
          retryLabel="Retry snapshot"
        />
      ) : floors.length === 0 ? (
        <PageStateBlock
          variant="empty"
          title="No parking live data"
          description="No parking-live slots were returned for this site. This is an empty business result, not necessarily a dependency failure. Refresh the board to rebuild the snapshot."
          onRetry={() => void handleRefresh(true)}
          retryLabel="Refresh now"
        />
      ) : (
        <>
          {activeSummary ? <ParkingLiveSummaryBar summary={activeSummary} label={summaryLabel} /> : null}

          <ParkingLiveAttentionBar
            items={attentionItems}
            activeStatus={statusFilter}
            onSelect={(value) => updateParams({ status: value || null, spot: null })}
          />

          {floors.length > 1 ? (
            <FloorTabs floors={floors} activeFloorKey={activeFloor?.floorKey ?? ''} onChange={(key) => updateParams({ floor: key, zone: null, spot: null })} />
          ) : null}

          {activeFloor ? (
            <ParkingZoneSummaryStrip
              items={zoneSummaryItems}
              activeZone={zoneFilter}
              onSelect={(zoneCode) => updateParams({ zone: zoneCode || null, spot: null })}
            />
          ) : null}

          <div className={`grid gap-5 ${selectedSlot ? 'xl:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
            <div className="min-w-0">
              {activeFloor ? (
                <ParkingFloorBoard
                  floor={activeFloor}
                  selectedSpotId={spotId}
                  searchQuery={searchQuery}
                  statusFilter={statusFilter}
                  zoneFilter={zoneFilter}
                  densityMode={densityMode}
                  onSlotClick={(slot) => updateParams({ spot: slot.spotId === spotId ? null : slot.spotId })}
                />
              ) : null}
            </div>

            {selectedSlot ? (
              <div className="xl:sticky xl:top-20 xl:self-start">
                <ParkingSlotDetailPanel slot={selectedSlot} siteCode={siteCode} onClose={() => updateParams({ spot: null })} />
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
