import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { config } from '../server/config';

export type ObjectStorageHealthSnapshot = {
  configured: boolean;
  available: boolean;
  degraded: boolean;
  endpoint: string | null;
  region: string | null;
  bucket: string | null;
  forcePathStyle: boolean;
  useSsl: boolean;
  lastCheckAt: string | null;
  lastError: string | null;
};

type RuntimeConfig = {
  endpoint: string | null;
  region: string;
  accessKey: string | null;
  secretKey: string | null;
  bucket: string | null;
  forcePathStyle: boolean;
  useSsl: boolean;
};

const state: {
  client: S3Client | null;
  healthPromise: Promise<ObjectStorageHealthSnapshot> | null;
  lastCheckAt: number | null;
  lastError: string | null;
} = {
  client: null,
  healthPromise: null,
  lastCheckAt: null,
  lastError: null,
};

function emptyToNull(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function sanitizeError(error: unknown): string {
  const message = String(
    error && typeof error === 'object' && 'message' in error
      ? (error as { message?: unknown }).message
      : error ?? 'Unknown object storage error',
  ).trim();

  return message || 'Unknown object storage error';
}

function redactEndpoint(rawEndpoint: string | null | undefined): string | null {
  if (!rawEndpoint) return null;

  try {
    const parsed = new URL(rawEndpoint);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return rawEndpoint;
  }
}

function runtime(): RuntimeConfig {
  const s3 = (config as any).s3 ?? {};
  return {
    endpoint: emptyToNull(s3.endpoint ?? process.env.S3_ENDPOINT),
    region: String(s3.region ?? process.env.S3_REGION ?? 'us-east-1').trim() || 'us-east-1',
    accessKey: emptyToNull(s3.accessKey ?? process.env.S3_ACCESS_KEY),
    secretKey: emptyToNull(s3.secretKey ?? process.env.S3_SECRET_KEY),
    bucket: emptyToNull(s3.bucket ?? process.env.S3_BUCKET_MEDIA),
    forcePathStyle: Boolean(
      s3.forcePathStyle ??
      String(process.env.S3_FORCE_PATH_STYLE ?? '').trim().toUpperCase() === 'ON',
    ),
    useSsl: Boolean(
      s3.useSsl ??
      String(process.env.S3_USE_SSL ?? '').trim().toUpperCase() === 'ON',
    ),
  };
}

function baseHealth(
  overrides: Partial<ObjectStorageHealthSnapshot> = {},
): ObjectStorageHealthSnapshot {
  const cfg = runtime();
  const configured = Boolean(
    cfg.endpoint &&
    cfg.region &&
    cfg.accessKey &&
    cfg.secretKey &&
    cfg.bucket,
  );

  return {
    configured,
    available: false,
    degraded: configured,
    endpoint: redactEndpoint(cfg.endpoint),
    region: cfg.region,
    bucket: cfg.bucket,
    forcePathStyle: cfg.forcePathStyle,
    useSsl: cfg.useSsl,
    lastCheckAt: state.lastCheckAt ? new Date(state.lastCheckAt).toISOString() : null,
    lastError: state.lastError,
    ...overrides,
  };
}

function requireBucket(bucket?: string | null): string {
  const cfg = runtime();
  const resolved = bucket ?? cfg.bucket;
  if (!resolved) throw new Error('S3 bucket is not configured');
  return resolved;
}

function normalizeMetadata(
  metadata?: Record<string, string | undefined>,
): Record<string, string> | undefined {
  if (!metadata) return undefined;

  const normalized = Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value != null && String(value).trim() !== '')
      .map(([key, value]) => [key, String(value)]),
  ) as Record<string, string>;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function client(): S3Client {
  if (state.client) return state.client;

  const cfg = runtime();
  if (!cfg.endpoint || !cfg.accessKey || !cfg.secretKey) {
    throw new Error('S3 endpoint/credentials are not configured');
  }

  state.client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    forcePathStyle: cfg.forcePathStyle,
    credentials: {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
    },
  });

  return state.client;
}

export function isObjectStorageConfigured(): boolean {
  return baseHealth().configured;
}

