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

function toIso(value: unknown) {
  if (value == null) return null
  return new Date(String(value)).toISOString()
}

function normalizeDateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function dateOnlyFromUnknown(value: unknown) {
  if (value == null) return null
  return normalizeDateOnly(new Date(String(value)))
}

function isDateRangeActive(args: { occurredAt: Date; from?: unknown; to?: unknown }) {
  const occurred = normalizeDateOnly(args.occurredAt)
  const from = dateOnlyFromUnknown(args.from)
  const to = dateOnlyFromUnknown(args.to)
  if (from && occurred.getTime() < from.getTime()) return false
  if (to && occurred.getTime() > to.getTime()) return false
  return true
}

function daysRemaining(endDate?: unknown, occurredAt?: Date) {
  if (!endDate || !occurredAt) return null
  const end = dateOnlyFromUnknown(endDate)
  const occurred = normalizeDateOnly(occurredAt)
  if (!end) return null
  return Math.trunc((end.getTime() - occurred.getTime()) / 86_400_000)
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

export type SubscriptionDecisionContext = {
  lookupEnabled: boolean
  subscriptionId: string | null
  customerId: string | null
  customerName: string | null
  planType: string | null
  matchedBy: 'PLATE' | 'RFID' | 'BOTH' | null
  subscriptionStatus: string | null
  subscriptionStartDate: string | null
  subscriptionEndDate: string | null
  credentialId: string | null
  credentialStatus: string | null
  credentialRfidUid: string | null
  vehicleId: string | null
  vehiclePlateCompact: string | null
  vehicleBindingStatus: string | null
  vehicleValidFrom: string | null
  vehicleValidTo: string | null
  assignedSpotId: string | null
  assignedSpotCode: string | null
  assignedSpotStatus: string | null
  assignedMode: string | null
  assignedFrom: string | null
  assignedUntil: string | null
  remainingDays: number | null
  plateMatched: boolean | null
  rfidMatched: boolean | null
  assignedRuleStatus: 'PASS' | 'NOT_CHECKED' | 'WRONG_SPOT' | 'NO_ACTIVE_ASSIGNMENT'
  eligibleEntry: boolean
  eligibleExit: boolean
  reviewRequired: boolean
  statusCode: string
  reasonCode: string
  reasonDetail: string
  raw: Record<string, unknown>
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

type SubscriptionBasicCandidate = {
  subscriptionId: bigint
  siteId: bigint
  customerId: bigint | null
  customerName: string | null
  planType: string | null
  subscriptionStatus: string | null
  subscriptionStartDate: string | null
  subscriptionEndDate: string | null
  source: 'PLATE' | 'RFID'
}

async function loadSubscriptionCandidatesByPlate(args: {
  siteId: bigint
  plateCompact: string
}): Promise<SubscriptionBasicCandidate[]> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        s.subscription_id AS subscriptionId,
        s.site_id AS siteId,
        s.customer_id AS customerId,
        cu.full_name AS customerName,
        s.plan_type AS planType,
        s.status AS subscriptionStatus,
        s.start_date AS subscriptionStartDate,
        s.end_date AS subscriptionEndDate
      FROM subscription_vehicles sv
      JOIN subscriptions s
        ON s.subscription_id = sv.subscription_id
      LEFT JOIN customers cu
        ON cu.customer_id = s.customer_id
      WHERE sv.site_id = ?
        AND sv.plate_compact = ?
      ORDER BY (s.status = 'ACTIVE') DESC, (sv.status = 'ACTIVE') DESC, sv.is_primary DESC, s.end_date DESC, s.subscription_id DESC
      LIMIT 10
    `,
    String(args.siteId),
    args.plateCompact,
  )

  return rows.map((row) => ({
    subscriptionId: BigInt(row.subscriptionId as any),
    siteId: BigInt(row.siteId as any),
    customerId: row.customerId == null ? null : BigInt(row.customerId as any),
    customerName: row.customerName == null ? null : String(row.customerName),
    planType: row.planType == null ? null : String(row.planType),
    subscriptionStatus: row.subscriptionStatus == null ? null : String(row.subscriptionStatus),
    subscriptionStartDate: toIso(row.subscriptionStartDate),
    subscriptionEndDate: toIso(row.subscriptionEndDate),
    source: 'PLATE',
  }))
}

async function loadSubscriptionCandidatesByRfid(args: {
  siteId: bigint
  rfidUid: string
}): Promise<SubscriptionBasicCandidate[]> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        s.subscription_id AS subscriptionId,
        s.site_id AS siteId,
        s.customer_id AS customerId,
        cu.full_name AS customerName,
        s.plan_type AS planType,
        s.status AS subscriptionStatus,
        s.start_date AS subscriptionStartDate,
        s.end_date AS subscriptionEndDate
      FROM credentials c
      JOIN subscriptions s
        ON s.subscription_id = c.subscription_id
      LEFT JOIN customers cu
        ON cu.customer_id = s.customer_id
      WHERE c.site_id = ?
        AND UPPER(c.rfid_uid) = ?
      ORDER BY (s.status = 'ACTIVE') DESC, (c.status = 'ACTIVE') DESC, s.end_date DESC, s.subscription_id DESC
      LIMIT 10
    `,
    String(args.siteId),
    args.rfidUid,
  )

  return rows.map((row) => ({
    subscriptionId: BigInt(row.subscriptionId as any),
    siteId: BigInt(row.siteId as any),
    customerId: row.customerId == null ? null : BigInt(row.customerId as any),
    customerName: row.customerName == null ? null : String(row.customerName),
    planType: row.planType == null ? null : String(row.planType),
    subscriptionStatus: row.subscriptionStatus == null ? null : String(row.subscriptionStatus),
    subscriptionStartDate: toIso(row.subscriptionStartDate),
    subscriptionEndDate: toIso(row.subscriptionEndDate),
    source: 'RFID',
  }))
}

