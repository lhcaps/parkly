import * as dotenv from 'dotenv';
dotenv.config();

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export function getDemoSiteCode(): string {
  return (process.env.DEMO_SITE_CODE ?? '').trim();
}

export function getDemoDeviceCode(): string {
  return (process.env.DEMO_DEVICE_CODE ?? '').trim();
}

export async function resolveDefaultSiteCode(): Promise<string> {
  const configured = getDemoSiteCode();
  if (configured) return configured;

  const rows = await prisma.$queryRaw<{ site_code: string }[]>(Prisma.sql`
    SELECT site_code
    FROM parking_sites
    WHERE is_active = 1
    ORDER BY site_code ASC
    LIMIT 1
  `);

  const siteCode = rows?.[0]?.site_code;
  if (!siteCode) {
    throw new Error("Cannot resolve default site_code. Run: pnpm db:seed:min (or insert parking_sites rows).");
  }

  return siteCode;
}

export async function resolveDefaultDeviceCode(siteId: bigint): Promise<string> {
  const configured = getDemoDeviceCode();
  if (configured) return configured;

  const rows = await prisma.$queryRaw<{ device_code: string }[]>(Prisma.sql`
    SELECT device_code
    FROM gate_devices
    WHERE site_id = ${siteId}
    ORDER BY CASE WHEN direction = 'ENTRY' THEN 0 ELSE 1 END, device_code ASC
    LIMIT 1
  `);

  const deviceCode = rows?.[0]?.device_code;
  if (!deviceCode) {
    throw new Error(`Cannot resolve default device_code for site_id=${siteId}. Run: pnpm db:seed:min (or insert gate_devices rows).`);
  }

  return deviceCode;
}

export async function resolveSiteIdByCode(siteCode: string): Promise<bigint> {
  const rows = await prisma.$queryRaw<{ site_id: any }[]>(Prisma.sql`
    SELECT site_id
    FROM parking_sites
    WHERE site_code = ${siteCode}
    LIMIT 1
  `);

  const siteId = rows?.[0]?.site_id;
  if (siteId === undefined || siteId === null) {
    throw new Error(
      `Cannot resolve site_id for site_code='${siteCode}'. Run: pnpm db:seed:min (or insert parking_sites row).`
    );
  }

  return BigInt(siteId);
}

export async function resolveDeviceIdByCode(args: {
  siteId: bigint;
  deviceCode: string;
}): Promise<bigint> {
  const rows = await prisma.$queryRaw<{ device_id: any }[]>(Prisma.sql`
    SELECT device_id
    FROM gate_devices
    WHERE site_id = ${args.siteId}
      AND device_code = ${args.deviceCode}
    LIMIT 1
  `);

  const deviceId = rows?.[0]?.device_id;
  if (deviceId === undefined || deviceId === null) {
    throw new Error(
      `Cannot resolve device_id for device_code='${args.deviceCode}' (site_id=${args.siteId}). Run: pnpm db:seed:min (or insert gate_devices row).`
    );
  }

  return BigInt(deviceId);
}

export async function resolveDemoGateIds(): Promise<{
  siteCode: string;
  deviceCode: string;
  siteId: bigint;
  deviceId: bigint;
}> {
  const siteCode = await resolveDefaultSiteCode();
  const siteId = await resolveSiteIdByCode(siteCode);
  const deviceCode = await resolveDefaultDeviceCode(siteId);
  const deviceId = await resolveDeviceIdByCode({ siteId, deviceCode });

  return { siteCode, deviceCode, siteId, deviceId };
}
