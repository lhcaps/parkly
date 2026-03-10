import { Prisma, gate_event_outbox_status } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getMongoDb } from "../lib/mongo";
import { ApiError } from "../server/http";

/**
 * Input chuẩn theo SPEC:
 * - eventTime phải đến từ thiết bị (timestamp ổn định) để idempotency hoạt động. [cite: 9, 25]
 * - direction dùng ENTRY/EXIT. [cite: 81]
 * - MySQL lưu metadata + partition; Mongo lưu raw payload. [cite: 10, 53]
 */
export interface GateEventInput {
  siteId: bigint;
  deviceId: bigint;
  direction: "ENTRY" | "EXIT";
  eventTime: Date;
  idempotencyKey: string;
  ticketId?: bigint;
  licensePlateRaw?: string;
  rfidUid?: string;
  imageUrl?: string;
  rawPayload: unknown;
}

export type LogGateEventResult = {
  changed: boolean;
  eventId: bigint;
  eventTime: Date;
  outboxId: bigint;
  mongoSynced: boolean;
};

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v.trim() === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v == null || v.trim() === "") return fallback;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

function computeExponentialBackoffMs(attempts: number): number {
  // attempts: 1..N
  const baseMs = envInt("OUTBOX_BACKOFF_BASE_MS", 5_000);
  const maxMs = envInt("OUTBOX_BACKOFF_MAX_MS", 300_000);
  const jitter = envBool("OUTBOX_BACKOFF_JITTER", true);

  const exp = Math.min(30, Math.max(0, attempts - 1));
  const raw = Math.min(maxMs, baseMs * 2 ** exp);

  // Full jitter: random(0..raw)
  if (jitter) return Math.floor(Math.random() * raw);
  return raw;
}

function isDuplicateKeyError(err: unknown): boolean {
  const e: any = err as any;
  const errno =
    e?.meta?.driverAdapterError?.cause?.errno ??
    e?.meta?.driverAdapterError?.cause?.code ??
    e?.meta?.cause?.errno ??
    e?.errno;
  if (errno === 1062 || errno === "ER_DUP_ENTRY") return true;
  const msg = String(e?.message ?? "");
  return msg.includes("Duplicate entry") || msg.includes("1062") || msg.includes("ER_DUP_ENTRY");
}

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  ) as Prisma.InputJsonValue;
}