async function loadPreferredVehicleBinding(args: {
  siteId: bigint
  subscriptionId: bigint
  plateCompact?: string | null
}) {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        sv.vehicle_id AS vehicleId,
        sv.plate_compact AS plateCompact,
        sv.status AS status,
        sv.valid_from AS validFrom,
        sv.valid_to AS validTo
      FROM subscription_vehicles sv
      WHERE sv.site_id = ?
        AND sv.subscription_id = ?
      ORDER BY
        (CASE WHEN ? IS NOT NULL AND sv.plate_compact = ? THEN 1 ELSE 0 END) DESC,
        (sv.status = 'ACTIVE') DESC,
        sv.is_primary DESC,
        sv.subscription_vehicle_id DESC
      LIMIT 1
    `,
    String(args.siteId),
    String(args.subscriptionId),
    normalizePlate(args.plateCompact),
    normalizePlate(args.plateCompact),
  )

  const row = rows[0]
  if (!row?.vehicleId) return null
  return {
    vehicleId: String(row.vehicleId),
    plateCompact: row.plateCompact == null ? null : String(row.plateCompact),
    status: row.status == null ? null : String(row.status),
    validFrom: toIso(row.validFrom),
    validTo: toIso(row.validTo),
  }
}

async function loadPreferredCredentialBinding(args: {
  siteId: bigint
  subscriptionId: bigint
  rfidUid?: string | null
}) {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        c.credential_id AS credentialId,
        c.status AS status,
        c.rfid_uid AS rfidUid
      FROM credentials c
      WHERE c.site_id = ?
        AND c.subscription_id = ?
      ORDER BY
        (CASE WHEN ? IS NOT NULL AND UPPER(c.rfid_uid) = ? THEN 1 ELSE 0 END) DESC,
        (c.status = 'ACTIVE') DESC,
        c.credential_id DESC
      LIMIT 1
    `,
    String(args.siteId),
    String(args.subscriptionId),
    normalizeRfid(args.rfidUid),
    normalizeRfid(args.rfidUid),
  )

  const row = rows[0]
  if (!row?.credentialId) return null
  return {
    credentialId: String(row.credentialId),
    status: row.status == null ? null : String(row.status),
    rfidUid: row.rfidUid == null ? null : String(row.rfidUid),
  }
}

