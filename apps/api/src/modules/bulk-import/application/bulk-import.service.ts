import type { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';

import { requireAuth } from '../../../server/auth';
import { ApiError, ok } from '../../../server/http';
import { getRequestActor } from '../../../server/auth';
import { validateOrThrow } from '../../../server/validation';
import { z } from 'zod';
import { config } from '../../../server/config';

const BULK_IMPORT_QUEUE_NAME = 'parkly:bulk-import';

const CreateBulkImportJobBody = z.object({
  siteCode: z.string().trim().min(1, 'siteCode là bắt buộc'),
  records: z.array(z.object({
    customerName: z.string().trim().min(1, 'customerName là bắt buộc').max(255),
    phone: z.string().trim().max(32).optional(),
    email: z.string().email().max(255).optional().or(z.literal('')),
    planType: z.enum(['MONTHLY', 'VIP']),
    startDate: z.string().trim().min(10, 'startDate format YYYY-MM-DD'),
    endDate: z.string().trim().min(10, 'endDate format YYYY-MM-DD'),
    vehicles: z.array(z.object({
      licensePlate: z.string().trim().min(1, 'licensePlate là bắt buộc').max(20),
      vehicleType: z.enum(['MOTORBIKE', 'CAR']),
      rfidUid: z.string().trim().max(64).optional(),
      isPrimary: z.boolean().optional().default(false),
    })).min(1, 'Ít nhất 1 vehicle'),
    spotCodes: z.array(z.string().trim().max(32)).optional(),
    autoRenew: z.boolean().optional().default(false),
  })).min(1, 'Ít nhất 1 record').max(10000),
});

const FileUploadBody = z.object({
  siteCode: z.string().trim().min(1, 'siteCode là bắt buộc'),
});

type BulkImportJob = {
  jobId: string;
  status: string;
  progressPct: number;
  totalRecords: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  resultSummary: unknown | null;
  errorLog: unknown | null;
};

async function getWorkerConnection() {
  const { default: IORedis } = await import('ioredis');
  const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  return new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
}

async function enqueueBulkImportJob(jobData: {
  jobId: string;
  siteId: bigint;
  siteCode: string;
  actorUserId?: bigint;
  records: z.infer<typeof CreateBulkImportJobBody>['records'];
}): Promise<{ jobId: string }> {
  const conn = await getWorkerConnection();
  try {
    await conn.rpush(
      BULK_IMPORT_QUEUE_NAME,
      JSON.stringify({
        ...jobData,
        enqueuedAt: new Date().toISOString(),
      }),
    );
    return { jobId: jobData.jobId };
  } finally {
    await conn.quit();
  }
}

async function recordJobCreated(args: {
  jobId: string;
  siteId: bigint;
  actorUserId?: bigint;
  totalRecords: number;
  fileName?: string;
}) {
  const { prisma } = await import('../../../lib/prisma');
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO bulk_import_jobs (job_id, site_id, actor_user_id, job_type, status, total_records, file_name, queued_at)
    VALUES (?, ?, ?, 'SUBSCRIPTION_BULK_IMPORT', 'QUEUED', ?, ?, NOW())
    ON DUPLICATE KEY UPDATE status = 'QUEUED'
    `,
    args.jobId,
    args.siteId.toString(),
    args.actorUserId?.toString() ?? null,
    args.totalRecords,
    args.fileName ?? null,
  );
}

async function getJobStatus(jobId: string): Promise<BulkImportJob | null> {
  const { prisma } = await import('../../../lib/prisma');
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT job_id, site_id, actor_user_id, job_type, status, total_records, processed_count,
           success_count, error_count, progress_pct, result_summary, error_log,
           queued_at, started_at, completed_at
    FROM bulk_import_jobs
    WHERE job_id = ?
    LIMIT 1
    `,
    jobId,
  );

  if (!rows[0]) return null;

  const row = rows[0];
  return {
    jobId: String(row.job_id),
    status: String(row.status),
    progressPct: Number(row.progress_pct ?? 0),
    totalRecords: Number(row.total_records ?? 0),
    processedCount: Number(row.processed_count ?? 0),
    successCount: Number(row.success_count ?? 0),
    errorCount: Number(row.error_count ?? 0),
    queuedAt: row.queued_at ? new Date(row.queued_at).toISOString() : new Date().toISOString(),
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    resultSummary: row.result_summary ? JSON.parse(String(row.result_summary)) : null,
    errorLog: row.error_log ? JSON.parse(String(row.error_log)) : null,
  };
}

