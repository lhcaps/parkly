import { prisma } from '../../../lib/prisma';
import { ApiError } from '../../../server/http';
import { buildAuditActorSnapshot, writeAuditLog as writePlatformAudit } from '../../../server/services/audit-service';
import { stringifyBigint } from '../../../server/utils';

export type AdminSubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';
export type AssignedMode = 'ASSIGNED' | 'PREFERRED';
export type SubscriptionSpotStatus = 'ACTIVE' | 'SUSPENDED' | 'RELEASED';
export type SubscriptionVehicleStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

type AuditLogWriteArgs = {
  siteId?: string | bigint | null;
  actorUserId?: bigint;
  action: string;
  entityTable: string;
  entityId: string;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
};

async function writeAuditLog(args: AuditLogWriteArgs) {
  await writePlatformAudit({
    siteId: args.siteId == null ? null : String(args.siteId),
    actor: args.actorUserId == null ? null : buildAuditActorSnapshot({ actorUserId: args.actorUserId.toString() }),
    actorUserId: args.actorUserId == null ? null : args.actorUserId.toString(),
    action: args.action,
    entityTable: args.entityTable,
    entityId: args.entityId,
    beforeSnapshot: args.beforeSnapshot === undefined ? null : stringifyBigint(args.beforeSnapshot),
    afterSnapshot: args.afterSnapshot === undefined ? null : stringifyBigint(args.afterSnapshot),
  });
}

export function compactPlate(input: string | null | undefined) {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function resolveEffectiveSubscriptionStatus(input: {
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  now?: Date;
}): AdminSubscriptionStatus {
  const explicit = String(input.status ?? '').toUpperCase();
  if (explicit === 'SUSPENDED') return 'SUSPENDED';
  if (explicit === 'CANCELLED') return 'CANCELLED';
  if (explicit === 'EXPIRED') return 'EXPIRED';

  const now = input.now ?? new Date();
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  if (endDay < today) return 'EXPIRED';
  if (startDay > today) return 'ACTIVE';
  return 'ACTIVE';
}

function toDateOnly(value: any) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function decodeCursor(cursor?: string | null): bigint | null {
  const raw = String(cursor ?? '').trim();
  if (!raw) return null;
  try {
    return BigInt(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new ApiError({ code: 'BAD_REQUEST', message: 'Cursor không hợp lệ', details: { cursor } });
  }
}

function encodeCursor(id: bigint | number | string | null | undefined) {
  if (id == null) return null;
  return Buffer.from(String(id)).toString('base64url');
}

async function requireSiteByCode(siteCode: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT site_id, site_code, name FROM parking_sites WHERE site_code = ? LIMIT 1`,
    siteCode,
  );
  const row = rows[0];
  if (!row) throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy site', details: { siteCode } });
  return { siteId: BigInt(row.site_id), siteCode: String(row.site_code), siteName: String(row.name) };
}

async function resolveExistingCustomerReference(customerRefInput: string) {
  const customerRef = String(customerRefInput ?? '').trim();
  const numericCustomerId = /^\d+$/.test(customerRef) ? customerRef : null;

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT customer_id, full_name, phone, email
      FROM customers
      WHERE (? IS NOT NULL AND customer_id = ?)
         OR (? <> '' AND phone = ?)
         OR (? <> '' AND LOWER(email) = LOWER(?))
      LIMIT 1
    `,
    numericCustomerId,
    numericCustomerId,
    customerRef,
    customerRef,
    customerRef,
    customerRef,
  );

  const row = rows[0];
  if (!row) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'KhÃ´ng tÃ¬m tháº¥y customer',
      details: {
        customerRef,
        field: 'customerId',
        reason: 'KhÃ´ng khá»›p customer_id, sá»‘ Ä‘iá»‡n thoáº¡i hoáº·c email hiá»‡n cÃ³.',
        hint: 'DÃ¹ng customer_id, sá»‘ Ä‘iá»‡n thoáº¡i hoáº·c email cá»§a customer Ä‘Ã£ tá»“n táº¡i.',
      },
    });
  }

  return {
    customerId: String(row.customer_id),
    fullName: String(row.full_name),
    phone: row.phone == null ? null : String(row.phone),
    email: row.email == null ? null : String(row.email),
  };
}

