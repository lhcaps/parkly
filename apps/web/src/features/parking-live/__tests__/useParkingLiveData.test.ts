import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { ApiError } from '@/lib/http/errors'
import type { ParkingLiveBoard, ParkingLiveSummary } from '../types'
import { useParkingLiveData } from '../hooks/useParkingLiveData'

const apiMocks = vi.hoisted(() => ({
  getParkingLiveBoard: vi.fn(),
  getParkingLiveSummary: vi.fn(),
}))

const sseMocks = vi.hoisted(() => ({
  connectSseWithRetry: vi.fn(),
  makeSseUrl: vi.fn((path: string) => path),
}))

const telemetryMocks = vi.hoisted(() => ({
  emitRealtimeTelemetry: vi.fn(),
}))

vi.mock('../api/parking-live', () => apiMocks)
vi.mock('@/lib/http/sse', () => sseMocks)
vi.mock('@/features/_shared/realtime/realtime-telemetry', () => telemetryMocks)

function makeBoard(updatedAt = '2026-03-18T00:00:00.000Z'): ParkingLiveBoard {
  return {
    site: { siteCode: 'SITE01', name: 'Site 01' },
    filters: { floorKey: null, zoneCode: null, status: null, q: null, refresh: false },
    connection: { source: 'projection', reconciledAt: updatedAt, streamSupported: true },
    floors: [
      {
        floorKey: 'F1',
        label: 'Floor 1',
        summary: {
          total: 2,
          empty: 1,
          occupiedMatched: 1,
          occupiedUnknown: 0,
          occupiedViolation: 0,
          sensorStale: 0,
          blocked: 0,
          reserved: 0,
          occupiedTotal: 1,
        },
        slots: [
          {
            spotId: 'spot_1',
            spotCode: 'A-01',
            siteCode: 'SITE01',
            zoneCode: 'A',
            floorKey: 'F1',
            layoutRow: 1,
            layoutCol: 1,
            layoutOrder: 1,
            slotKind: 'STANDARD',
            occupancyStatus: 'EMPTY',
            plateNumber: null,
            subscriptionId: null,
            subscriptionCode: null,
            sessionId: null,
            incidentCode: null,
            updatedAt,
            stale: false,
          },
          {
            spotId: 'spot_2',
            spotCode: 'A-02',
            siteCode: 'SITE01',
            zoneCode: 'A',
            floorKey: 'F1',
            layoutRow: 1,
            layoutCol: 2,
            layoutOrder: 2,
            slotKind: 'STANDARD',
            occupancyStatus: 'OCCUPIED_MATCHED',
            plateNumber: '43A12345',
            subscriptionId: 'sub_1',
            subscriptionCode: 'SUB-1',
            sessionId: 'GS-1',
            incidentCode: null,
            updatedAt,
            stale: false,
          },
        ],
      },
    ],
  }
}

function makeSummary(updatedAt = '2026-03-18T00:00:00.000Z'): ParkingLiveSummary {
  return {
    site: { siteCode: 'SITE01', name: 'Site 01' },
    summary: {
      total: 2,
      empty: 1,
      occupiedMatched: 1,
      occupiedUnknown: 0,
      occupiedViolation: 0,
      sensorStale: 0,
      blocked: 0,
      reserved: 0,
      occupiedTotal: 1,
    },
    floors: [
      { floorKey: 'F1', label: 'Floor 1', total: 2, empty: 1, occupiedTotal: 1, sensorStale: 0, blocked: 0, reserved: 0 },
    ],
    updatedAt,
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

describe('useParkingLiveData', () => {
  let sseHandlers: Parameters<typeof import('@/lib/http/sse').connectSseWithRetry>[0] | null

  beforeEach(() => {
    sseHandlers = null
    apiMocks.getParkingLiveBoard.mockResolvedValue(makeBoard())
    apiMocks.getParkingLiveSummary.mockResolvedValue(makeSummary())
    sseMocks.connectSseWithRetry.mockImplementation(async (args: Parameters<typeof import('@/lib/http/sse').connectSseWithRetry>[0]) => {
      sseHandlers = args
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the last snapshot when the stream degrades and marks freshness as stale', async () => {
    const { result } = renderHook(() => useParkingLiveData('SITE01'))

    await waitFor(() => expect(result.current.floors.length).toBe(1))
    await waitFor(() => expect(sseHandlers).not.toBeNull())

    act(() => {
      sseHandlers?.onStatusChange?.('connected', { reconnectCount: 0 })
    })

    await waitFor(() => expect(result.current.connectionStatus).toBe('connected'))

    act(() => {
      sseHandlers?.onStatusChange?.('failed', {
        reconnectCount: 1,
        error: 'stream failed',
        nextRetryAt: '2026-03-18T00:01:00.000Z',
      })
    })

    await waitFor(() => expect(result.current.connectionStatus).toBe('stale'))
    expect(result.current.floors[0]?.slots).toHaveLength(2)
    expect(result.current.freshness.hasSnapshot).toBe(true)
  })

  it('coalesces burst slot.updated events into a single snapshot refresh', async () => {
    renderHook(() => useParkingLiveData('SITE01'))
    await waitFor(() => expect(apiMocks.getParkingLiveBoard).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(sseHandlers).not.toBeNull())

    act(() => {
      for (let index = 0; index < 10; index += 1) {
        sseHandlers?.onMessage({ event: 'slot.updated', data: '{}', id: String(index), retry: null })
      }
    })

    await act(async () => {
      await sleep(450)
    })

    await waitFor(() => expect(apiMocks.getParkingLiveBoard).toHaveBeenCalledTimes(2), { timeout: 1500 })
  })

  it('preserves the last snapshot and exposes requestId when refresh fails after the board was already loaded', async () => {
    const { result } = renderHook(() => useParkingLiveData('SITE01'))
    await waitFor(() => expect(result.current.floors.length).toBe(1))
    await waitFor(() => expect(sseHandlers).not.toBeNull())

    apiMocks.getParkingLiveBoard.mockRejectedValueOnce(new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Snapshot failed',
      requestId: 'req-pl-500',
    }))
    apiMocks.getParkingLiveSummary.mockRejectedValueOnce(new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Summary failed',
      requestId: 'req-pl-500',
    }))

    act(() => {
      sseHandlers?.onMessage({ event: 'slot.updated', data: '{}', id: 'burst-1', retry: null })
    })

    await act(async () => {
      await sleep(450)
    })

    await waitFor(() => expect(result.current.freshness.requestIdHint).toBe('req-pl-500'), { timeout: 1500 })
    expect(result.current.floors.length).toBe(1)
    expect(result.current.freshness.status).toBe('stale')
    expect(result.current.state.error).toContain('Snapshot failed')
  })

  it('supports force refresh and updates snapshot fetch calls with reconcile intent', async () => {
    const { result } = renderHook(() => useParkingLiveData('SITE01'))
    await waitFor(() => expect(result.current.floors.length).toBe(1))

    await act(async () => {
      await result.current.refresh(true)
    })

    expect(apiMocks.getParkingLiveBoard).toHaveBeenLastCalledWith(expect.objectContaining({ siteCode: 'SITE01', refresh: true, signal: expect.any(AbortSignal) }))
    expect(apiMocks.getParkingLiveSummary).toHaveBeenLastCalledWith('SITE01', expect.objectContaining({ refresh: true, signal: expect.any(AbortSignal) }))
  })
})