export async function getObjectStorageHealth(
  options: { forceRefresh?: boolean } = {},
): Promise<ObjectStorageHealthSnapshot> {
  const forceRefresh = Boolean(options.forceRefresh);
  const base = baseHealth();
  if (!base.configured) return base;

  if (!forceRefresh && state.healthPromise) return state.healthPromise;

  state.healthPromise = (async () => {
    try {
      const cfg = runtime();
      if (!cfg.bucket) throw new Error('S3_BUCKET_MEDIA is not configured');

      await client().send(
        new HeadBucketCommand({
          Bucket: cfg.bucket,
        }),
      );

      state.lastCheckAt = Date.now();
      state.lastError = null;

      return baseHealth({
        available: true,
        degraded: false,
        lastCheckAt: new Date(state.lastCheckAt).toISOString(),
        lastError: null,
      });
    } catch (error) {
      state.lastCheckAt = Date.now();
      state.lastError = sanitizeError(error);

      return baseHealth({
        available: false,
        degraded: true,
        lastCheckAt: new Date(state.lastCheckAt).toISOString(),
        lastError: state.lastError,
      });
    } finally {
      state.healthPromise = null;
    }
  })();

  return state.healthPromise;
}

export async function putObjectBuffer(input: {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string | null;
  metadata?: Record<string, string | undefined>;
  bucket?: string | null;
}) {
  const Bucket = requireBucket(input.bucket);

  const result = await client().send(
    new PutObjectCommand({
      Bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType ?? undefined,
      Metadata: normalizeMetadata(input.metadata),
    }),
  );

  return {
    bucket: Bucket,
    key: input.key,
    etag: result.ETag ?? null,
    versionId: result.VersionId ?? null,
  };
}

export async function headStoredObject(input: {
  key: string;
  bucket?: string | null;
}) {
  const Bucket = requireBucket(input.bucket);

  const result = await client().send(
    new HeadObjectCommand({
      Bucket,
      Key: input.key,
    }),
  );

  return {
    bucket: Bucket,
    key: input.key,
    etag: result.ETag ?? null,
    contentLength: result.ContentLength ?? null,
    contentType: result.ContentType ?? null,
    metadata: result.Metadata ?? {},
    lastModified: result.LastModified ? result.LastModified.toISOString() : null,
  };
}

async function toBuffer(body: any): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);

  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array | string>) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(Buffer.from(chunk));
    }
  }

  return Buffer.concat(chunks);
}

export async function getObjectBuffer(input: {
  key: string;
  bucket?: string | null;
}) {
  const Bucket = requireBucket(input.bucket);

  const result = await client().send(
    new GetObjectCommand({
      Bucket,
      Key: input.key,
    }),
  );

  return {
    bucket: Bucket,
    key: input.key,
    body: await toBuffer(result.Body),
    contentType: result.ContentType ?? null,
    etag: result.ETag ?? null,
    metadata: result.Metadata ?? {},
  };
}

export async function deleteStoredObject(input: {
  key: string;
  bucket?: string | null;
}) {
  const Bucket = requireBucket(input.bucket);

  await client().send(
    new DeleteObjectCommand({
      Bucket,
      Key: input.key,
    }),
  );

  return {
    bucket: Bucket,
    key: input.key,
  };
}

export async function createPresignedDownloadUrl(input: {
  key: string;
  bucket?: string | null;
  expiresInSec?: number;
}) {
  const Bucket = requireBucket(input.bucket);
  const expiresInSec = Math.max(1, Math.min(604800, Math.trunc(input.expiresInSec ?? 300)));

  const url = await getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket,
      Key: input.key,
    }),
    { expiresIn: expiresInSec },
  );

  return {
    bucket: Bucket,
    key: input.key,
    expiresInSec,
    url,
  };
}

export async function closeObjectStorage() {
  state.client?.destroy();
  state.client = null;
  state.healthPromise = null;
}

export default {
  isObjectStorageConfigured,
  getObjectStorageHealth,
  putObjectBuffer,
  headStoredObject,
  getObjectBuffer,
  deleteStoredObject,
  createPresignedDownloadUrl,
  closeObjectStorage,
};