async function requireSubscription(subscriptionId: string | bigint) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT subscription_id, site_id, site_code, site_name, customer_id,
             customer_name, customer_phone, plan_type, start_date, end_date, status, effective_status
      FROM pkg_subscription_effective_status_v
      WHERE subscription_id = ?
      LIMIT 1
    `,
    String(subscriptionId),
  );
  const row = rows[0];
  if (!row) throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy subscription', details: { subscriptionId: String(subscriptionId) } });
  return row;
}

async function requireSpot(spotId: string | bigint) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT sp.spot_id, sp.site_id, ps.site_code, sp.code AS spot_code, z.code AS zone_code
      FROM spots sp
      JOIN parking_sites ps ON ps.site_id = sp.site_id
      JOIN zones z ON z.zone_id = sp.zone_id
      WHERE sp.spot_id = ?
      LIMIT 1
    `,
    String(spotId),
  );
  const row = rows[0];
  if (!row) throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy spot', details: { spotId: String(spotId) } });
  return row;
}

async function requireVehicle(vehicleId: string | bigint) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT v.vehicle_id, v.license_plate, v.vehicle_type, v.owner_customer_id,
             c.full_name AS owner_name
      FROM vehicles v
      LEFT JOIN customers c ON c.customer_id = v.owner_customer_id
      WHERE v.vehicle_id = ?
      LIMIT 1
    `,
    String(vehicleId),
  );
  const row = rows[0];
  if (!row) throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy vehicle', details: { vehicleId: String(vehicleId) } });
  return row;
}

async function assertSiteConsistency(siteCode: string, subscriptionId: string | bigint, spotId?: string | bigint | null, vehicleSiteCode?: string | null) {
  const subscription = await requireSubscription(subscriptionId);
  if (String(subscription.site_code) !== String(siteCode)) {
    throw new ApiError({
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Subscription khác site',
      details: { subscriptionId: String(subscriptionId), siteCode, subscriptionSiteCode: String(subscription.site_code) },
    });
  }
  if (spotId != null) {
    const spot = await requireSpot(spotId);
    if (String(spot.site_code) !== String(siteCode)) {
      throw new ApiError({
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Spot khác site',
        details: { spotId: String(spotId), siteCode, spotSiteCode: String(spot.site_code) },
      });
    }
  }
  if (vehicleSiteCode && vehicleSiteCode !== siteCode) {
    throw new ApiError({
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Vehicle binding khác site',
      details: { siteCode, vehicleSiteCode },
    });
  }
}

async function assertActivePrimaryVehicleUnique(args: { subscriptionId: string | bigint; excludeId?: string | bigint | null }) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT subscription_vehicle_id
      FROM subscription_vehicles
      WHERE subscription_id = ?
        AND is_primary = 1
        AND status = 'ACTIVE'
        AND (? IS NULL OR subscription_vehicle_id <> ?)
      LIMIT 1
    `,
    String(args.subscriptionId),
    args.excludeId == null ? null : String(args.excludeId),
    args.excludeId == null ? null : String(args.excludeId),
  );
  if (rows[0]) {
    throw new ApiError({
      code: 'CONFLICT',
      message: 'Subscription đã có primary vehicle active',
      details: { subscriptionId: String(args.subscriptionId), existingId: String(rows[0].subscription_vehicle_id) },
    });
  }
}

async function assertActivePrimarySpotUnique(args: { subscriptionId: string | bigint; excludeId?: string | bigint | null }) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT subscription_spot_id
      FROM subscription_spots
      WHERE subscription_id = ?
        AND is_primary = 1
        AND status = 'ACTIVE'
        AND (? IS NULL OR subscription_spot_id <> ?)
      LIMIT 1
    `,
    String(args.subscriptionId),
    args.excludeId == null ? null : String(args.excludeId),
    args.excludeId == null ? null : String(args.excludeId),
  );
  if (rows[0]) {
    throw new ApiError({
      code: 'CONFLICT',
      message: 'Subscription đã có primary assigned spot active',
      details: { subscriptionId: String(args.subscriptionId), existingId: String(rows[0].subscription_spot_id) },
    });
  }
}

async function assertAssignedSpotConflict(args: { siteCode: string; spotId: string | bigint; excludeId?: string | bigint | null }) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT subscription_spot_id, subscription_id
      FROM pkg_subscription_spot_assignments_v
      WHERE site_code = ?
        AND spot_id = ?
        AND active_window_flag = 1
        AND (? IS NULL OR subscription_spot_id <> ?)
      LIMIT 1
    `,
    args.siteCode,
    String(args.spotId),
    args.excludeId == null ? null : String(args.excludeId),
    args.excludeId == null ? null : String(args.excludeId),
  );
  if (rows[0]) {
    throw new ApiError({
      code: 'CONFLICT',
      message: 'Spot đang được assign active cho subscription khác',
      details: { spotId: String(args.spotId), conflictingSubscriptionId: String(rows[0].subscription_id) },
    });
  }
}

