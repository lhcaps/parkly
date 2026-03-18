import { apiFetch, buildQuery } from '@/lib/http/client'
import {
  normalizeParkingLiveBoard,
  normalizeParkingLiveSpotDetail,
  normalizeParkingLiveSummary,
} from '../mappers'
import type { OccupancyStatus, ParkingLiveBoard, ParkingLiveSpotDetail, ParkingLiveSummary } from '../types'

export type ParkingLiveRequestOptions = {
  signal?: AbortSignal
  refresh?: boolean
}

export function getParkingLiveBoard(params: {
  siteCode: string
  floorKey?: string
  zoneCode?: string
  status?: OccupancyStatus | ''
  q?: string
  refresh?: boolean
  signal?: AbortSignal
}): Promise<ParkingLiveBoard> {
  const qs = buildQuery({
    siteCode: params.siteCode,
    floorKey: params.floorKey || undefined,
    zoneCode: params.zoneCode || undefined,
    status: params.status || undefined,
    q: params.q || undefined,
    refresh: params.refresh ? true : undefined,
  })

  return apiFetch<ParkingLiveBoard>(
    `/api/ops/parking-live${qs ? `?${qs}` : ''}`,
    { signal: params.signal },
    normalizeParkingLiveBoard,
  )
}

export function getParkingLiveSummary(siteCode: string, options: ParkingLiveRequestOptions | boolean = false): Promise<ParkingLiveSummary> {
  const normalizedOptions = typeof options === 'boolean' ? { refresh: options } : options
  const qs = buildQuery({ siteCode, refresh: normalizedOptions.refresh ? true : undefined })
  return apiFetch<ParkingLiveSummary>(
    `/api/ops/parking-live/summary${qs ? `?${qs}` : ''}`,
    { signal: normalizedOptions.signal },
    normalizeParkingLiveSummary,
  )
}

export function getParkingLiveSpotDetail(siteCode: string, spotCode: string, options: ParkingLiveRequestOptions | boolean = false): Promise<ParkingLiveSpotDetail | null> {
  const normalizedOptions = typeof options === 'boolean' ? { refresh: options } : options
  const qs = buildQuery({ siteCode, refresh: normalizedOptions.refresh ? true : undefined })
  return apiFetch<ParkingLiveSpotDetail | null>(
    `/api/ops/parking-live/spots/${encodeURIComponent(spotCode)}${qs ? `?${qs}` : ''}`,
    { signal: normalizedOptions.signal },
    normalizeParkingLiveSpotDetail,
  )
}
