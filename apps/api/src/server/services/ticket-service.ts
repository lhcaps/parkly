import { prisma } from '../../lib/prisma'

function normalizePlate(value?: string | null) {
  const v = String(value ?? '').trim().toUpperCase()
  return v || null
}

function normalizeRfid(value?: string | null) {
  const v = String(value ?? '').trim().toUpperCase()
  return v || null
}

function sanitizeCompact(value: string) {
  return value.replace(/[^A-Z0-9]/g, '')
}

function inferVehicleTypeFromPlate(plateCompact?: string | null): 'MOTORBIKE' | 'CAR' {
  const plate = sanitizeCompact(String(plateCompact ?? ''))
  return plate.length >= 8 ? 'CAR' : 'MOTORBIKE'
}

function buildFallbackVehiclePlate(args: { rfidUid?: string | null; sessionId: bigint }) {
  const compact = sanitizeCompact(String(args.rfidUid ?? ''))
  if (compact) return `RF${compact}`.slice(0, 20)
  return `SES${String(args.sessionId)}`.slice(0, 20)
}

function buildEntryTicketCode(args: { siteCode: string; sessionId: bigint }) {
  const site = sanitizeCompact(args.siteCode).slice(-6) || 'SITE'
  return `EN${site}${String(args.sessionId)}`.slice(0, 32)
}

export type CredentialContext = {
  credentialId: bigint
  status: 'ACTIVE' | 'BLOCKED' | 'LOST'
} | null

export type OpenTicketLookup = {
  ticketId: bigint
  ticketCode: string | null
  entryTime: string | null
  credentialId: bigint | null
  vehicleId: bigint | null
  vehicleType: 'CAR' | 'MOTORBIKE' | null
  plateCompact: string | null
} | null

export async function findCredentialByRfid(args: { siteId: bigint; rfidUid?: string | null }): Promise<CredentialContext> {
  const rfidUid = normalizeRfid(args.rfidUid)
  if (!rfidUid) return null

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT credential_id AS credentialId, status AS status
      FROM credentials
      WHERE site_id = ?
        AND rfid_uid = ?
      LIMIT 1
    `,
    String(args.siteId),
    rfidUid,
  )

  const row = rows[0]
  if (!row?.credentialId) return null
  const status = String(row.status ?? 'ACTIVE').toUpperCase()
  return {
    credentialId: BigInt(row.credentialId as any),
    status: status === 'LOST' ? 'LOST' : status === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE',
  }
}

export async function findOpenTicketByPlate(args: {
  siteId: bigint
  plateCompact?: string | null
}): Promise<OpenTicketLookup> {
  const plateCompact = normalizePlate(args.plateCompact)
  if (!plateCompact) return null

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        t.ticket_id AS ticketId,
        t.ticket_code AS ticketCode,
        t.entry_time AS entryTime,
        t.credential_id AS credentialId,
        t.vehicle_id AS vehicleId,
        v.vehicle_type AS vehicleType,
        UPPER(v.license_plate) AS plateCompact
      FROM tickets t
      JOIN vehicles v
        ON v.vehicle_id = t.vehicle_id
      WHERE t.site_id = ?
        AND t.status = 'OPEN'
        AND UPPER(v.license_plate) = ?
      ORDER BY t.entry_time DESC, t.ticket_id DESC
      LIMIT 1
    `,
    String(args.siteId),
    plateCompact,
  )

  const row = rows[0]
  if (!row?.ticketId) return null
  return {
    ticketId: BigInt(row.ticketId as any),
    ticketCode: row.ticketCode == null ? null : String(row.ticketCode),
    entryTime: row.entryTime == null ? null : new Date(String(row.entryTime)).toISOString(),
    credentialId: row.credentialId == null ? null : BigInt(row.credentialId as any),
    vehicleId: row.vehicleId == null ? null : BigInt(row.vehicleId as any),
    vehicleType:
      String(row.vehicleType ?? '').toUpperCase() === 'CAR'
        ? 'CAR'
        : String(row.vehicleType ?? '').toUpperCase() === 'MOTORBIKE'
          ? 'MOTORBIKE'
          : null,
    plateCompact: row.plateCompact == null ? null : String(row.plateCompact),
  }
}