async function loadLinks(subscriptionIds: string[]) {
  if (subscriptionIds.length === 0) return { spotsBySubId: new Map(), vehiclesBySubId: new Map() };
  const placeholders = subscriptionIds.map(() => '?').join(',');

  const spotRows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT subscription_spot_id, subscription_id, site_id, site_code, spot_id,
             spot_code, zone_code, assigned_mode, status,
             is_primary, assigned_from, assigned_until, note
      FROM pkg_subscription_spot_assignments_v
      WHERE subscription_id IN (${placeholders})
      ORDER BY subscription_id ASC, is_primary DESC, subscription_spot_id ASC
    `,
    ...subscriptionIds,
  );

  const vehicleRows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT subscription_vehicle_id, subscription_id, site_id, site_code,
             vehicle_id, license_plate, vehicle_type, plate_compact,
             status, is_primary, valid_from, valid_to, note
      FROM pkg_subscription_vehicle_active_v
      WHERE subscription_id IN (${placeholders})
      ORDER BY subscription_id ASC, is_primary DESC, subscription_vehicle_id ASC
    `,
    ...subscriptionIds,
  );

  const spotsBySubId = new Map<string, any[]>();
  const vehiclesBySubId = new Map<string, any[]>();

  for (const row of spotRows) {
    const key = String(row.subscription_id);
    const item = {
      subscriptionSpotId: String(row.subscription_spot_id),
      subscriptionId: String(row.subscription_id),
      siteCode: String(row.site_code),
      spotId: String(row.spot_id),
      spotCode: String(row.spot_code),
      zoneCode: String(row.zone_code),
      assignedMode: String(row.assigned_mode),
      status: String(row.status),
      isPrimary: Boolean(row.is_primary),
      assignedFrom: toDateOnly(row.assigned_from),
      assignedUntil: toDateOnly(row.assigned_until),
      note: row.note == null ? null : String(row.note),
    };
    if (!spotsBySubId.has(key)) spotsBySubId.set(key, []);
    spotsBySubId.get(key)!.push(item);
  }

  for (const row of vehicleRows) {
    const key = String(row.subscription_id);
    const item = {
      subscriptionVehicleId: String(row.subscription_vehicle_id),
      subscriptionId: String(row.subscription_id),
      siteCode: String(row.site_code),
      vehicleId: String(row.vehicle_id),
      licensePlate: String(row.license_plate),
      plateCompact: String(row.plate_compact),
      vehicleType: String(row.vehicle_type),
      status: String(row.status),
      isPrimary: Boolean(row.is_primary),
      validFrom: toDateOnly(row.valid_from),
      validTo: toDateOnly(row.valid_to),
      note: row.note == null ? null : String(row.note),
    };
    if (!vehiclesBySubId.has(key)) vehiclesBySubId.set(key, []);
    vehiclesBySubId.get(key)!.push(item);
  }

  return { spotsBySubId, vehiclesBySubId };
}

