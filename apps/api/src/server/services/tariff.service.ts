import { Prisma, type tariffs_applies_to, type tariffs_vehicle_type, type tariff_rules_rule_type } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { Tx } from './with-actor';

export async function createTariffTx(
  tx: Tx,
  args: {
    siteId: bigint;
    name: string;
    appliesTo: 'TICKET' | 'SUBSCRIPTION';
    vehicleType: 'CAR' | 'MOTORBIKE';
    isActive: boolean;
    validFrom: Date;
  }
): Promise<{ tariffId: bigint }> {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO tariffs(site_id, name, applies_to, vehicle_type, is_active, valid_from)
    VALUES (${args.siteId}, ${args.name}, ${args.appliesTo}, ${args.vehicleType}, ${args.isActive ? 1 : 0}, ${args.validFrom})
  `);

  const t = await tx.$queryRaw<{ tariff_id: any }[]>(Prisma.sql`
    SELECT tariff_id
    FROM tariffs
    WHERE site_id = ${args.siteId} AND name = ${args.name}
    ORDER BY tariff_id DESC
    LIMIT 1
  `);
  if (!t[0]?.tariff_id) throw new Error('Failed to retrieve created tariff_id');
  return { tariffId: BigInt(t[0].tariff_id) };
}

export async function addTariffRuleTx(
  tx: Tx,
  args: {
    tariffId: bigint;
    ruleType: 'FREE_MINUTES' | 'HOURLY' | 'DAILY_CAP' | 'OVERNIGHT';
    paramJson: unknown;
    priority: number;
  }
): Promise<{ ruleId: bigint }> {
  const json = JSON.stringify(args.paramJson ?? {});
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO tariff_rules(tariff_id, rule_type, param_json, priority)
    VALUES (${args.tariffId}, ${args.ruleType}, CAST(${json} AS JSON), ${args.priority})
  `);

  const r = await tx.$queryRaw<{ rule_id: any }[]>(Prisma.sql`
    SELECT rule_id
    FROM tariff_rules
    WHERE tariff_id = ${args.tariffId}
    ORDER BY rule_id DESC
    LIMIT 1
  `);
  if (!r[0]?.rule_id) throw new Error('Failed to retrieve created rule_id');
  return { ruleId: BigInt(r[0].rule_id) };
}

export async function updateTariffActiveTx(tx: Tx, args: { tariffId: bigint; isActive: boolean }) {
  await tx.$executeRaw(
    Prisma.sql`UPDATE tariffs SET is_active = ${args.isActive ? 1 : 0} WHERE tariff_id = ${args.tariffId}`
  );
}

export async function patchTariffTx(
  tx: Tx,
  args: {
    tariffId: bigint;
    name?: string;
    vehicleType?: 'CAR' | 'MOTORBIKE';
    appliesTo?: 'TICKET' | 'SUBSCRIPTION';
    validFrom?: Date;
    isActive?: boolean;
  }
) {
  const parts: Prisma.Sql[] = [];
  if (args.name != null) parts.push(Prisma.sql`name = ${args.name}`);
  if (args.vehicleType != null) parts.push(Prisma.sql`vehicle_type = ${args.vehicleType}`);
  if (args.appliesTo != null) parts.push(Prisma.sql`applies_to = ${args.appliesTo}`);
  if (args.validFrom != null) parts.push(Prisma.sql`valid_from = ${args.validFrom}`);
  if (args.isActive != null) parts.push(Prisma.sql`is_active = ${args.isActive ? 1 : 0}`);

  if (parts.length === 0) return;

  const setSql = Prisma.join(parts, ', ');
  await tx.$executeRaw(Prisma.sql`UPDATE tariffs SET ${setSql} WHERE tariff_id = ${args.tariffId}`);
}

export async function deleteTariffRuleTx(tx: Tx, args: { tariffId: bigint; ruleId: bigint }): Promise<{ deleted: number }> {
  const res = await tx.$executeRaw(
    Prisma.sql`DELETE FROM tariff_rules WHERE tariff_id = ${args.tariffId} AND rule_id = ${args.ruleId}`
  );
  return { deleted: Number(res) || 0 };
}

