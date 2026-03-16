import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type IdemStatus = 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED';

export type IdemRow = {
  scope: string;
  idempotency_key: string;
  request_hash: string | null;
  status: IdemStatus;
  response_json: any | null;
};

function isDuplicateKeyError(err: unknown): boolean {
  const e: any = err as any;
  const errno = e?.meta?.driverAdapterError?.cause?.errno ?? e?.errno;
  if (errno === 1062 || errno === 'ER_DUP_ENTRY') return true;
  const msg = String(e?.message ?? '');
  return msg.includes('Duplicate entry') || msg.includes('1062') || msg.includes('ER_DUP_ENTRY');
}

export async function claimIdempotency(args: {
  scope: string;
  key: string;
  requestHash: string;
}): Promise<{ claimed: true } | { claimed: false; row: IdemRow }> {
  try {
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO api_idempotency(scope, idempotency_key, request_hash, status)
        VALUES (${args.scope}, ${args.key}, ${args.requestHash}, 'IN_PROGRESS')
      `
    );
    return { claimed: true };
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;

    const rows = await prisma.$queryRaw<IdemRow[]>(
      Prisma.sql`
        SELECT scope, idempotency_key, request_hash, status, response_json
        FROM api_idempotency
        WHERE scope = ${args.scope} AND idempotency_key = ${args.key}
        LIMIT 1
      `
    );

    if (!rows[0]) {
      // Should not happen, but safe fallback
      throw err;
    }

    return { claimed: false, row: rows[0] };
  }
}

export async function markIdempotencySucceeded(args: {
  scope: string;
  key: string;
  responseJson: unknown;
}) {
  const json = JSON.stringify(args.responseJson ?? null);
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE api_idempotency
      SET status = 'SUCCEEDED', response_json = CAST(${json} AS JSON)
      WHERE scope = ${args.scope} AND idempotency_key = ${args.key}
    `
  );
}

export async function markIdempotencyFailed(args: {
  scope: string;
  key: string;
}) {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE api_idempotency
      SET status = 'FAILED'
      WHERE scope = ${args.scope} AND idempotency_key = ${args.key}
    `
  );
}
