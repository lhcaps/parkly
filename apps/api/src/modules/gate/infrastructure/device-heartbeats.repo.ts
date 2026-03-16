import { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma';
import { ApiError } from '../../../server/http';

export type HeartbeatStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE';

export type DeviceContext = {
  siteId: bigint;
  siteCode: string;
  deviceId: bigint;
  deviceCode: string;
  deviceType: string;
  direction: 'ENTRY' | 'EXIT';
  laneId: bigint | null;
  laneCode: string | null;
};

function jsonSafe(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined) return null;
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  ) as Prisma.InputJsonValue;
}

export async function resolveDeviceContext(args: {
  siteCode: string;
  deviceCode: string;
}): Promise<DeviceContext> {
  const siteCode = String(args.siteCode ?? '').trim();
  const deviceCode = String(args.deviceCode ?? '').trim();

  if (!siteCode || !deviceCode) {
    throw new ApiError({ code: 'BAD_REQUEST', message: 'siteCode và deviceCode là bắt buộc' });
  }

  const rows = await prisma.$queryRaw<any[]>(Prisma.sql`
    SELECT
      ps.site_id AS site_id,
      ps.site_code AS site_code,
      gd.device_id AS device_id,
      gd.device_code AS device_code,
      gd.device_type AS device_type,
      gd.direction AS direction,
      gl.lane_id AS lane_id,
      gl.lane_code AS lane_code
    FROM parking_sites ps
    JOIN gate_devices gd
      ON gd.site_id = ps.site_id
    LEFT JOIN gate_lane_devices gld
      ON gld.device_id = gd.device_id
    LEFT JOIN gate_lanes gl
      ON gl.lane_id = gld.lane_id
    WHERE ps.site_code = ${siteCode}
      AND gd.device_code = ${deviceCode}
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Không resolve được device từ master data',
      details: { siteCode, deviceCode },
    });
  }

  return {
    siteId: BigInt(row.site_id),
    siteCode: String(row.site_code),
    deviceId: BigInt(row.device_id),
    deviceCode: String(row.device_code),
    deviceType: String(row.device_type),
    direction: String(row.direction).toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY',
    laneId: row.lane_id != null ? BigInt(row.lane_id) : null,
    laneCode: row.lane_code != null ? String(row.lane_code) : null,
  };
}

export async function insertDeviceHeartbeat(args: {
  siteId: bigint;
  deviceId: bigint;
  status: HeartbeatStatus;
  reportedAt: Date;
  latencyMs?: number | null;
  firmwareVersion?: string | null;
  ipAddress?: string | null;
  payloadJson?: unknown;
}): Promise<{ heartbeatId: bigint; reportedAt: Date; receivedAt: Date }> {
  const reportedAt = new Date(args.reportedAt);
  reportedAt.setMilliseconds(0);
  const receivedAt = new Date();
  receivedAt.setMilliseconds(0);

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO device_heartbeats(
      site_id,
      device_id,
      status,
      reported_at,
      received_at,
      latency_ms,
      firmware_version,
      ip_address,
      payload_json
    ) VALUES (
      ${args.siteId},
      ${args.deviceId},
      ${args.status},
      ${reportedAt},
      ${receivedAt},
      ${args.latencyMs ?? null},
      ${args.firmwareVersion ?? null},
      ${args.ipAddress ?? null},
      ${jsonSafe(args.payloadJson)}
    )
  `);

  const idRows = await prisma.$queryRaw<{ id: any }[]>(Prisma.sql`SELECT LAST_INSERT_ID() AS id`);
  if (!idRows[0]?.id) {
    throw new Error('Failed to resolve heartbeat_id via LAST_INSERT_ID()');
  }

  return {
    heartbeatId: BigInt(idRows[0].id),
    reportedAt,
    receivedAt,
  };
}
