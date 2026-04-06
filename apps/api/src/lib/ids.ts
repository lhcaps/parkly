import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

async function hasGateLaneFoundation(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ cnt: any }[]>(Prisma.sql`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name IN ('gate_lanes', 'gate_lane_devices')
  `);

  return Number(rows?.[0]?.cnt ?? 0) >= 2;
}

/**
 * Resolve deterministic IDs by stable codes.
 *
 * PR-01:
 * - Không lệ thuộc cứng SITE_HCM_01 / GATE_ENTRY_01 khi UI không gửi code.
 * - Nếu env không cấu hình, tự lấy site/device đầu tiên có trong master data.
 */

export function getConfiguredSiteCode(): string {
  return (process.env.DEMO_SITE_CODE ?? '').trim();
}

export function getConfiguredDeviceCode(): string {
  return (process.env.DEMO_DEVICE_CODE ?? '').trim();
}

export function getDefaultSiteCode(): string {
  return getConfiguredSiteCode() || 'SITE_HCM_01';
}

export function getDefaultDeviceCode(): string {
  return getConfiguredDeviceCode() || 'GATE_ENTRY_01';
}

export async function resolveDefaultSiteCode(): Promise<string> {
  const configured = getConfiguredSiteCode();
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
  const configured = getConfiguredDeviceCode();
  if (configured) return configured;

  if (await hasGateLaneFoundation()) {
    const laneRows = await prisma.$queryRaw<{ device_code: string | null }[]>(Prisma.sql`
      SELECT COALESCE(gd_primary.device_code, gd_fallback.device_code) AS device_code
      FROM gate_lanes gl
      LEFT JOIN gate_lane_devices gld_primary
        ON gld_primary.lane_id = gl.lane_id
       AND gld_primary.is_primary = 1
      LEFT JOIN gate_devices gd_primary
        ON gd_primary.device_id = gld_primary.device_id
      LEFT JOIN gate_devices gd_fallback
        ON gd_fallback.device_id = gl.primary_device_id
      WHERE gl.site_id = ${siteId}
      ORDER BY
        CASE WHEN gl.direction = 'ENTRY' THEN 0 ELSE 1 END,
        gl.sort_order ASC,
        gl.lane_code ASC
      LIMIT 1
    `);

    const laneDeviceCode = laneRows?.[0]?.device_code?.trim();
    if (laneDeviceCode) return laneDeviceCode;
  }

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

export async function resolveGateIds(args?: {
  siteCode?: string;
  deviceCode?: string;
}): Promise<{ siteCode: string; deviceCode: string; siteId: bigint; deviceId: bigint }> {
  const siteCode = (args?.siteCode ?? '').trim() || await resolveDefaultSiteCode();
  const siteId = await resolveSiteIdByCode(siteCode);
  const deviceCode = (args?.deviceCode ?? '').trim() || await resolveDefaultDeviceCode(siteId);
  const deviceId = await resolveDeviceIdByCode({ siteId, deviceCode });
  return { siteCode, deviceCode, siteId, deviceId };
}