async function resolveSiteId(siteCode: string): Promise<bigint> {
  const { prisma } = await import('../../../lib/prisma');
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT site_id FROM parking_sites WHERE site_code = ? AND is_active = 1 LIMIT 1`,
    siteCode,
  );
  if (!rows[0]) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Không tìm thấy site', details: { siteCode } });
  }
  return BigInt(rows[0].site_id);
}

async function resolveCustomer(args: {
  siteId: bigint;
  name: string;
  phone?: string;
  email?: string;
}): Promise<bigint> {
  const { prisma } = await import('../../../lib/prisma');

  if (args.phone) {
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT customer_id FROM customers WHERE phone = ? LIMIT 1`,
      args.phone,
    );
    if (existing[0]) return BigInt(existing[0].customer_id);
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO customers (full_name, phone, email, status) VALUES (?, ?, ?, 'ACTIVE')`,
    args.name,
    args.phone ?? null,
    args.email ?? null,
  );

  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT LAST_INSERT_ID() AS id`);
  return BigInt(rows[0].id);
}

async function resolveVehicle(licensePlate: string, vehicleType: string, ownerCustomerId: bigint): Promise<bigint> {
  const { prisma } = await import('../../../lib/prisma');
  const compactPlate = licensePlate.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT vehicle_id FROM vehicles WHERE license_plate = ? LIMIT 1`,
    licensePlate,
  );
  if (existing[0]) return BigInt(existing[0].vehicle_id);

  await prisma.$executeRawUnsafe(
    `INSERT INTO vehicles (license_plate, vehicle_type, owner_customer_id) VALUES (?, ?, ?)`,
    licensePlate,
    vehicleType,
    ownerCustomerId.toString(),
  );

  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT LAST_INSERT_ID() AS id`);
  return BigInt(rows[0].id);
}

async function resolveSpotId(siteId: bigint, spotCode: string): Promise<bigint | null> {
  const { prisma } = await import('../../../lib/prisma');
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT spot_id FROM spots WHERE site_id = ? AND code = ? AND is_active = 1 LIMIT 1`,
    siteId.toString(),
    spotCode,
  );
  return rows[0] ? BigInt(rows[0].spot_id) : null;
}

async function resolveCredential(siteId: bigint, subscriptionId: bigint, vehicleId: bigint, rfidUid?: string | null): Promise<void> {
  const { prisma } = await import('../../../lib/prisma');
  if (!rfidUid) return;

  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT credential_id FROM credentials WHERE site_id = ? AND rfid_uid = ? LIMIT 1`,
    siteId.toString(),
    rfidUid,
  );
  if (existing[0]) return;

  await prisma.$executeRawUnsafe(
    `INSERT INTO credentials (site_id, subscription_id, rfid_uid, status) VALUES (?, ?, ?, 'ACTIVE')`,
    siteId.toString(),
    subscriptionId.toString(),
    rfidUid,
  );
}

export type BulkImportResult = {
  jobId: string;
  status: 'QUEUED';
  totalRecords: number;
  queuedAt: string;
};

export async function createBulkImportJob(
  input: z.infer<typeof CreateBulkImportJobBody>,
  opts: { actorUserId?: bigint } = {},
): Promise<BulkImportResult> {
  const siteId = await resolveSiteId(input.siteCode);
  const jobId = `bulk_${Date.now()}_${randomUUID().slice(0, 12)}`;

  await recordJobCreated({
    jobId,
    siteId,
    actorUserId: opts.actorUserId,
    totalRecords: input.records.length,
  });

  await enqueueBulkImportJob({
    jobId,
    siteId,
    siteCode: input.siteCode,
    actorUserId: opts.actorUserId,
    records: input.records,
  });

  return {
    jobId,
    status: 'QUEUED',
    totalRecords: input.records.length,
    queuedAt: new Date().toISOString(),
  };
}

export async function getBulkImportJobStatus(jobId: string): Promise<BulkImportJob | null> {
  return getJobStatus(jobId);
}

export { CreateBulkImportJobBody };
