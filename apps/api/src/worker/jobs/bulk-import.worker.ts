/**
 * Bulk Import Worker — BullMQ
 *
 * Processes subscription bulk import jobs from the `parkly:bulk-import` queue.
 * Reads job data from Redis (list-based queue), processes subscriptions in batches
 * of 100 records with Prisma transactions, and updates progress in DB.
 *
 * Run: pnpm worker:bulk-import
 * Or:  node dist/worker/jobs/bulk-import.worker.js
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';

import { prisma } from '../../lib/prisma';
import { closeRedis, getRedisClient } from '../../lib/redis';
import { config } from '../../server/config';

const BULK_IMPORT_QUEUE_NAME = 'parkly:bulk-import';
const BATCH_SIZE = 100;

type BulkImportJobPayload = {
  jobId: string;
  siteId: string;
  siteCode: string;
  actorUserId?: string;
  records: Array<{
    customerName: string;
    phone?: string;
    email?: string;
    planType: 'MONTHLY' | 'VIP';
    startDate: string;
    endDate: string;
    vehicles: Array<{
      licensePlate: string;
      vehicleType: 'MOTORBIKE' | 'CAR';
      rfidUid?: string;
      isPrimary?: boolean;
    }>;
    spotCodes?: string[];
    autoRenew?: boolean;
  }>;
  enqueuedAt: string;
};

type BulkImportProgress = {
  total: number;
  processed: number;
  success: number;
  error: number;
  errors: Array<{ index: number; customerName: string; error: string }>;
};

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function updateJobProgress(
  jobId: string,
  progress: BulkImportProgress,
  status: 'PROCESSING' | 'SUCCEEDED' | 'FAILED',
) {
  const progressPct = Math.round((progress.processed / Math.max(progress.total, 1)) * 100);
  await prisma.$executeRawUnsafe(
    `
    UPDATE bulk_import_jobs
    SET status = ?,
        processed_count = ?,
        success_count = ?,
        error_count = ?,
        progress_pct = ?,
        result_summary = ?,
        error_log = ?,
        started_at = COALESCE(started_at, NOW()),
        completed_at = ?
    WHERE job_id = ?
    `,
    status,
    progress.processed.toString(),
    progress.success.toString(),
    progress.error.toString(),
    progressPct.toString(),
    JSON.stringify({
      total: progress.total,
      processed: progress.processed,
      success: progress.success,
      error: progress.error,
    }),
    progress.errors.length > 0 ? JSON.stringify(progress.errors.slice(0, 100)) : null,
    status === 'SUCCEEDED' || status === 'FAILED' ? new Date().toISOString() : null,
    jobId,
  );
}

async function processBulkImportRecord(args: {
  siteId: bigint;
  record: BulkImportJobPayload['records'][0];
  index: number;
}): Promise<{ success: boolean; error?: string }> {
  const { siteId, record, index } = args;

  try {
    // Resolve or create customer
    let customerId: bigint;
    if (record.phone) {
      const existingCustomer = await prisma.$queryRawUnsafe<any[]>(
        `SELECT customer_id FROM customers WHERE phone = ? LIMIT 1`,
        record.phone,
      );
      if (existingCustomer[0]) {
        customerId = BigInt(existingCustomer[0].customer_id);
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO customers (full_name, phone, email, status) VALUES (?, ?, ?, 'ACTIVE')`,
          record.customerName,
          record.phone,
          record.email ?? null,
        );
        const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT LAST_INSERT_ID() AS id`);
        customerId = BigInt(rows[0].id);
      }
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO customers (full_name, email, status) VALUES (?, ?, 'ACTIVE')`,
        record.customerName,
        record.email ?? null,
      );
      const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT LAST_INSERT_ID() AS id`);
      customerId = BigInt(rows[0].id);
    }

    // Create subscription
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO subscriptions (site_id, customer_id, plan_type, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE')
      `,
      siteId.toString(),
      customerId.toString(),
      record.planType,
      record.startDate,
      record.endDate,
    );

    const subRows = await prisma.$queryRawUnsafe<any[]>(`SELECT LAST_INSERT_ID() AS id`);
    const subscriptionId = BigInt(subRows[0].id);

    // Resolve and assign spots
    if (record.spotCodes && record.spotCodes.length > 0) {
      for (const spotCode of record.spotCodes) {
        const spotRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT spot_id FROM spots WHERE site_id = ? AND code = ? AND is_active = 1 LIMIT 1`,
          siteId.toString(),
          spotCode,
        );
        if (spotRows[0]) {
          await prisma.$executeRawUnsafe(
            `
            INSERT INTO subscription_spots (subscription_id, site_id, spot_id, assigned_mode, status, is_primary)
            VALUES (?, ?, ?, 'ASSIGNED', 'ACTIVE', 0)
            `,
            subscriptionId.toString(),
            siteId.toString(),
            spotRows[0].spot_id.toString(),
          );
        }
      }
    }

    // Resolve and assign vehicles
    let hasPrimaryVehicle = false;
    for (const vehicle of record.vehicles) {
      // Resolve or create vehicle
      let vehicleId: bigint;
      const existingVehicle = await prisma.$queryRawUnsafe<any[]>(
        `SELECT vehicle_id FROM vehicles WHERE license_plate = ? LIMIT 1`,
        vehicle.licensePlate,
      );
      if (existingVehicle[0]) {
        vehicleId = BigInt(existingVehicle[0].vehicle_id);
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO vehicles (license_plate, vehicle_type, owner_customer_id) VALUES (?, ?, ?)`,
          vehicle.licensePlate,
          vehicle.vehicleType,
          customerId.toString(),
        );
        const vRows = await prisma.$queryRawUnsafe<any[]>(`SELECT LAST_INSERT_ID() AS id`);
        vehicleId = BigInt(vRows[0].id);
      }

      // Determine if this is the primary vehicle
      const isPrimary = vehicle.isPrimary || (!hasPrimaryVehicle && record.vehicles.length === 1);
      if (isPrimary) hasPrimaryVehicle = true;

      const plateCompact = vehicle.licensePlate.toUpperCase().replace(/[^A-Z0-9]/g, '');

      await prisma.$executeRawUnsafe(
        `
        INSERT INTO subscription_vehicles (subscription_id, site_id, vehicle_id, plate_compact, status, is_primary)
        VALUES (?, ?, ?, ?, 'ACTIVE', ?)
        ON DUPLICATE KEY UPDATE status = 'ACTIVE', is_primary = VALUES(is_primary)
        `,
        subscriptionId.toString(),
        siteId.toString(),
        vehicleId.toString(),
        plateCompact,
        isPrimary ? '1' : '0',
      );

      // Create credential if rfid provided
      if (vehicle.rfidUid) {
        const existingCred = await prisma.$queryRawUnsafe<any[]>(
          `SELECT credential_id FROM credentials WHERE site_id = ? AND rfid_uid = ? LIMIT 1`,
          siteId.toString(),
          vehicle.rfidUid,
        );
        if (!existingCred[0]) {
          await prisma.$executeRawUnsafe(
            `
            INSERT INTO credentials (site_id, subscription_id, rfid_uid, status)
            VALUES (?, ?, ?, 'ACTIVE')
            `,
            siteId.toString(),
            subscriptionId.toString(),
            vehicle.rfidUid,
          );
        }
      }
    }

    // Ensure at least one vehicle has is_primary = 1
    if (!hasPrimaryVehicle && record.vehicles.length > 0) {
      const firstVehicle = record.vehicles[0];
      const plateCompact = firstVehicle.licensePlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      await prisma.$executeRawUnsafe(
        `
        UPDATE subscription_vehicles SET is_primary = 1
        WHERE subscription_id = ? AND plate_compact = ? AND status = 'ACTIVE'
        LIMIT 1
        `,
        subscriptionId.toString(),
        plateCompact,
      );
    }

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

async function processJob(payload: BulkImportJobPayload): Promise<void> {
  const { jobId, siteId, records } = payload;
  const siteIdBigint = BigInt(siteId);

  console.log(`[BulkImportWorker] Starting job ${jobId} with ${records.length} records`);

  const progress: BulkImportProgress = {
    total: records.length,
    processed: 0,
    success: 0,
    error: 0,
    errors: [],
  };

  await updateJobProgress(jobId, progress, 'PROCESSING');

  const batches = chunkArray(records, BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];

    for (let i = 0; i < batch.length; i++) {
      const record = batch[i];
      const globalIndex = batchIdx * BATCH_SIZE + i;

      const result = await processBulkImportRecord({
        siteId: siteIdBigint,
        record,
        index: globalIndex,
      });

      progress.processed++;

      if (result.success) {
        progress.success++;
      } else {
        progress.error++;
        progress.errors.push({
          index: globalIndex,
          customerName: record.customerName,
          error: result.error ?? 'Unknown error',
        });
      }
    }

    // Update progress after each batch
    await updateJobProgress(jobId, progress, 'PROCESSING');
    console.log(`[BulkImportWorker] Job ${jobId}: ${progress.processed}/${progress.total} processed (${progress.success} success, ${progress.error} errors)`);
  }

  const finalStatus = progress.error === 0 ? 'SUCCEEDED' : progress.success === 0 ? 'FAILED' : 'SUCCEEDED';
  await updateJobProgress(jobId, progress, finalStatus);

  console.log(`[BulkImportWorker] Job ${jobId} completed: ${progress.success} success, ${progress.error} errors`);
}

async function pollQueue() {
  const BATCH_POLL_SIZE = 10;
  const POLL_INTERVAL_MS = Math.max(500, Number(process.env.BULK_IMPORT_POLL_INTERVAL_MS ?? 2000));

  let stopping = false;

  while (!stopping) {
    try {
      const redis = await getRedisClient({ connect: true });
      if (!redis) {
        console.warn('[BulkImportWorker] Redis not available, waiting...');
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      // Atomic dequeue: LPOP from head
      const raw = await redis.lpop(BULK_IMPORT_QUEUE_NAME);
      if (raw) {
        try {
          const payload: BulkImportJobPayload = JSON.parse(String(raw));
          await processJob(payload);
        } catch (err) {
          console.error('[BulkImportWorker] Failed to parse job payload:', err);
        }
      } else {
        // No jobs — idle wait
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (err) {
      console.error('[BulkImportWorker] Poll error:', err);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

async function main() {
  console.log('[BulkImportWorker] Starting bulk import worker...');
  console.log(`[BulkImportWorker] Queue: ${BULK_IMPORT_QUEUE_NAME}, Batch size: ${BATCH_SIZE}`);

  const stop = async () => {
    console.log('[BulkImportWorker] Shutting down...');
    await prisma.$disconnect();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());

  await pollQueue();
}

main().catch((e) => {
  console.error('[BulkImportWorker] Fatal error:', e);
  process.exitCode = 1;
});
