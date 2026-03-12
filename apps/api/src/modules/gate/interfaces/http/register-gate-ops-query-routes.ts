import type { NextFunction, Request, Response, Router } from 'express'
import { z } from 'zod'

import { requireAuth } from '../../../../server/auth'
import { ApiError, ok } from '../../../../server/http'
import { getDeviceHealthSnapshot, getLaneStatusSnapshot } from '../../../../server/services/gate-realtime.service'

function encodeCursor(parts: unknown[]) {
  return Buffer.from(JSON.stringify(parts)).toString('base64url')
}

function decodeCursor(cursor?: string | null): string[] | null {
  const raw = String(cursor ?? '').trim()
  if (!raw) return null

  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    return Array.isArray(parsed) ? parsed.map((item) => String(item ?? '')) : null
  } catch {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Cursor không hợp lệ',
      details: { cursor },
    })
  }
}

function compareTuple(a: string[], b: string[]) {
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i += 1) {
    const left = a[i] ?? ''
    const right = b[i] ?? ''
    const cmp = left.localeCompare(right)
    if (cmp !== 0) return cmp
  }
  return 0
}

function paginateRows<T>(
  rows: T[],
  args: {
    limit?: number
    cursor?: string | null
    keyFn: (row: T) => string[]
  },
) {
  const limit = Math.min(200, Math.max(1, Number(args.limit ?? 50)))
  const cursor = decodeCursor(args.cursor)
  const sorted = [...rows].sort((a, b) => compareTuple(args.keyFn(a), args.keyFn(b)))

  let startIndex = 0
  if (cursor) {
    startIndex = sorted.findIndex((row) => compareTuple(args.keyFn(row), cursor) > 0)
    if (startIndex < 0) {
      return {
        rows: [] as T[],
        nextCursor: null,
        hasMore: false,
      }
    }
  }

  const page = sorted.slice(startIndex, startIndex + limit)
  const hasMore = startIndex + limit < sorted.length
  const nextCursor = hasMore && page.length > 0 ? encodeCursor(args.keyFn(page[page.length - 1])) : null

  return {
    rows: page,
    nextCursor,
    hasMore,
  }
}

const SnapshotQuery = z.object({
  siteCode: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().trim().optional(),
})

export function registerGateOpsQueryRoutes(api: Router) {
  api.get('/ops/lane-status', requireAuth(['ADMIN', 'OPS', 'GUARD', 'WORKER']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = SnapshotQuery.safeParse(req.query ?? {})
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() })

      const rows = await getLaneStatusSnapshot(parsed.data.siteCode)
      const page = paginateRows(rows, {
        limit: parsed.data.limit,
        cursor: parsed.data.cursor,
        keyFn: (row) => [row.siteCode, row.gateCode, row.laneCode],
      })

      res.json(ok((req as any).id, {
        rows: page.rows,
        pageInfo: {
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          limit: parsed.data.limit ?? 50,
          sort: 'siteCode:asc,gateCode:asc,laneCode:asc',
        },
      }))
    } catch (error) {
      next(error)
    }
  })

  api.get('/ops/device-health', requireAuth(['ADMIN', 'OPS', 'GUARD', 'WORKER']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = SnapshotQuery.safeParse(req.query ?? {})
      if (!parsed.success) throw new ApiError({ code: 'BAD_REQUEST', details: parsed.error.flatten() })

      const rows = await getDeviceHealthSnapshot(parsed.data.siteCode)
      const page = paginateRows(rows, {
        limit: parsed.data.limit,
        cursor: parsed.data.cursor,
        keyFn: (row) => [row.siteCode, row.gateCode ?? '', row.laneCode ?? '', row.deviceCode],
      })

      res.json(ok((req as any).id, {
        rows: page.rows,
        pageInfo: {
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          limit: parsed.data.limit ?? 50,
          sort: 'siteCode:asc,gateCode:asc,laneCode:asc,deviceCode:asc',
        },
      }))
    } catch (error) {
      next(error)
    }
  })
}
