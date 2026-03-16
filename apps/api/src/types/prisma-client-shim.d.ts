declare module '@prisma/client' {
  export namespace Prisma {
    type InputJsonValue = any;
    type Sql = any;
    interface TransactionClient {
      $queryRaw<T = unknown>(query: any, ...values: any[]): Promise<T>;
      $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Promise<T>;
      $executeRaw(query: any, ...values: any[]): Promise<number>;
      $executeRawUnsafe(query: string, ...values: any[]): Promise<number>;
      [key: string]: any;
    }
    const sql: any;
    const join: any;
    class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, options?: { code?: string });
    }
  }

  export const Prisma: {
    sql: typeof Prisma.sql;
    join: typeof Prisma.join;
    PrismaClientKnownRequestError: typeof Prisma.PrismaClientKnownRequestError;
  };

  export class PrismaClient {
    constructor(...args: any[]);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $queryRaw<T = unknown>(query: any, ...values: any[]): Promise<T>;
    $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Promise<T>;
    $executeRaw(query: any, ...values: any[]): Promise<number>;
    $executeRawUnsafe(query: string, ...values: any[]): Promise<number>;
    $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T> | T, options?: any): Promise<T>;
    $transaction<T = unknown>(queries: any[], options?: any): Promise<T>;
    [key: string]: any;
  }

  export const gate_event_outbox_status: {
    PENDING: 'PENDING';
    SENT: 'SENT';
    FAILED: 'FAILED';
  };
  export type gate_event_outbox_status = (typeof gate_event_outbox_status)[keyof typeof gate_event_outbox_status];

  export const gate_barrier_commands_status: {
    PENDING: 'PENDING';
    SENT: 'SENT';
    ACKED: 'ACKED';
    NACKED: 'NACKED';
    TIMEOUT: 'TIMEOUT';
    CANCELLED: 'CANCELLED';
  };
  export type gate_barrier_commands_status = (typeof gate_barrier_commands_status)[keyof typeof gate_barrier_commands_status];

  export type tariffs_applies_to = 'ONCE' | 'DAILY' | 'SUBSCRIPTION' | 'ALL';
  export type tariffs_vehicle_type = 'CAR' | 'MOTORBIKE' | 'BICYCLE' | 'OTHER';
  export type tariff_rules_rule_type = 'BASE' | 'STEP' | 'MAX_CAP' | 'FREE_MINUTES';
}
