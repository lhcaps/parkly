import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type Tx = Prisma.TransactionClient;

export async function withAuditActor<T>(actorUserId: bigint | undefined, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    if (actorUserId != null) {
      const existing = await tx.users.findUnique({
        where: { user_id: actorUserId },
        select: { user_id: true },
      });
      if (existing?.user_id != null) {
        await tx.$executeRaw(Prisma.sql`SET @actor_user_id = ${existing.user_id}`);
      }
    }
    return fn(tx);
  }, {
    maxWait: 10_000,
    timeout: 30_000,
  });
}
