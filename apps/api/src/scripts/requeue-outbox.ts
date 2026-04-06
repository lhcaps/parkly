import * as dotenv from 'dotenv';
dotenv.config();

import { gate_event_outbox_status } from '@prisma/client';
import { prisma } from '../lib/prisma';

/**
 * Manual requeue for outbox rows that are terminal FAILED.
 *
 * Usage:
 *   pnpm outbox:requeue --id 123
 *   pnpm outbox:requeue --all-failed
 *
 * Optional:
 *   --reset-attempts   (default: false)
 */

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const idStr = getArg('--id');
  const allFailed = hasFlag('--all-failed');
  const resetAttempts = hasFlag('--reset-attempts');

  if (!idStr && !allFailed) {
    console.error(
      'Usage: pnpm outbox:requeue --id <outbox_id> | --all-failed [--reset-attempts]'
    );
    process.exitCode = 2;
    return;
  }

  const where: any = { status: gate_event_outbox_status.FAILED };
  if (idStr) {
    const id = BigInt(idStr);
    where.outbox_id = id;
  }

  const data: any = {
    status: gate_event_outbox_status.PENDING,
    next_retry_at: null,
    // keep last_error by default (useful as evidence). If you want to clear, uncomment:
    // last_error: null,
  };
  if (resetAttempts) {
    data.attempts = 0;
    data.last_error = null;
  }

  const res = await prisma.gate_event_outbox.updateMany({ where, data });
  console.log(
    `[outbox:requeue] mode=${allFailed ? 'ALL_FAILED' : 'ONE'} resetAttempts=${resetAttempts} updated=${res.count}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