export async function listAdminSubscriptions(args: {
  siteCode?: string;
  status?: string;
  plate?: string;
  limit?: number;
  cursor?: string | null;
}) {
  const limit = Math.max(1, Math.min(200, Number(args.limit ?? 50)));
  const cursor = decodeCursor(args.cursor);
  const plate = compactPlate(args.plate);

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT s.subscription_id, s.site_id, s.site_code, s.site_name,
             s.customer_id, s.customer_name, s.customer_phone,
             s.plan_type, s.start_date, s.end_date, s.status, s.effective_status
      FROM pkg_subscription_effective_status_v s
      WHERE (? IS NULL OR s.site_code = ?)
        AND (? IS NULL OR s.subscription_id < ?)
        AND (
          ? = '' OR EXISTS (
            SELECT 1
            FROM pkg_subscription_vehicle_active_v sv
            WHERE sv.subscription_id = s.subscription_id
              AND sv.plate_compact = ?
              AND sv.status IN ('ACTIVE','SUSPENDED')
          )
        )
        AND (? IS NULL OR ? = '' OR s.effective_status = ?)
      ORDER BY s.subscription_id DESC
      LIMIT ?
    `,
    args.siteCode ?? null,
    args.siteCode ?? null,
    cursor == null ? null : cursor.toString(),
    cursor == null ? null : cursor.toString(),
    plate,
    plate,
    args.status ?? null,
    args.status ?? null,
    args.status ?? null,
    limit + 1,
  );

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const ids = pageRows.map((row) => String(row.subscription_id));
  const links = await loadLinks(ids);

  const items = pageRows.map((row) => ({
    subscriptionId: String(row.subscription_id),
    siteId: String(row.site_id),
    siteCode: String(row.site_code),
    siteName: String(row.site_name),
    customerId: String(row.customer_id),
    customerName: String(row.customer_name),
    customerPhone: row.customer_phone == null ? null : String(row.customer_phone),
    planType: String(row.plan_type),
    startDate: toDateOnly(row.start_date),
    endDate: toDateOnly(row.end_date),
    status: String(row.status),
    effectiveStatus: String(row.effective_status),
    spots: links.spotsBySubId.get(String(row.subscription_id)) ?? [],
    vehicles: links.vehiclesBySubId.get(String(row.subscription_id)) ?? [],
  }));

  return {
    items,
    nextCursor: hasMore ? encodeCursor(pageRows[pageRows.length - 1].subscription_id) : null,
  };
}

export async function createAdminSubscription(input: {
  siteCode: string;
  customerId: string;
  planType: 'MONTHLY' | 'VIP';
  startDate: string;
  endDate: string;
  status?: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';
}, opts: { actorUserId?: bigint } = {}) {
  const site = await requireSiteByCode(input.siteCode);
  const customer = await resolveExistingCustomerReference(input.customerId);
  await prisma.$executeRawUnsafe(
    `CALL pkg_subscription_create(?, ?, ?, ?, ?, ?)`,
    site.siteId.toString(),
    customer.customerId,
    input.planType,
    input.startDate,
    input.endDate,
    input.status ?? 'ACTIVE',
  );
  const createdRows = await prisma.$queryRawUnsafe<any[]>(`SELECT LAST_INSERT_ID() AS id`);
  const createdId = createdRows[0]?.id == null ? null : String(createdRows[0].id);
  if (!createdId) {
    throw new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'Created subscription could not be resolved after insert',
      details: { siteCode: input.siteCode, customerRef: input.customerId },
    });
  }
  const detail = await getAdminSubscriptionDetail(createdId);
  await writeAuditLog({ siteId: site.siteId, actorUserId: opts.actorUserId, action: 'SUBSCRIPTION_CREATED', entityTable: 'subscriptions', entityId: createdId, afterSnapshot: detail });
  return detail;
}

export async function updateAdminSubscription(subscriptionId: string, patch: {
  planType?: 'MONTHLY' | 'VIP';
  startDate?: string;
  endDate?: string;
  status?: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';
}, opts: { actorUserId?: bigint } = {}) {
  const before = await getAdminSubscriptionDetail(subscriptionId);
  await requireSubscription(subscriptionId);
  await prisma.$executeRawUnsafe(
    `CALL pkg_subscription_update(?, ?, ?, ?, ?)`,
    subscriptionId,
    patch.planType ?? null,
    patch.startDate ?? null,
    patch.endDate ?? null,
    patch.status ?? null,
  );
  const detail = await getAdminSubscriptionDetail(subscriptionId);
  await writeAuditLog({ siteId: detail.siteId, actorUserId: opts.actorUserId, action: 'SUBSCRIPTION_UPDATED', entityTable: 'subscriptions', entityId: subscriptionId, beforeSnapshot: before, afterSnapshot: detail });
  return detail;
}

export async function getAdminSubscriptionDetail(subscriptionId: string) {
  const row = await requireSubscription(subscriptionId);
  const links = await loadLinks([String(row.subscription_id)]);
  return {
    subscriptionId: String(row.subscription_id),
    siteId: String(row.site_id),
    siteCode: String(row.site_code),
    siteName: String(row.site_name),
    customerId: String(row.customer_id),
    customerName: String(row.customer_name),
    planType: String(row.plan_type),
    startDate: toDateOnly(row.start_date),
    endDate: toDateOnly(row.end_date),
    status: String(row.status),
    effectiveStatus: String(row.effective_status ?? resolveEffectiveSubscriptionStatus({ status: String(row.status), startDate: row.start_date, endDate: row.end_date })),
    spots: links.spotsBySubId.get(String(row.subscription_id)) ?? [],
    vehicles: links.vehiclesBySubId.get(String(row.subscription_id)) ?? [],
  };
}

export async function listAdminSubscriptionSpots(args: { siteCode?: string; subscriptionId?: string; status?: string; limit?: number; cursor?: string | null; }) {
  const limit = Math.max(1, Math.min(200, Number(args.limit ?? 50)));
  const cursor = decodeCursor(args.cursor);
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT subscription_spot_id, subscription_id, site_code, spot_id, spot_code, zone_code,
             assigned_mode, status, is_primary, assigned_from, assigned_until, note
      FROM pkg_subscription_spot_assignments_v
      WHERE (? IS NULL OR site_code = ?)
        AND (? IS NULL OR subscription_id = ?)
        AND (? IS NULL OR status = ?)
        AND (? IS NULL OR subscription_spot_id < ?)
      ORDER BY subscription_spot_id DESC
      LIMIT ?
    `,
    args.siteCode ?? null, args.siteCode ?? null,
    args.subscriptionId ?? null, args.subscriptionId ?? null,
    args.status ?? null, args.status ?? null,
    cursor == null ? null : cursor.toString(), cursor == null ? null : cursor.toString(),
    limit + 1,
  );
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: pageRows.map((row) => ({
      subscriptionSpotId: String(row.subscription_spot_id),
      subscriptionId: String(row.subscription_id),
      siteCode: String(row.site_code),
      spotId: String(row.spot_id),
      spotCode: String(row.spot_code),
      zoneCode: String(row.zone_code),
      assignedMode: String(row.assigned_mode),
      status: String(row.status),
      isPrimary: Boolean(row.is_primary),
      assignedFrom: toDateOnly(row.assigned_from),
      assignedUntil: toDateOnly(row.assigned_until),
      note: row.note == null ? null : String(row.note),
    })),
    nextCursor: hasMore ? encodeCursor(pageRows[pageRows.length - 1].subscription_spot_id) : null,
  };
}

