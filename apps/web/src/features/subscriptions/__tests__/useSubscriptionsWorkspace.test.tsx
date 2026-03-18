import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ApiError } from '@/lib/http/errors'
import type { SubscriptionDetail, SubscriptionRow } from '../types'
import { useSubscriptionsWorkspace } from '../hooks/useSubscriptionsWorkspace'

const topologyMocks = vi.hoisted(() => ({
  getSites: vi.fn(),
}))

const systemMocks = vi.hoisted(() => ({
  getMe: vi.fn(),
}))

const subscriptionMocks = vi.hoisted(() => ({
  getSubscriptions: vi.fn(),
  getSubscriptionDetail: vi.fn(),
}))

vi.mock('@/lib/api/topology', () => topologyMocks)
vi.mock('@/lib/api/system', () => systemMocks)
vi.mock('../api/subscriptions', () => subscriptionMocks)

function makeRow(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    subscriptionId: 'sub_123',
    siteCode: 'SITE01',
    siteName: 'Site 01',
    customerId: 'cust_1',
    customerName: 'Nguyen Van A',
    customerPhone: '0900000000',
    planType: 'MONTHLY',
    startDate: '2026-03-01',
    endDate: '2026-03-31',
    status: 'ACTIVE',
    effectiveStatus: 'ACTIVE',
    ...overrides,
  }
}

function makeDetail(overrides: Partial<SubscriptionDetail> = {}): SubscriptionDetail {
  return {
    ...makeRow(),
    spots: [],
    vehicles: [],
    ...overrides,
  }
}

function createWrapper(initialEntry: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/subscriptions" element={<>{children}</>} />
        </Routes>
      </MemoryRouter>
    )
  }
}

describe('useSubscriptionsWorkspace', () => {
  beforeEach(() => {
    topologyMocks.getSites.mockResolvedValue({ rows: [{ siteCode: 'SITE01', name: 'Site 01', isActive: true }] })
    systemMocks.getMe.mockResolvedValue({ role: 'OPS' })
    subscriptionMocks.getSubscriptions.mockImplementation(async (query: { status?: string }) => {
      if (query.status === 'CANCELLED') {
        return { rows: [makeRow({ subscriptionId: 'sub_cancelled', effectiveStatus: 'CANCELLED', status: 'CANCELLED' })], nextCursor: null }
      }
      return { rows: [makeRow()], nextCursor: null }
    })
    subscriptionMocks.getSubscriptionDetail.mockImplementation(async (subscriptionId: string) => makeDetail({ subscriptionId }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('restores selected subscription and tab from the deep link URL', async () => {
    const { result } = renderHook(() => useSubscriptionsWorkspace(), {
      wrapper: createWrapper('/subscriptions?siteCode=SITE01&id=sub_123&tab=vehicles'),
    })

    await waitFor(() => expect(result.current.list.loading).toBe(false))
    await waitFor(() => expect(result.current.detail.data?.subscriptionId).toBe('sub_123'))

    expect(result.current.query.siteCode).toBe('SITE01')
    expect(result.current.query.selectedId).toBe('sub_123')
    expect(result.current.query.activeTab).toBe('vehicles')
    expect(result.current.selection.reason).toBe('')
    expect(subscriptionMocks.getSubscriptionDetail).toHaveBeenCalledWith('sub_123', expect.any(Object))
  })

  it('clears stale selection when filters change the result set and keeps the pane recoverable', async () => {
    const { result } = renderHook(() => useSubscriptionsWorkspace(), {
      wrapper: createWrapper('/subscriptions?siteCode=SITE01&id=sub_123'),
    })

    await waitFor(() => expect(result.current.detail.data?.subscriptionId).toBe('sub_123'))

    act(() => {
      result.current.applyFilters({ status: 'CANCELLED' })
    })

    await waitFor(() => expect(result.current.list.loading).toBe(false))
    await waitFor(() => expect(result.current.query.selectedId).toBe(''))

    expect(result.current.selection.reason).not.toBe('')
    expect(result.current.detail.data).toBeNull()
  })

  it('surfaces detail fetch failures without collapsing the list pane state', async () => {
    subscriptionMocks.getSubscriptionDetail.mockRejectedValueOnce(new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Detail fetch failed',
      requestId: 'req-sub-500',
    }))

    const { result } = renderHook(() => useSubscriptionsWorkspace(), {
      wrapper: createWrapper('/subscriptions?siteCode=SITE01&id=sub_123'),
    })

    await waitFor(() => expect(result.current.list.loading).toBe(false))
    await waitFor(() => expect(result.current.detail.loading).toBe(false))

    expect(result.current.list.rows).toHaveLength(1)
    expect(result.current.detail.error).toContain('req-sub-500')
    expect(result.current.detail.error).toMatch(/server-side error|Detail fetch failed/i)
  })

  it('shows explicit empty-selection guidance when the list has data and no id is selected', async () => {
    const { result } = renderHook(() => useSubscriptionsWorkspace(), {
      wrapper: createWrapper('/subscriptions?siteCode=SITE01'),
    })

    await waitFor(() => expect(result.current.list.loading).toBe(false))

    expect(result.current.list.rows).toHaveLength(1)
    expect(result.current.query.selectedId).toBe('')
    expect(result.current.selection.reason).toContain('Select a subscription from the list')
  })
})
