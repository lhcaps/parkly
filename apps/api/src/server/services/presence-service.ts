import { prisma } from '../../lib/prisma'
import type { Tx } from './with-actor'

function normalizePlate(value?: string | null) {
  const v = String(value ?? '').trim().toUpperCase()
  return v || null
}

function normalizeRfid(value?: string | null) {
  const v = String(value ?? '').trim().toUpperCase()
  return v || null
}

export type ActivePresenceConflict = {
  presenceId: string
  sessionId: string | null
  ticketId: string | null
  plateCompact: string | null
  rfidUid: string | null
  entryLaneCode: string
  enteredAt: string
  lastSeenAt: string
  evidenceReadEventId: string | null
  matchedBy: Array<'TICKET' | 'PLATE' | 'RFID'>
}

function dedupeMatches(matches: Array<'TICKET' | 'PLATE' | 'RFID'>) {
  return Array.from(new Set(matches))
}

export async function findActivePresenceConflicts(args: {
  siteId: bigint
  ticketId?: string | number | bigint | null
  plateCompact?: string | null
  rfidUid?: string | null
}) {
  const ticketId = args.ticketId == null ? null : String(args.ticketId)
  const plateCompact = normalizePlate(args.plateCompact)
  const rfidUid = normalizeRfid(args.rfidUid)

  if (!ticketId && !plateCompact && !rfidUid) return []

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        presence_id AS presenceId,
        session_id AS sessionId,
        ticket_id AS ticketId,
        plate_compact AS plateCompact,
        rfid_uid AS rfidUid,
        entry_lane_code AS entryLaneCode,
        entered_at AS enteredAt,
        last_seen_at AS lastSeenAt,
        evidence_read_event_id AS evidenceReadEventId
      FROM gate_active_presence
      WHERE site_id = ?
        AND status = 'ACTIVE'
        AND (
          (? IS NOT NULL AND ticket_id = ?)
          OR (? IS NOT NULL AND plate_compact = ?)
          OR (? IS NOT NULL AND rfid_uid = ?)
        )
      ORDER BY last_seen_at DESC, presence_id DESC
    `,
    String(args.siteId),
    ticketId,
    ticketId,
    plateCompact,
    plateCompact,
    rfidUid,
    rfidUid,
  )

  return rows.map((row) => {
    const matchedBy: Array<'TICKET' | 'PLATE' | 'RFID'> = []
    if (ticketId && row.ticketId != null && String(row.ticketId) === ticketId) matchedBy.push('TICKET')
    if (plateCompact && row.plateCompact != null && String(row.plateCompact).toUpperCase() === plateCompact) matchedBy.push('PLATE')
    if (rfidUid && row.rfidUid != null && String(row.rfidUid).toUpperCase() === rfidUid) matchedBy.push('RFID')

    return {
      presenceId: String(row.presenceId),
      sessionId: row.sessionId == null ? null : String(row.sessionId),
      ticketId: row.ticketId == null ? null : String(row.ticketId),
      plateCompact: row.plateCompact == null ? null : String(row.plateCompact),
      rfidUid: row.rfidUid == null ? null : String(row.rfidUid),
      entryLaneCode: String(row.entryLaneCode ?? ''),
      enteredAt: new Date(String(row.enteredAt)).toISOString(),
      lastSeenAt: new Date(String(row.lastSeenAt)).toISOString(),
      evidenceReadEventId: row.evidenceReadEventId == null ? null : String(row.evidenceReadEventId),
      matchedBy: dedupeMatches(matchedBy),
    } as ActivePresenceConflict
  })
}

async function findExistingActivePresenceTx(tx: Tx, args: {
  siteId: bigint
  ticketId?: bigint | null
  plateCompact?: string | null
  rfidUid?: string | null
}) {
  const rows = await tx.$queryRawUnsafe<Array<{ presenceId: string }>>(
    `
      SELECT presence_id AS presenceId
      FROM gate_active_presence
      WHERE site_id = ?
        AND status = 'ACTIVE'
        AND (
          (? IS NOT NULL AND ticket_id = ?)
          OR (? IS NOT NULL AND plate_compact = ?)
          OR (? IS NOT NULL AND rfid_uid = ?)
        )
      ORDER BY last_seen_at DESC, presence_id DESC
      LIMIT 1
    `,
    String(args.siteId),
    args.ticketId == null ? null : String(args.ticketId),
    args.ticketId == null ? null : String(args.ticketId),
    normalizePlate(args.plateCompact),
    normalizePlate(args.plateCompact),
    normalizeRfid(args.rfidUid),
    normalizeRfid(args.rfidUid),
  )

  return rows[0]?.presenceId == null ? null : BigInt(rows[0].presenceId)
}

export async function upsertActivePresenceTx(tx: Tx, args: {
  siteId: bigint
  sessionId: bigint
  ticketId?: bigint | null
  plateCompact?: string | null
  rfidUid?: string | null
  entryLaneCode: string
  occurredAt: Date
  evidenceReadEventId?: bigint | null
}) {
  const existingId = await findExistingActivePresenceTx(tx, args)

  if (existingId != null) {
    await tx.$executeRawUnsafe(
      `
        UPDATE gate_active_presence
        SET
          session_id = ?,
          ticket_id = COALESCE(?, ticket_id),
          plate_compact = COALESCE(?, plate_compact),
          rfid_uid = COALESCE(?, rfid_uid),
          entry_lane_code = ?,
          last_seen_at = ?,
          evidence_read_event_id = COALESCE(?, evidence_read_event_id),
          status = 'ACTIVE',
          cleared_at = NULL,
          updated_at = ?
        WHERE presence_id = ?
      `,
      String(args.sessionId),
      args.ticketId == null ? null : String(args.ticketId),
      normalizePlate(args.plateCompact),
      normalizeRfid(args.rfidUid),
      args.entryLaneCode,
      args.occurredAt,
      args.evidenceReadEventId == null ? null : String(args.evidenceReadEventId),
      args.occurredAt,
      String(existingId),
    )

    return { presenceId: existingId, created: false }
  }

  await tx.$executeRawUnsafe(
    `
      INSERT INTO gate_active_presence (
        site_id,
        session_id,
        ticket_id,
        plate_compact,
        rfid_uid,
        entry_lane_code,
        entered_at,
        last_seen_at,
        evidence_read_event_id,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `,
    String(args.siteId),
    String(args.sessionId),
    args.ticketId == null ? null : String(args.ticketId),
    normalizePlate(args.plateCompact),
    normalizeRfid(args.rfidUid),
    args.entryLaneCode,
    args.occurredAt,
    args.occurredAt,
    args.evidenceReadEventId == null ? null : String(args.evidenceReadEventId),
    args.occurredAt,
    args.occurredAt,
  )

  const inserted = await findExistingActivePresenceTx(tx, args)
  return {
    presenceId: inserted ?? BigInt(0),
    created: true,
  }
}

export async function clearActivePresenceTx(tx: Tx, args: {
  siteId: bigint
  ticketId?: bigint | null
  plateCompact?: string | null
  rfidUid?: string | null
  occurredAt: Date
  nextStatus?: 'EXITED' | 'CLEARED' | 'BLOCKED'
}) {
  const ticketId = args.ticketId == null ? null : String(args.ticketId)
  const plateCompact = normalizePlate(args.plateCompact)
  const rfidUid = normalizeRfid(args.rfidUid)
  if (!ticketId && !plateCompact && !rfidUid) return 0

  const result = await tx.$executeRawUnsafe(
    `
      UPDATE gate_active_presence
      SET
        status = ?,
        cleared_at = ?,
        last_seen_at = ?,
        updated_at = ?
      WHERE site_id = ?
        AND status = 'ACTIVE'
        AND (
          (? IS NOT NULL AND ticket_id = ?)
          OR (? IS NOT NULL AND plate_compact = ?)
          OR (? IS NOT NULL AND rfid_uid = ?)
        )
    `,
    args.nextStatus ?? 'EXITED',
    args.occurredAt,
    args.occurredAt,
    args.occurredAt,
    String(args.siteId),
    ticketId,
    ticketId,
    plateCompact,
    plateCompact,
    rfidUid,
    rfidUid,
  )

  return Number(result ?? 0)
}


export type ActivePresenceLookup = {
  presenceId: string
  sessionId: string | null
  ticketId: string | null
  plateCompact: string | null
  rfidUid: string | null
  entryLaneCode: string
  enteredAt: string
  lastSeenAt: string
  status: 'ACTIVE' | 'EXITED' | 'CLEARED' | 'BLOCKED'
}

export async function findActivePresenceByTicket(args: {
  siteId: bigint
  ticketId?: string | number | bigint | null
}) {
  const ticketId = args.ticketId == null ? null : String(args.ticketId)
  if (!ticketId) return null

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        presence_id AS presenceId,
        session_id AS sessionId,
        ticket_id AS ticketId,
        plate_compact AS plateCompact,
        rfid_uid AS rfidUid,
        entry_lane_code AS entryLaneCode,
        entered_at AS enteredAt,
        last_seen_at AS lastSeenAt,
        status AS status
      FROM gate_active_presence
      WHERE site_id = ?
        AND ticket_id = ?
        AND status = 'ACTIVE'
      ORDER BY last_seen_at DESC, presence_id DESC
      LIMIT 1
    `,
    String(args.siteId),
    ticketId,
  )

  const row = rows[0]
  if (!row?.presenceId) return null

  return {
    presenceId: String(row.presenceId),
    sessionId: row.sessionId == null ? null : String(row.sessionId),
    ticketId: row.ticketId == null ? null : String(row.ticketId),
    plateCompact: row.plateCompact == null ? null : String(row.plateCompact),
    rfidUid: row.rfidUid == null ? null : String(row.rfidUid),
    entryLaneCode: String(row.entryLaneCode ?? ''),
    enteredAt: new Date(String(row.enteredAt)).toISOString(),
    lastSeenAt: new Date(String(row.lastSeenAt)).toISOString(),
    status:
      String(row.status ?? '').toUpperCase() === 'EXITED'
        ? 'EXITED'
        : String(row.status ?? '').toUpperCase() === 'CLEARED'
          ? 'CLEARED'
          : String(row.status ?? '').toUpperCase() === 'BLOCKED'
            ? 'BLOCKED'
            : 'ACTIVE',
  } as ActivePresenceLookup
}
