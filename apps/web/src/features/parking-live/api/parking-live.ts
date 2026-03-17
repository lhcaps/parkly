import { apiFetch, buildQuery } from '@/lib/http/client'
import {
  normalizeParkingLiveBoard,
  normalizeParkingLiveSpotDetail,
  normalizeParkingLiveSummary,
} from '../mappers'
import type { OccupancyStatus, ParkingLiveBoard, ParkingLiveSpotDetail, ParkingLiveSummary } from '../types'

export function getParkingLiveBoard(params: {
  siteCode: string
  floorKey?: string
  zoneCode?: string
  status?: OccupancyStatus | ''
  q?: string
  refresh?: boolean
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
    undefined,
    normalizeParkingLiveBoard,
  )
}

export function getParkingLiveSummary(siteCode: string, refresh = false): Promise<ParkingLiveSummary> {
  const qs = buildQuery({ siteCode, refresh: refresh ? true : undefined })
  return apiFetch<ParkingLiveSummary>(
    `/api/ops/parking-live/summary${qs ? `?${qs}` : ''}`,
    undefined,
    normalizeParkingLiveSummary,
  )
}

export function getParkingLiveSpotDetail(siteCode: string, spotCode: string, refresh = false): Promise<ParkingLiveSpotDetail | null> {
  const qs = buildQuery({ siteCode, refresh: refresh ? true : undefined })
  return apiFetch<ParkingLiveSpotDetail | null>(
    `/api/ops/parking-live/spots/${encodeURIComponent(spotCode)}${qs ? `?${qs}` : ''}`,
    undefined,
    normalizeParkingLiveSpotDetail,
  )
}
