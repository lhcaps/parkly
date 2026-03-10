import 'dotenv/config';

import { config } from '../server/config';
import { drainOutboxOnce } from '../server/services/outbox.service';
import { prisma } from '../lib/prisma';
import { closeMongo } from '../lib/mongo';

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const intervalMs = config.worker.outboxIntervalMs;

  // eslint-disable-next-line no-console
  console.log('[worker] started', { intervalMs });

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    // eslint-disable-next-line no-console
    console.log('[worker] stopping...');
    await prisma.$disconnect().catch(() => void 0);
    await closeMongo().catch(() => void 0);
    process.exit(0);
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  while (!stopping) {
    try {
      const res = await drainOutboxOnce({ limit: 50, dryRun: false });
      // eslint-disable-next-line no-console
      console.log('[worker] outbox', res);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[worker] outbox error', e?.message ?? e);
    }
    await sleep(intervalMs);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[worker] fatal', e);
  process.exitCode = 1;
});