export async function createAdminSubscriptionSpot(input: { subscriptionId: string; siteCode: string; spotId: string; assignedMode?: AssignedMode; status?: SubscriptionSpotStatus; isPrimary?: boolean; assignedFrom?: string | null; assignedUntil?: string | null; note?: string | null; }, opts: { actorUserId?: bigint } = {}) {
  await assertSiteConsistency(input.siteCode, input.subscriptionId, input.spotId, input.siteCode);
  if (input.isPrimary) await assertActivePrimarySpotUnique({ subscriptionId: input.subscriptionId });
  if ((input.status ?? 'ACTIVE') === 'ACTIVE') await assertAssignedSpotConflict({ siteCode: input.siteCode, spotId: input.spotId });
  const site = await requireSiteByCode(input.siteCode);
  await prisma.$executeRawUnsafe(
    `CALL pkg_subscription_assign_spot(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.subscriptionId, site.siteId.toString(), input.spotId,
    input.assignedMode ?? 'ASSIGNED', input.status ?? 'ACTIVE', input.isPrimary ? 1 : 0,
    input.assignedFrom ?? null, input.assignedUntil ?? null, input.note ?? null,
  );
  const idRows = await prisma.$queryRawUnsafe<any[]>(`SELECT LAST_INSERT_ID() AS id`);
  const createdId = String(idRows[0].id);
  const data = await listAdminSubscriptionSpots({ subscriptionId: input.subscriptionId, limit: 200 });
  const detail = data.items.find((item) => item.subscriptionSpotId === createdId) ?? null;
  await writeAuditLog({ siteId: site.siteId, actorUserId: opts.actorUserId, action: 'SUBSCRIPTION_SPOT_CREATED', entityTable: 'subscription_spots', entityId: createdId, afterSnapshot: detail });
  return detail;
}

export async function updateAdminSubscriptionSpot(subscriptionSpotId: string, patch: { status?: SubscriptionSpotStatus; assignedMode?: AssignedMode; isPrimary?: boolean; assignedFrom?: string | null; assignedUntil?: string | null; note?: string | null; }, opts: { actorUserId?: bigint } = {}) {
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT subscription_id, site_id, spot_id FROM subscription_spots WHERE subscription_spot_id = ? LIMIT 1`, subscriptionSpotId);
  const current = rows[0];
  if (!current) throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy subscription spot', details: { subscriptionSpotId } });
  const siteRows = await prisma.$queryRawUnsafe<any[]>(`SELECT site_code FROM parking_sites WHERE site_id = ? LIMIT 1`, String(current.site_id));
  const beforeData = await listAdminSubscriptionSpots({ subscriptionId: String(current.subscription_id), limit: 200 });
  const before = beforeData.items.find((item) => item.subscriptionSpotId === subscriptionSpotId) ?? null;
  const siteCode = String(siteRows[0].site_code);
  if (patch.isPrimary) await assertActivePrimarySpotUnique({ subscriptionId: String(current.subscription_id), excludeId: subscriptionSpotId });
  if ((patch.status ?? 'ACTIVE') === 'ACTIVE') await assertAssignedSpotConflict({ siteCode, spotId: String(current.spot_id), excludeId: subscriptionSpotId });
  await prisma.$executeRawUnsafe(
    `CALL pkg_subscription_update_spot(?, ?, ?, ?, ?, ?, ?)`,
    subscriptionSpotId,
    patch.status ?? null,
    patch.assignedMode ?? null,
    patch.isPrimary == null ? null : (patch.isPrimary ? 1 : 0),
    patch.assignedFrom ?? null,
    patch.assignedUntil ?? null,
    patch.note ?? null,
  );
  const data = await listAdminSubscriptionSpots({ subscriptionId: String(current.subscription_id), limit: 200 });
  const detail = data.items.find((item) => item.subscriptionSpotId === subscriptionSpotId) ?? null;
  await writeAuditLog({ siteId: String(current.site_id), actorUserId: opts.actorUserId, action: 'SUBSCRIPTION_SPOT_UPDATED', entityTable: 'subscription_spots', entityId: subscriptionSpotId, beforeSnapshot: before, afterSnapshot: detail });
  return detail;
}