export async function listTariffs(args: { siteId: bigint; limit?: number }) {
  const limit = Math.min(200, Math.max(1, args.limit ?? 50));
  return prisma.tariffs.findMany({
    where: { site_id: args.siteId },
    orderBy: { tariff_id: 'desc' },
    take: limit,
    include: { tariff_rules: true },
  });
}

export async function listAuditLogs(args: { siteId?: bigint; entityTable?: string; limit?: number }) {
  const limit = Math.min(200, Math.max(1, args.limit ?? 50));
  return prisma.audit_logs.findMany({
    where: {
      ...(args.siteId ? { site_id: args.siteId } : {}),
      ...(args.entityTable ? { entity_table: args.entityTable } : {}),
    },
    orderBy: { audit_id: 'desc' },
    take: limit,
  });
}

// --- PR-BE-06: Quote helper ---

function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

export async function quoteTariff(args: {
  siteId: bigint;
  vehicleType: 'CAR' | 'MOTORBIKE';
  entryTime: Date;
  exitTime: Date;
}): Promise<{
  tariffId: bigint | null;
  minutes: number;
  breakdown: Array<{ ruleType: string; amount: number; note?: string }>;
  subtotal: number;
  total: number;
}> {
  const minutes = Math.max(0, Math.floor((args.exitTime.getTime() - args.entryTime.getTime()) / 60000));

  const tariff = await prisma.tariffs.findFirst({
    where: {
      site_id: args.siteId,
      is_active: true,
      applies_to: 'TICKET',
      vehicle_type: args.vehicleType,
      valid_from: { lte: args.entryTime },
    },
    orderBy: { valid_from: 'desc' },
    include: { tariff_rules: { orderBy: { priority: 'asc' } } },
  });

  if (!tariff) {
    return { tariffId: null, minutes, breakdown: [], subtotal: 0, total: 0 };
  }

  let freeMinutes = 0;
  let perHour = 0;
  let dailyCap: number | null = null;

  for (const r of tariff.tariff_rules) {
    if (r.rule_type === 'FREE_MINUTES') {
      const m = Number((r.param_json as any)?.minutes ?? 0);
      if (Number.isFinite(m) && m > 0) freeMinutes = Math.max(freeMinutes, Math.floor(m));
    }
    if (r.rule_type === 'HOURLY') {
      const v = Number((r.param_json as any)?.perHour ?? (r.param_json as any)?.pricePerHour ?? 0);
      if (Number.isFinite(v) && v > 0) perHour = Math.max(perHour, v);
    }
    if (r.rule_type === 'DAILY_CAP') {
      const c = Number((r.param_json as any)?.capAmount ?? 0);
      if (Number.isFinite(c) && c > 0) dailyCap = dailyCap == null ? c : Math.min(dailyCap, c);
    }
  }

  const breakdown: Array<{ ruleType: string; amount: number; note?: string }> = [];

  let billableMinutes = minutes;
  if (freeMinutes > 0) {
    const usedFree = Math.min(minutes, freeMinutes);
    billableMinutes = Math.max(0, minutes - usedFree);
    breakdown.push({ ruleType: 'FREE_MINUTES', amount: 0, note: `Free ${usedFree} minutes` });
  }

  let subtotal = 0;
  if (perHour > 0) {
    const hours = ceilDiv(billableMinutes, 60);
    subtotal = hours * perHour;
    breakdown.push({ ruleType: 'HOURLY', amount: subtotal, note: `${hours} × ${perHour} / hour` });
  }

  let total = subtotal;
  if (dailyCap != null) {
    total = Math.min(total, dailyCap);
    breakdown.push({ ruleType: 'DAILY_CAP', amount: total, note: `Cap ${dailyCap}` });
  }

  return {
    tariffId: tariff.tariff_id,
    minutes,
    breakdown,
    subtotal,
    total,
  };
}


export async function quoteTicketExitTariff(args: {
  siteId: bigint;
  vehicleType: 'CAR' | 'MOTORBIKE';
  entryTime: Date;
  exitTime: Date;
}) {
  return quoteTariff({
    siteId: args.siteId,
    vehicleType: args.vehicleType,
    entryTime: args.entryTime,
    exitTime: args.exitTime,
  });
}