export async function logGateEvent(data: GateEventInput): Promise<LogGateEventResult> {
  const eventTime = new Date(data.eventTime);
  eventTime.setMilliseconds(0);

  // Cập nhật: Thêm options cho transaction để xử lý tải cao [cite: 15, 16]
  const { eventId, outboxId, changed } = await prisma.$transaction(
    async (tx) => {
      let eventId: bigint;
      let changed = true;
      try {
        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO gate_events
              (site_id, device_id, direction, event_time, rfid_uid, license_plate_raw, image_url, ticket_id, idempotency_key)
            VALUES
              (${data.siteId}, ${data.deviceId}, ${data.direction}, ${eventTime},
               ${data.rfidUid ?? null}, ${data.licensePlateRaw ?? null}, ${data.imageUrl ?? null},
               ${data.ticketId ?? null}, ${data.idempotencyKey})
          `
        );

        const idRows = await tx.$queryRaw<{ id: any }[]>(Prisma.sql`SELECT LAST_INSERT_ID() AS id`);
        if (!idRows[0]?.id) throw new Error("Failed to resolve event_id via LAST_INSERT_ID()");
        eventId = BigInt(idRows[0].id);
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;

        changed = false;

        const existing = await tx.$queryRaw<
          { event_id: any; device_id: any; direction: any; rfid_uid: any; license_plate_raw: any; image_url: any; ticket_id: any }[]
        >(
          Prisma.sql`
            SELECT event_id, device_id, direction, rfid_uid, license_plate_raw, image_url, ticket_id
            FROM gate_events
            WHERE site_id = ${data.siteId}
              AND idempotency_key = ${data.idempotencyKey}
              AND event_time = ${eventTime}
            LIMIT 1
          `
        );

        const row = existing[0];
        if (!row?.event_id) throw new Error("Idempotency hit but cannot fetch existing event_id");

        const eq = (a: any, b: any) => (a ?? null) === (b ?? null);
        const same =
          eq(String(row.device_id), String(data.deviceId)) &&
          eq(String(row.direction), String(data.direction)) &&
          eq(row.rfid_uid, data.rfidUid) &&
          eq(row.license_plate_raw, data.licensePlateRaw) &&
          eq(row.image_url, data.imageUrl) &&
          eq(row.ticket_id != null ? String(row.ticket_id) : null, data.ticketId != null ? String(data.ticketId) : null);

        if (!same) {
          throw new ApiError({
            code: 'CONFLICT',
            message: 'Idempotency key already used with different payload',
            statusCode: 409,
            details: {
              reason: 'IDEMPOTENCY_CONFLICT',
              scope: { siteId: String(data.siteId), eventTime: eventTime.toISOString(), idempotencyKey: data.idempotencyKey },
            },
          });
        }

        eventId = BigInt(row.event_id);
      }

      const payloadJson: Prisma.InputJsonValue = jsonSafe({
        mysql: {
          site_id: String(data.siteId),
          device_id: String(data.deviceId),
          direction: data.direction,
          event_time: eventTime.toISOString(),
          idempotency_key: data.idempotencyKey,
          ticket_id: data.ticketId ? String(data.ticketId) : null,
          license_plate_raw: data.licensePlateRaw ?? null,
          rfid_uid: data.rfidUid ?? null,
          image_url: data.imageUrl ?? null,
        },
        raw_payload: data.rawPayload,
        created_at: new Date().toISOString(),
      });

      const out = await tx.gate_event_outbox
        .create({
          data: {
            site_id: data.siteId,
            event_id: eventId,
            event_time: eventTime,
            payload_json: payloadJson,
          },
          select: { outbox_id: true },
        })
        .catch(async (err) => {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const existing = await tx.gate_event_outbox.findFirst({
              where: { site_id: data.siteId, event_id: eventId, event_time: eventTime },
              select: { outbox_id: true },
            });
            if (existing) return existing;
          }
          throw err;
        });

      return { eventId, outboxId: out.outbox_id, changed };
    },
    {
      maxWait: 10_000, // Đợi lấy connection (mặc định 2000ms)
      timeout: 30_000, // Thời gian chạy transaction (mặc định 5000ms)
    }
  );

  // Outbox behavior:
  // - OUTBOX_INLINE_SYNC=false (default): chỉ ghi PENDING, worker sẽ drain.
  // - OUTBOX_INLINE_SYNC=true : thử sync ngay để demo nhanh.
  const inline = envBool("OUTBOX_INLINE_SYNC", false);
  const mongoSynced = inline ? await trySyncOutboxToMongo(outboxId) : false;

  return { changed, eventId, eventTime, outboxId, mongoSynced };
}

export async function trySyncOutboxToMongo(outboxId: bigint): Promise<boolean> {
  const row = await prisma.gate_event_outbox.findUnique({ where: { outbox_id: outboxId } });
  if (!row) return false;
  if (row.status === gate_event_outbox_status.SENT) return true;

  try {
    const db = await getMongoDb();

    const res = await db.collection(row.mongo_collection).insertOne({
      mysql_event_id: String(row.event_id),
      site_id: String(row.site_id),
      event_time: row.event_time,
      payload: row.payload_json,
      created_at: new Date(),
    });

    await prisma.gate_event_outbox.update({
      where: { outbox_id: outboxId },
      data: {
        status: gate_event_outbox_status.SENT,
        sent_at: new Date(),
        mongo_doc_id: String(res.insertedId),
        last_error: null,
        next_retry_at: null,
      },
    });

    return true;
  } catch (err: any) {
    const attempts = (row.attempts ?? 0) + 1;

    const maxAttempts = envInt("OUTBOX_MAX_ATTEMPTS", 8);
    const isTerminalFail = attempts >= maxAttempts;
    const backoffMs = isTerminalFail ? 0 : computeExponentialBackoffMs(attempts);
    const nextRetryAt = isTerminalFail ? null : new Date(Date.now() + backoffMs);

    await prisma.gate_event_outbox.update({
      where: { outbox_id: outboxId },
      data: {
        attempts,
        last_error: String(err?.message ?? err),
        status: isTerminalFail ? gate_event_outbox_status.FAILED : gate_event_outbox_status.PENDING,
        next_retry_at: nextRetryAt,
      },
    });

    return false;
  }
}

export async function mapLegacyEntryEventToSessionFlow(args: {
  siteCode: string;
  laneCode: string;
  deviceCode?: string;
  eventTime: Date;
  idempotencyKey: string;
  requestId: string;
  licensePlateRaw?: string | null;
  rfidUid?: string | null;
  ocrConfidence?: number | null;
  rawPayload?: unknown;
}) {
  const { processLegacyEntryGateEvent } = await import('../modules/gate/application/process-entry');

  return processLegacyEntryGateEvent({
    siteCode: args.siteCode,
    laneCode: args.laneCode,
    deviceCode: args.deviceCode,
    occurredAt: args.eventTime,
    plateRaw: args.licensePlateRaw ?? null,
    ocrConfidence: args.ocrConfidence ?? null,
    rfidUid: args.rfidUid ?? null,
    requestId: args.requestId,
    idempotencyKey: `legacy-entry:${args.idempotencyKey}`.slice(0, 64),
    payload: args.rawPayload,
  });
}


export async function mapLegacyExitEventToSessionFlow(args: {
  siteCode: string;
  laneCode: string;
  deviceCode?: string;
  eventTime: Date;
  idempotencyKey: string;
  requestId: string;
  licensePlateRaw?: string | null;
  rfidUid?: string | null;
  ocrConfidence?: number | null;
  rawPayload?: unknown;
}) {
  const { processLegacyExitGateEvent } = await import('../modules/gate/application/process-exit');

  return processLegacyExitGateEvent({
    siteCode: args.siteCode,
    laneCode: args.laneCode,
    deviceCode: args.deviceCode,
    occurredAt: args.eventTime,
    plateRaw: args.licensePlateRaw ?? null,
    ocrConfidence: args.ocrConfidence ?? null,
    rfidUid: args.rfidUid ?? null,
    requestId: args.requestId,
    idempotencyKey: `legacy-exit:${args.idempotencyKey}`.slice(0, 64),
    payload: args.rawPayload,
  });
}
