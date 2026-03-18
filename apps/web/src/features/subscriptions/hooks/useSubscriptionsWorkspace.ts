import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getSites } from '@/lib/api/topology'
import { getMe } from '@/lib/api/system'
import { classifyApiError, toAppErrorDisplay } from '@/lib/http/errors'
import {
  buildSearchParams,
  normalizeEnumValue,
  normalizeSearchText,
  normalizeSearchTextInput,
  readTrimmedSearchParam,
  syncSearchParams,
} from '@/lib/router/url-state'
import type { SiteRow } from '@/lib/contracts/topology'
import {
  getSubscriptionDetail,
  getSubscriptions,
} from '../api/subscriptions'
import type {
  SubscriptionDetail,
  SubscriptionEffectiveStatus,
  SubscriptionRow,
} from '../types'

const SUBSCRIPTION_TAB_VALUES = ['overview', 'spots', 'vehicles'] as const
export type SubscriptionWorkspaceTab = (typeof SUBSCRIPTION_TAB_VALUES)[number]

const STATUS_VALUES = ['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'] as const

type WorkspaceQueryState = {
  siteCode: string
  status: SubscriptionEffectiveStatus | ''
  plate: string
  selectedId: string
  activeTab: SubscriptionWorkspaceTab
}

type ListState = {
  rows: SubscriptionRow[]
  nextCursor: string | null
  loading: boolean
  loadingMore: boolean
  error: string
}

type DetailState = {
  data: SubscriptionDetail | null
  loading: boolean
  error: string
}

type SelectionState = {
  reason: string
}

export type SubscriptionsWorkspaceResult = {
  query: WorkspaceQueryState
  plateInput: string
  setPlateInput: (value: string) => void
  sites: SiteRow[]
  operatorRole: string
  list: ListState
  detail: DetailState
  selection: SelectionState
  canMutate: boolean
  reloadList: () => Promise<void>
  reloadDetail: (subscriptionId?: string) => Promise<void>
  loadMore: () => Promise<void>
  retryDetail: () => Promise<void>
  applyFilters: (input: { siteCode?: string; status?: SubscriptionEffectiveStatus | ''; plate?: string }) => void
  resetFilters: () => void
  selectRow: (subscriptionId: string, options?: { siteCode?: string; status?: SubscriptionEffectiveStatus | ''; plate?: string; activeTab?: SubscriptionWorkspaceTab }) => void
  focusSubscription: (subscriptionId: string, options?: { siteCode?: string; status?: string; plate?: string; activeTab?: string }) => void
  closeDetail: () => void
  setActiveTab: (tab: string) => void
}

function normalizeQueryState(searchParams: URLSearchParams): WorkspaceQueryState {
  return {
    siteCode: normalizeSearchText(readTrimmedSearchParam(searchParams, 'siteCode')),
    status: normalizeEnumValue(
      readTrimmedSearchParam(searchParams, 'status'),
      STATUS_VALUES,
      '',
    ) as SubscriptionEffectiveStatus | '',
    plate: normalizeSearchText(readTrimmedSearchParam(searchParams, 'plate')).toUpperCase(),
    selectedId: normalizeSearchText(readTrimmedSearchParam(searchParams, 'id')),
    activeTab: normalizeEnumValue(
      readTrimmedSearchParam(searchParams, 'tab'),
      SUBSCRIPTION_TAB_VALUES,
      'overview',
    ) as SubscriptionWorkspaceTab,
  }
}

function uniqueRows(rows: SubscriptionRow[]) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    if (seen.has(row.subscriptionId)) return false
    seen.add(row.subscriptionId)
    return true
  })
}

function shouldKeepSelection(row: SubscriptionRow, query: WorkspaceQueryState) {
  if (query.siteCode && row.siteCode !== query.siteCode) return false
  if (query.status && row.effectiveStatus !== query.status) return false
  return true
}

