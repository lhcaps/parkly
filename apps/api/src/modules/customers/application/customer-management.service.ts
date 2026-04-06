/**
 * Customer Management Service — raw SQL / Prisma.
 *
 * Covers: list, get detail, create, update, delete.
 * Does NOT set updated_at (customers table has no such column).
 */
import { prisma } from '../../../lib/prisma'
import { ApiError } from '../../../server/http'
import { writeAuditLog } from '../../../server/services/audit-service'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toBigInt(value: string | number | bigint): bigint {
  return BigInt(value)
}

function str(v: unknown): string {
  return v != null ? String(v) : ''
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ListCustomersOptions = {
  search?: string
  status?: 'ACTIVE' | 'SUSPENDED'
  vehicleType?: 'CAR' | 'MOTORBIKE'
  cursor?: string
  limit: number
}

export type CustomerSummary = {
  customerId: string
  fullName: string
  phone: string | null
  email: string | null
  status: 'ACTIVE' | 'SUSPENDED'
  createdAt: string | null
  vehicleCount: number
  subscriptionCount: number
  activeCredentialCount: number
}

export type VehicleRow = {
  vehicleId: string
  licensePlate: string
  vehicleType: 'CAR' | 'MOTORBIKE'
  createdAt: string | null
}

export type SubscriptionRow = {
  subscriptionId: string
  siteId: string
  siteCode: string
  planType: string
  startDate: string
  endDate: string
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED'
  createdAt: string | null
}

export type CredentialRow = {
  credentialId: string
  siteId: string
  siteCode: string
  rfidUid: string
  status: 'ACTIVE' | 'BLOCKED' | 'LOST'
  lastDirection: string | null
  lastEventTime: string | null
}

export type CustomerDetail = CustomerSummary & {
  vehicles: VehicleRow[]
  subscriptions: SubscriptionRow[]
  credentials: CredentialRow[]
}

// ─── List Customers ─────────────────────────────────────────────────────────────

export async function listCustomers(options: ListCustomersOptions) {
  const { search, status, vehicleType, cursor, limit } = options

  const conditions: string[] = []
  const params: unknown[] = []

  if (status) {
    conditions.push('c.status = ?')
    params.push(status)
  }
  if (search) {
    const esc = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
    conditions.push('(c.full_name LIKE ? ESCAPE \'\\\\\' OR c.phone LIKE ? ESCAPE \'\\\\\' OR c.email LIKE ? ESCAPE \'\\\\\')')
    params.push(`%${esc}%`, `%${esc}%`, `%${esc}%`)
  }
  if (vehicleType) {
    conditions.push(
      `EXISTS (
        SELECT 1 FROM vehicles v
        WHERE v.owner_customer_id = c.customer_id AND v.vehicle_type = ?
      )`,
    )
    params.push(vehicleType)
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const cursorSql = cursor
    ? whereSql
      ? ' AND c.customer_id < ?'
      : 'WHERE c.customer_id < ?'
    : ''
  if (cursor) params.push(toBigInt(cursor))

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        c.customer_id        AS customerId,
        c.full_name          AS fullName,
        c.phone              AS phone,
        c.email              AS email,
        c.status             AS status,
        c.created_at         AS createdAt,
        (
          SELECT COUNT(*) FROM vehicles v
          WHERE v.owner_customer_id = c.customer_id
        ) AS vehicleCount,
        (
          SELECT COUNT(*) FROM subscriptions s
          WHERE s.customer_id = c.customer_id
        ) AS subscriptionCount,
        (
          SELECT COUNT(*) FROM credentials cr
          JOIN subscriptions sub ON sub.subscription_id = cr.subscription_id
          WHERE sub.customer_id = c.customer_id AND cr.status = 'ACTIVE'
        ) AS activeCredentialCount
      FROM customers c
      ${whereSql}
      ${cursorSql}
      ORDER BY c.customer_id DESC
      LIMIT ?
    `,
    ...params,
    limit + 1,
  )

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  const items: CustomerSummary[] = page.map((r) => ({
    customerId: str(r.customerId),
    fullName: str(r.fullName),
    phone: r.phone != null ? str(r.phone) : null,
    email: r.email != null ? str(r.email) : null,
    status: (str(r.status) || 'ACTIVE') as 'ACTIVE' | 'SUSPENDED',
    createdAt: r.createdAt != null ? str(r.createdAt) : null,
    vehicleCount: Number(r.vehicleCount ?? 0),
    subscriptionCount: Number(r.subscriptionCount ?? 0),
    activeCredentialCount: Number(r.activeCredentialCount ?? 0),
  }))

  const nextCursor = hasMore ? items[items.length - 1]?.customerId : null

  return { rows: items, nextCursor, hasMore }
}

// ─── Get Customer Detail ────────────────────────────────────────────────────────

export async function getCustomerDetail(customerId: string): Promise<CustomerDetail> {
  const id = toBigInt(customerId)

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM customers WHERE customer_id = ? LIMIT 1`,
    id,
  )
  if (!rows[0]) throw new ApiError({ code: 'NOT_FOUND', message: `Customer ${customerId} not found` })

  const c = rows[0]

  const vehicleRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT vehicle_id, license_plate, vehicle_type, created_at FROM vehicles WHERE owner_customer_id = ? ORDER BY created_at DESC`,
    id,
  )
  const vehicles: VehicleRow[] = vehicleRows.map((v) => ({
    vehicleId: str(v.vehicle_id),
    licensePlate: str(v.license_plate),
    vehicleType: str(v.vehicle_type) as 'CAR' | 'MOTORBIKE',
    createdAt: v.created_at != null ? str(v.created_at) : null,
  }))

  const subRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT s.subscription_id, s.site_id, ps.site_code, s.plan_type, s.start_date, s.end_date, s.status, s.created_at
     FROM subscriptions s
     JOIN parking_sites ps ON ps.site_id = s.site_id
     WHERE s.customer_id = ?
     ORDER BY s.created_at DESC`,
    id,
  )
  const subscriptions: SubscriptionRow[] = subRows.map((s) => ({
    subscriptionId: str(s.subscription_id),
    siteId: str(s.site_id),
    siteCode: str(s.site_code),
    planType: str(s.plan_type),
    startDate: str(s.start_date),
    endDate: str(s.end_date),
    status: str(s.status) as 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED',
    createdAt: s.created_at != null ? str(s.created_at) : null,
  }))

  const credRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT cr.credential_id, cr.site_id, ps.site_code, cr.rfid_uid, cr.status, cr.last_direction, cr.last_event_time
     FROM credentials cr
     JOIN subscriptions sub ON sub.subscription_id = cr.subscription_id
     JOIN parking_sites ps ON ps.site_id = cr.site_id
     WHERE sub.customer_id = ?
     ORDER BY cr.last_event_time DESC NULLS LAST
     LIMIT 50`,
    id,
  )
  const credentials: CredentialRow[] = credRows.map((cr) => ({
    credentialId: str(cr.credential_id),
    siteId: str(cr.site_id),
    siteCode: str(cr.site_code),
    rfidUid: str(cr.rfid_uid),
    status: str(cr.status) as 'ACTIVE' | 'BLOCKED' | 'LOST',
    lastDirection: cr.last_direction != null ? str(cr.last_direction) : null,
    lastEventTime: cr.last_event_time != null ? str(cr.last_event_time) : null,
  }))

  return {
    customerId: str(c.customer_id),
    fullName: str(c.full_name),
    phone: c.phone != null ? str(c.phone) : null,
    email: c.email != null ? str(c.email) : null,
    status: str(c.status) as 'ACTIVE' | 'SUSPENDED',
    createdAt: c.created_at != null ? str(c.created_at) : null,
    vehicleCount: vehicles.length,
    subscriptionCount: subscriptions.length,
    activeCredentialCount: credentials.filter((c) => c.status === 'ACTIVE').length,
    vehicles,
    subscriptions,
    credentials,
  }
}

// ─── Create Customer ────────────────────────────────────────────────────────────

export type CreateCustomerInput = {
  fullName: string
  phone?: string
  email?: string
  actorUserId?: string | bigint
}

export async function createCustomer(input: CreateCustomerInput) {
  if (input.phone) {
    const dup = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT customer_id FROM customers WHERE phone = ? LIMIT 1`,
      input.phone,
    )
    if (dup.length > 0) {
      throw new ApiError({ code: 'CONFLICT', message: `Phone '${input.phone}' already registered`, details: { phone: input.phone } })
    }
  }
  if (input.email) {
    const dup = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT customer_id FROM customers WHERE email = ? LIMIT 1`,
      input.email,
    )
    if (dup.length > 0) {
      throw new ApiError({ code: 'CONFLICT', message: `Email '${input.email}' already registered`, details: { email: input.email } })
    }
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO customers (full_name, phone, email, status) VALUES (?, ?, ?, 'ACTIVE')`,
    input.fullName,
    input.phone ?? null,
    input.email || null,
  )

  const idRows = await prisma.$queryRawUnsafe<Array<{ id: unknown }>>(`SELECT LAST_INSERT_ID() AS id`)
  const rawId = idRows[0]?.id
  if (rawId === undefined || rawId === null) {
    throw new ApiError({ code: 'INTERNAL_ERROR', message: 'Failed to resolve new customer id after insert' })
  }
  const id = toBigInt(String(rawId))

  const actorId = typeof input.actorUserId === 'bigint' ? input.actorUserId : input.actorUserId ? toBigInt(input.actorUserId) : null
  await writeAuditLog({
    siteId: null,
    actorUserId: actorId,
    action: 'CUSTOMER.CREATE',
    entityTable: 'customers',
    entityId: id,
    afterSnapshot: { customerId: String(id), fullName: input.fullName, phone: input.phone, email: input.email },
  })

  return { customerId: String(id), fullName: input.fullName }
}

