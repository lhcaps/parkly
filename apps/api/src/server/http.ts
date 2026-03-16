export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export type ApiErrorEnvelope = {
  requestId: string;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export type ApiSuccessEnvelope<T> = {
  requestId: string;
  data: T;
};

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export type CursorPageInfo = {
  type: 'CURSOR';
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
  sort: string;
};

const CODE_SET: ReadonlySet<string> = new Set<ApiErrorCode>([
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE_ENTITY',
  'UNSUPPORTED_MEDIA_TYPE',
  'PAYLOAD_TOO_LARGE',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && CODE_SET.has(value);
}

export function statusToCode(statusCode: number): ApiErrorCode {
  if (statusCode === 400) return 'BAD_REQUEST';
  if (statusCode === 401) return 'UNAUTHENTICATED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 409) return 'CONFLICT';
  if (statusCode === 413) return 'PAYLOAD_TOO_LARGE';
  if (statusCode === 415) return 'UNSUPPORTED_MEDIA_TYPE';
  if (statusCode === 422) return 'UNPROCESSABLE_ENTITY';
  if (statusCode === 503) return 'SERVICE_UNAVAILABLE';
  return 'INTERNAL_ERROR';
}

export function defaultMessageForCode(code: ApiErrorCode): string {
  switch (code) {
    case 'BAD_REQUEST':
      return 'Bad request';
    case 'UNAUTHENTICATED':
      return 'Unauthenticated';
    case 'FORBIDDEN':
      return 'Forbidden';
    case 'NOT_FOUND':
      return 'Not found';
    case 'CONFLICT':
      return 'Conflict';
    case 'UNPROCESSABLE_ENTITY':
      return 'Unprocessable entity';
    case 'UNSUPPORTED_MEDIA_TYPE':
      return 'Unsupported media type';
    case 'PAYLOAD_TOO_LARGE':
      return 'Payload too large';
    case 'SERVICE_UNAVAILABLE':
      return 'Service unavailable';
    case 'INTERNAL_ERROR':
    default:
      return 'Unexpected server error';
  }
}

export function isEnvelope(payload: unknown): payload is ApiEnvelope<unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const p = payload as any;
  const hasReqId = typeof p.requestId === 'string' && p.requestId.length > 0;
  const hasData = Object.prototype.hasOwnProperty.call(p, 'data');
  const hasFlatError = isApiErrorCode(p.code) && typeof p.message === 'string';
  const hasLegacyError =
    p.error &&
    typeof p.error === 'object' &&
    !Array.isArray(p.error) &&
    isApiErrorCode((p.error as any).code) &&
    typeof (p.error as any).message === 'string';
  return hasReqId && (hasData || hasFlatError || hasLegacyError);
}

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(opts: { code: ApiErrorCode; message?: string; statusCode?: number; details?: unknown }) {
    super(opts.message ?? defaultMessageForCode(opts.code));
    this.name = 'ApiError';
    this.code = opts.code;
    this.statusCode = opts.statusCode ?? codeToStatus(opts.code);
    this.details = opts.details;
  }
}

export function codeToStatus(code: ApiErrorCode): number {
  switch (code) {
    case 'BAD_REQUEST':
      return 400;
    case 'UNAUTHENTICATED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    case 'PAYLOAD_TOO_LARGE':
      return 413;
    case 'UNSUPPORTED_MEDIA_TYPE':
      return 415;
    case 'UNPROCESSABLE_ENTITY':
      return 422;
    case 'SERVICE_UNAVAILABLE':
      return 503;
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}

export function normalizeSortExpression(value: string): string {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(',');
}

export function buildCursorPageInfo(args: {
  limit: number;
  nextCursor?: string | number | bigint | null;
  hasMore?: boolean;
  sort: string;
}): CursorPageInfo {
  const limit = Math.min(2000, Math.max(1, Math.trunc(Number(args.limit) || 1)));
  const nextCursor = args.nextCursor == null ? null : String(args.nextCursor);
  return {
    type: 'CURSOR',
    limit,
    nextCursor,
    hasMore: args.hasMore ?? nextCursor !== null,
    sort: normalizeSortExpression(args.sort),
  };
}

export function withCursorPage<T>(
  rows: T[],
  args: {
    limit: number;
    nextCursor?: string | number | bigint | null;
    hasMore?: boolean;
    sort: string;
  },
): { rows: T[]; nextCursor: string | null; pageInfo: CursorPageInfo } {
  const pageInfo = buildCursorPageInfo(args);
  return {
    rows,
    nextCursor: pageInfo.nextCursor,
    pageInfo,
  };
}

export function ok<T>(requestId: string, data: T): ApiSuccessEnvelope<T> {
  return { requestId, data };
}

export function fail(
  requestId: string,
  err: { code: ApiErrorCode; message?: string; details?: unknown },
): ApiErrorEnvelope {
  return {
    requestId,
    code: err.code,
    message: err.message ?? defaultMessageForCode(err.code),
    ...(err.details !== undefined ? { details: err.details } : {}),
  };
}