export function useSubscriptionsWorkspace(): SubscriptionsWorkspaceResult {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => normalizeQueryState(searchParams), [searchParams])

  const [plateInput, setPlateInput] = useState(query.plate)
  const [sites, setSites] = useState<SiteRow[]>([])
  const [operatorRole, setOperatorRole] = useState('')

  const [list, setList] = useState<ListState>({
    rows: [],
    nextCursor: null,
    loading: true,
    loadingMore: false,
    error: '',
  })
  const [detail, setDetail] = useState<DetailState>({ data: null, loading: false, error: '' })
  const [selection, setSelection] = useState<SelectionState>({ reason: '' })

  const listAbortRef = useRef<AbortController | null>(null)
  const detailAbortRef = useRef<AbortController | null>(null)
  const listRequestRef = useRef(0)
  const detailRequestRef = useRef(0)

  useEffect(() => {
    setPlateInput(query.plate)
  }, [query.plate])

  useEffect(() => {
    let cancelled = false

    void Promise.all([getSites(), getMe()])
      .then(([siteRes, me]) => {
        if (cancelled) return
        setSites(siteRes.rows)
        setOperatorRole(me.role)
      })
      .catch(() => {
        if (cancelled) return
        setSites([])
        setOperatorRole('')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const updateUrl = useCallback((nextState: Partial<WorkspaceQueryState>, replace = true) => {
    const next = buildSearchParams({
      siteCode: nextState.siteCode ?? query.siteCode,
      status: nextState.status ?? query.status,
      plate: nextState.plate ?? query.plate,
      id: nextState.selectedId ?? query.selectedId,
      tab: nextState.activeTab ?? query.activeTab,
    })
    syncSearchParams(searchParams, next, setSearchParams, replace)
  }, [query.activeTab, query.plate, query.selectedId, query.siteCode, query.status, searchParams, setSearchParams])

  const clearSelection = useCallback((reason: string) => {
    detailAbortRef.current?.abort()
    setDetail({ data: null, loading: false, error: '' })
    setSelection({ reason })
    const next = buildSearchParams({
      siteCode: query.siteCode,
      status: query.status,
      plate: query.plate,
      id: null,
      tab: 'overview',
    })
    syncSearchParams(searchParams, next, setSearchParams, true)
  }, [query.plate, query.siteCode, query.status, searchParams, setSearchParams])

  const loadList = useCallback(async (options?: { append?: boolean; cursor?: string | null }) => {
    const append = options?.append === true
    const cursor = append ? options?.cursor ?? null : null

    if (listAbortRef.current) listAbortRef.current.abort()
    const controller = new AbortController()
    listAbortRef.current = controller
    const requestId = ++listRequestRef.current

    setList((current) => ({
      ...current,
      loading: append ? current.loading : true,
      loadingMore: append,
      error: append ? current.error : '',
    }))

    try {
      const response = await getSubscriptions({
        siteCode: query.siteCode || undefined,
        status: query.status || undefined,
        plate: query.plate || undefined,
        limit: 100,
        cursor: cursor || undefined,
      }, {
        signal: controller.signal,
      })

      if (requestId !== listRequestRef.current) return

      setList((current) => ({
        rows: append ? uniqueRows([...current.rows, ...response.rows]) : response.rows,
        nextCursor: response.nextCursor,
        loading: false,
        loadingMore: false,
        error: '',
      }))
    } catch (error) {
      if (classifyApiError(error) === 'aborted') return
      if (requestId !== listRequestRef.current) return
      const display = toAppErrorDisplay(error, 'Failed to load subscriptions')
      setList((current) => ({
        rows: append ? current.rows : [],
        nextCursor: append ? current.nextCursor : null,
        loading: false,
        loadingMore: false,
        error: display.message + (display.requestId ? ` (requestId: ${display.requestId})` : ''),
      }))
    }
  }, [query.plate, query.siteCode, query.status])

  useEffect(() => {
    void loadList({ append: false })
  }, [loadList])

  useEffect(() => {
    if (!query.selectedId) {
      setSelection((current) => ({
        reason: current.reason || (list.rows.length > 0 ? 'Select a subscription from the list to inspect details, linked spots, and linked vehicles.' : ''),
      }))
      setDetail({ data: null, loading: false, error: '' })
      return
    }

    if (!list.loading && !list.error && list.rows.length === 0) {
      clearSelection('No subscriptions remain in the current result set. Adjust filters or reset the workspace before selecting another record.')
      return
    }

    if (list.rows.length === 0) return

    const match = list.rows.find((row) => row.subscriptionId === query.selectedId)
    if (!match) {
      clearSelection('The selected subscription is not available in the current result set anymore. Review the list and choose another record.')
      return
    }

    if (!shouldKeepSelection(match, query)) {
      clearSelection('The selected subscription no longer matches the active filters. Clear or adjust filters, then choose another record.')
      return
    }

    setSelection({ reason: '' })
  }, [clearSelection, list.error, list.loading, list.rows, query])

  const fetchDetail = useCallback(async (subscriptionId: string) => {
    if (!subscriptionId) return

    if (detailAbortRef.current) detailAbortRef.current.abort()
    const controller = new AbortController()
    detailAbortRef.current = controller
    const requestId = ++detailRequestRef.current

    setDetail({ data: null, loading: true, error: '' })

    try {
      const response = await getSubscriptionDetail(subscriptionId, { signal: controller.signal })
      if (requestId !== detailRequestRef.current) return
      setDetail({ data: response, loading: false, error: '' })
    } catch (error) {
      if (classifyApiError(error) === 'aborted') return
      if (requestId !== detailRequestRef.current) return
      const display = toAppErrorDisplay(error, 'Failed to load detail')
      setDetail({
        data: null,
        loading: false,
        error: display.message + (display.requestId ? ` (requestId: ${display.requestId})` : ''),
      })
    }
  }, [])

  useEffect(() => {
    if (!query.selectedId) return
    if (selection.reason) return
    void fetchDetail(query.selectedId)
  }, [fetchDetail, query.selectedId, selection.reason])

  useEffect(() => () => {
    listAbortRef.current?.abort()
    detailAbortRef.current?.abort()
  }, [])

  const applyFilters = useCallback((input: { siteCode?: string; status?: SubscriptionEffectiveStatus | ''; plate?: string }) => {
    const nextPlate = input.plate === undefined ? query.plate : normalizeSearchTextInput(input.plate).toUpperCase()
    const nextSiteCode = input.siteCode === undefined ? query.siteCode : normalizeSearchText(input.siteCode)
    const nextStatus = input.status === undefined ? query.status : (normalizeEnumValue(input.status, STATUS_VALUES, '') as SubscriptionEffectiveStatus | '')

    setSelection({ reason: '' })

    const next = buildSearchParams({
      siteCode: nextSiteCode,
      status: nextStatus,
      plate: nextPlate,
      id: null,
      tab: 'overview',
    })
    syncSearchParams(searchParams, next, setSearchParams, true)
  }, [query.plate, query.siteCode, query.status, searchParams, setSearchParams])

  const resetFilters = useCallback(() => {
    setPlateInput('')
    setSelection({ reason: '' })
    const next = buildSearchParams({ tab: 'overview' })
    syncSearchParams(searchParams, next, setSearchParams, true)
  }, [searchParams, setSearchParams])

  const selectRow = useCallback((subscriptionId: string, options?: { siteCode?: string; status?: SubscriptionEffectiveStatus | ''; plate?: string; activeTab?: SubscriptionWorkspaceTab }) => {
    updateUrl({
      selectedId: subscriptionId,
      siteCode: options?.siteCode ?? query.siteCode,
      status: options?.status ?? query.status,
      plate: options?.plate ?? query.plate,
      activeTab: options?.activeTab ?? 'overview',
    }, true)
    setSelection({ reason: '' })
  }, [query.plate, query.siteCode, query.status, updateUrl])

  const focusSubscription = useCallback((subscriptionId: string, options?: { siteCode?: string; status?: string; plate?: string; activeTab?: string }) => {
    const normalizedStatus = normalizeEnumValue(options?.status, STATUS_VALUES, '') as SubscriptionEffectiveStatus | ''
    const normalizedTab = normalizeEnumValue(options?.activeTab, SUBSCRIPTION_TAB_VALUES, 'overview') as SubscriptionWorkspaceTab
    selectRow(subscriptionId, {
      siteCode: normalizeSearchText(options?.siteCode ?? query.siteCode),
      status: normalizedStatus,
      plate: normalizeSearchTextInput(options?.plate ?? query.plate).toUpperCase(),
      activeTab: normalizedTab,
    })
  }, [query.plate, query.siteCode, selectRow])

  const closeDetail = useCallback(() => {
    clearSelection('Select a subscription from the list to inspect details, linked spots, and linked vehicles.')
  }, [clearSelection])

  const setActiveTab = useCallback((tab: string) => {
    const nextTab = normalizeEnumValue(tab, SUBSCRIPTION_TAB_VALUES, 'overview') as SubscriptionWorkspaceTab
    updateUrl({ activeTab: nextTab }, true)
  }, [updateUrl])

  const loadMore = useCallback(async () => {
    if (!list.nextCursor || list.loadingMore) return
    await loadList({ append: true, cursor: list.nextCursor })
  }, [list.loadingMore, list.nextCursor, loadList])

  const reloadList = useCallback(async () => {
    await loadList({ append: false })
  }, [loadList])

  const reloadDetail = useCallback(async (subscriptionId?: string) => {
    const targetId = subscriptionId || query.selectedId
    if (!targetId) return
    await fetchDetail(targetId)
  }, [fetchDetail, query.selectedId])

  const retryDetail = useCallback(async () => {
    await reloadDetail(query.selectedId)
  }, [query.selectedId, reloadDetail])

  return {
    query,
    plateInput,
    setPlateInput,
    sites,
    operatorRole,
    list,
    detail,
    selection,
    canMutate: operatorRole === 'ADMIN' || operatorRole === 'OPS',
    reloadList,
    reloadDetail,
    loadMore,
    retryDetail,
    applyFilters,
    resetFilters,
    selectRow,
    focusSubscription,
    closeDetail,
    setActiveTab,
  }
}