// ─── Update Customer ────────────────────────────────────────────────────────────

export type UpdateCustomerInput = {
  fullName?: string
  phone?: string | null
  email?: string | null
  status?: 'ACTIVE' | 'SUSPENDED'
  actorUserId?: string | bigint
}

export async function updateCustomer(customerId: string, input: UpdateCustomerInput) {
  const id = toBigInt(customerId)

  const before = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM customers WHERE customer_id = ? LIMIT 1`,
    id,
  )
  if (!before[0]) throw new ApiError({ code: 'NOT_FOUND', message: `Customer ${customerId} not found` })

  if (input.phone !== undefined && input.phone !== null) {
    const dup = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT customer_id FROM customers WHERE phone = ? AND customer_id != ? LIMIT 1`,
      input.phone,
      id,
    )
    if (dup.length > 0) {
      throw new ApiError({ code: 'CONFLICT', message: `Phone '${input.phone}' already registered`, details: { phone: input.phone } })
    }
  }

  if (input.email !== undefined && input.email !== null) {
    const dup = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT customer_id FROM customers WHERE email = ? AND customer_id != ? LIMIT 1`,
      input.email,
      id,
    )
    if (dup.length > 0) {
      throw new ApiError({ code: 'CONFLICT', message: `Email '${input.email}' already registered`, details: { email: input.email } })
    }
  }

  const sets: string[] = []
  const vals: unknown[] = []

  if (input.fullName !== undefined) {
    sets.push('full_name = ?')
    vals.push(input.fullName)
  }
  if (input.phone !== undefined) {
    sets.push('phone = ?')
    vals.push(input.phone)
  }
  if (input.email !== undefined) {
    sets.push('email = ?')
    vals.push(input.email)
  }
  if (input.status !== undefined) {
    sets.push('status = ?')
    vals.push(input.status)
  }

  if (sets.length > 0) {
    vals.push(id)
    await prisma.$executeRawUnsafe(`UPDATE customers SET ${sets.join(', ')} WHERE customer_id = ?`, ...vals)
  }

  const actorId = typeof input.actorUserId === 'bigint' ? input.actorUserId : input.actorUserId ? toBigInt(input.actorUserId) : null
  await writeAuditLog({
    siteId: null,
    actorUserId: actorId,
    action: 'CUSTOMER.UPDATE',
    entityTable: 'customers',
    entityId: id,
    beforeSnapshot: before[0],
    afterSnapshot: null,
  })

  return { customerId, fullName: input.fullName ?? str(before[0].full_name) }
}

// ─── Delete Customer ───────────────────────────────────────────────────────────

export async function deleteCustomer(customerId: string, actorUserId?: string | bigint) {
  const id = toBigInt(customerId)

  const before = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM customers WHERE customer_id = ? LIMIT 1`,
    id,
  )
  if (!before[0]) throw new ApiError({ code: 'NOT_FOUND', message: `Customer ${customerId} not found` })

  await prisma.$executeRawUnsafe(`DELETE FROM customers WHERE customer_id = ?`, id)

  const aid = typeof actorUserId === 'bigint' ? actorUserId : actorUserId ? toBigInt(actorUserId) : null
  await writeAuditLog({
    siteId: null,
    actorUserId: aid,
    action: 'CUSTOMER.DELETE',
    entityTable: 'customers',
    entityId: id,
    beforeSnapshot: before[0],
    afterSnapshot: null,
  })

  return { customerId }
}