export async function findOpenTicketByRfid(args: {
  siteId: bigint
  rfidUid?: string | null
}): Promise<OpenTicketLookup> {
  const rfidUid = normalizeRfid(args.rfidUid)
  if (!rfidUid) return null

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        t.ticket_id AS ticketId,
        t.ticket_code AS ticketCode,
        t.entry_time AS entryTime,
        t.credential_id AS credentialId,
        t.vehicle_id AS vehicleId,
        v.vehicle_type AS vehicleType,
        UPPER(v.license_plate) AS plateCompact
      FROM tickets t
      JOIN credentials c
        ON c.credential_id = t.credential_id
      JOIN vehicles v
        ON v.vehicle_id = t.vehicle_id
      WHERE t.site_id = ?
        AND t.status = 'OPEN'
        AND UPPER(c.rfid_uid) = ?
      ORDER BY t.entry_time DESC, t.ticket_id DESC
      LIMIT 1
    `,
    String(args.siteId),
    rfidUid,
  )

  const row = rows[0]
  if (!row?.ticketId) return null
  return {
    ticketId: BigInt(row.ticketId as any),
    ticketCode: row.ticketCode == null ? null : String(row.ticketCode),
    entryTime: row.entryTime == null ? null : new Date(String(row.entryTime)).toISOString(),
    credentialId: row.credentialId == null ? null : BigInt(row.credentialId as any),
    vehicleId: row.vehicleId == null ? null : BigInt(row.vehicleId as any),
    vehicleType:
      String(row.vehicleType ?? '').toUpperCase() === 'CAR'
        ? 'CAR'
        : String(row.vehicleType ?? '').toUpperCase() === 'MOTORBIKE'
          ? 'MOTORBIKE'
          : null,
    plateCompact: row.plateCompact == null ? null : String(row.plateCompact),
  }
}

export async function resolveOpenTicketForDecision(args: {
  siteId: bigint
  direction: 'ENTRY' | 'EXIT'
  plateCompact?: string | null
  rfidUid?: string | null
}) {
  const [plateTicket, rfidTicket] = await Promise.all([
    findOpenTicketByPlate({ siteId: args.siteId, plateCompact: args.plateCompact }),
    findOpenTicketByRfid({ siteId: args.siteId, rfidUid: args.rfidUid }),
  ])

  const plateTicketId = plateTicket?.ticketId != null ? String(plateTicket.ticketId) : null
  const rfidTicketId = rfidTicket?.ticketId != null ? String(rfidTicket.ticketId) : null

  if (plateTicket && rfidTicket && plateTicket.ticketId === rfidTicket.ticketId) {
    return {
      openTicket: {
        ticketId: String(plateTicket.ticketId),
        ticketCode: plateTicket.ticketCode ?? rfidTicket.ticketCode,
        matchedBy: 'BOTH' as const,
        entryTime: plateTicket.entryTime ?? rfidTicket.entryTime,
      },
      plateTicketId,
      rfidTicketId,
      selectedTicketId: String(plateTicket.ticketId),
      selectedBy: 'BOTH' as const,
      mismatch: false,
      raw: { plateTicket, rfidTicket },
    }
  }

  if (args.direction === 'EXIT') {
    if (rfidTicket) {
      return {
        openTicket: {
          ticketId: String(rfidTicket.ticketId),
          ticketCode: rfidTicket.ticketCode,
          matchedBy: 'RFID' as const,
          entryTime: rfidTicket.entryTime,
        },
        plateTicketId,
        rfidTicketId,
        selectedTicketId: String(rfidTicket.ticketId),
        selectedBy: 'RFID' as const,
        mismatch: Boolean(plateTicket && plateTicket.ticketId !== rfidTicket.ticketId),
        raw: { plateTicket, rfidTicket },
      }
    }

    if (plateTicket) {
      return {
        openTicket: {
          ticketId: String(plateTicket.ticketId),
          ticketCode: plateTicket.ticketCode,
          matchedBy: 'PLATE' as const,
          entryTime: plateTicket.entryTime,
        },
        plateTicketId,
        rfidTicketId,
        selectedTicketId: String(plateTicket.ticketId),
        selectedBy: 'PLATE' as const,
        mismatch: false,
        raw: { plateTicket, rfidTicket },
      }
    }
  }

  if (plateTicket) {
    return {
      openTicket: {
        ticketId: String(plateTicket.ticketId),
        ticketCode: plateTicket.ticketCode,
        matchedBy: 'PLATE' as const,
        entryTime: plateTicket.entryTime,
      },
      plateTicketId,
      rfidTicketId,
      selectedTicketId: String(plateTicket.ticketId),
      selectedBy: 'PLATE' as const,
      mismatch: Boolean(rfidTicket && rfidTicket.ticketId !== plateTicket.ticketId),
      raw: { plateTicket, rfidTicket },
    }
  }

  if (rfidTicket) {
    return {
      openTicket: {
        ticketId: String(rfidTicket.ticketId),
        ticketCode: rfidTicket.ticketCode,
        matchedBy: 'RFID' as const,
        entryTime: rfidTicket.entryTime,
      },
      plateTicketId,
      rfidTicketId,
      selectedTicketId: String(rfidTicket.ticketId),
      selectedBy: 'RFID' as const,
      mismatch: false,
      raw: { plateTicket, rfidTicket },
    }
  }

  return {
    openTicket: null,
    plateTicketId: null,
    rfidTicketId: null,
    selectedTicketId: null,
    selectedBy: null,
    mismatch: false,
    raw: { plateTicket: null, rfidTicket: null },
  }
}

async function ensureVehicleTx(tx: any, args: { plateCompact?: string | null; rfidUid?: string | null; sessionId: bigint }) {
  const licensePlate = normalizePlate(args.plateCompact) ?? buildFallbackVehiclePlate({ rfidUid: args.rfidUid, sessionId: args.sessionId })
  const existing = await tx.vehicles.findFirst({
    where: { license_plate: licensePlate },
    select: { vehicle_id: true },
  })
  if (existing?.vehicle_id != null) return BigInt(existing.vehicle_id)

  const created = await tx.vehicles.create({
    data: {
      license_plate: licensePlate,
      vehicle_type: inferVehicleTypeFromPlate(args.plateCompact),
    },
    select: { vehicle_id: true },
  })

  return BigInt(created.vehicle_id)
}

export async function createOrGetEntryTicketTx(tx: any, args: {
  siteId: bigint
  siteCode: string
  sessionId: bigint
  occurredAt: Date
  plateCompact?: string | null
  rfidUid?: string | null
}) {
  const credential = await findCredentialByRfid({ siteId: args.siteId, rfidUid: args.rfidUid })
  const vehicleId = await ensureVehicleTx(tx, {
    plateCompact: args.plateCompact,
    rfidUid: args.rfidUid,
    sessionId: args.sessionId,
  })

  const existingOpen = await tx.tickets.findFirst({
    where: {
      site_id: args.siteId,
      vehicle_id: vehicleId,
      status: 'OPEN',
    },
    orderBy: [{ entry_time: 'desc' }, { ticket_id: 'desc' }],
    select: { ticket_id: true, ticket_code: true, credential_id: true },
  })

  if (existingOpen?.ticket_id != null) {
    if (credential?.credentialId && existingOpen.credential_id == null) {
      await tx.tickets.update({
        where: { ticket_id: existingOpen.ticket_id },
        data: { credential_id: credential.credentialId },
      })
    }

    return {
      ticketId: BigInt(existingOpen.ticket_id),
      ticketCode: String(existingOpen.ticket_code ?? buildEntryTicketCode({ siteCode: args.siteCode, sessionId: args.sessionId })),
      created: false,
      credentialId: credential?.credentialId ?? (existingOpen.credential_id != null ? BigInt(existingOpen.credential_id) : null),
    }
  }

  const ticketCode = buildEntryTicketCode({ siteCode: args.siteCode, sessionId: args.sessionId })

  try {
    const created = await tx.tickets.create({
      data: {
        site_id: args.siteId,
        ticket_code: ticketCode,
        vehicle_id: vehicleId,
        credential_id: credential?.credentialId ?? null,
        entry_time: args.occurredAt,
        status: 'OPEN',
      },
      select: { ticket_id: true, ticket_code: true },
    })

    return {
      ticketId: BigInt(created.ticket_id),
      ticketCode: String(created.ticket_code),
      created: true,
      credentialId: credential?.credentialId ?? null,
    }
  } catch (err: any) {
    const errno = err?.meta?.driverAdapterError?.cause?.errno ?? err?.errno
    const msg = String(err?.message ?? '')
    if (errno !== 1062 && !msg.includes('Duplicate entry')) throw err

    const fallback = await tx.tickets.findFirst({
      where: {
        site_id: args.siteId,
        vehicle_id: vehicleId,
        status: 'OPEN',
      },
      orderBy: [{ entry_time: 'desc' }, { ticket_id: 'desc' }],
      select: { ticket_id: true, ticket_code: true, credential_id: true },
    })

    if (!fallback?.ticket_id) throw err

    return {
      ticketId: BigInt(fallback.ticket_id),
      ticketCode: String(fallback.ticket_code ?? ticketCode),
      created: false,
      credentialId: credential?.credentialId ?? (fallback.credential_id != null ? BigInt(fallback.credential_id) : null),
    }
  }
}

export async function touchCredentialDirectionTx(tx: any, args: {
  siteId: bigint
  rfidUid?: string | null
  direction: 'ENTRY' | 'EXIT'
  occurredAt: Date
}) {
  const rfidUid = normalizeRfid(args.rfidUid)
  if (!rfidUid) return false

  const result = await tx.credentials.updateMany({
    where: {
      site_id: args.siteId,
      rfid_uid: rfidUid,
    },
    data: {
      last_direction: args.direction,
      last_event_time: args.occurredAt,
    },
  })

  return result.count > 0
}
