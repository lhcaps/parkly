import { prisma } from '../../lib/prisma'
import { createPresignedDownloadUrl } from '../../lib/object-storage'
import { config } from '../config'

function encodePublicPath(filePath: string) {
  const prefix = config.upload.publicPath.replace(/\/+$/, '')
  return prefix + '/' + String(filePath).split('/').map(encodeURIComponent).join('/')
}

function deriveLocalUrl(row: any) {
  if (row.file_path) return encodePublicPath(String(row.file_path))
  if (row.media_url) return String(row.media_url)
  return null
}

export async function resolveMediaViewById(mediaIdInput: string | number | bigint, options: { ttlSec?: number } = {}) {
  const mediaId = BigInt(mediaIdInput)
  const row = await prisma.gate_read_media.findUnique({
    where: { media_id: mediaId },
  })

  if (!row) return null

  const storageProvider = String((row.storage_provider ?? 'LOCAL')).toUpperCase()
  if (
    storageProvider === 'MINIO' &&
    row.bucket_name &&
    row.object_key
  ) {
    const ttlSec = Math.max(1, Math.min(604800, Math.trunc(options.ttlSec ?? config.media.presignTtlSec)))
    const signed = await createPresignedDownloadUrl({
      bucket: row.bucket_name,
      key: row.object_key,
      expiresInSec: ttlSec,
    })

    return {
      mediaId: String(row.media_id),
      storageProvider,
      bucketName: row.bucket_name,
      objectKey: row.object_key,
      objectEtag: row.object_etag ?? null,
      viewUrl: signed.url,
      expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(),
      mimeType: row.mime_type ?? null,
      filePath: row.file_path ?? null,
      mediaUrl: row.media_url ?? null,
    }
  }

  const viewUrl = deriveLocalUrl(row)

  return {
    mediaId: String(row.media_id),
    storageProvider,
    bucketName: row.bucket_name ?? null,
    objectKey: row.object_key ?? null,
    objectEtag: row.object_etag ?? null,
    viewUrl,
    expiresAt: null,
    mimeType: row.mime_type ?? null,
    filePath: row.file_path ?? null,
    mediaUrl: row.media_url ?? null,
  }
}
