import { z, type ZodTypeAny } from 'zod';

import { ApiError, type ApiErrorCode } from './http';

/**
 * Express `req.query` values are usually strings, but repeated keys become `string[]`.
 * Collapse to a single trimmed string (or `undefined` if absent / empty).
 */
export function normalizeQueryPrimitive(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  return s === '' ? undefined : s;
}

export function validateOrThrow<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown,
  opts?: {
    code?: ApiErrorCode;
    message?: string;
    details?: Record<string, unknown>;
  },
): z.infer<TSchema> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;

  throw new ApiError({
    code: opts?.code ?? 'BAD_REQUEST',
    message: opts?.message,
    details: opts?.details
      ? { ...opts.details, validation: parsed.error.flatten() }
      : parsed.error.flatten(),
  });
}

export function parseBigIntCursor(cursor?: string | null, fieldName = 'cursor'): bigint | undefined {
  const raw = String(cursor ?? '').trim();
  if (!raw) return undefined;
  if (!/^\d+$/.test(raw)) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: `${fieldName} không hợp lệ`,
      details: { [fieldName]: raw },
    });
  }
  return BigInt(raw);
}

export function parseRequiredNumericString(raw: unknown, fieldName: string): string {
  const value = String(raw ?? '').trim();
  if (!/^\d+$/.test(value)) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: `${fieldName} không hợp lệ`,
      details: { [fieldName]: raw ?? null },
    });
  }
  return value;
}