async function loadPreferredSpotAssignment(args: {
  siteId: bigint
  subscriptionId: bigint
  spotCode?: string | null
}) {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        ss.spot_id AS spotId,
        sp.code AS spotCode,
        ss.status AS status,
        ss.assigned_mode AS assignedMode,
        ss.assigned_from AS assignedFrom,
        ss.assigned_until AS assignedUntil
      FROM subscription_spots ss
      JOIN spots sp
        ON sp.spot_id = ss.spot_id
      WHERE ss.site_id = ?
        AND ss.subscription_id = ?
      ORDER BY
        (CASE WHEN ? IS NOT NULL AND UPPER(sp.code) = ? THEN 1 ELSE 0 END) DESC,
        (ss.status = 'ACTIVE') DESC,
        ss.is_primary DESC,
        ss.subscription_spot_id DESC
      LIMIT 1
    `,
    String(args.siteId),
    String(args.subscriptionId),
    args.spotCode == null ? null : String(args.spotCode).trim().toUpperCase(),
    args.spotCode == null ? null : String(args.spotCode).trim().toUpperCase(),
  )

  const row = rows[0]
  if (!row?.spotId) return null
  return {
    spotId: String(row.spotId),
    spotCode: row.spotCode == null ? null : String(row.spotCode),
    status: row.status == null ? null : String(row.status),
    assignedMode: row.assignedMode == null ? null : String(row.assignedMode),
    assignedFrom: toIso(row.assignedFrom),
    assignedUntil: toIso(row.assignedUntil),
  }
}

function selectSubscriptionCandidate(args: {
  plateCandidates: SubscriptionBasicCandidate[]
  rfidCandidates: SubscriptionBasicCandidate[]
}) {
  const merged = new Map<string, SubscriptionBasicCandidate & { sources: Set<'PLATE' | 'RFID'> }>()

  for (const candidate of [...args.plateCandidates, ...args.rfidCandidates]) {
    const key = String(candidate.subscriptionId)
    const existing = merged.get(key)
    if (existing) {
      existing.sources.add(candidate.source)
      if ((existing.subscriptionStatus ?? '').toUpperCase() !== 'ACTIVE' && (candidate.subscriptionStatus ?? '').toUpperCase() === 'ACTIVE') {
        existing.subscriptionStatus = candidate.subscriptionStatus
        existing.subscriptionStartDate = candidate.subscriptionStartDate
        existing.subscriptionEndDate = candidate.subscriptionEndDate
      }
      continue
    }

    merged.set(key, {
      ...candidate,
      sources: new Set([candidate.source]),
    })
  }

  const list = [...merged.values()]
  const both = list.find((item) => item.sources.has('PLATE') && item.sources.has('RFID'))
  if (both) return both

  if (args.rfidCandidates[0]) {
    return list.find((item) => String(item.subscriptionId) === String(args.rfidCandidates[0].subscriptionId)) ?? null
  }

  if (args.plateCandidates[0]) {
    return list.find((item) => String(item.subscriptionId) === String(args.plateCandidates[0].subscriptionId)) ?? null
  }

  return null
}

export async function resolveSubscriptionDecisionContext(args: {
  siteId: bigint
  occurredAt: Date
  plateCompact?: string | null
  rfidUid?: string | null
  requestedSpotCode?: string | null
}): Promise<SubscriptionDecisionContext> {
  const plateCompact = normalizePlate(args.plateCompact)
  const rfidUid = normalizeRfid(args.rfidUid)
  const requestedSpotCode = args.requestedSpotCode == null ? null : String(args.requestedSpotCode).trim().toUpperCase() || null

  if (!plateCompact && !rfidUid) return null

  const [plateCandidates, rfidCandidates] = await Promise.all([
    plateCompact ? loadSubscriptionCandidatesByPlate({ siteId: args.siteId, plateCompact }) : Promise.resolve([]),
    rfidUid ? loadSubscriptionCandidatesByRfid({ siteId: args.siteId, rfidUid }) : Promise.resolve([]),
  ])

  const chosen = selectSubscriptionCandidate({ plateCandidates, rfidCandidates })
  if (!chosen) return null

  const [vehicleBinding, credentialBinding, spotBinding] = await Promise.all([
    loadPreferredVehicleBinding({ siteId: args.siteId, subscriptionId: chosen.subscriptionId, plateCompact }),
    loadPreferredCredentialBinding({ siteId: args.siteId, subscriptionId: chosen.subscriptionId, rfidUid }),
    loadPreferredSpotAssignment({ siteId: args.siteId, subscriptionId: chosen.subscriptionId, spotCode: requestedSpotCode }),
  ])

  const subscriptionStatus = String(chosen.subscriptionStatus ?? '').toUpperCase() || null
  const subscriptionActive = subscriptionStatus === 'ACTIVE'
    && isDateRangeActive({ occurredAt: args.occurredAt, from: chosen.subscriptionStartDate, to: chosen.subscriptionEndDate })

  const vehicleBindingStatus = String(vehicleBinding?.status ?? '').toUpperCase() || null
  const vehicleBindingActive = vehicleBinding != null
    && vehicleBindingStatus === 'ACTIVE'
    && isDateRangeActive({ occurredAt: args.occurredAt, from: vehicleBinding.validFrom, to: vehicleBinding.validTo })

  const credentialStatus = String(credentialBinding?.status ?? '').toUpperCase() || null
  const credentialActive = credentialBinding == null
    ? true
    : credentialStatus === 'ACTIVE'

  const spotStatus = String(spotBinding?.status ?? '').toUpperCase() || null
  const spotActive = spotBinding != null
    && spotStatus === 'ACTIVE'
    && isDateRangeActive({ occurredAt: args.occurredAt, from: spotBinding.assignedFrom, to: spotBinding.assignedUntil })

  const matchedBy: 'PLATE' | 'RFID' | 'BOTH' | null = chosen.sources.has('PLATE') && chosen.sources.has('RFID')
    ? 'BOTH'
    : chosen.sources.has('RFID')
      ? 'RFID'
      : chosen.sources.has('PLATE')
        ? 'PLATE'
        : null

  const plateMatched = plateCompact == null ? null : Boolean(vehicleBinding?.plateCompact && normalizePlate(vehicleBinding.plateCompact) === plateCompact && vehicleBindingActive)
  const rfidMatched = rfidUid == null ? null : Boolean(credentialBinding?.rfidUid && normalizeRfid(credentialBinding.rfidUid) === rfidUid && credentialActive)

  let assignedRuleStatus: 'PASS' | 'NOT_CHECKED' | 'WRONG_SPOT' | 'NO_ACTIVE_ASSIGNMENT' = 'NOT_CHECKED'
  if (requestedSpotCode) {
    if (!spotBinding || !spotBinding.spotCode || !spotActive) {
      assignedRuleStatus = 'NO_ACTIVE_ASSIGNMENT'
    } else if (String(spotBinding.spotCode).trim().toUpperCase() !== requestedSpotCode) {
      assignedRuleStatus = 'WRONG_SPOT'
    } else {
      assignedRuleStatus = 'PASS'
    }
  }

  let statusCode = 'ACTIVE_MATCH'
  let reasonCode = 'SUBSCRIPTION_ACTIVE_MATCH'
  let reasonDetail = 'Subscription VIP hợp lệ và đủ điều kiện fast-path.'
  let reviewRequired = false

  if (!subscriptionActive) {
    statusCode = subscriptionStatus === 'SUSPENDED' ? 'SUSPENDED' : 'EXPIRED'
    reasonCode = statusCode === 'SUSPENDED' ? 'SUBSCRIPTION_SUSPENDED' : 'SUBSCRIPTION_EXPIRED'
    reasonDetail = statusCode === 'SUSPENDED'
      ? 'Subscription tồn tại nhưng đang ở trạng thái SUSPENDED hoặc bị khoá.'
      : 'Subscription tồn tại nhưng đã hết hạn hoặc không còn hiệu lực theo date range.'
    reviewRequired = true
  }

  if (!reviewRequired && plateMatched === false) {
    statusCode = 'PLATE_MISMATCH'
    reasonCode = 'SUBSCRIPTION_PLATE_MISMATCH'
    reasonDetail = 'RFID/subscription có match nhưng biển số đọc vào không trùng vehicle binding đang active.'
    reviewRequired = true
  }

  if (!reviewRequired && rfidMatched === false) {
    statusCode = credentialStatus === 'BLOCKED' || credentialStatus === 'LOST' ? 'RFID_BLOCKED' : 'RFID_MISMATCH'
    reasonCode = statusCode === 'RFID_BLOCKED' ? 'SUBSCRIPTION_RFID_BLOCKED' : 'SUBSCRIPTION_RFID_MISMATCH'
    reasonDetail = statusCode === 'RFID_BLOCKED'
      ? 'RFID match vào subscription nhưng credential đang BLOCKED/LOST nên không được fast-path.'
      : 'Plate/subscription có match nhưng RFID hiện tại không trùng credential đang active.'
    reviewRequired = true
  }

  if (!reviewRequired && assignedRuleStatus === 'NO_ACTIVE_ASSIGNMENT') {
    statusCode = 'NO_ACTIVE_ASSIGNMENT'
    reasonCode = 'SUBSCRIPTION_ASSIGNMENT_MISSING'
    reasonDetail = 'Subscription có assigned-bay semantics nhưng không tìm thấy assignment ACTIVE khớp để auto-approve.'
    reviewRequired = true
  }

  if (!reviewRequired && assignedRuleStatus === 'WRONG_SPOT') {
    statusCode = 'WRONG_SPOT'
    reasonCode = 'SUBSCRIPTION_WRONG_SPOT'
    reasonDetail = 'Subscription có assigned bay nhưng spot được khai báo không khớp assigned bay hiện hành.'
    reviewRequired = true
  }

  const eligibleFastPath = !reviewRequired && subscriptionActive && plateMatched !== false && rfidMatched !== false

  return {
    lookupEnabled: true,
    subscriptionId: String(chosen.subscriptionId),
    customerId: chosen.customerId == null ? null : String(chosen.customerId),
    customerName: chosen.customerName,
    planType: chosen.planType,
    matchedBy,
    subscriptionStatus,
    subscriptionStartDate: chosen.subscriptionStartDate,
    subscriptionEndDate: chosen.subscriptionEndDate,
    credentialId: credentialBinding?.credentialId ?? null,
    credentialStatus,
    credentialRfidUid: credentialBinding?.rfidUid == null ? null : String(credentialBinding.rfidUid),
    vehicleId: vehicleBinding?.vehicleId ?? null,
    vehiclePlateCompact: vehicleBinding?.plateCompact == null ? null : String(vehicleBinding.plateCompact),
    vehicleBindingStatus,
    vehicleValidFrom: vehicleBinding?.validFrom ?? null,
    vehicleValidTo: vehicleBinding?.validTo ?? null,
    assignedSpotId: spotBinding?.spotId ?? null,
    assignedSpotCode: spotBinding?.spotCode == null ? null : String(spotBinding.spotCode),
    assignedSpotStatus: spotStatus,
    assignedMode: spotBinding?.assignedMode == null ? null : String(spotBinding.assignedMode),
    assignedFrom: spotBinding?.assignedFrom ?? null,
    assignedUntil: spotBinding?.assignedUntil ?? null,
    remainingDays: daysRemaining(chosen.subscriptionEndDate, args.occurredAt),
    plateMatched,
    rfidMatched,
    assignedRuleStatus,
    eligibleEntry: eligibleFastPath,
    eligibleExit: eligibleFastPath,
    reviewRequired,
    statusCode,
    reasonCode,
    reasonDetail,
    raw: {
      matchedBy,
      requestedSpotCode,
      plateCandidates: plateCandidates.map((item) => String(item.subscriptionId)),
      rfidCandidates: rfidCandidates.map((item) => String(item.subscriptionId)),
    },
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
