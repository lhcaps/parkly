import type { Router } from 'express'

import { requireAuth } from '../../../../server/auth'
import {
  initSse,
  writeSseComment,
  writeLegacySseEvent,
} from '../../../../server/sse-contract'
import { listParkingLiveBoard } from '../../application/list-parking-live-board'
import { getDefaultParkingLiveServiceDeps } from '../../application/list-parking-live-board'
import type { ParkingLiveDerivedStatus } from '../../domain/parking-live-types'

const PARKING_LIVE_POLL_MS = (() => {
  const raw = Number(process.env['PARKING_LIVE_STREAM_POLL_MS'] ?? 15_000)
  return Number.isFinite(raw) && raw >= 2_000 ? raw : 15_000
})()

const STALE_AFTER_MS = 3 * PARKING_LIVE_POLL_MS

// ─── Event type helpers ───────────────────────────────────────────────────

type SlotUpdatedEvent = {
  siteCode: string
  floorKey: string
  spotCode: string
  spotId: string
  occupancyStatus: ParkingLiveDerivedStatus
  plateNumber: string | null
  stale: boolean
  updatedAt: string | null
}

type FloorSummaryUpdatedEvent = {
  siteCode: string
  floorKey: string
  summary: {
    total: number
    empty: number
    occupiedTotal: number
    occupiedMatched: number
    occupiedUnknown: number
    occupiedViolation: number
    sensorStale: number
    blocked: number
    reserved: number
  }
}

function slotKey(siteCode: string, spotCode: string) {
  return `${siteCode}::${spotCode}`
}

function fingerprintSlot(status: ParkingLiveDerivedStatus, plate: string | null, stale: boolean) {
  return `${status}::${plate ?? ''}::${stale}`
}

/**
 * SSE stream: GET /api/stream/parking-live
 *
 * Delivers delta events for the Parking Live board.
 * No guaranteed delivery, no replay — FE must fall back to polling if disconnected.
 *
 * Event types:
 *   snapshot.ready      — initial snapshot broadcast on connect
 *   slot.updated        — a slot changed occupancy status
 *   floor.summary.updated — per-floor counter changed
 *   stream.stale        — backend couldn't refresh data in time
 *   keepalive           — SSE comment ping
 *
 * Data source: parking-live board service (projection + subscription lookup)
 * Polling interval: PARKING_LIVE_STREAM_POLL_MS env var (default 15 000 ms)
 */
export function registerParkingLiveStream(api: Router) {
  api.get(
    '/stream/parking-live',
    requireAuth(['ADMIN', 'OPS', 'GUARD']),
    async (req, res, next) => {
      try {
        const siteCode =
          typeof req.query.siteCode === 'string' && req.query.siteCode.trim()
            ? req.query.siteCode.trim()
            : null

        if (!siteCode) {
          res.status(400).json({
            requestId: (req as any).id ?? null,
            error: { code: 'BAD_REQUEST', message: 'siteCode is required for parking live stream' },
          })
          return
        }

        const filterFloor =
          typeof req.query.floorKey === 'string' && req.query.floorKey.trim()
            ? req.query.floorKey.trim()
            : null

        initSse(res)

        // Previous slot fingerprint map for diff detection
        const prevSlots = new Map<string, string>()
        const prevFloorSummaries = new Map<string, string>()
        let lastSuccessAt = Date.now()
        let staleEventSent = false

        const deps = getDefaultParkingLiveServiceDeps()

        const emit = async (initial: boolean) => {
          let board
          try {
            board = await listParkingLiveBoard(
              { siteCode, floorKey: filterFloor ?? undefined },
              deps,
            )
            lastSuccessAt = Date.now()
            staleEventSent = false
          } catch (fetchError) {
            // Data unavailable — mark stream stale rather than crash
            const age = Date.now() - lastSuccessAt
            if (!staleEventSent || age > STALE_AFTER_MS) {
              writeLegacySseEvent(res, 'stream.stale', {
                siteCode,
                message: fetchError instanceof Error ? fetchError.message : 'board fetch failed',
                staleSinceMs: age,
              })
              staleEventSent = true
            }
            return
          }

          if (initial) {
            // On connect: send full snapshot so FE can hydrate immediately
            writeLegacySseEvent(res, 'snapshot.ready', {
              siteCode: board.site.siteCode,
              reconciledAt: board.connection.reconciledAt,
              floors: board.floors.map((f) => ({
                floorKey: f.floorKey,
                label: f.label,
                summary: f.summary,
                slots: f.slots,
              })),
            })

            // Seed previous-state maps
            for (const floor of board.floors) {
              for (const slot of floor.slots) {
                prevSlots.set(
                  slotKey(siteCode, slot.spotCode),
                  fingerprintSlot(slot.occupancyStatus, slot.plateNumber, slot.stale),
                )
              }
              prevFloorSummaries.set(floor.floorKey, JSON.stringify(floor.summary))
            }
            return
          }

          // Delta pass: emit only changed slots
          for (const floor of board.floors) {
            for (const slot of floor.slots) {
              const key = slotKey(siteCode, slot.spotCode)
              const current = fingerprintSlot(slot.occupancyStatus, slot.plateNumber, slot.stale)
              if (prevSlots.get(key) !== current) {
                const event: SlotUpdatedEvent = {
                  siteCode: board.site.siteCode,
                  floorKey: floor.floorKey,
                  spotCode: slot.spotCode,
                  spotId: slot.spotId,
                  occupancyStatus: slot.occupancyStatus,
                  plateNumber: slot.plateNumber,
                  stale: slot.stale,
                  updatedAt: slot.updatedAt,
                }
                writeLegacySseEvent(res, 'slot.updated', event)
                prevSlots.set(key, current)
              }
            }

            // Floor-level summary delta
            const prevSummary = prevFloorSummaries.get(floor.floorKey)
            const currentSummary = JSON.stringify(floor.summary)
            if (prevSummary !== currentSummary) {
              const event: FloorSummaryUpdatedEvent = {
                siteCode: board.site.siteCode,
                floorKey: floor.floorKey,
                summary: floor.summary,
              }
              writeLegacySseEvent(res, 'floor.summary.updated', event)
              prevFloorSummaries.set(floor.floorKey, currentSummary)
            }
          }
        }

        // Initial full snapshot
        try {
          await emit(true)
        } catch (initError) {
          writeLegacySseEvent(res, 'stream.stale', {
            siteCode,
            message: initError instanceof Error ? initError.message : 'init failed',
            staleSinceMs: 0,
          })
        }

        // Polling loop
        const timer = setInterval(async () => {
          try {
            await emit(false)
            writeSseComment(res, `ping ${Date.now()}`)
          } catch (loopError) {
            writeLegacySseEvent(res, 'stream.stale', {
              siteCode,
              message: loopError instanceof Error ? loopError.message : 'poll failed',
              staleSinceMs: Date.now() - lastSuccessAt,
            })
          }
        }, PARKING_LIVE_POLL_MS)

        req.on('close', () => {
          clearInterval(timer)
        })
      } catch (error) {
        next(error)
      }
    },
  )
}