export async function listAdminSubscriptionVehicles(args: { siteCode?: string; subscriptionId?: string; status?: string; plate?: string; limit?: number; cursor?: string | null; }) {
  const limit = Math.max(1, Math.min(200, Number(args.limit ?? 50)));
  const cursor = decodeCursor(args.cursor);
  const plate = compactPlate(args.plate);
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT subscription_vehicle_id, subscription_id, site_code, vehicle_id, license_plate, vehicle_type,
             plate_compact, status, is_primary, valid_from, valid_to, note
      FROM pkg_subscription_vehicle_active_v
      WHERE (? IS NULL OR site_code = ?)
        AND (? IS NULL OR subscription_id = ?)
        AND (? = '' OR plate_compact = ?)
        AND (? IS NULL OR status = ?)
        AND (? IS NULL OR subscription_vehicle_id < ?)
      ORDER BY subscription_vehicle_id DESC
      LIMIT ?
    `,
    args.siteCode ?? null, args.siteCode ?? null,
    args.subscriptionId ?? null, args.subscriptionId ?? null,
    plate, plate,
    args.status ?? null, args.status ?? null,
    cursor == null ? null : cursor.toString(), cursor == null ? null : cursor.toString(),
    limit + 1,
  );
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: pageRows.map((row) => ({
      subscriptionVehicleId: String(row.subscription_vehicle_id),
      subscriptionId: String(row.subscription_id),
      siteCode: String(row.site_code),
      vehicleId: String(row.vehicle_id),
      licensePlate: String(row.license_plate),
      plateCompact: String(row.plate_compact),
      vehicleType: String(row.vehicle_type),
      status: String(row.status),
      isPrimary: Boolean(row.is_primary),
      validFrom: toDateOnly(row.valid_from),
      validTo: toDateOnly(row.valid_to),
      note: row.note == null ? null : String(row.note),
    })),
    nextCursor: hasMore ? encodeCursor(pageRows[pageRows.length - 1].subscription_vehicle_id) : null,
  };
}

export async function createAdminSubscriptionVehicle(input: { subscriptionId: string; siteCode: string; vehicleId: string; status?: SubscriptionVehicleStatus; isPrimary?: boolean; validFrom?: string | null; validTo?: string | null; note?: string | null; }, opts: { actorUserId?: bigint } = {}) {
  await assertSiteConsistency(input.siteCode, input.subscriptionId, null, input.siteCode);
  if (input.isPrimary) await assertActivePrimaryVehicleUnique({ subscriptionId: input.subscriptionId });
  const site = await requireSiteByCode(input.siteCode);
  await prisma.$executeRawUnsafe(
    `CALL pkg_subscription_bind_vehicle(?, ?, ?, ?, ?, ?, ?, ?)`,
    input.subscriptionId,
    site.siteId.toString(),
    input.vehicleId,
    input.status ?? 'ACTIVE',
    input.isPrimary ? 1 : 0,
    input.validFrom ?? null,
    input.validTo ?? null,
    input.note ?? null,
  );
  const idRows = await prisma.$queryRawUnsafe<any[]>(`SELECT LAST_INSERT_ID() AS id`);
  const createdId = String(idRows[0].id);
  const data = await listAdminSubscriptionVehicles({ subscriptionId: input.subscriptionId, limit: 200 });
  const detail = data.items.find((item) => item.subscriptionVehicleId === createdId) ?? null;
  await writeAuditLog({ siteId: site.siteId, actorUserId: opts.actorUserId, action: 'SUBSCRIPTION_VEHICLE_CREATED', entityTable: 'subscription_vehicles', entityId: createdId, afterSnapshot: detail });
  return detail;
}

export async function updateAdminSubscriptionVehicle(subscriptionVehicleId: string, patch: { status?: SubscriptionVehicleStatus; isPrimary?: boolean; validFrom?: string | null; validTo?: string | null; note?: string | null; }, opts: { actorUserId?: bigint } = {}) {
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT subscription_id FROM subscription_vehicles WHERE subscription_vehicle_id = ? LIMIT 1`, subscriptionVehicleId);
  const current = rows[0];
  if (!current) throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy subscription vehicle', details: { subscriptionVehicleId } });
  const beforeData = await listAdminSubscriptionVehicles({ subscriptionId: String(current.subscription_id), limit: 200 });
  const before = beforeData.items.find((item) => item.subscriptionVehicleId === subscriptionVehicleId) ?? null;
  if (patch.isPrimary) await assertActivePrimaryVehicleUnique({ subscriptionId: String(current.subscription_id), excludeId: subscriptionVehicleId });
  await prisma.$executeRawUnsafe(
    `CALL pkg_subscription_update_vehicle(?, ?, ?, ?, ?, ?)`,
    subscriptionVehicleId,
    patch.status ?? null,
    patch.isPrimary == null ? null : (patch.isPrimary ? 1 : 0),
    patch.validFrom ?? null,
    patch.validTo ?? null,
    patch.note ?? null,
  );
  const data = await listAdminSubscriptionVehicles({ subscriptionId: String(current.subscription_id), limit: 200 });
  const detail = data.items.find((item) => item.subscriptionVehicleId === subscriptionVehicleId) ?? null;
  await writeAuditLog({ actorUserId: opts.actorUserId, action: 'SUBSCRIPTION_VEHICLE_UPDATED', entityTable: 'subscription_vehicles', entityId: subscriptionVehicleId, beforeSnapshot: before, afterSnapshot: detail });
  return detail;
}
